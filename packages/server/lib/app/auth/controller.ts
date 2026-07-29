import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import {
  body,
  controller,
  http,
  pathParam,
  queryParam,
} from "@fastr/controller";
import { Context } from "@fastr/core";
import {
  ApplicationError,
  BadRequestError,
  ForbiddenError,
} from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { randomString, type SessionState } from "@fastr/middleware-session";
import {
  Credential,
  EmailVerification,
  Profile,
  User,
  UserExistsError,
  UserLoginRequest,
} from "@keybr/database";
import { Logger } from "@keybr/logger";
import { type AbstractAdapter } from "@keybr/oauth";
import { UserDataFactory } from "@keybr/result-userdata";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { z } from "zod";
import { Mailer } from "../mail/index.ts";
import {
  messageWithCode,
  messageWithLink,
  messageWithResetLink,
} from "./email.ts";
import { pAdapter } from "./pipe.ts";
import { rateLimit } from "./ratelimit.ts";
import {
  clearFailures,
  recordFailure,
  requireCaptchaIfSuspicious,
} from "./turnstile.ts";
import { type AuthState } from "./types.ts";
import { zod } from "./zod.ts";

const jsonOpts = { maxLength: 4096 };
// Profiles may carry a photo avatar as a data URL, so allow a larger body.
const profileJsonOpts = { maxLength: 3_000_000 };

const MAX_PROFILES_FREE = 4;
const MAX_PROFILES_PREMIUM = 8;

const TProfile = z.object({
  kind: z.enum(["adult", "kid"]),
  firstName: z.string().min(1).max(32),
  lastName: z.string().max(32).optional(),
  birthYear: z.number().int().min(1900).max(2200).nullable().optional(),
  avatar: z.unknown().optional(),
  prefs: z.unknown().optional(),
  parentalConsent: z.boolean().optional(),
});
type TProfile = z.infer<typeof TProfile>;
const PProfile = zod(TProfile, () => {
  throw new ApplicationError("Invalid profile");
});

const TProfilePatch = TProfile.partial();
type TProfilePatch = z.infer<typeof TProfilePatch>;
const PProfilePatch = zod(TProfilePatch, () => {
  throw new ApplicationError("Invalid profile");
});

const MIN_PASSWORD = 8;
// COPPA: children under 13 may not create their own account. Whole years.
const MIN_AGE = 13;

// Age in whole years from an ISO "YYYY-MM-DD" date of birth.
function ageInYears(dob: string, now: Date = new Date()): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = now.getFullYear() - y;
  const months = now.getMonth() + 1 - m;
  if (months < 0 || (months === 0 && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

const TCreateToken = z.object({
  email: z.string().min(1).email(),
});
type TCreateToken = z.infer<typeof TCreateToken>;
const PCreateToken = zod(TCreateToken, () => {
  throw new ApplicationError("Invalid e-mail address");
});

const TRegister = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(MIN_PASSWORD).max(128),
  name: z.string().max(32).optional(),
  // ISO "YYYY-MM-DD"; required so the age gate can run server-side.
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turnstileToken: z.string().max(4096).optional(),
});
type TRegister = z.infer<typeof TRegister>;
const PRegister = zod(TRegister, () => {
  throw new ApplicationError(
    `Enter a valid email, a password of at least ${MIN_PASSWORD} characters, and your date of birth`,
  );
});

const TVerifyEmail = z.object({
  email: z.string().min(1).email(),
  code: z.string().regex(/^\d{6}$/),
});
type TVerifyEmail = z.infer<typeof TVerifyEmail>;
const PVerifyEmail = zod(TVerifyEmail, () => {
  throw new ApplicationError("Enter the 6-digit code from your email");
});

const TResend = z.object({
  email: z.string().min(1).email(),
});
type TResend = z.infer<typeof TResend>;
const PResend = zod(TResend, () => {
  throw new ApplicationError("Invalid e-mail address");
});

const TChangeEmail = z.object({
  email: z.string().min(1).email(),
  password: z.string().max(128).optional(),
  // For accounts without a password: a code sent to the CURRENT email proves
  // the request comes from the account owner, not a hijacked session.
  identityCode: z.string().regex(/^\d{6}$/).optional(),
});
type TChangeEmail = z.infer<typeof TChangeEmail>;
const PChangeEmail = zod(TChangeEmail, () => {
  throw new ApplicationError("Enter a valid e-mail address");
});

