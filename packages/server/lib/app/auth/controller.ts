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
  generateRecoveryCodes,
  generateTotpSecret,
  Profile,
  SecurityEvent,
  type SecurityEventType,
  totpUri,
  User,
  UserExistsError,
  UserExternalId,
  UserLoginRequest,
  type VerificationPurpose,
  verifyTotp,
} from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { type AbstractAdapter } from "@keylearn/oauth";
import {
  countPlaces,
  PLACES_BRAILLE,
  sightedPlaces,
} from "@keylearn/pages-shared";
import { PublicId } from "@keylearn/publicid";
import { UserDataFactory } from "@keylearn/result-userdata";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { z } from "zod";
import { Mailer, Notifier } from "../mail/index.ts";
import { isBreached } from "./breached.ts";
import {
  messageWithCode,
  messageWithLink,
  messageWithResetLink,
} from "./email.ts";
import { pAdapter } from "./pipe.ts";
import { clientIp, rateLimit } from "./ratelimit.ts";
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

// A photo avatar is produced by the client as canvas.toDataURL("image/jpeg"),
// and its `dataUrl` is rendered straight into an <img src>. Accepting an
// arbitrary string there would let a profile point at a remote URL (a tracking
// beacon inside a children's app) or a `javascript:` URL, leaving the app
// relying on React's URL handling rather than its own validation. So constrain
// it to an inline image and nothing else.
const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
// ~1.5 MB of base64 ≈ 1.1 MB of image, comfortably above what the client's
// downscaled JPEG produces.
const MAX_DATA_URL = 1_500_000;

const TAvatar = z.union([
  z.object({
    type: z.literal("icon"),
    // Matched against a fixed preset table on render; keep it to a plain slug.
    id: z
      .string()
      .max(32)
      .regex(/^[a-z0-9-]*$/),
  }),
  z.object({
    type: z.literal("photo"),
    dataUrl: z.string().max(MAX_DATA_URL).regex(DATA_URL),
  }),
]);

// Per-profile UI preferences. Bounded so a profile row cannot become a
// megabyte-scale arbitrary blob.
const TPrefs = z.record(
  z.string().max(48),
  z.union([z.string().max(256), z.number(), z.boolean(), z.null()]),
);