const TVerifyCode = z.object({
  code: z.string().regex(/^\d{6}$/),
});
type TVerifyCode = z.infer<typeof TVerifyCode>;
const PVerifyCode = zod(TVerifyCode, () => {
  throw new ApplicationError("Enter the 6-digit code from your email");
});

const TDeleteAccount = z.object({
  code: z.string().regex(/^\d{6}$/),
  // Opt-in: keep anonymised adult typing stats (no personal data) to help
  // improve the app. Never set for child profiles.
  keepStats: z.boolean().optional(),
});
type TDeleteAccount = z.infer<typeof TDeleteAccount>;
const PDeleteAccount = zod(TDeleteAccount, () => {
  throw new ApplicationError("Enter the 6-digit code from your email");
});

const TLogin = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1).max(128),
  // Optional Cloudflare Turnstile token, sent only when the adaptive gate has
  // asked the client for a challenge.
  turnstileToken: z.string().max(4096).optional(),
  // "Keep me signed in" — when false, the session is marked short-lived.
  remember: z.boolean().optional(),
});
type TLogin = z.infer<typeof TLogin>;
const PLogin = zod(TLogin, () => {
  throw new ApplicationError("Invalid email or password");
});

const TForgot = z.object({
  email: z.string().min(1).email(),
  turnstileToken: z.string().max(4096).optional(),
});
type TForgot = z.infer<typeof TForgot>;
const PForgot = zod(TForgot, () => {
  throw new ApplicationError("Invalid e-mail address");
});

const TReset = z.object({
  token: z.string().min(1),
  password: z.string().min(MIN_PASSWORD).max(128),
  turnstileToken: z.string().max(4096).optional(),
});
type TReset = z.infer<typeof TReset>;
const PReset = zod(TReset, () => {
  throw new ApplicationError(
    `Password must be at least ${MIN_PASSWORD} characters`,
  );
});

const TCompleteProfile = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
type TCompleteProfile = z.infer<typeof TCompleteProfile>;
const PCompleteProfile = zod(TCompleteProfile, () => {
  throw new ApplicationError("Enter your date of birth");
});

const TChangePassword = z.object({
  // Absent when the account has no password yet (OAuth-only setting one).
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(MIN_PASSWORD).max(128),
});
type TChangePassword = z.infer<typeof TChangePassword>;
const PChangePassword = zod(TChangePassword, () => {
  throw new ApplicationError(
    `Choose a new password of at least ${MIN_PASSWORD} characters`,
  );
});

const TPatchAccount = z.object({
  anonymized: z.boolean().optional(),
  name: z.string().min(1).max(32).optional(),
});
type TPatchAccount = z.infer<typeof TPatchAccount>;
const PPatchAccount = zod(TPatchAccount, () => {
  throw new ApplicationError("Invalid request");
});

@injectable()
@controller()
export class Controller {
  constructor(
    @inject("canonicalUrl") readonly canonicalUrl: string,
    readonly mailer: Mailer,
    readonly userData: UserDataFactory,
  ) {}

  // Remove a profile's on-disk typing history — its data files, separate from
  // the DB row. Best-effort; a missing file is fine.
  async #deleteProfileData(userId: number, profileId: number): Promise<void> {
    try {
      await this.userData.loadProfile(userId, profileId).delete();
    } catch (err) {
      Logger.warn(err, "Could not delete stats for profile %d", profileId);
    }
  }

  // Issue a fresh verification code for an email and send it. Failing to send
  // is surfaced to the caller so the UI can tell the user to try again.
  async #sendVerificationCode(email: string): Promise<void> {
    const code = await EmailVerification.issue(email);
    try {
      await this.mailer.sendMail(messageWithCode({ email, code }));
    } catch (err: any) {
      Logger.warn(err, "Error sending verification code to '%s'", email);
      throw new ApplicationError("Error sending e-mail message");
    }
  }

  @http.GET({ name: "oauth-init", path: "/auth/oauth-init/{adapter}" })
  async oAuthInit(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("adapter", pAdapter) adapter: AbstractAdapter,
    // "register" only when the visitor came from a "Sign up with …" button;
    // anything else (including a missing value) is treated as a login attempt,
    // which requires an already-registered account.
    @queryParam("intent", zod(z.enum(["login", "register"]).catch("login")))
    intent: "login" | "register",
  ) {
    rateLimit(ctx, "oauth", 30, 60_000);
    const state = randomString(20);
    // PKCE: a per-request verifier kept server-side in the session; only its
    // S256 challenge travels to the provider.
    const codeVerifier = randomString(64);
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    ctx.state.session.start();
    ctx.state.session.set("authState", state);
    ctx.state.session.set("codeVerifier", codeVerifier);
    ctx.state.session.set("oauthIntent", intent);
    ctx.response.redirect(
      adapter.getAuthorizationUrl({ state, codeChallenge }),
    );
  }

  @http.GET({ name: "oauth-callback", path: "/auth/oauth-callback/{adapter}" })
  async oAuthCallback(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("adapter", pAdapter) adapter: AbstractAdapter,
    @queryParam("code", zod(z.string().min(1))) code: string,
    @queryParam("state", zod(z.string().min(1))) state: string,
  ) {
    const authState = ctx.state.session.pull("authState");
    const codeVerifier = ctx.state.session.pull("codeVerifier") as
      | string
      | undefined;
    const intent = ctx.state.session.pull("oauthIntent") as
      | "login"
      | "register"
      | undefined;
    ctx.state.session.destroy();
    if (state === authState) {
      const token = await adapter.getAccessToken({ code, codeVerifier });
      const resourceOwner = await adapter.getProfile(token);
      if (resourceOwner.email != null) {
        const existing = await User.findByEmail(resourceOwner.email);
        // A login (not an explicit "sign up") with no matching account: don't
        // silently create one — send them to register first. Registration is
        // the only path that provisions a new SSO account.
        if (existing == null && intent !== "register") {
          ctx.response.redirect("/register?sso=noaccount");
          return;
        }
        const user = await User.ensure(resourceOwner);
        ctx.state.session.start();
        ctx.state.session.set("userId", user.id!);
        ctx.state.session.set("epoch", user.sessionEpoch ?? 0);
      }
      ctx.response.redirect("/");
    } else {
      throw new BadRequestError();
    }
  }

  @http.POST({ name: "create-token", path: "/auth/login/register-email" })
  async createToken(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PCreateToken, jsonOpts) { email }: TCreateToken,
  ) {
    rateLimit(ctx, "email", 5, 300_000);
    const token = String(await UserLoginRequest.init(email));
    const link = String(
      new URL(ctx.state.router.makePath("login", { token }), this.canonicalUrl),
    );
    try {
      await this.mailer.sendMail(messageWithLink({ email, link }));
    } catch (err: any) {
      Logger.warn(err, "Error sending e-mail message to '%s'", email);
      throw new ApplicationError("Error sending e-mail message");
    }
    ctx.response.body = { email };
  }

  @http.POST({ name: "register-password", path: "/auth/register-password" })
  async registerWithPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PRegister, jsonOpts)
    { email, password, name, dateOfBirth, turnstileToken }: TRegister,
  ) {
    rateLimit(ctx, "register", 10, 60_000);
    await requireCaptchaIfSuspicious(ctx, turnstileToken);
    // COPPA age gate — authoritative check (the client also gates for UX).
    // Under-13s can't own an account; a parent creates it and adds them as a
    // learner profile instead.
    if (ageInYears(dateOfBirth) < MIN_AGE) {
      throw new ForbiddenError(
        "You need to be at least 13 to create an account. Ask a parent or guardian to create one and add you as a learner.",
      );
    }
    ctx.state.session.destroy();
    try {
      await User.registerWithPassword(email, password, name ?? "", dateOfBirth);
    } catch (err) {
      if (err instanceof UserExistsError) {
        throw new ApplicationError(
          "An account with this email already exists. Try logging in instead.",
        );
      }
      throw err;
    }
    // The account exists but isn't usable until the email is verified: email a
    // one-time code and let the client collect it. No session is established
    // here, so an unverified account can't be signed in.
    await this.#sendVerificationCode(email);
    ctx.response.body = { verify: true, email };
  }

  @http.POST({ name: "verify-email", path: "/auth/verify-email" })
  async verifyEmail(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PVerifyEmail, jsonOpts) { email, code }: TVerifyEmail,
  ) {
    rateLimit(ctx, "verify", 20, 300_000);
    const ok = await EmailVerification.verify(email, code);
    if (!ok) {
      throw new ForbiddenError(
        "That code is incorrect or has expired. Request a new one and try again.",
      );
    }
    const user = await User.findByEmail(email);
    if (user == null) {
      throw new ForbiddenError("This account no longer exists");
    }
    await user.$query().patch({ emailVerified: true });
    ctx.state.session.destroy();
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.state.session.set("epoch", user.sessionEpoch ?? 0);
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "resend-code", path: "/auth/resend-code" })
  async resendCode(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PResend, jsonOpts) { email }: TResend,
  ) {
    rateLimit(ctx, "email", 5, 300_000);
    // Only send to accounts that exist and still need verifying, but always
    // answer the same way so the endpoint can't probe for registered emails.
    const user = await User.findByEmail(email);
    if (user != null && !user.emailVerified) {
      await this.#sendVerificationCode(email);
    }
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "login-password", path: "/auth/login-password" })
  async loginWithPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PLogin, jsonOpts)
    { email, password, turnstileToken, remember }: TLogin,
  ) {
    rateLimit(ctx, "login", 20, 60_000);
    // Adaptive CAPTCHA: after several failures from this IP, a challenge must
    // be solved before we even check the password.
    await requireCaptchaIfSuspicious(ctx, turnstileToken);
    const user = await User.loginWithPassword(email, password);
    if (user == null) {
      recordFailure(ctx);
      // One message for both cases — never reveal whether the email exists.
      throw new ForbiddenError("Invalid email or password");
    }
    clearFailures(ctx);
    // A correct password but an unverified email (they abandoned sign-up before
    // entering the code): don't sign them in — reissue a code and route them
    // back to the verification step so they can finish.
    if (!user.emailVerified) {
      await this.#sendVerificationCode(email);
      ctx.response.body = { verify: true, email };
      return;
    }
    ctx.state.session.destroy();
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.state.session.set("epoch", user.sessionEpoch ?? 0);
    // Shared/family device: mark the session short-lived so it lapses in a day.
    if (remember === false) {
      ctx.state.session.set("shortLived", true);
      ctx.state.session.set("loginAt", Date.now());
    }
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "forgot-password", path: "/auth/forgot-password" })
  async forgotPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PForgot, jsonOpts) { email, turnstileToken }: TForgot,
  ) {
    rateLimit(ctx, "email", 5, 300_000);
    await requireCaptchaIfSuspicious(ctx, turnstileToken);
    // Only send a link to accounts that actually exist, but always answer the
    // same way so the endpoint can't be used to probe for registered emails.
    const user = await User.findByEmail(email);
    if (user != null) {
      const token = String(await UserLoginRequest.init(email));
      const link = String(
        new URL(`/reset-password/${token}`, this.canonicalUrl),
      );
      try {
        await this.mailer.sendMail(messageWithResetLink({ email, link }));
      } catch (err: any) {
        Logger.warn(err, "Error sending reset e-mail to '%s'", email);
      }
    }
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "reset-password", path: "/auth/reset-password" })
  async resetPassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PReset, jsonOpts) { token, password, turnstileToken }: TReset,
  ) {
    rateLimit(ctx, "reset", 20, 300_000);
    await requireCaptchaIfSuspicious(ctx, turnstileToken);
    const email = await UserLoginRequest.consume(token);
    if (email == null) {
      recordFailure(ctx);
      throw new ForbiddenError("This reset link has expired or is invalid");
    }
    const user = await User.findByEmail(email);
    if (user == null) {
      recordFailure(ctx);
      throw new ForbiddenError("This reset link has expired or is invalid");
    }
    clearFailures(ctx);
    await user.setPassword(password);
    // Recovery should also lock out anyone else: bump the epoch to invalidate
    // every existing session, then stamp this new one with the fresh epoch.
    const epoch = (user.sessionEpoch ?? 0) + 1;
    await user.$query().patch({ sessionEpoch: epoch });
    ctx.state.session.destroy();
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.state.session.set("epoch", epoch);
    ctx.response.body = { ok: true };
  }

  @http.GET({ name: "login", path: "/login/{token}" })
  async loginWithToken(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("token", zod(z.string().min(1))) token: string,
  ) {
    ctx.state.session.destroy();
    const user = await UserLoginRequest.login(token);
    if (user != null) {
      ctx.state.session.start();
      ctx.state.session.set("userId", user.id!);
      ctx.state.session.set("epoch", user.sessionEpoch ?? 0);
      ctx.response.redirect("/");
    } else {
      throw new ForbiddenError("Invalid login link", {
        description:
          "The login link that you are currently using is either expired or invalid. " +
          "Please enter your e-mail address again to receive a new login link. " +
          "Don’t worry, your account is safe! " +
          "You likely got here because you used an old link that does not work anymore.",
      });
    }
  }

  @http.GET({ name: "logout", path: "/auth/logout" })
  async logout(ctx: Context<RouterState & SessionState & AuthState>) {
    ctx.state.session.destroy();
    ctx.response.redirect("/");
  }

  // Collects the date of birth for accounts that don't have one yet — chiefly
  // OAuth sign-ups, which never see the register form. Enforces the same age
  // gate: an under-13 owner isn't allowed, so we delete the just-created
  // account rather than keep a child's data.
  @http.POST({ name: "complete-profile", path: "/auth/complete-profile" })
  async completeProfile(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PCompleteProfile, jsonOpts) { dateOfBirth }: TCompleteProfile,
  ) {
    const user = ctx.state.requireUser();
    if (ageInYears(dateOfBirth) < MIN_AGE) {
      await user.$query().delete();
      ctx.state.session.destroy();
      throw new ForbiddenError(
        "You need to be at least 13 to have an account. Ask a parent or guardian to create one and add you as a learner.",
      );
    }
    await user.$query().patch({ dateOfBirth });
    ctx.response.body = { ok: true };
  }

  @http.PATCH({ name: "patch-account", path: "/_/account" })
  async patchAccount(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PPatchAccount, jsonOpts) { anonymized, name }: TPatchAccount,
  ) {
    const user = ctx.state.requireUser();
    const patch: Record<string, unknown> = {};
    if (anonymized !== undefined) {
      patch.anonymized = Number(anonymized);
    }
    if (name !== undefined && name !== user.name) {
      // Names are unique across accounts.
      if (await User.nameExists(user.email!, name)) {
        throw new ApplicationError("That name is already taken.");
      }
      patch.name = name;
    }
    if (Object.keys(patch).length > 0) {
      await user.$query().patch(patch);
    }
    const result = await User.findById(user.id!);
    if (result == null) {
      throw new ForbiddenError();
    }
    ctx.response.body = {
      user: result.toDetails(),
      publicUser: User.toPublicUser(result, 0),
    };
  }

  // Send a 6-digit code to the registered email — the confirmation step for
  // permanently deleting the account.
  @http.POST({ name: "delete-account-code", path: "/_/account/delete-code" })
  async deleteAccountCode(
    ctx: Context<RouterState & SessionState & AuthState>,
  ) {
    const user = ctx.state.requireUser();
    if (user.email == null) {
      throw new ApplicationError("Your account has no email address.");
    }
    rateLimit(ctx, "email", 5, 300_000);
    await this.#sendVerificationCode(user.email);
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "delete-account", path: "/_/account/delete" })
  async deleteAccount(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PDeleteAccount, jsonOpts) { code, keepStats }: TDeleteAccount,
  ) {
    const user = ctx.state.requireUser();
    // Confirm the request with a code sent to the registered email.
    if (user.email != null) {
      const ok = await EmailVerification.verify(user.email, code);
      if (!ok) {
        throw new ForbiddenError(
          "That confirmation code is incorrect or has expired.",
        );
      }
    }
    const profiles = await Profile.listForUser(user.id!);
    // Opt-in: keep anonymised ADULT stats (identifiers stripped) before the
    // data is erased. Best-effort — never blocks the deletion.
    if (keepStats === true) {
      await this.#retainAnonymizedStats(user.id!, profiles).catch((err) => {
        Logger.warn(err, "Could not retain anonymized stats");
      });
    }
    // Delete each profile's data files, then the profile rows, then the
    // account — so no learner data (including a child's) is left behind,
    // regardless of DB foreign-key support.
    for (const profile of profiles) {
      await this.#deleteProfileData(user.id!, profile.id!);
    }
    await Profile.query().where("userId", user.id!).delete();
    await user.$query().delete();
    ctx.state.session.destroy();
    ctx.response.body = { ok: true };
  }

  // Append each ADULT profile's typing results — stripped to anonymous metrics
  // (no name, email, user/profile id) — to a shared JSONL sink. Child profiles
  // are never included.
  async #retainAnonymizedStats(
    userId: number,
    profiles: readonly Profile[],
  ): Promise<void> {
    const adults = profiles.filter((profile) => profile.kind === "adult");
    if (adults.length === 0) {
      return;
    }
    const lines: string[] = [];
    for (const profile of adults) {
      const store = this.userData.loadProfile(userId, profile.id!);
      if (!(await store.exists())) {
        continue;
      }
      for await (const result of store.read()) {
        // Result.toJSON() carries only typing metrics — no personal data.
        lines.push(JSON.stringify(result.toJSON()));
      }
    }
    if (lines.length === 0) {
      return;
    }
    const file = this.userData.dataDir.dataPath("anonymous-stats.jsonl");
    await appendFile(file, lines.join("\n") + "\n", "utf8");
  }

  @http.POST({
    name: "sign-out-everywhere",
    path: "/_/account/sign-out-everywhere",
  })
  async signOutEverywhere(
    ctx: Context<RouterState & SessionState & AuthState>,
  ) {
    const user = ctx.state.requireUser();
    // Bumping the epoch invalidates every session issued before now (they'll be
    // rejected by loadUser); re-stamp THIS session so the current device stays.
    const epoch = (user.sessionEpoch ?? 0) + 1;
    await user.$query().patch({ sessionEpoch: epoch });
    ctx.state.session.set("epoch", epoch);
    ctx.response.status = 204;
  }

  @http.POST({ name: "change-password", path: "/auth/change-password" })
  async changePassword(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PChangePassword, jsonOpts)
    { currentPassword, newPassword }: TChangePassword,
  ) {
    rateLimit(ctx, "password", 10, 300_000);
    const user = ctx.state.requireUser();
    // If a password is already set, the current one must be proven.
    if (user.passwordHash != null) {
      const ok =
        currentPassword != null &&
        (await User.loginWithPassword(user.email!, currentPassword)) != null;
      if (!ok) {
        throw new ForbiddenError("Your current password is incorrect");
      }
    }
    await user.setPassword(newPassword);
    // Changing the password signs out every other device; re-stamp this session
    // so the current device stays in.
    const epoch = (user.sessionEpoch ?? 0) + 1;
    await user.$query().patch({ sessionEpoch: epoch });
    ctx.state.session.set("epoch", epoch);
    ctx.response.body = { ok: true };
  }

  // ---- Change email (with re-verification) ----

  // Send a verification code to the account's CURRENT email — the identity
  // step for password-less (SSO) accounts changing their email.
  @http.POST({
    name: "change-email-identity",
    path: "/auth/change-email/identity-code",
  })
  async changeEmailIdentityCode(
    ctx: Context<RouterState & SessionState & AuthState>,
  ) {
    rateLimit(ctx, "email", 5, 300_000);
    const user = ctx.state.requireUser();
    if (user.email == null) {
      throw new ApplicationError("Your account has no email address.");
    }
    await this.#sendVerificationCode(user.email);
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "change-email", path: "/auth/change-email" })
  async changeEmail(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PChangeEmail, jsonOpts)
    { email, password, identityCode }: TChangeEmail,
  ) {
    rateLimit(ctx, "email", 5, 300_000);
    const user = ctx.state.requireUser();
    // Prove the request comes from the account owner before changing the email.
    if (user.passwordHash != null) {
      // Password accounts: the current password.
      const ok =
        password != null &&
        (await User.loginWithPassword(user.email!, password)) != null;
      if (!ok) {
        throw new ForbiddenError("Your password is incorrect");
      }
    } else {
      // Password-less (SSO) accounts: a code sent to the current email.
      const ok =
        identityCode != null &&
        (await EmailVerification.verify(user.email!, identityCode));
      if (!ok) {
        throw new ForbiddenError(
          "That confirmation code is incorrect or has expired.",
        );
      }
    }
    if (email === user.email) {
      throw new ApplicationError("That's already your email address.");
    }
    if ((await User.findByEmail(email)) != null) {
      throw new ApplicationError("That email address is already in use.");
    }
    // Prove control of the NEW address before switching to it.
    await this.#sendVerificationCode(email);
    ctx.state.session.set("pendingEmail", email);
    ctx.response.body = { ok: true };
  }

  @http.POST({ name: "verify-email-change", path: "/auth/verify-email-change" })
  async verifyEmailChange(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PVerifyCode, jsonOpts) { code }: TVerifyCode,
  ) {
    rateLimit(ctx, "verify", 20, 300_000);
    const user = ctx.state.requireUser();
    const pending = ctx.state.session.get("pendingEmail") as string | undefined;
    if (pending == null) {
      throw new ForbiddenError("Start the email change again.");
    }
    const ok = await EmailVerification.verify(pending, code);
    if (!ok) {
      throw new ForbiddenError(
        "That code is incorrect or has expired. Request a new one and try again.",
      );
    }
    // Re-check availability at commit time in case it was taken meanwhile.
    if ((await User.findByEmail(pending)) != null) {
      ctx.state.session.delete("pendingEmail");
      throw new ApplicationError("That email address is now in use.");
    }
    await user.$query().patch({ email: pending, emailVerified: true });
    ctx.state.session.delete("pendingEmail");
    ctx.response.body = { ok: true, email: pending };
  }

  // ---- Passkeys (WebAuthn) ----

  // Relying-party config derived from the app URL. rpID is the bare hostname,
  // origin is the full scheme://host[:port].
  #rp(): { rpID: string; rpName: string; origin: string } {
    const url = new URL(this.canonicalUrl);
    return { rpID: url.hostname, rpName: "KeyLearn", origin: url.origin };
  }

  @http.POST({
    name: "passkey-register-options",
    path: "/auth/passkey/register-options",
  })
  async passkeyRegisterOptions(
    ctx: Context<RouterState & SessionState & AuthState>,
  ) {
    const user = ctx.state.requireUser();
    const { rpID, rpName } = this.#rp();
    const existing = await Credential.listForUser(user.id!);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email!,
      userID: new TextEncoder().encode(String(user.id)),
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId!,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
    ctx.state.session.set("passkeyChallenge", options.challenge);
    ctx.response.body = options;
  }

  @http.POST({
    name: "passkey-register-verify",
    path: "/auth/passkey/register-verify",
  })
  async passkeyRegisterVerify(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(null, { maxLength: 65536 }) data: any,
  ) {
    const user = ctx.state.requireUser();
    const { rpID, origin } = this.#rp();
    const expectedChallenge = ctx.state.session.pull("passkeyChallenge") as
      | string
      | undefined;
    if (expectedChallenge == null) {
      throw new BadRequestError();
    }
    const verification = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!verification.verified || verification.registrationInfo == null) {
      throw new BadRequestError("Passkey could not be verified");
    }
    const cred = verification.registrationInfo.credential;
    await Credential.query().insert({
      userId: user.id!,
      credentialId: cred.id,
      publicKey: Buffer.from(cred.publicKey).toString("base64"),
      counter: cred.counter,
      transports: cred.transports ? JSON.stringify(cred.transports) : null,
      name: (typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : "Passkey"
      ).slice(0, 64),
    });
    ctx.response.body = { ok: true };
  }

  @http.POST({
    name: "passkey-login-options",
    path: "/auth/passkey/login-options",
  })
  async passkeyLoginOptions(
    ctx: Context<RouterState & SessionState & AuthState>,
  ) {
    rateLimit(ctx, "passkey", 30, 60_000);
    const { rpID } = this.#rp();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });
    // A fresh session holds the challenge across the round-trip for the
    // (still anonymous) visitor.
    ctx.state.session.start();
    ctx.state.session.set("passkeyChallenge", options.challenge);
    ctx.response.body = options;
  }

  @http.POST({
    name: "passkey-login-verify",
    path: "/auth/passkey/login-verify",
  })
  async passkeyLoginVerify(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(null, { maxLength: 65536 }) response: any,
  ) {
    rateLimit(ctx, "passkey", 30, 60_000);
    const { rpID, origin } = this.#rp();
    const expectedChallenge = ctx.state.session.pull("passkeyChallenge") as
      | string
      | undefined;
    const cred = await Credential.findByCredentialId(String(response?.id));
    if (expectedChallenge == null || cred == null) {
      throw new ForbiddenError();
    }
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId!,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey!, "base64")),
        counter: cred.counter ?? 0,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      },
    });
    if (!verification.verified) {
      throw new ForbiddenError();
    }
    await cred
      .$query()
      .patch({ counter: verification.authenticationInfo.newCounter });
    const user = await User.findById(cred.userId!);
    if (user == null) {
      throw new ForbiddenError();
    }
    ctx.state.session.destroy();
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.state.session.set("epoch", user.sessionEpoch ?? 0);
    ctx.response.body = { ok: true };
  }

  @http.GET({ name: "list-passkeys", path: "/_/passkeys" })
  async listPasskeys(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    ctx.response.body = {
      passkeys: (await Credential.listForUser(user.id!)).map((c) =>
        c.toDetails(),
      ),
    };
  }

  @http.DELETE({ name: "delete-passkey", path: "/_/passkeys/{id:[0-9]+}" })
  async deletePasskey(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id") id: string,
  ) {
    const user = ctx.state.requireUser();
    const cred = await Credential.query().findOne({
      id: Number(id),
      userId: user.id!,
    });
    if (cred == null) {
      throw new ForbiddenError();
    }
    await cred.$query().delete();
    ctx.response.body = {
      passkeys: (await Credential.listForUser(user.id!)).map((c) =>
        c.toDetails(),
      ),
    };
  }

  // ---- Household profiles (server-side, owned by the account) ----

  @http.GET({ name: "list-profiles", path: "/_/profiles" })
  async listProfiles(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    ctx.response.body = { profiles: await profileList(user.id!) };
  }

  @http.POST({ name: "create-profile", path: "/_/profiles" })
  async createProfile(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PProfile, profileJsonOpts) data: TProfile,
  ) {
    const user = ctx.state.requireUser();
    // COPPA: a child profile can't be created without the grown-up's consent.
    if (data.kind === "kid" && data.parentalConsent !== true) {
      throw new ApplicationError(
        "Parental consent is required to create a child profile.",
      );
    }
    const cap =
      user.order != null ? MAX_PROFILES_PREMIUM : MAX_PROFILES_FREE;
    const count = await Profile.query().where("userId", user.id!).resultSize();
    if (count >= cap) {
      throw new ApplicationError(`You can have at most ${cap} profiles.`);
    }
    const consented = data.kind === "kid";
    await Profile.query().insert({
      userId: user.id!,
      kind: data.kind,
      firstName: data.firstName,
      lastName: data.lastName || null,
      birthYear: data.birthYear ?? null,
      avatar: data.avatar != null ? JSON.stringify(data.avatar) : null,
      prefs: data.prefs != null ? JSON.stringify(data.prefs) : null,
      parentalConsent: consented,
      consentAt: consented ? new Date() : null,
    });
    ctx.response.body = { profiles: await profileList(user.id!) };
  }

  @http.PATCH({ name: "update-profile", path: "/_/profiles/{id:[0-9]+}" })
  async updateProfile(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id") id: string,
    @body.json(PProfilePatch, profileJsonOpts) data: TProfilePatch,
  ) {
    const user = ctx.state.requireUser();
    const profile = await Profile.findOwned(user.id!, Number(id));
    if (profile == null) {
      throw new ForbiddenError();
    }
    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch.firstName = data.firstName;
    if (data.lastName !== undefined) patch.lastName = data.lastName || null;
    if (data.birthYear !== undefined) patch.birthYear = data.birthYear ?? null;
    if (data.avatar !== undefined) {
      patch.avatar = data.avatar != null ? JSON.stringify(data.avatar) : null;
    }
    if (data.prefs !== undefined) {
      patch.prefs = data.prefs != null ? JSON.stringify(data.prefs) : null;
    }
    await profile.$query().patch(patch);
    ctx.response.body = { profiles: await profileList(user.id!) };
  }

  @http.DELETE({ name: "delete-profile", path: "/_/profiles/{id:[0-9]+}" })
  async deleteProfile(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id") id: string,
  ) {
    const user = ctx.state.requireUser();
    const profile = await Profile.findOwned(user.id!, Number(id));
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.#deleteProfileData(user.id!, profile.id!);
    await profile.$query().delete();
    ctx.response.body = { profiles: await profileList(user.id!) };
  }
}

async function profileList(userId: number) {
  return (await Profile.listForUser(userId)).map((p) => p.toDetails());
}