const TProfile = z.object({
  kind: z.enum(["adult", "kid"]),
  firstName: z.string().min(1).max(32),
  lastName: z.string().max(32).optional(),
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(2200)
    // Five is the app's minimum age; the client says it kindly, this makes
    // sure it stays true whatever posts the form.
    .refine((year) => new Date().getFullYear() - year >= 5, {
      message: "KeyLearn is designed for learners aged 5 and up",
    })
    .nullable()
    .optional(),
  avatar: TAvatar.nullable().optional(),
  prefs: TPrefs.nullable().optional(),
  visionSupport: z.boolean().optional(),
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

// How long a proved grown-up PIN stands before it is asked for again. Long
// enough to manage several profiles in one sitting, short enough that a tablet
// left unattended does not stay unlocked.
const PARENT_PIN_TTL_MS = 15 * 60 * 1000;

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
  // Both required. The account holder's real name seeds their learner profile,
  // and a household of "Me" and "Me 2" is no use to anyone.
  firstName: z.string().trim().min(1).max(32),
  lastName: z.string().trim().min(1).max(32),
  // ISO "YYYY-MM-DD"; required so the age gate can run server-side.
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turnstileToken: z.string().max(4096).optional(),
});
type TRegister = z.infer<typeof TRegister>;
const PRegister = zod(TRegister, () => {
  throw new ApplicationError(
    `Enter your name, a valid email, a password of at least ${MIN_PASSWORD} characters, and your date of birth`,
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
  identityCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
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

const TLookup = z.object({
  email: z.string().min(1).email(),
  turnstileToken: z.string().max(4096).optional(),
});
type TLookup = z.infer<typeof TLookup>;
const PLookup = zod(TLookup, () => {
  throw new ApplicationError("Enter a valid e-mail address");
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

const TTwoFactorEnable = z.object({
  code: z.string().regex(/^\d{6}$/),
});
type TTwoFactorEnable = z.infer<typeof TTwoFactorEnable>;
const PTwoFactorEnable = zod(TTwoFactorEnable, () => {
  throw new ApplicationError("Enter the 6-digit code from your app");
});

const TTwoFactorDisable = z.object({
  // Proof of possession: the current password, or a live code.
  password: z.string().max(128).optional(),
  code: z.string().max(32).optional(),
});
type TTwoFactorDisable = z.infer<typeof TTwoFactorDisable>;
const PTwoFactorDisable = zod(TTwoFactorDisable, () => {
  throw new ApplicationError("Invalid request");
});

const TTwoFactorLogin = z.object({
  // Either a 6-digit app code or a recovery code.
  code: z.string().min(6).max(32),
});
type TTwoFactorLogin = z.infer<typeof TTwoFactorLogin>;
const PTwoFactorLogin = zod(TTwoFactorLogin, () => {
  throw new ApplicationError("Enter the 6-digit code from your app");
});

const TParentPin = z.object({
  // 4-8 digits: long enough not to be guessed over a child's shoulder in a few
  // tries (attempts are rate-limited), short enough to be remembered.
  pin: z
    .string()
    .regex(/^\d{4,8}$/)
    .nullable(),
  // Proof this is the account owner and not whoever is holding the tablet.
  password: z.string().max(128).optional(),
  currentPin: z.string().max(16).optional(),
});
type TParentPin = z.infer<typeof TParentPin>;
const PParentPin = zod(TParentPin, () => {
  throw new ApplicationError("Choose a PIN of 4 to 8 digits");
});

const TVerifyPin = z.object({
  pin: z.string().max(16),
});
type TVerifyPin = z.infer<typeof TVerifyPin>;
const PVerifyPin = zod(TVerifyPin, () => {
  throw new ApplicationError("Enter the grown-up PIN");
});

const TPatchAccount = z.object({
  anonymized: z.boolean().optional(),
  publicProfile: z.boolean().optional(),
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
    readonly notifier: Notifier,
    readonly userData: UserDataFactory,
  ) {}

  // Tell the account holder that something changed. Always sent — the point of
  // the notice is to reach someone who did NOT do it.
  #alert(ctx: Context<any>, user: User, event: string): void {
    this.notifier.securityAlert(user, event, {
      ip: clientIp(ctx),
      device: ctx.request.headers.get("user-agent"),
    });
  }

  // Record a security-relevant event against the current request. Best-effort:
  // SecurityEvent.record swallows its own failures, so this can never turn a
  // successful action into a failed one.
  #audit(
    ctx: Context<any>,
    type: SecurityEventType,
    userId: number | null,
    detail: string | null = null,
  ): void {
    void SecurityEvent.record({
      userId,
      type,
      ip: clientIp(ctx),
      userAgent: ctx.request.headers.get("user-agent"),
      detail,
    });
  }

  // Profile management is a grown-up action. When the household has set a PIN,
  // the browser must have proved it recently — checked HERE, on the server,
  // because the on-screen gate is only a speed bump and a curious child with
  // devtools (or a direct fetch) walks straight past it.
  #requireParentPin(ctx: Context<SessionState & AuthState>, user: User): void {
    if (user.parentPinHash == null) {
      return;
    }
    const at = Number(ctx.state.session.get("parentPinAt") ?? 0);
    if (at === 0 || Date.now() - at > PARENT_PIN_TTL_MS) {
      throw new ApplicationError("Enter the grown-up PIN to continue.", {
        status: 428,
        body: { error: { message: "Grown-up PIN required", parentPin: true } },
      });
    }
  }

  // Remove a profile's on-disk typing history — its data files, separate from
  // the DB row. Best-effort; a missing file is fine.
  async #deleteProfileData(userId: number, profileId: number): Promise<void> {
    try {
      await this.userData.loadProfile(userId, profileId).delete();
    } catch (err: any) {
      Logger.warn(err, "Could not delete stats for profile %d", profileId);
    }
  }

  // Issue a fresh verification code for an email and send it. Failing to send
  // is surfaced to the caller so the UI can tell the user to try again.
  async #sendVerificationCode(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<void> {
    const code = await EmailVerification.issue(email, purpose);
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
  ) {
    const query = ctx.request.query;
    const code = query.get("code");
    const state = query.get("state");
    const error = query.get("error");
    const authState = ctx.state.session.pull("authState") as string | null;
    const codeVerifier = ctx.state.session.pull("codeVerifier") as
      | string
      | null;
    const intent = ctx.state.session.pull("oauthIntent") as
      | "login"
      | "register"
      | undefined;
    ctx.state.session.destroy();

    // Declining is a normal thing to do. Send them back to sign-in rather than
    // showing an error page for a choice they made deliberately.
    if (error != null || code == null) {
      ctx.response.redirect("/login?sso=cancelled");
      return;
    }

    // The state has to exist as well as match. `pull` returns null for a key
    // that was never set, and `query.get` returns null for a parameter that was
    // never sent — so a bare `state === authState` is satisfied by null === null
    // for any browser with no OAuth flow in progress. That is login CSRF: a
    // third party redeems an authorization code they obtained for their own
    // provider account inside somebody else's browser, and that browser is then
    // signed in as them, quietly recording whatever the victim does next.
    if (
      typeof authState === "string" &&
      authState !== "" &&
      state === authState &&
      typeof codeVerifier === "string" &&
      codeVerifier !== ""
    ) {
      const token = await adapter.getAccessToken({ code, codeVerifier });
      const resourceOwner = await adapter.getProfile(token);
      if (resourceOwner.email != null) {
        // A login (not an explicit "sign up") that matches no account and no
        // known provider identity: don't silently create one — send them to
        // register first. Registration is the only path that provisions a new
        // SSO account.
        if (intent !== "register") {
          const known =
            (await UserExternalId.findBySubject(
              resourceOwner.provider,
              resourceOwner.id,
            )) != null || (await User.findByEmail(resourceOwner.email)) != null;
          if (!known) {
            ctx.response.redirect("/register?sso=noaccount");
            return;
          }
        }
        const result = await User.ensure(resourceOwner);
        switch (result.kind) {
          case "link-required":
            this.#audit(ctx, "sso-link-refused", null, resourceOwner.provider);
            // An account already holds this address but the provider never
            // verified it, so we will not hand over the account. Ask the owner
            // to sign in the way they registered and link from there.
            ctx.response.redirect("/login?sso=linkrequired");
            return;
          case "verify":
            // A fresh account from an address nobody vouched for: make them
            // prove the mailbox before it becomes usable. No session yet.
            await this.#sendVerificationCode(
              result.email,
              "verify-email",
            ).catch((err: any) => {
              Logger.warn(err, "Could not send SSO verification code");
            });
            ctx.response.redirect(
              `/login?sso=verify&email=${encodeURIComponent(result.email)}`,
            );
            return;
          case "ok":
            ctx.state.session.start();
            ctx.state.session.set("userId", result.user.id!);
            ctx.state.session.set("epoch", result.user.sessionEpoch ?? 0);
            this.#audit(ctx, "login", result.user.id!, resourceOwner.provider);
            break;
        }
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
    const token = String(await UserLoginRequest.init(email, "login"));
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
    {
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      turnstileToken,
    }: TRegister,
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
    if (await isBreached(password)) {
      throw new ApplicationError(
        "That password has appeared in a public data breach. Please pick a different one.",
      );
    }
    ctx.state.session.destroy();
    try {
      await User.registerWithPassword(
        email,
        password,
        firstName,
        lastName,
        dateOfBirth,
      );
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
    await this.#sendVerificationCode(email, "verify-email");
    ctx.response.body = { verify: true, email };
  }

  @http.POST({ name: "verify-email", path: "/auth/verify-email" })
  async verifyEmail(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PVerifyEmail, jsonOpts) { email, code }: TVerifyEmail,
  ) {
    rateLimit(ctx, "verify", 20, 300_000);
    const ok = await EmailVerification.verify(email, "verify-email", code);
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
    // Completing sign-up also signs you in, so it belongs in the trail.
    this.#audit(ctx, "login", user.id!, "sign-up");
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
      await this.#sendVerificationCode(email, "verify-email");
    }
    ctx.response.body = { ok: true };
  }

  /**
   * What to ask this address for next: a password, a second factor, a
   * sign-in provider, or an invitation to register.
   *
   * This DOES tell a caller whether an address has an account — a deliberate
   * trade for the far better sign-in flow, and the same one Google and most
   * consumer apps make. It is why the endpoint is rate-limited per address as
   * well as per client, and why it is behind the adaptive CAPTCHA: the answer is
   * cheap for one address a person actually owns, and expensive at the scale
   * enumeration would need.
   */
  @http.POST({ name: "lookup", path: "/auth/lookup" })
  async lookup(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PLookup, jsonOpts) { email, turnstileToken }: TLookup,
  ) {
    rateLimit(ctx, "lookup", 30, 300_000);
    await requireCaptchaIfSuspicious(ctx, turnstileToken);

    const user = await User.findByEmail(email);
    if (user == null) {
      recordFailure(ctx);
      ctx.response.body = { exists: false };
      return;
    }
    ctx.response.body = {
      exists: true,
      hasPassword: user.passwordHash != null,
      twoFactor: Boolean(user.totpEnabled),
      // Which buttons to highlight, so someone who signed up with Google is
      // pointed back at Google rather than at a password they never set.
      providers: (user.externalIds ?? []).map((x) => x.provider),
    };
    ctx.response.headers.set("Cache-Control", "private, no-store");
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
      // Recorded against the account when the address is known, so the owner
      // can see attempts against them even though the attempt failed.
      const target = await User.findByEmail(email);
      this.#audit(ctx, "login-failed", target?.id ?? null, "password");
      // One message for both cases — never reveal whether the email exists.
      throw new ForbiddenError("Invalid email or password");
    }
    clearFailures(ctx);
    // A correct password but an unverified email (they abandoned sign-up before
    // entering the code): don't sign them in — reissue a code and route them
    // back to the verification step so they can finish.
    if (!user.emailVerified) {
      await this.#sendVerificationCode(email, "verify-email");
      ctx.response.body = { verify: true, email };
      return;
    }
    ctx.state.session.destroy();
    ctx.state.session.start();
    // Two-step verification: the password is only the first factor, so the
    // session is marked PENDING rather than signed in. `loadUser` refuses to
    // resolve a pending session to a user, so nothing is reachable until the
    // second factor is supplied.
    if (user.totpEnabled) {
      ctx.state.session.set("pending2faUserId", user.id!);
      ctx.state.session.set("pending2faAt", Date.now());
      if (remember === false) {
        ctx.state.session.set("shortLived", true);
      }
      ctx.response.body = { twoFactor: true };
      return;
    }
    ctx.state.session.set("userId", user.id!);
    ctx.state.session.set("epoch", user.sessionEpoch ?? 0);
    this.#audit(ctx, "login", user.id!, "password");
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
      const token = String(await UserLoginRequest.init(email, "reset"));
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
    if (await isBreached(password)) {
      throw new ApplicationError(
        "That password has appeared in a public data breach. Please pick a different one.",
      );
    }
    await user.setPassword(password);
    this.#audit(ctx, "password-reset", user.id!);
    this.#alert(ctx, user, "Your password was reset");
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

  // POST, not GET: `SameSite=Lax` sends the session cookie on top-level GET
  // navigations, so a GET logout can be triggered by any page that embeds a
  // link or image pointing at it.
  @http.POST({ name: "logout", path: "/auth/logout" })
  async logout(ctx: Context<RouterState & SessionState & AuthState>) {
    ctx.state.session.destroy();
    ctx.response.body = { ok: true };
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
    @body.json(PPatchAccount, jsonOpts)
    { anonymized, publicProfile, name }: TPatchAccount,
  ) {
    const user = ctx.state.requireUser();
    const patch: Record<string, unknown> = {};
    if (anonymized !== undefined) {
      patch.anonymized = Number(anonymized);
    }
    if (publicProfile !== undefined) {
      patch.publicProfile = Number(publicProfile);
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
    await this.#sendVerificationCode(user.email, "delete-account");
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
      const ok = await EmailVerification.verify(
        user.email,
        "delete-account",
        code,
      );
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
    // The trail goes with the account: keeping it would retain personal data
    // (addresses, device strings) about someone who asked to be erased.
    await SecurityEvent.deleteForUser(user.id!);
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
    this.#audit(ctx, "signed-out-everywhere", user.id!);
    this.#alert(ctx, user, "You were signed out of all devices");
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
    if (await isBreached(newPassword)) {
      throw new ApplicationError(
        "That password has appeared in a public data breach. Please pick a different one.",
      );
    }
    await user.setPassword(newPassword);
    this.#audit(ctx, "password-changed", user.id!);
    this.#alert(ctx, user, "Your password was changed");
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
    await this.#sendVerificationCode(user.email, "identity");
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
        (await EmailVerification.verify(user.email!, "identity", identityCode));
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
    await this.#sendVerificationCode(email, "change-email");
    this.#audit(ctx, "email-change-requested", user.id!, email);
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
    const ok = await EmailVerification.verify(pending, "change-email", code);
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
    // Sent to the OLD address as well as recorded — otherwise the one person
    // who needs to know an address was taken over never hears about it.
    this.#alert(ctx, user, "Your email address was changed");
    await user.$query().patch({ email: pending, emailVerified: true });
    this.#audit(ctx, "email-changed", user.id!, pending);
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
    this.#audit(ctx, "passkey-added", user.id!);
    this.#alert(ctx, user, "A passkey was added to your account");
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
    this.#audit(ctx, "login", user.id!, "passkey");
    ctx.response.body = { ok: true };
  }

  // Everything the account holds, as one JSON file. The deletion path was
  // already thorough; this is the other half of the same obligation — a
  // household can see and take what has been stored about them (GDPR art. 15
  // and 20, and the equivalent parental right over a child's records).
  @http.GET({ name: "export-account", path: "/_/account/export" })
  async exportAccount(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    rateLimit(ctx, "export", 5, 3_600_000);
    const profiles = await Profile.listForUser(user.id!);

    const perProfile = [];
    for (const profile of profiles) {
      const store = this.userData.loadProfile(user.id!, profile.id!);
      const results = [];
      if (await store.exists()) {
        for await (const result of store.read()) {
          results.push(result.toJSON());
        }
      }
      perProfile.push({ profile: profile.toDetails(), results });
    }

    // The account-level history, kept separately from the per-learner ones.
    const accountResults = [];
    const accountStore = this.userData.load(new PublicId(user.id!));
    if (await accountStore.exists()) {
      for await (const result of accountStore.read()) {
        accountResults.push(result.toJSON());
      }
    }

    ctx.response.body = {
      exportedAt: new Date().toISOString(),
      account: user.toDetails(),
      // The security trail is part of what is held about them.
      securityEvents: (await SecurityEvent.listForUser(user.id!, 200)).map(
        (e) => e.toDetails(),
      ),
      passkeys: (await Credential.listForUser(user.id!)).map((c) =>
        c.toDetails(),
      ),
      accountResults,
      profiles: perProfile,
    };
    ctx.response.headers.set("Cache-Control", "private, no-store");
    ctx.response.headers.set(
      "Content-Disposition",
      'attachment; filename="keylearn-data.json"',
    );
  }

  // ---- Grown-up PIN ----

  @http.POST({ name: "set-parent-pin", path: "/_/account/parent-pin" })
  async setParentPin(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PParentPin, jsonOpts) { pin, password, currentPin }: TParentPin,
  ) {
    rateLimit(ctx, "pin", 10, 300_000);
    const user = ctx.state.requireUser();
    // Changing or removing an existing PIN needs the old one, or the account
    // password — otherwise a child who gets to an unlocked session could simply
    // set their own.
    if (user.parentPinHash != null) {
      const byPin =
        currentPin != null && (await user.verifyParentPin(currentPin));
      const byPassword =
        user.passwordHash != null &&
        password != null &&
        (await User.loginWithPassword(user.email!, password)) != null;
      if (!byPin && !byPassword) {
        throw new ForbiddenError("That PIN is not right.");
      }
    }
    await user.setParentPin(pin);
    // Setting a PIN also proves it for this session, so the grown-up is not
    // immediately asked for what they just typed.
    if (pin != null) {
      ctx.state.session.set("parentPinAt", Date.now());
    } else {
      ctx.state.session.delete("parentPinAt");
    }
    this.#audit(
      ctx,
      "parent-pin-set",
      user.id!,
      pin == null ? "removed" : null,
    );
    ctx.response.body = { ok: true, parentPinSet: pin != null };
  }

  @http.POST({
    name: "verify-parent-pin",
    path: "/_/account/parent-pin/verify",
  })
  async verifyParentPin(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PVerifyPin, jsonOpts) { pin }: TVerifyPin,
  ) {
    // A 4-digit PIN is only 10^4, so the limiter is what makes it meaningful.
    rateLimit(ctx, "pin", 10, 300_000);
    const user = ctx.state.requireUser();
    if (user.parentPinHash == null) {
      ctx.response.body = { ok: true };
      return;
    }
    if (!(await user.verifyParentPin(pin))) {
      recordFailure(ctx);
      throw new ForbiddenError("That PIN is not right.");
    }
    clearFailures(ctx);
    ctx.state.session.set("parentPinAt", Date.now());
    ctx.response.body = { ok: true };
  }

  // ---- Two-step verification (TOTP) ----

  // Step 1 of setup: mint a secret and hand back the otpauth URI to scan. The
  // secret is stored but NOT yet active — an abandoned setup leaves the account
  // exactly as it was.
  @http.POST({ name: "2fa-begin", path: "/_/account/2fa/begin" })
  async twoFactorBegin(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    rateLimit(ctx, "2fa", 10, 300_000);
    if (user.totpEnabled) {
      throw new ApplicationError("Two-step verification is already on.");
    }
    const secret = generateTotpSecret();
    await user.$query().patch({ totpSecret: secret });
    ctx.response.body = {
      secret,
      uri: totpUri(secret, user.email!),
    };
    ctx.response.headers.set("Cache-Control", "private, no-store");
  }

  // Step 2: prove the app is set up correctly before switching it on, so nobody
  // locks themselves out with a mistyped secret. Returns the recovery codes,
  // which are shown exactly once.
  @http.POST({ name: "2fa-enable", path: "/_/account/2fa/enable" })
  async twoFactorEnable(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PTwoFactorEnable, jsonOpts) { code }: TTwoFactorEnable,
  ) {
    rateLimit(ctx, "2fa", 10, 300_000);
    const user = ctx.state.requireUser();
    if (user.totpSecret == null) {
      throw new ApplicationError("Start the setup again.");
    }
    if (!verifyTotp(user.totpSecret, code)) {
      throw new ForbiddenError("That code is not right. Try the next one.");
    }
    const codes = generateRecoveryCodes();
    await user.$query().patch({ totpEnabled: true });
    await user.setRecoveryCodes(codes);
    this.#audit(ctx, "two-factor-enabled", user.id!);
    ctx.response.body = { ok: true, recoveryCodes: codes };
    ctx.response.headers.set("Cache-Control", "private, no-store");
  }

  // Turning it off is itself a sensitive act — someone with a borrowed session
  // should not be able to quietly remove the second factor — so it needs the
  // password (or a live code) again.
  @http.POST({ name: "2fa-disable", path: "/_/account/2fa/disable" })
  async twoFactorDisable(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PTwoFactorDisable, jsonOpts)
    { password, code }: TTwoFactorDisable,
  ) {
    rateLimit(ctx, "2fa", 10, 300_000);
    const user = ctx.state.requireUser();
    if (!user.totpEnabled) {
      ctx.response.body = { ok: true };
      return;
    }
    const byPassword =
      user.passwordHash != null &&
      password != null &&
      (await User.loginWithPassword(user.email!, password)) != null;
    const byCode =
      code != null &&
      user.totpSecret != null &&
      verifyTotp(user.totpSecret, code);
    if (!byPassword && !byCode) {
      throw new ForbiddenError("Confirm with your password or a current code.");
    }
    await user.$query().patch({
      totpEnabled: false,
      totpSecret: null,
      recoveryCodes: null,
    });
    this.#audit(ctx, "two-factor-disabled", user.id!);
    this.#alert(ctx, user, "Two-step verification was turned off");
    ctx.response.body = { ok: true };
  }

  // The second step of signing in. The session holds only a pending marker
  // until this succeeds.
  @http.POST({ name: "2fa-verify", path: "/auth/2fa/verify" })
  async twoFactorVerify(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PTwoFactorLogin, jsonOpts) { code }: TTwoFactorLogin,
  ) {
    rateLimit(ctx, "2fa-login", 10, 300_000);
    const pendingId = ctx.state.session.get("pending2faUserId");
    const at = Number(ctx.state.session.get("pending2faAt") ?? 0);
    // The half-finished sign-in is short-lived: leaving it open indefinitely
    // would leave a password-only foothold sitting around.
    if (pendingId == null || Date.now() - at > 10 * 60_000) {
      ctx.state.session.destroy();
      throw new ForbiddenError("Start signing in again.");
    }
    const user = await User.findById(Number(pendingId));
    if (user == null || !user.totpEnabled) {
      ctx.state.session.destroy();
      throw new ForbiddenError("Start signing in again.");
    }
    const byTotp = user.totpSecret != null && verifyTotp(user.totpSecret, code);
    const byRecovery = byTotp ? false : await user.useRecoveryCode(code);
    if (!byTotp && !byRecovery) {
      recordFailure(ctx);
      this.#audit(ctx, "login-failed", user.id!, "two-factor");
      throw new ForbiddenError("That code is not right.");
    }
    clearFailures(ctx);
    const wasShortLived = ctx.state.session.get("shortLived") === true;
    ctx.state.session.destroy();
    ctx.state.session.start();
    ctx.state.session.set("userId", user.id!);
    ctx.state.session.set("epoch", user.sessionEpoch ?? 0);
    if (wasShortLived) {
      ctx.state.session.set("shortLived", true);
      ctx.state.session.set("loginAt", Date.now());
    }
    this.#audit(
      ctx,
      "login",
      user.id!,
      byRecovery ? "recovery code" : "two-factor",
    );
    ctx.response.body = {
      ok: true,
      // Surfaced so the UI can nudge for a fresh set before they run out.
      recoveryCodesLeft: user.countRecoveryCodes(),
    };
  }

  // The account's own security activity. Owner only — this is a record of when
  // and from where the account was used, which is exactly what an attacker
  // would like to read.
  @http.GET({ name: "security-events", path: "/_/account/security-events" })
  async securityEvents(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    const events = await SecurityEvent.listForUser(user.id!, 50);
    ctx.response.body = { events: events.map((e) => e.toDetails()) };
    ctx.response.headers.set("Cache-Control", "private, no-store");
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
    this.#audit(ctx, "passkey-removed", user.id!, cred.name ?? null);
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
    this.#requireParentPin(ctx, user);
    // COPPA: a child profile can't be created without the grown-up's consent.
    if (data.kind === "kid" && data.parentalConsent !== true) {
      throw new ApplicationError(
        "Parental consent is required to create a child profile.",
      );
    }
    // Two allowances: a learner on braille and audio does not use up one of
    // the ordinary places. See `profilecaps.ts` for why.
    const premium = user.order != null;
    const braille = data.visionSupport === true;
    const counts = countPlaces(
      await Profile.query().where("userId", user.id!),
      premium,
    );
    if (braille ? counts.brailleFree === 0 : counts.sightedFree === 0) {
      throw new ApplicationError(
        braille
          ? `You can have at most ${PLACES_BRAILLE} learners on braille and audio.`
          : `You can have at most ${sightedPlaces(premium)} learners. Learners on braille and audio have their own places.`,
      );
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
      visionSupport: data.visionSupport === true,
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
    this.#requireParentPin(ctx, user);
    const profile = await Profile.findOwned(user.id!, Number(id));
    if (profile == null) {
      throw new ForbiddenError();
    }
    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch.firstName = data.firstName;
    if (data.lastName !== undefined) patch.lastName = data.lastName || null;
    if (data.birthYear !== undefined) patch.birthYear = data.birthYear ?? null;
    if (data.visionSupport !== undefined) {
      // Turning vision support off moves this learner out of the braille
      // allowance and into the ordinary one. Without this check a household
      // could fill both allowances and then clear the flag on each braille
      // profile, ending up over the cap the create path enforces.
      if (profile.visionSupport && !data.visionSupport) {
        const premium = user.order != null;
        const counts = countPlaces(
          await Profile.query().where("userId", user.id!),
          premium,
        );
        if (counts.sightedFree === 0) {
          throw new ApplicationError(
            `You can have at most ${sightedPlaces(premium)} learners who are not on braille and audio. Delete one first, or leave braille and audio switched on.`,
          );
        }
      }
      patch.visionSupport = data.visionSupport;
    }
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
    this.#requireParentPin(ctx, user);
    const profile = await Profile.findOwned(user.id!, Number(id));
    if (profile == null) {
      throw new ForbiddenError();
    }
    await this.#deleteProfileData(user.id!, profile.id!);
    await profile.$query().delete();
    this.#audit(ctx, "profile-deleted", user.id!, profile.firstName ?? null);
    ctx.response.body = { profiles: await profileList(user.id!) };
  }
}

async function profileList(userId: number) {
  return (await Profile.listForUser(userId)).map((p) => p.toDetails());
}
