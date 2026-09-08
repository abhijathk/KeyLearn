import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
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
  NotFoundError,
} from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { certificateNumber } from "@keylearn/certificate";
import { DataDir, Env, isAdminEmail, listStaffEmails } from "@keylearn/config";
import {
  AccountDeletionRequest,
  AdCampaign,
  Certificate,
  checkUnlockPasscode,
  Credential,
  LearnerResponse,
  maskEmail,
  Notification,
  Order,
  Organization,
  OrganizationPlan,
  OrgInvite,
  OrgMember,
  PracticeSession,
  Profile,
  ProfileAccess,
  SecurityEvent,
  Staff,
  StaffAuditEvent,
  StaffSettings,
  SupportAttachment,
  SupportTicket,
  User,
  UserExternalId,
  verifyTotp,
} from "@keylearn/database";
import { UserDataFactory } from "@keylearn/result-userdata";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { z } from "zod";
import { buildAccountExport } from "../account-export.ts";
import {
  messageAccountDeletionRequested,
  messagePlanReminder,
} from "../auth/email.ts";
import { clientIp, rateLimit } from "../auth/ratelimit.ts";
import { staffAccessStatus } from "../auth/staff-access.ts";
import { refreshStaffCache } from "../auth/staff-cache.ts";
import { resolveTotpSecret } from "../auth/totp-crypto.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import { numberingKey } from "../certificate/key.ts";
import { Mailer } from "../mail/index.ts";
import { criteriaVersion } from "../site-config/criteria-version.ts";
import { impactCounts } from "../site-config/impact.ts";
import {
  envOverrideCount,
  showLastLoginLocation,
  SiteConfigService,
} from "../site-config/index.ts";
import { learnerReferenceRows } from "../site-config/learner-reference.ts";
import { learnerDefaultRows } from "../site-config/readers.ts";
import { deriveSignInMethod } from "../support/controller.ts";

const TStaffAuthVerify = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).optional(),
  totp: z.string().trim().min(1).optional(),
});
type TStaffAuthVerify = z.infer<typeof TStaffAuthVerify>;
const TDeskUnlockCheck = z.object({
  passcode: z.string().trim().min(1).max(64),
  /** Who is trying — for the audit line, not for authorisation. */
  staffEmail: z.string().trim().min(3).max(320),
});
type TDeskUnlockCheck = z.infer<typeof TDeskUnlockCheck>;
const PDeskUnlockCheck = zod(TDeskUnlockCheck);

const TStaffRosterSync = z.object({
  /** The complete active roster — replaces, never appends. */
  emails: z.array(z.string().trim().min(3).max(320)).max(200),
});
type TStaffRosterSync = z.infer<typeof TStaffRosterSync>;
const PStaffRosterSync = zod(TStaffRosterSync);

const TStaffTotpVerify = z.object({
  email: z.string().trim().email().max(320),
  totp: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
type TStaffTotpVerify = z.infer<typeof TStaffTotpVerify>;
const PStaffTotpVerify = zod(TStaffTotpVerify);

const PStaffAuthVerify = zod(TStaffAuthVerify);

const TStaffAuthPasskeyVerify = z.object({
  response: z.record(z.string(), z.any()),
  challenge: z.string().min(1),
});
type TStaffAuthPasskeyVerify = z.infer<typeof TStaffAuthPasskeyVerify>;
const PStaffAuthPasskeyVerify = zod(TStaffAuthPasskeyVerify);

const TActedRequest = z.object({
  reason: z.string().trim().min(1).max(500),
  actingStaffUserId: z.number().int().positive().optional(),
});
type TActedRequest = z.infer<typeof TActedRequest>;
const PActedRequest = zod(TActedRequest);

const TSiteSettingsUpdate = z.object({
  showLastLoginLocation: z.boolean(),
  actingStaffUserId: z.number().int().positive(),
});
type TSiteSettingsUpdate = z.infer<typeof TSiteSettingsUpdate>;
const PSiteSettingsUpdate = zod(TSiteSettingsUpdate);

// Control centre (spec phase 0.7). `restore: true` puts the key back to its
// shipped default; otherwise `value` is validated by the registry.
const TSiteConfigPut = z.object({
  value: z.unknown().optional(),
  restore: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
  /** Phase 3.4: an operations number tuned outside its bounds, with a reason. */
  beyondBounds: z.boolean().optional(),
  actingStaffUserId: z.number().int().positive(),
});

const TFeedbackHide = z.object({
  reason: z.string().trim().max(500).optional(),
  actingStaffUserId: z.number().int().positive(),
});
type TFeedbackHide = z.infer<typeof TFeedbackHide>;
const PFeedbackHide = zod(TFeedbackHide);
const pFeedbackLimit = zod(
  z.coerce.number().int().positive().max(200).optional().catch(undefined),
);
const pOptionalId = zod(
  z.coerce.number().int().positive().optional().catch(undefined),
);
type TSiteConfigPut = z.infer<typeof TSiteConfigPut>;
const PSiteConfigPut = zod(TSiteConfigPut);

const TSiteConfigRevert = z.object({
  historyId: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
  actingStaffUserId: z.number().int().positive(),
});
type TSiteConfigRevert = z.infer<typeof TSiteConfigRevert>;
const PSiteConfigRevert = zod(TSiteConfigRevert);

const pSettingKey = zod(z.string().trim().min(1).max(64));
const pHistoryLimit = zod(
  z.coerce.number().int().positive().max(500).optional().catch(undefined),
);
const pHistoryKey = zod(
  z.string().trim().min(1).max(64).optional().catch(undefined),
);
const siteConfigJson = { maxLength: 64 * 1024 };

const pId = zod(z.coerce.number().int().positive());
const pQuery = zod(z.string().trim().max(200).optional().catch(undefined));
const pActingStaffUserId = zod(
  z.coerce.number().int().positive().optional().catch(undefined),
);

/**
 * The one door the separate ops app reaches into KeyLearn through — see
 * that repo's `packages/server/lib/app/internal/keylearn-client.ts` for
 * the contract this implements. Every route here is `requireOpsApi()`
 * only: no session, no cookie, a machine-to-machine bearer key. The ops
 * app's own staff member is identified by `actingStaffUserId` in the
 * body (KeyLearn's own user id, returned by `staff-auth/verify`) so
 * KeyLearn's audit log attributes the action correctly instead of
 * recording a generic "ops app" actor.
 */
/**
 * The handful of client settings a support agent may see.
 *
 * An allow-list, never a pass-through. `prefs` is the client's own blob
 * and grows whenever the app grows; forwarding it whole would mean every
 * new preference silently becoming visible to staff, which is not a
 * decision anybody would have made deliberately. These five answer the
 * questions the desk actually gets — why does it look like this, why is
 * it reading to me, why are the letters wrong — and nothing else does.
 */
function readVisibleSettings(
  prefs: string | null,
): Record<string, string> | null {
  if (prefs == null || prefs === "") {
    return null;
  }
  let blob: Record<string, unknown>;
  try {
    const parsed = JSON.parse(prefs) as unknown;
    if (typeof parsed !== "object" || parsed == null) {
      return null;
    }
    blob = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const out: Record<string, string> = {};
  const say = (key: string, value: unknown) => {
    if (typeof value === "string" && value !== "") {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value ? "on" : "off";
    } else if (typeof value === "number") {
      out[key] = String(value);
    }
  };
  say("layout", blob["layout"] ?? blob["keyboard.layout"]);
  say("language", blob["language"] ?? blob["lang"]);
  say("theme", blob["theme"] ?? blob["color.theme"]);
  say("sound", blob["sound"] ?? blob["sounds"]);
  say("textSize", blob["textSize"] ?? blob["fontSize"]);
  // The accessibility switches. Half the tickets this desk gets are "why
  // does it look like this", and the answer is almost always one of these
  // three — so they are worth the same allow-list slot as the layout.
  say("kidsMode", blob["kidsMode"] ?? blob["kids"]);
  say("reducedMotion", blob["reducedMotion"] ?? blob["motion.reduced"]);
  say("largeText", blob["largeText"] ?? blob["a11y.largeText"]);
  return Object.keys(out).length === 0 ? null : out;
}

/**
 * Whether this learner has moved any accessibility switch off how the app
 * ships — the same question `a11yAdapted()` answers in the browser, asked
 * of the durable copy instead of localStorage.
 *
 * The desk needs the fact, not the settings: a staff member should be able
 * to see that a learner is adapted without reading which adaptations they
 * need, which is health-adjacent and none of support's business. So this
 * returns a boolean and the caller says nothing more.
 *
 * The rule is duplicated rather than imported because the browser copy
 * lives in a package that reaches for `localStorage` at module scope. If
 * the switch set grows, both copies move together — the drift shows up as
 * a learner who is adapted and not marked, which is the safe direction.
 */
async function a11yAdapted(file: string): Promise<boolean> {
  let prefs: Record<string, unknown>;
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed == null) {
      return false;
    }
    prefs = parsed as Record<string, unknown>;
  } catch {
    // No file is the ordinary case: a learner who has never opened the
    // accessibility page has nothing stored, and that is not adapted.
    return false;
  }
  const on = (key: string) => prefs[key] === true;
  const off = (key: string) => prefs[key] === false;
  const num = (key: string, over: number) =>
    typeof prefs[key] === "number" && (prefs[key] as number) > over;
  return (
    (prefs["motion"] != null && prefs["motion"] !== "system") ||
    (prefs["typeface"] != null && prefs["typeface"] !== "default") ||
    (prefs["targets"] != null && prefs["targets"] !== "default") ||
    on("calm") ||
    off("chords") ||
    num("bounceMs", 0) ||
    on("cues") ||
    on("fingerMarks") ||
    on("captions") ||
    on("predictable") ||
    num("letterSpacing", 0) ||
    num("lineHeight", 1.2) ||
    on("plain") ||
    off("scores") ||
    on("streakGrace") ||
    off("timers")
  );
}

/**
 * What the Accounts wizard sends.
 *
 * Validated as one shape rather than field by field, so a half-filled
 * request is refused before anything is written — which is what makes
 * "nothing is written until you press create" true rather than hopeful.
 */
const NewAccount = z
  .object({
    name: z.string().trim().min(1).max(128),
    type: z.enum(["group", "school", "tutor"]),
    parentId: z.number().int().positive().nullable().optional(),
    staffEmailDomains: z.string().max(255).nullable().optional(),
    plan: z
      .object({
        kind: z.enum(["paid", "nonprofit", "setup"]),
        seats: z.number().int().min(1).max(100000),
        validUntil: z.string().nullable().optional(),
        bodyKind: z.string().max(24).nullable().optional(),
        registrationNumber: z.string().max(64).nullable().optional(),
        registrationCountry: z.string().max(64).nullable().optional(),
        evidence: z.string().max(255).nullable().optional(),
        provider: z.string().max(32).nullable().optional(),
        providerRef: z.string().max(128).nullable().optional(),
      })
      .nullable()
      .optional(),
    owner: z.discriminatedUnion("mode", [
      z.object({
        mode: z.literal("existing"),
        userId: z.number().int().positive(),
      }),
      z.object({
        mode: z.literal("create"),
        email: z.string().email().max(128),
        title: z.string().max(16).nullable().optional(),
        firstName: z.string().trim().min(1).max(32),
        middleName: z.string().max(32).nullable().optional(),
        lastName: z.string().max(32).nullable().optional(),
        designation: z.string().max(64).nullable().optional(),
        temporaryPassword: z.string().min(8).max(72).nullable().optional(),
      }),
      z.object({
        mode: z.literal("invite"),
        email: z.string().email().max(128),
        note: z.string().max(300).nullable().optional(),
      }),
    ]),
    schools: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(128),
          principalEmail: z.string().max(128).nullable().optional(),
        }),
      )
      .max(200)
      .optional(),
    reason: z.string().trim().min(1).max(200),
    actingStaffUserId: z.number().int().positive().nullable().optional(),
  })
  // A non-profit grant without its evidence is a discount nobody can
  // justify later. Refused here rather than saved half-recorded.
  .refine(
    (v) =>
      v.plan?.kind !== "nonprofit" ||
      (v.plan.registrationNumber ?? "").trim() !== "",
    { message: "A non-profit account needs its registration number." },
  )
  // Schools belong to a group. Attaching them to a single school would
  // build a hierarchy the rest of the desk does not expect.
  .refine((v) => v.type === "group" || (v.schools ?? []).length === 0, {
    message: "Only a group holds schools.",
  });

/**
 * How many accounts one look-up returns.
 *
 * High enough that the desk's own pager is doing the paging and the count
 * under the search box means what it says, low enough that a mistyped
 * single letter does not walk the whole table.
 */
const ACCOUNT_SEARCH_LIMIT = 200;

@injectable()
@controller()
export class Controller {
  constructor(
    @inject("canonicalUrl") readonly canonicalUrl: string,
    readonly mailer: Mailer,
    readonly userData: UserDataFactory,
    @inject(DataDir) readonly dataDir: DataDir,
    readonly siteConfig: SiteConfigService,
  ) {}

  #link(path: string): string {
    return String(new URL(path, this.canonicalUrl));
  }

  /**
   * Verifies a TOTP code alone, for somebody already signed in.
   *
   * Distinct from `staff-auth/verify`, which is password-plus-TOTP and
   * answers "is this person who they say". This answers a narrower
   * question — "is the person already holding this session still at the
   * keyboard, with their authenticator" — which is what the desk's
   * control-centre gate needs and what its shared failsafe passcode
   * could never tell it: a passcode says somebody knows the passcode.
   *
   * No password is taken, so it cannot be used to sign in. It only ever
   * confirms a second factor for an identity the caller has already
   * established, and it is refused for anyone who is not staff.
   */
  @http.POST("/_/internal/staff-auth/totp-verify")
  async verifyStaffTotp(
    ctx: Context<RouterState & AuthState>,
    @body.json(PStaffTotpVerify) input: TStaffTotpVerify,
  ) {
    ctx.state.requireOpsApi();
    // Tighter than the sign-in limiter: six digits is a small space, and
    // this route is reachable with no password in hand.
    rateLimit(ctx, `ops-staff-totp:${input.email}`, 5, 300_000);
    const user = await User.findByEmail(input.email);
    if (user == null) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    const status = await staffAccessStatus(user);
    if (!status.ok) {
      ctx.response.body = { ok: false, reason: status.reason };
      return;
    }
    if (!user.totpEnabled || user.totpSecret == null) {
      ctx.response.body = { ok: false, reason: "needs-2fa" };
      return;
    }
    if (
      !verifyTotp(
        resolveTotpSecret(user.totpSecret, this.userData.dataDir.dataPath()),
        input.totp,
      )
    ) {
      void StaffAuditEvent.record({
        userId: user.id,
        action: "staff-access-denied",
        detail: "authenticator code refused at the desk's unlock gate",
        ip: clientIp(ctx),
      });
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    ctx.response.body = {
      ok: true,
      userId: user.id,
      name: user.name,
      email: user.email,
      // Env-only, exactly as the sign-in route reads it.
      admin: isAdminEmail(user.email),
    };
  }

  /**
   * Verifies a staff sign-in attempt. Stateless — the caller sends
   * `totp` in the SAME request as `password` once it has both; this
   * never stores a pending-2FA state of its own the way the browser-based
   * `/auth/*` flow does, since the ops app's own session is what carries
   * state between its two sign-in steps.
   */
  @http.POST("/_/internal/staff-auth/verify")
  async verifyStaffAuth(
    ctx: Context<RouterState & AuthState>,
    @body.json(PStaffAuthVerify) input: TStaffAuthVerify,
  ) {
    ctx.state.requireOpsApi();
    rateLimit(ctx, `ops-staff-auth:${input.email}`, 10, 300_000);
    const user = await User.findByEmail(input.email);
    // Password verified before anything about staff/2FA status is
    // revealed — checking staff eligibility first would let an
    // unauthenticated caller map the staff roster (who's on it, who
    // still needs a second factor) purely from the `reason` in the
    // response, without ever proving they hold the account.
    if (
      user == null ||
      input.password == null ||
      user.passwordHash == null ||
      (await User.loginWithPassword(input.email, input.password)) == null
    ) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    const status = await staffAccessStatus(user);
    if (!status.ok) {
      ctx.response.body = { ok: false, reason: status.reason };
      return;
    }
    // Passkey satisfies `staffAccessStatus`'s own factor check, but this
    // API is password-plus-TOTP only — it has no way to verify a
    // passkey. A staff member without TOTP enrolled must not be able to
    // reach the ops app on password alone just because they normally
    // sign in to KeyLearn itself with a passkey.
    if (!user.totpEnabled) {
      ctx.response.body = { ok: false, reason: "needs-2fa" };
      return;
    }
    if (input.totp == null) {
      ctx.response.body = { ok: false, reason: "needs-2fa" };
      return;
    }
    const valid =
      user.totpSecret != null &&
      verifyTotp(
        resolveTotpSecret(user.totpSecret, this.userData.dataDir.dataPath()),
        input.totp,
      );
    if (!valid) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    void StaffAuditEvent.record({
      userId: user.id,
      action: "staff-signin",
      detail: "via ops app",
      ip: clientIp(ctx),
    });
    ctx.response.body = {
      ok: true,
      userId: user.id,
      name: user.name,
      email: user.email,
      // Env-only, never a DB row — see adminEmails() for why that
      // invariant is what makes the desk-managed roster safe at all.
      admin: isAdminEmail(user.email),
    };
  }

  /**
   * `rpID` is bare-hostname, same rule as the account-facing passkey
   * endpoints (`#rp()` in auth/controller.ts) — sharing a hostname is
   * what lets a passkey created for KeyLearn itself work from the ops
   * app's own origin too. `origins` is the allowlist `verifyAuthenticationResponse`
   * checks the assertion's `clientDataJSON.origin` against: KeyLearn's
   * own canonical origin, plus whatever ops-app origins are configured —
   * never taken from the request itself, or any caller could pin
   * verification to an origin they don't actually control.
   */
  #rp(): { readonly rpID: string; readonly origins: readonly string[] } {
    const canonical = new URL(this.canonicalUrl);
    const trusted = Env.getString("TRUSTED_DESK_ORIGINS", "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    return {
      rpID: canonical.hostname,
      origins: [canonical.origin, ...trusted],
    };
  }

  /**
   * Usernameless — the ops app doesn't know who's signing in yet, same as
   * KeyLearn's own account-level passkey login. The challenge travels back
   * to the caller rather than living in a session here: this endpoint and
   * `verifyStaffAuthPasskey` below are two independent ops-key-authenticated
   * requests with nothing else correlating them, so the ops app's own
   * session (already used to hold the pending password between its two
   * sign-in steps) is where the challenge has to live meanwhile.
   */
  @http.POST("/_/internal/staff-auth/passkey-options")
  async staffAuthPasskeyOptions(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    rateLimit(ctx, "ops-staff-passkey", 30, 60_000);
    const { rpID } = this.#rp();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });
    ctx.response.body = { options };
  }

  /**
   * Verifies a passkey assertion the ops app collected on its own origin.
   * Cryptographic proof of possession comes first, exactly like the
   * password check in `verifyStaffAuth` above — staff eligibility is
   * only revealed once the caller has actually proven they hold the
   * credential, not before.
   */
  @http.POST("/_/internal/staff-auth/passkey-verify")
  async verifyStaffAuthPasskey(
    ctx: Context<RouterState & AuthState>,
    @body.json(PStaffAuthPasskeyVerify) input: TStaffAuthPasskeyVerify,
  ) {
    ctx.state.requireOpsApi();
    rateLimit(ctx, "ops-staff-passkey", 30, 60_000);
    const { rpID, origins } = this.#rp();
    const cred = await Credential.findByCredentialId(String(input.response.id));
    if (cred == null) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: input.response as any,
        expectedChallenge: input.challenge,
        expectedOrigin: origins as string[],
        expectedRPID: rpID,
        credential: {
          id: cred.credentialId!,
          publicKey: new Uint8Array(Buffer.from(cred.publicKey!, "base64")),
          counter: cred.counter ?? 0,
          transports: cred.transports ? JSON.parse(cred.transports) : undefined,
        },
      });
    } catch {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    if (!verification.verified) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    await cred
      .$query()
      .patch({ counter: verification.authenticationInfo.newCounter });
    const user = await User.findById(cred.userId!);
    const status = await staffAccessStatus(user);
    if (!status.ok) {
      ctx.response.body = { ok: false, reason: status.reason };
      return;
    }
    void StaffAuditEvent.record({
      userId: user!.id,
      action: "staff-signin",
      detail: "via ops app, passkey",
      ip: clientIp(ctx),
    });
    ctx.response.body = {
      ok: true,
      userId: user!.id,
      name: user!.name,
      email: user!.email,
      admin: isAdminEmail(user!.email),
    };
  }

  /**
   * The ops app's own Accounts search screen — same query shape and same
   * structural scoping as the in-repo desk's own `/_/support/accounts`
   * (never a profile's name/kind/avatar, never result/practice-session
   * content beyond a count): an empty query returns the 10 most recently
   * registered accounts rather than a blank page, still a real lookup for
   * the audit log. `actingStaffUserId` arrives as a query param (not a
   * body — this is a GET) so the audit event attributes to the actual
   * ops-app staff member, not a generic "ops app" actor.
   */
  /**
   * The bytes of one customer attachment, for the desk to show a staff
   * member.
   *
   * The file stays here. Only its description crosses the bridge when a
   * ticket is forwarded; this is how the desk gets the contents, on
   * demand, when somebody actually clicks. Copying every screenshot into
   * the desk's storage as well would mean two places to leak it from, two
   * things to back up, and two things to delete when somebody asks to be
   * forgotten.
   *
   * Ops-key only, like everything else here — the desk is trusted, a
   * browser is not, and this route has no session of its own to check.
   */
  @http.GET("/_/internal/attachments/{id}")
  async opsAttachment(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireOpsApi();
    const row = await SupportAttachment.query().findById(id);
    if (row == null || row.ticketId == null) {
      throw new NotFoundError();
    }
    // A ticket the customer has removed from their own list is not one
    // the desk should still be pulling files out of.
    const ticket = await SupportTicket.findById(row.ticketId);
    if (ticket == null) {
      throw new NotFoundError();
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(this.dataDir.supportAttachmentFile(row.id!));
    } catch {
      // The row outliving the file is a real state — an upload swept, a
      // restore that missed it — and the desk needs to say "no longer
      // available" rather than show a broken image.
      throw new NotFoundError();
    }
    ctx.response.headers.set("content-type", row.mimeType!);
    // Always an attachment: this is a machine-to-machine route, the desk
    // decides how to present it, and nothing here should ever be treated
    // as a document rendered on this origin.
    const safeName = row.fileName!.replace(/[^\w.\- ]+/g, "_");
    ctx.response.headers.set(
      "content-disposition",
      `attachment; filename="${safeName}"`,
    );
    ctx.response.headers.set("x-content-type-options", "nosniff");
    ctx.response.body = bytes;
  }

  /**
   * The organisations that own customers, for the desk's Accounts page.
   *
   * An account here is the ORGANISATION — a school, a tutor — and the
   * plan behind it. The people are Customers; this is who pays, for how
   * many, and whether the seats they bought are being used.
   *
   * Seats "active" is not seats assigned. A school can hand out two
   * hundred places and have forty learners who ever practise, and the
   * difference between those two numbers is the single most useful thing
   * on the page: it is a renewal conversation six months early. Assigned
   * comes from the seat ledger; active is read from each learner's own
   * result file, whose modification time is when they last practised.
   *
   * The member user ids travel with each row because the desk holds the
   * tickets and this side holds the people, and neither can score an
   * account alone.
   */
  /**
   * Creates a whole account in one go: the organisation, its plan, the
   * person at the top, and — for a group — its schools and their
   * principals.
   *
   * One route rather than five, because half a created account is worse
   * than none. A group whose owner failed to be made is a record nobody
   * can administer, and a school created without its parent is a school
   * that quietly bills separately. It is a transaction for the same
   * reason: the wizard promised "nothing is written until you press
   * create", and a partial write breaks that promise in the way that is
   * hardest to notice.
   *
   * A group's schools are child organisations, and a principal is the
   * owner of their own school — not an admin of the group. That is the
   * hierarchy the desk shows and the one a trust actually has: the group
   * owner can add and remove schools; a principal runs theirs and cannot
   * see the others.
   */
  @http.POST("/_/internal/organizations")
  async createOrganization(
    ctx: Context<RouterState & AuthState>,
    @body.json() input: unknown,
  ) {
    ctx.state.requireOpsApi();
    const parsed = NewAccount.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues[0]?.message ?? "That account could not be created.",
      );
    }
    const a = parsed.data;
    const staffUserId = a.actingStaffUserId ?? null;

    // Checked before the transaction so the answer is a sentence rather
    // than a constraint violation: "that name is taken" is something a
    // person can act on, and the wizard has a screen for it.
    const clash = await Organization.query().findOne({ name: a.name.trim() });
    if (clash != null) {
      ctx.response.status = 409;
      ctx.response.body = {
        error: "name-taken",
        message: `There is already an organisation called ${a.name.trim()}.`,
        existing: { id: clash.id!, name: clash.name!, type: clash.type! },
      };
      return;
    }

    // The owner is resolved BEFORE anything is written. Creating the
    // organisation and then failing to find its owner leaves exactly the
    // orphan this route exists to prevent.
    let ownerUser: User | null = null;
    let tempPassword: string | null = null;
    if (a.owner.mode === "existing") {
      ownerUser = (await User.query().findById(a.owner.userId)) ?? null;
      if (ownerUser == null) {
        throw new BadRequestError("That account no longer exists.");
      }
    } else if (a.owner.mode === "create") {
      const already = await User.findByEmail(a.owner.email);
      if (already != null) {
        throw new BadRequestError(
          `${a.owner.email} already has an account — choose "an existing account" instead.`,
        );
      }
      tempPassword =
        a.owner.temporaryPassword ?? randomBytes(12).toString("base64url");
      // Created BEFORE the transaction, not inside it.
      //
      // `registerWithPassword` takes its own connection. Called from
      // within a transaction that already holds SQLite's write lock, it
      // waits for a connection that cannot be granted until that lock
      // is released — a deadlock the engine reports as "database is
      // locked", which reads like contention from somewhere else.
      //
      // If the organisation below then fails, this leaves an ordinary
      // account with no membership: harmless and reusable, and far
      // better than a wedged database.
      ownerUser = await User.registerWithPassword(
        a.owner.email,
        tempPassword,
        a.owner.firstName,
        a.owner.lastName ?? "",
      );
      await User.query()
        .findById(ownerUser.id!)
        .patch({
          emailVerified: true,
          mustChangePassword: true,
          tempPasswordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }

    const created = await Organization.transaction(async (trx) => {
      const org = await Organization.query(trx).insertAndFetch({
        name: a.name.trim(),
        type: a.type,
        parentId: a.parentId ?? null,
        staffEmailDomains: a.staffEmailDomains?.trim() || null,
      });

      if (a.plan != null) {
        await OrganizationPlan.query(trx).insert({
          organizationId: org.id!,
          seats: a.plan.seats,
          validUntil:
            a.plan.validUntil == null ? null : new Date(a.plan.validUntil),
          kind: a.plan.kind,
          bodyKind: a.plan.bodyKind ?? null,
          registrationNumber: a.plan.registrationNumber ?? null,
          registrationCountry: a.plan.registrationCountry ?? null,
          evidence: a.plan.evidence ?? null,
          // A free grant is reviewed, not forgotten. Stamped now so the
          // first review is a year from when it was given.
          reviewedAt: a.plan.kind === "nonprofit" ? new Date() : null,
          provider: a.plan.kind === "paid" ? (a.plan.provider ?? null) : null,
          providerRef:
            a.plan.kind === "paid" ? (a.plan.providerRef ?? null) : null,
        });
      }

      // The person at the top — resolved or created above, so nothing in
      // here reaches for a second connection.
      if (ownerUser != null) {
        await OrgMember.query(trx).insert({
          organizationId: org.id!,
          userId: ownerUser.id!,
          role: "owner",
          designation:
            a.owner.mode === "create" ? (a.owner.designation ?? null) : null,
        });
      }

      // A group's schools, each its own organisation under this one.
      const schools = [];
      for (const school of a.schools ?? []) {
        const child = await Organization.query(trx).insertAndFetch({
          name: school.name.trim(),
          type: "school",
          parentId: org.id!,
          staffEmailDomains: null,
        });
        schools.push({
          id: child.id!,
          name: child.name!,
          principalEmail: school.principalEmail ?? null,
        });
      }
      return { org, schools };
    });

    // Invitations are sent AFTER the transaction commits. An email about
    // an account that was rolled away is worse than a missing email.
    const invites: { email: string; organizationId: number; token: string }[] =
      [];
    if (a.owner.mode === "invite" && staffUserId != null) {
      const { token } = await OrgInvite.issue({
        organizationId: created.org.id!,
        role: "owner",
        issuedByUserId: staffUserId,
        email: a.owner.email,
      });
      invites.push({
        email: a.owner.email,
        organizationId: created.org.id!,
        token,
      });
    }
    for (const school of created.schools) {
      if (
        school.principalEmail != null &&
        school.principalEmail !== "" &&
        staffUserId != null
      ) {
        const { token } = await OrgInvite.issue({
          organizationId: school.id,
          role: "owner",
          issuedByUserId: staffUserId,
          email: school.principalEmail,
        });
        invites.push({
          email: school.principalEmail,
          organizationId: school.id,
          token,
        });
      }
    }

    void StaffAuditEvent.record({
      userId: staffUserId,
      action: "org-created",
      detail:
        `${a.type} "${a.name.trim()}"` +
        (a.plan == null
          ? " (no plan)"
          : ` (${a.plan.kind}, ${a.plan.seats} seats)`) +
        (created.schools.length > 0
          ? `, ${created.schools.length} school(s)`
          : "") +
        `: ${a.reason.slice(0, 160)} (via ops app)`,
      ip: clientIp(ctx),
    });

    ctx.response.body = {
      id: created.org.id!,
      name: created.org.name!,
      type: created.org.type!,
      schools: created.schools.map((s) => ({ id: s.id, name: s.name })),
      owner:
        ownerUser == null
          ? null
          : {
              userId: ownerUser.id!,
              name: ownerUser.name!,
              email: maskEmail(ownerUser.email!),
            },
      // Returned once, never stored in readable form and never logged.
      // The desk shows it and then it is gone from everywhere.
      temporaryPassword: tempPassword,
      invitesSent: invites.length,
    };
  }

  @http.GET("/_/internal/organizations")
  async listOrganizations(
    ctx: Context<RouterState & AuthState>,
    @queryParam("actingStaffUserId", pActingStaffUserId)
    actingStaffUserId: number | undefined,
  ) {
    ctx.state.requireOpsApi();
    const orgs = await Organization.query().orderBy("name", "asc").limit(200);
    const out = [];
    for (const org of orgs) {
      out.push(await this.describeOrganization(org));
    }
    void StaffAuditEvent.record({
      userId: actingStaffUserId ?? null,
      action: "account-lookup",
      detail: `organisations (${out.length}) (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = out;
  }

  /**
   * Changes what an organisation is on — seats, end date, kind of plan.
   *
   * "Add seats" and "Change plan" are the same write with different
   * defaults on the screen; a separate route for each would be two
   * places to keep the seat rules in step. Creating the plan row when
   * there is none is deliberate: an organisation set up before billing
   * existed is exactly the one somebody is now selling to.
   */
  @http.PUT("/_/internal/organizations/{id}/plan")
  async setOrganizationPlan(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json() input: unknown,
  ) {
    ctx.state.requireOpsApi();
    const parsed = z
      .object({
        kind: z.enum(["paid", "nonprofit", "setup"]),
        seats: z.number().int().min(1).max(100000).nullable().optional(),
        validUntil: z.string().nullable().optional(),
        bodyKind: z.string().max(24).nullable().optional(),
        registrationNumber: z.string().max(64).nullable().optional(),
        registrationCountry: z.string().max(64).nullable().optional(),
        evidence: z.string().max(255).nullable().optional(),
        provider: z.string().max(32).nullable().optional(),
        providerRef: z.string().max(128).nullable().optional(),
        reason: z.string().trim().min(1).max(200),
        actingStaffUserId: z.number().int().positive().nullable().optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      throw new BadRequestError("That plan change is not valid.");
    }
    const org = await Organization.query().findById(id);
    if (org == null) {
      ctx.response.status = 404;
      return;
    }
    const p = parsed.data;
    const existing = await OrganizationPlan.query().findOne({
      organizationId: id,
    });
    const before = existing?.seats ?? null;

    if (p.kind === "setup") {
      // Back to unlimited-while-onboarding. The row is removed rather
      // than kept with a null seat count: a plan row IS the statement
      // that something was sold.
      if (existing != null) {
        await OrganizationPlan.query().delete().where("organizationId", id);
      }
    } else {
      const patch = {
        seats: p.seats ?? existing?.seats ?? 1,
        validUntil:
          p.validUntil == null || p.validUntil === ""
            ? null
            : new Date(p.validUntil),
        kind: p.kind,
        bodyKind:
          p.kind === "nonprofit"
            ? (p.bodyKind ?? existing?.bodyKind ?? null)
            : null,
        registrationNumber:
          p.kind === "nonprofit"
            ? (p.registrationNumber ?? existing?.registrationNumber ?? null)
            : null,
        registrationCountry:
          p.kind === "nonprofit"
            ? (p.registrationCountry ?? existing?.registrationCountry ?? null)
            : null,
        evidence:
          p.kind === "nonprofit"
            ? (p.evidence ?? existing?.evidence ?? null)
            : null,
        reviewedAt: p.kind === "nonprofit" ? new Date() : null,
        provider: p.kind === "paid" ? (p.provider ?? null) : null,
        providerRef: p.kind === "paid" ? (p.providerRef ?? null) : null,
      };
      if (existing == null) {
        await OrganizationPlan.query().insert({ organizationId: id, ...patch });
      } else {
        await OrganizationPlan.query().where("organizationId", id).patch(patch);
      }
    }

    void StaffAuditEvent.record({
      userId: p.actingStaffUserId ?? null,
      action: "org-plan-changed",
      detail:
        `organisation ${id}: ${p.kind}` +
        (p.seats != null ? `, seats ${before ?? "none"} → ${p.seats}` : "") +
        `: ${p.reason.slice(0, 160)} (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = {
      ok: true,
      seats: p.kind === "setup" ? null : (p.seats ?? before),
    };
  }

  /**
   * Emails the owner about a plan that has run out, or is about to.
   *
   * Sent by a named person, not by a scheduler, and it says so — a
   * customer who cannot tell whether a machine or a person wrote to them
   * cannot reply usefully to either.
   */
  @http.POST("/_/internal/organizations/{id}/remind")
  async remindOrganization(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json() input: unknown,
  ) {
    ctx.state.requireOpsApi();
    const parsed = z
      .object({
        fromName: z.string().trim().min(1).max(64),
        actingStaffUserId: z.number().int().positive().nullable().optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      throw new BadRequestError("A reminder needs the name it is from.");
    }
    const org = await Organization.query().findById(id);
    if (org == null) {
      ctx.response.status = 404;
      return;
    }
    const members = await OrgMember.query().where("organizationId", id);
    const owner =
      members.find((m) => m.role === "owner") ??
      members.find((m) => m.role === "admin");
    const user =
      owner == null ? null : await User.query().findById(owner.userId!);
    if (user?.email == null) {
      // ASCII only. An HttpError's message is written into the HTTP
      // status line, and Node refuses to send a response whose status
      // line holds a non-ASCII byte — so the em dash that used to sit
      // here did not produce this message, it hung the request.
      throw new BadRequestError(
        "There is nobody to remind: this organisation has no owner with an address.",
      );
    }
    const plan = await OrganizationPlan.query().findOne({ organizationId: id });
    const lapsed =
      plan?.validUntil != null &&
      new Date(plan.validUntil).getTime() < Date.now();
    // A send failure is reported as itself. Letting it become a 500 makes
    // the desk say "couldn't reach KeyLearn", which sends whoever
    // investigates to look at a perfectly healthy service — the reach
    // worked, the mail provider refused.
    try {
      await this.mailer.sendMail(
        messagePlanReminder({
          email: user.email,
          organisation: org.name!,
          seats: plan?.seats ?? null,
          validUntil:
            plan?.validUntil == null
              ? null
              : new Date(plan.validUntil).toLocaleDateString(undefined, {
                  dateStyle: "long",
                }),
          lapsed: Boolean(lapsed),
          fromName: parsed.data.fromName,
          contactLink: this.#link("/support"),
        }),
      );
    } catch (err) {
      throw new ApplicationError(
        `The reminder could not be sent: ${err instanceof Error ? err.message : String(err)}`,
        { status: 502 },
      );
    }
    void StaffAuditEvent.record({
      userId: parsed.data.actingStaffUserId ?? null,
      action: "org-reminder-sent",
      detail: `organisation ${id} → ${maskEmail(user.email)} (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = {
      sent: true,
      to: maskEmail(user.email),
      lapsed: Boolean(lapsed),
    };
  }

  @http.GET("/_/internal/organizations/{id}")
  async getOrganization(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @queryParam("actingStaffUserId", pActingStaffUserId)
    actingStaffUserId: number | undefined,
  ) {
    ctx.state.requireOpsApi();
    const org = await Organization.query().findById(id);
    if (org == null) {
      ctx.response.status = 404;
      return;
    }
    const base = await this.describeOrganization(org);
    const members = await OrgMember.query()
      .where("organizationId", id)
      .limit(500);
    const users = await User.query().findByIds(members.map((m) => m.userId!));
    const byId = new Map(users.map((u) => [u.id!, u]));
    void StaffAuditEvent.record({
      userId: actingStaffUserId ?? null,
      action: "account-viewed",
      detail: `organisation ${id} (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = {
      ...base,
      // Staff by name, and only the staff. Learners on an organisation
      // are children in a classroom: they are counted here and read
      // under Customers, where the shield rules apply.
      people: members
        .filter((m) => m.role !== "learner")
        .map((m) => ({
          userId: m.userId!,
          name: byId.get(m.userId!)?.name ?? "—",
          email: maskEmail(byId.get(m.userId!)?.email ?? ""),
          role: m.role!,
        })),
    };
  }

  /** One organisation, as both routes describe it. */
  private async describeOrganization(org: Organization) {
    const seats = await org.seatStatus();
    const members = await OrgMember.query()
      .where("organizationId", org.id!)
      .limit(1000);
    const owner =
      members.find((m) => m.role === "owner") ??
      members.find((m) => m.role === "admin");
    const ownerUser =
      owner == null ? null : await User.query().findById(owner.userId!);
    const plan = await OrganizationPlan.query().findOne({
      organizationId: org.id!,
    });

    // Active in the last 30 days, from each learner's own result file —
    // one stat per profile rather than a walk of anybody's history.
    //
    // A seat is filled two ways (spec §9.4). Mode A is a profile the
    // organisation created; mode B is a family's own profile granted to
    // it. Both are counted, because both are a place somebody paid for.
    //
    // A mode-A profile with no owning account has nowhere for its result
    // file to live, so its practice cannot be read here. Those are
    // reported as UNMEASURED rather than counted as idle: scoring "we
    // cannot see it" the same as "nobody used it" would mark a school
    // that is doing fine as about to leave, and the score is meant to
    // start a conversation about renewal.
    const owned = await Profile.query()
      .where("organizationId", org.id!)
      .limit(1000);
    const granted = (await ProfileAccess.query()
      .where("organizationId", org.id!)
      .whereNull("revokedAt")
      .limit(1000)) as unknown as { profileId?: number }[];
    const grantedProfiles =
      granted.length === 0
        ? []
        : await Profile.query().findByIds(
            granted.map((g) => g.profileId!).filter(Boolean),
          );

    const seen = new Map<number, Profile>();
    for (const p of [...owned, ...grantedProfiles]) {
      seen.set(p.id!, p);
    }
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let seatsActive = 0;
    let seatsUnmeasured = 0;
    for (const p of seen.values()) {
      if (p.userId == null) {
        seatsUnmeasured++;
        continue;
      }
      const at = await this.userData
        .loadProfile(p.userId, p.id!)
        .lastWrittenAt()
        .catch(() => null);
      if (at != null && at.getTime() >= cutoff) {
        seatsActive++;
      }
    }
    const profiles = [...seen.values()];

    return {
      id: org.id!,
      name: org.name!,
      type: org.type!,
      createdAt: new Date(org.createdAt!).toISOString(),
      plan:
        plan == null
          ? null
          : {
              seats: plan.seats ?? null,
              validUntil:
                plan.validUntil == null
                  ? null
                  : new Date(plan.validUntil).toISOString(),
              // Where the money actually lives. KeyLearn stores a
              // reference, not an invoice — see the desk's Accounts page,
              // which says so rather than drawing an amount it made up.
              provider: plan.provider ?? null,
              providerRef: plan.providerRef ?? null,
              lapsed: seats.lapsed,
            },
      seats: seats.seats,
      seatsAssigned: seats.used,
      seatsActive,
      seatsUnmeasured,
      learners: profiles.length,
      owner:
        ownerUser == null
          ? null
          : {
              userId: ownerUser.id!,
              name: ownerUser.name!,
              email: maskEmail(ownerUser.email!),
              role: owner!.role!,
            },
      memberUserIds: members.map((m) => m.userId!),
    };
  }

  @http.GET("/_/internal/accounts/search")
  async searchAccounts(
    ctx: Context<RouterState & AuthState>,
    @queryParam("query", pQuery) query: string | undefined,
    @queryParam("actingStaffUserId", pActingStaffUserId)
    actingStaffUserId: number | undefined,
  ) {
    ctx.state.requireOpsApi();
    const term = query?.trim();
    // One cap for both branches. The desk shows this as a directory it
    // pages through, and the old split — 20 for a search, 10 for no
    // query — meant the page said "every registered account" while
    // showing ten of them, with a pager that reported ten as the total.
    // A reader has no way to tell that apart from a desk with ten
    // customers.
    const users = await (term
      ? User.query()
          .where((q) =>
            q
              .where("email", "like", `%${term}%`)
              .orWhere("name", "like", `%${term}%`),
          )
          .orderBy("createdAt", "desc")
          .limit(ACCOUNT_SEARCH_LIMIT)
      : User.query().orderBy("createdAt", "desc").limit(ACCOUNT_SEARCH_LIMIT));

    // Counted and dated in two queries rather than two per user. At a cap
    // of ten the loop was invisible; at two hundred it is four hundred
    // round trips to build one page.
    const ids = users.map((u) => u.id!);
    const profileCounts = new Map<number, number>();
    const lastSeenAt = new Map<number, number>();
    if (ids.length > 0) {
      const counted = (await Profile.query()
        .whereIn("userId", ids)
        .select("userId")
        .count("* as n")
        .groupBy("userId")) as unknown as { userId: number; n: number }[];
      for (const row of counted) {
        profileCounts.set(Number(row.userId), Number(row.n));
      }
      const logins = (await SecurityEvent.query()
        .whereIn("userId", ids)
        .where("type", "login")
        .select("userId")
        .max("createdAt as at")
        .groupBy("userId")) as unknown as { userId: number; at: unknown }[];
      for (const row of logins) {
        if (row.at != null) {
          lastSeenAt.set(
            Number(row.userId),
            new Date(row.at as string).getTime(),
          );
        }
      }
    }

    const results = users.map((u) => {
      const seen = lastSeenAt.get(u.id!);
      return {
        id: u.id!,
        name: u.name!,
        email: maskEmail(u.email!),
        emailVerified: Boolean(u.emailVerified),
        createdAt: new Date(u.createdAt!).toISOString(),
        signInMethod: deriveSignInMethod(u),
        profileCount: profileCounts.get(u.id!) ?? 0,
        lastSeen: seen == null ? null : new Date(seen).toISOString(),
      };
    });

    void StaffAuditEvent.record({
      userId: actingStaffUserId ?? null,
      action: "account-lookup",
      detail:
        (term ? term.slice(0, 120) : "(recent, no query)") + " (via ops app)",
      ip: clientIp(ctx),
    });
    ctx.response.body = results;
  }

  /** How many accounts exist, for the ops app's own "N registered" stat. */
  @http.GET("/_/internal/accounts/total")
  async getAccountsTotal(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    ctx.response.body = { total: await User.query().resultSize() };
  }

  /**
   * The ops app's own Dashboard — account-side aggregate stats only.
   * Deliberately narrower than this repo's own `computeDashboard()` (the
   * in-repo desk's Dashboard data source, `support/controller.ts`): that
   * function also returns `urgent`/`notices`/`automation`, all sourced
   * from THIS repo's own support_ticket/notice/staff_audit_event tables —
   * data the ops app must never surface, since it has its own separate
   * ticket/notice tables now and showing KeyLearn's side would just be
   * stale, confusing duplicate data. The account-stat queries themselves
   * are copied from that function (same shape, same bucketing), not
   * shared code, to avoid coupling the ops app's contract to that
   * function's internal shape changing later.
   */
  @http.GET("/_/internal/dashboard-accounts")
  async getDashboardAccountStats(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    ctx.response.body = await computeAccountStats();
  }

  /**
   * How much of Tab's own workload it's handling without a human — the
   * ops app's Dashboard headline AI metric. Counted straight off this
   * repo's own `staff_audit_event` rows for the agent-scoped endpoints
   * (`agent-reply`/`agent-flag`/`agent-close-spam`), not re-derived from
   * ticket state, so it can never drift from what actually happened.
   * `agent-reply` covers both a grounded auto-reply and an off-topic
   * redirect — this repo doesn't currently distinguish the two in the
   * audit action name, so "replied" is honestly a slight overcount of
   * "resolved with a real answer." Good enough for a trend number; not
   * precise enough to bill against.
   */
  @http.GET("/_/internal/agent-stats")
  async getAgentStats(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    const since = new Date(Date.now() - 7 * DAY_MS);
    const rows = (await StaffAuditEvent.knex()(StaffAuditEvent.tableName)
      .select("action")
      .count({ count: "*" })
      .whereIn("action", ["agent-reply", "agent-flag", "agent-close-spam"])
      .where("created_at", ">=", since)
      .groupBy("action")) as { action: string; count: number | string }[];
    const counts = Object.fromEntries(
      rows.map((r) => [r.action, Number(r.count)]),
    );
    const replied = counts["agent-reply"] ?? 0;
    const flagged = counts["agent-flag"] ?? 0;
    const closedSpam = counts["agent-close-spam"] ?? 0;
    const total = replied + flagged + closedSpam;
    ctx.response.body = {
      replied,
      escalated: flagged,
      closedSpam,
      total,
      resolutionRate: total === 0 ? null : replied / total,
    };
  }

  /**
   * The one KeyLearn-side setting the ops app's Settings screen surfaces
   * directly rather than mirroring locally, because it isn't really a
   * per-staff preference on this side either — `StaffSettings.siteDefault()`
   * reads whichever staff member's row was updated most recently (see that
   * function's own doc comment: "deliberately unsophisticated... good
   * enough for a two-person team"). Writing it here through the acting
   * ops-app staffer's own row behaves exactly like that staffer changing it
   * from KeyLearn's own desk directly — not a separate, disconnected
   * control living only in the ops app.
   */
  /**
   * Kept for the desk's Settings page while it migrates (phase 1.9): the
   * one setting it surfaced now lives in site_config and is written
   * through the same validated, audited path as the control centre.
   */
  @http.GET("/_/internal/site-settings")
  async getSiteSettings(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    ctx.response.body = { showLastLoginLocation: showLastLoginLocation() };
  }

  @http.PUT("/_/internal/site-settings")
  async updateSiteSettings(
    ctx: Context<RouterState & AuthState>,
    @body.json(PSiteSettingsUpdate) input: TSiteSettingsUpdate,
  ) {
    ctx.state.requireOpsApi();
    await this.#requireAdminActor(
      ctx,
      input.actingStaffUserId,
      "privacy.showLastLoginLocation",
    );
    await this.siteConfig.set(
      "privacy.showLastLoginLocation",
      input.showLastLoginLocation,
      { userId: input.actingStaffUserId, ip: clientIp(ctx) },
    );
    ctx.response.body = { showLastLoginLocation: showLastLoginLocation() };
  }

  /**
   * The control centre's view of every site setting (spec phase 0.7): the
   * registry row, the value in force, where it came from, and why the row
   * is locked if it is. Reads are open to the ops key; writes below also
   * require the acting staff member to be an admin, checked here against
   * ADMIN_EMAILS rather than trusted from the desk, because this is the
   * door and the desk's own gate is a second layer, not the only one.
   */
  @http.GET("/_/internal/site-config")
  async getSiteConfig(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    ctx.response.body = {
      refreshSeconds: this.siteConfig.refreshSeconds(),
      envOverrides: envOverrideCount(),
      settings: await this.siteConfig.describe(),
      // Phase 2: the numbers a risky switch shows first, the read-only
      // learner defaults list, and the certificate criteria version.
      impact: await impactCounts(),
      learnerDefaults: learnerDefaultRows(),
      // The read-only reference of every small per-learner setting (spec
      // §5): fonts, caret shapes, keyboard colours, sound volume, lesson
      // knobs. Generated from the settings props themselves, so it cannot
      // drift from what a new learner is actually given.
      learnerReference: learnerReferenceRows(),
      criteriaVersion: await criteriaVersion(),
      // Phase 3.3: whether premium can be sold at all.
      paddle: this.siteConfig.paddleStatus(),
    };
  }

  @http.GET("/_/internal/site-config/history")
  async getSiteConfigHistory(
    ctx: Context<RouterState & AuthState>,
    @queryParam("limit", pHistoryLimit) limit: number | undefined,
    @queryParam("key", pHistoryKey) key: string | undefined,
  ) {
    ctx.state.requireOpsApi();
    ctx.response.body = {
      history: await this.siteConfig.history(limit ?? 100, key),
    };
  }

  @http.PUT("/_/internal/site-config/{key}")
  async putSiteConfig(
    ctx: Context<RouterState & AuthState>,
    @pathParam("key", pSettingKey) key: string,
    @body.json(PSiteConfigPut, siteConfigJson) input: TSiteConfigPut,
  ) {
    ctx.state.requireOpsApi();
    await this.#requireAdminActor(ctx, input.actingStaffUserId, key);
    ctx.response.body = await this.siteConfig.set(
      key,
      input.restore ? undefined : input.value,
      {
        userId: input.actingStaffUserId,
        ip: clientIp(ctx),
        reason: input.reason ?? null,
      },
      null,
      { beyondBounds: input.beyondBounds === true },
    );
  }

  // ── Polls and feedback (control centre phase 3.1 / 3.2) ──

  /** The live tally for a desk notice's poll or feedback card. Never any text. */
  @http.GET("/_/internal/notices/{id}/results")
  async noticeResults(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireOpsApi();
    ctx.response.body = { results: await LearnerResponse.resultsFor(id) };
  }

  /**
   * The Feedback inbox: comments with their star, newest first, with the
   * account they came from. Read by the desk for its KeyLearn-scope staff;
   * the desk decides who may open the inbox, KeyLearn decides what is in it.
   */
  @http.GET("/_/internal/feedback")
  async listFeedback(
    ctx: Context<RouterState & AuthState>,
    @queryParam("noticeId", pOptionalId) noticeId: number | undefined,
    @queryParam("before", pOptionalId) before: number | undefined,
    @queryParam("limit", pFeedbackLimit) limit: number | undefined,
  ) {
    ctx.state.requireOpsApi();
    const rows = await LearnerResponse.listFeedback({
      noticeId: noticeId ?? null,
      before: before ?? null,
      limit: limit ?? 50,
    });
    const userIds = [...new Set(rows.map((row) => row.userId!))];
    const users = new Map<number, User>();
    for (const userId of userIds) {
      const user = await User.findById(userId);
      if (user != null) {
        users.set(userId, user);
      }
    }
    ctx.response.body = {
      feedback: rows.map((row) => {
        const user = users.get(row.userId!) ?? null;
        return {
          ...row.toDetails(),
          account:
            user == null
              ? null
              : {
                  id: user.id!,
                  email: user.email ?? null,
                  name: user.name ?? null,
                },
        };
      }),
    };
  }

  /**
   * Moderation: a staff member drops one comment's text; the star stays.
   * Any staff member with KeyLearn scope may — the desk gates the scope,
   * this side checks the actor is on the roster at all.
   */
  @http.POST("/_/internal/feedback/{id}/hide")
  async hideFeedback(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PFeedbackHide) input: TFeedbackHide,
  ) {
    ctx.state.requireOpsApi();
    const actor = await User.findById(input.actingStaffUserId);
    if (
      actor == null ||
      actor.email == null ||
      !listStaffEmails().includes(actor.email)
    ) {
      throw new ForbiddenError("Only a staff member can moderate feedback.");
    }
    const hidden = await LearnerResponse.hide(id);
    if (!hidden) {
      throw new NotFoundError();
    }
    void StaffAuditEvent.record({
      userId: actor.id!,
      action: "feedback-hidden",
      detail: `response ${id}${input.reason ? `: ${input.reason.slice(0, 120)}` : ""} (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { ok: true };
  }

  @http.POST("/_/internal/site-config/revert")
  async revertSiteConfig(
    ctx: Context<RouterState & AuthState>,
    @body.json(PSiteConfigRevert) input: TSiteConfigRevert,
  ) {
    ctx.state.requireOpsApi();
    await this.#requireAdminActor(
      ctx,
      input.actingStaffUserId,
      `revert ${input.historyId}`,
    );
    ctx.response.body = await this.siteConfig.revert(input.historyId, {
      userId: input.actingStaffUserId,
      ip: clientIp(ctx),
      reason: input.reason ?? null,
    });
  }

  /**
   * The acting staff member must be an admin by ADMIN_EMAILS, which is
   * env-only and never a database row — the same invariant that makes the
   * desk-managed roster safe. A non-admin staff member holding a valid
   * desk session cannot change the site through the desk's own key.
   */
  async #requireAdminActor(
    ctx: Context<RouterState & AuthState>,
    actingStaffUserId: number,
    what: string,
  ): Promise<User> {
    const user = await User.findById(actingStaffUserId);
    if (user == null || user.email == null || !isAdminEmail(user.email)) {
      void StaffAuditEvent.record({
        userId: actingStaffUserId,
        action: "site-config-refused",
        detail: `${what}: not an admin (via ops app)`,
        ip: clientIp(ctx),
      });
      throw new ForbiddenError("Only an admin can change site settings.");
    }
    return user;
  }

  /**
   * The ops app's own Settings screen — who's allowlisted and what proves
   * their identity, read-only. Same shape and same query pattern as the
   * in-repo desk's own `/_/support/desk/staff` — an address with no
   * account yet still appears, since this lists who's *allowed*, not just
   * who's signed in.
   */
  @http.GET("/_/internal/staff-roster")
  async listStaffRoster(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    const roster = await Promise.all(
      listStaffEmails().map(async (email) => {
        const user = await User.findByEmail(email);
        if (user == null) {
          return {
            email,
            name: null,
            hasPasskey: false,
            hasAuthenticator: false,
            lastSignedInAt: null,
          };
        }
        const [credentials, lastLogin] = await Promise.all([
          Credential.listForUser(user.id!),
          SecurityEvent.lastOfType(user.id!, "login"),
        ]);
        return {
          email,
          name: user.name ?? null,
          hasPasskey: credentials.length > 0,
          hasAuthenticator: Boolean(user.totpEnabled),
          lastSignedInAt:
            lastLogin != null
              ? new Date(lastLogin.createdAt!).toISOString()
              : null,
        };
      }),
    );
    ctx.response.body = roster;
  }

  /**
   * The desk pushing its roster here — QDesk owns "who is staff" now, and
   * this app keeps a synced replica that `isStaffEmail`'s per-worker cache
   * reads (see staff-cache.ts).
   *
   * A full-list replace rather than add/remove deltas, deliberately: it is
   * idempotent, self-healing after a missed push, and there is no ordering
   * to get wrong. Reconciliation is add-what's-missing, soft-remove
   * what's-absent — never a DELETE, because the audit trail refers to
   * people by rows that must keep resolving after they've gone.
   *
   * Admins are unaffected by construction: they come from ADMIN_EMAILS and
   * are staff whether or not any row says so, so a push can neither grant
   * nor revoke admin. That invariant is what makes a desk-managed roster
   * acceptable at all.
   */
  @http.PUT("/_/internal/staff-roster")
  async syncStaffRoster(
    ctx: Context<RouterState & AuthState>,
    @body.json(PStaffRosterSync) input: TStaffRosterSync,
  ) {
    ctx.state.requireOpsApi();
    const wanted = new Set(
      input.emails
        .map((email) => email.trim().toLowerCase())
        .filter((e) => e !== ""),
    );
    const current = new Set(await Staff.activeEmails());
    let added = 0;
    let removed = 0;
    for (const email of wanted) {
      if (!current.has(email)) {
        await Staff.add(email, null);
        added++;
      }
    }
    for (const email of current) {
      if (!wanted.has(email)) {
        await Staff.remove(email);
        removed++;
      }
    }
    if (added > 0 || removed > 0) {
      void StaffAuditEvent.record({
        action: "staff-roster-synced",
        detail: `desk push: ${added} added, ${removed} removed, ${wanted.size} active`,
      });
      // The per-worker caches refresh on their own timer; this refresh
      // makes THIS worker answer correctly straight away, so the desk
      // can read back what it just wrote without racing the interval.
      await refreshStaffCache();
    }
    ctx.response.body = { added, removed, active: [...wanted] };
  }

  /**
   * The failsafe passcode behind the desk's Tab & automation unlock.
   *
   * The hash and the failure counter live HERE (DeskUnlock, one row,
   * scrypt) rather than in the desk, so a leaked desk database contains
   * nothing that opens the gate, and the lockout counter is shared however
   * many desks or workers ask. The desk's passkey path never touches this
   * — a passkey is not guessable, so it gets no counter and cannot be
   * locked out (which also means a flood of wrong passcodes can never
   * deny the admin their passkey).
   */
  @http.POST("/_/internal/desk-unlock/check")
  async checkDeskUnlock(
    ctx: Context<RouterState & AuthState>,
    @body.json(PDeskUnlockCheck) input: TDeskUnlockCheck,
  ) {
    ctx.state.requireOpsApi();
    const result = await checkUnlockPasscode(input.passcode, clientIp(ctx));
    void StaffAuditEvent.record({
      action: result.ok ? "desk-unlock" : "desk-unlock-failed",
      detail: result.ok
        ? `by ${input.staffEmail}`
        : `${input.staffEmail}: ${result.reason}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = result.ok
      ? { ok: true }
      : result.reason === "locked"
        ? { ok: false, reason: "locked", until: result.until.toISOString() }
        : result.reason === "wrong"
          ? { ok: false, reason: "wrong", remaining: result.remaining }
          : { ok: false, reason: "no-passcode" };
  }

  /** Same masked scope the desk's own Accounts page has always shown. */
  @http.GET("/_/internal/accounts/{id}")
  async getAccount(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireOpsApi();
    const user = await User.query().findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    const profileCount = await Profile.query().where("userId", id).resultSize();
    const lastLogin = await SecurityEvent.query()
      .where({ userId: id, type: "login" })
      .orderBy("createdAt", "desc")
      .first();
    const tickets = await SupportTicket.query()
      .where("userId", id)
      .orderBy("createdAt", "desc")
      .limit(10);
    // Control centre, phase 1.9: the switch lives in site_config now.
    const showLocation = showLastLoginLocation();
    const deletionRequest = await AccountDeletionRequest.findPendingForUser(id);

    // Three facts the desk asks for on nearly every ticket, and had to
    // guess at: what they are paying for, whether they belong to a
    // school, and whether this is the same person as an account they
    // already have. Guessing the third is how a household ends up with
    // two records and a support conversation that contradicts itself.
    const order = await Order.query().findOne({ userId: id });
    const memberships = await OrgMember.membershipsFor(id);
    const org =
      memberships.length === 0
        ? null
        : await Organization.query().findById(memberships[0]!.organizationId!);

    // A duplicate is a name and a country that match, registered within a
    // week either side. Deliberately narrow: a false positive here invites
    // a staff member to merge two real people, and unpicking that is not
    // a thing this system can do. It suggests; a person decides.
    const NEAR_MS = 7 * 24 * 60 * 60 * 1000;
    const registeredAt = new Date(user.createdAt!).getTime();
    const sameName =
      user.name == null || user.name.trim() === ""
        ? []
        : await User.query()
            .where("name", user.name)
            .whereNot("id", id)
            .orderBy("createdAt", "desc")
            .limit(5);
    const possibleDuplicates = sameName
      .filter((u) => (u.signupCountry ?? null) === (user.signupCountry ?? null))
      .filter(
        (u) =>
          Math.abs(new Date(u.createdAt!).getTime() - registeredAt) <= NEAR_MS,
      )
      .map((u) => {
        const theirs = new Date(u.createdAt!).getTime();
        const days = Math.round(
          Math.abs(theirs - registeredAt) / (24 * 60 * 60 * 1000),
        );
        const when =
          days === 0
            ? "the same day"
            : `${days} day${days === 1 ? "" : "s"} ${theirs < registeredAt ? "earlier" : "later"}`;
        return {
          id: u.id!,
          name: u.name!,
          email: maskEmail(u.email!),
          signInMethod: deriveSignInMethod(u),
          createdAt: new Date(u.createdAt!).toISOString(),
          why: `same name, same country, registered ${when}`,
        };
      });

    ctx.response.body = {
      id: user.id!,
      name: user.name!,
      email: maskEmail(user.email!),
      emailVerified: Boolean(user.emailVerified),
      createdAt: new Date(user.createdAt!).toISOString(),
      signInMethod: deriveSignInMethod(user),
      signupCountry: user.signupCountry ?? null,
      locale: user.locale ?? null,
      profileCount,
      lastLogin:
        lastLogin == null
          ? null
          : {
              at: new Date(lastLogin.createdAt!).toISOString(),
              ip: showLocation ? (lastLogin.ip ?? null) : null,
              userAgent: showLocation ? (lastLogin.userAgent ?? null) : null,
            },
      tickets: tickets.map((t) => ({
        id: t.id!,
        subject: t.subject!,
        status: t.status!,
        createdAt: new Date(t.createdAt!).toISOString(),
      })),
      deletionRequest: deletionRequest?.toDetails() ?? null,
      // "Free" is the absence of an order, not a stored plan — said here
      // rather than left for the desk to work out, so both sides cannot
      // disagree about what somebody is paying for.
      plan: order == null ? "free" : "premium",
      organisation:
        org == null
          ? null
          : {
              id: org.id!,
              name: org.name!,
              role: memberships[0]!.role ?? null,
            },
      possibleDuplicates,
    };
  }

  /**
   * The facts an account holder may be told about their own account.
   *
   * Deliberately NOT `getAccount` with fewer fields. That one is the
   * staff Accounts page: it carries a masked email, the last login's IP
   * and user agent, and any pending deletion request — things a support
   * agent may look at and must never read back to the person on the
   * other end. This is the answering surface, so it holds only what the
   * customer already knows about themselves and might reasonably ask us
   * to confirm: when they started, how many learners they set up, and
   * what those learners are called.
   *
   * **No practice content, by design.** `practice_session` is
   * deliberately skeletal — its own docstring says the support and
   * analytics surface "must never see a lesson, a speed, an accuracy or
   * a keystroke" — so "how much has she improved" cannot be answered
   * from here and is not attempted. Adding it is a decision about that
   * boundary, not a field to slip in.
   *
   * Scoped by the caller, not by this route: QDesk resolves the id from
   * the ticket the customer wrote on, so the agent never supplies one.
   */
  @http.GET("/_/internal/accounts/{id}/self-summary")
  async accountSelfSummary(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireOpsApi();
    const user = await User.query().findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    const profiles = await Profile.query()
      .where("userId", id)
      .orderBy("createdAt", "asc");
    // How often they have actually been here lately, and what the last
    // visit looked like. The desk asks because half the tickets it gets
    // are "why does it look like this", and the answer is usually in the
    // account's own settings rather than in anything the customer can
    // describe.
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const [signIns28d, lastLogin] = await Promise.all([
      SecurityEvent.query()
        .where({ userId: id, type: "login" })
        .where("createdAt", ">=", since)
        .resultSize(),
      SecurityEvent.query()
        .where({ userId: id, type: "login" })
        .orderBy("createdAt", "desc")
        .first(),
    ]);

    // When each learner last actually practised — one stat per profile,
    // not a walk of their whole result history. "Which of these people
    // uses it" is the question behind most household tickets.
    const practised = await Promise.all(
      profiles.map(async (p) => {
        const at = await this.userData
          .loadProfile(id, p.id!)
          .lastWrittenAt()
          .catch(() => null);
        return [p.id!, at] as const;
      }),
    );
    const lastPractised = new Map(practised);

    // Which learners have accessibility switches on. A boolean each, from
    // the durable per-profile file — never which switches, and never why.
    const adapted = new Map(
      await Promise.all(
        profiles.map(
          async (p) =>
            [
              p.id!,
              await a11yAdapted(this.dataDir.a11yPrefsFile(id, p.id!)),
            ] as const,
        ),
      ),
    );

    // The certificates each learner holds: which paper, at what level, in
    // which language, and its number, so a "my certificate says…" ticket
    // can be matched to the document. The speed and accuracy printed on
    // it stay behind: support does not see practice figures, and a
    // certificate is the one place those figures are written down.
    const key = numberingKey(this.dataDir.dataPath());
    const certificates = new Map<number, unknown[]>();
    for (const c of await Certificate.query()
      .where("userId", id)
      .orderBy("createdAt", "asc")) {
      const list = certificates.get(c.profileId!) ?? [];
      list.push({
        number: certificateNumber(c.sequence!, key),
        kind: c.kind,
        audience: c.audience,
        level: c.level,
        sheet: c.sheet,
        language: c.language,
        issuedAt: new Date(c.createdAt!).toISOString(),
      });
      certificates.set(c.profileId!, list);
    }

    // Feedback cards and poll answers they left. The desk shows these
    // because a person who has already told you what they think of the
    // product should not be asked again in a support reply.
    const responses = await LearnerResponse.listForUser(id);

    ctx.response.body = {
      memberSince: new Date(user.createdAt!).toISOString(),
      profileCount: profiles.length,
      // First names only. The surname belongs to a child on a family
      // account and is never needed to answer "how many profiles do I
      // have" or "which one is the braille one".
      profiles: profiles.map((p) => ({
        firstName: p.firstName!,
        kind: p.kind ?? "adult",
        visionSupport: Boolean(p.visionSupport),
        createdAt: new Date(p.createdAt!).toISOString(),
        // What this learner's client is set to. Read out of the prefs
        // blob rather than passed through whole: the blob is a client
        // implementation detail and carries far more than a support
        // agent has any business seeing.
        settings: readVisibleSettings(p.prefs ?? null),
        lastPractisedAt: lastPractised.get(p.id!)?.toISOString() ?? null,
        // The fact, not the adaptations — see a11yAdapted above.
        accessibility: adapted.get(p.id!) ?? false,
        certificates: certificates.get(p.id!) ?? [],
      })),
      feedback: responses
        .filter((r) => r.stars != null || (r.text ?? "") !== "")
        .map((r) => ({
          at: new Date(r.createdAt ?? Date.now()).toISOString(),
          stars: r.stars ?? null,
          // Hidden means a staff member dropped the text; the star stays.
          text: r.hiddenAt != null ? null : (r.text ?? null),
        })),
      signIns28d,
      lastSignInAt:
        lastLogin?.createdAt == null
          ? null
          : new Date(lastLogin.createdAt).toISOString(),
    };
  }

  /**
   * A data request, answered by a staff member on the person's behalf.
   *
   * The same bytes the account holder would download themselves — see
   * {@link buildAccountExport}. A staff member answers these because the
   * person asking usually cannot sign in; that is often WHY they are
   * asking, and a desk that can only say "download it yourself" cannot
   * answer a request from somebody locked out of the account.
   *
   * Logged against the staff member who asked. There is no reason to
   * take a copy of somebody's whole record that does not survive being
   * written down next to a name.
   */
  @http.GET("/_/internal/accounts/{id}/export")
  async exportAccountForStaff(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @queryParam("actingStaffUserId", pActingStaffUserId)
    actingStaffUserId: number | undefined,
    @queryParam("reason", pQuery) reason: string | undefined,
  ) {
    ctx.state.requireOpsApi();
    const user = await User.query().findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    void StaffAuditEvent.record({
      userId: actingStaffUserId ?? null,
      action: "account-data-exported",
      detail:
        `account ${id}` +
        (reason ? `: ${reason.slice(0, 160)}` : "") +
        " (via ops app)",
      ip: clientIp(ctx),
    });
    ctx.response.body = await buildAccountExport(this.userData, user);
    ctx.response.headers.set("Cache-Control", "private, no-store");
  }

  /**
   * Two records, one person.
   *
   * Households do this constantly: a magic link one week, "sign in with
   * Google" the next, and now there are two accounts with one child's
   * progress split between them. The desk finds them; a staff member
   * decides; this moves them.
   *
   * What it does is deliberately narrow, and it is exactly what the
   * button promises. Profiles and tickets move to the account being kept.
   * Sign-in methods move too, so both ways in still work — unless the
   * kept account already has that provider, in which case its own is left
   * alone rather than overwritten.
   *
   * NOTHING is deleted. The merged-from account stays, empty, and the
   * audit row on both sides says where its contents went. An account
   * merge that deletes is a merge that cannot be argued with afterwards,
   * and this is precisely the operation somebody will need to argue with.
   */
  @http.POST("/_/internal/accounts/{id}/merge")
  async mergeAccount(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json() input: unknown,
  ) {
    ctx.state.requireOpsApi();
    const parsed = z
      .object({
        fromId: z.number().int().positive(),
        reason: z.string().min(1).max(200),
        actingStaffUserId: z.number().int().positive().nullable().optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      throw new BadRequestError(
        "An account to merge from, and a reason, are needed.",
      );
    }
    const { fromId, reason } = parsed.data;
    if (fromId === id) {
      throw new BadRequestError("An account cannot be merged into itself.");
    }
    const [keep, gone] = await Promise.all([
      User.query().findById(id),
      User.query().findById(fromId),
    ]);
    if (keep == null || gone == null) {
      ctx.response.status = 404;
      return;
    }

    const providersHere = new Set(
      (await UserExternalId.query().where("userId", id)).map(
        (x) => x.provider!,
      ),
    );
    const movable = (
      await UserExternalId.query().where("userId", fromId)
    ).filter((x) => !providersHere.has(x.provider!));

    const moved = await User.transaction(async (trx) => {
      const profiles = await Profile.query(trx)
        .where("userId", fromId)
        .patch({ userId: id });
      const tickets = await SupportTicket.query(trx)
        .where("userId", fromId)
        .patch({ userId: id });
      const credentials = await Credential.query(trx)
        .where("userId", fromId)
        .patch({ userId: id });
      let signIns = 0;
      for (const row of movable) {
        await UserExternalId.query(trx).findById(row.id!).patch({ userId: id });
        signIns++;
      }
      return { profiles, tickets, credentials, signIns };
    });

    // Written against BOTH accounts, because somebody investigating will
    // start from whichever one they were handed.
    for (const target of [id, fromId]) {
      void StaffAuditEvent.record({
        userId: parsed.data.actingStaffUserId ?? null,
        action: "account-merged",
        detail:
          `account ${fromId} merged into ${id}: ` +
          `${moved.profiles} profile(s), ${moved.tickets} ticket(s), ` +
          `${moved.signIns} sign-in method(s) — ${reason.slice(0, 160)} (via ops app)`,
        ip: clientIp(ctx),
      });
      void target;
    }

    ctx.response.body = { ...moved, keptId: id, mergedFromId: fromId };
  }

  @http.POST("/_/internal/accounts/{id}/reveal-email")
  async revealAccountEmail(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PActedRequest) input: TActedRequest,
  ) {
    ctx.state.requireOpsApi();
    const user = await User.findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    void StaffAuditEvent.record({
      userId: input.actingStaffUserId ?? null,
      action: "account-email-revealed",
      detail: `account ${id} — ${input.reason} (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { email: user.email };
  }

  @http.POST("/_/internal/accounts/{id}/request-deletion")
  async requestAccountDeletion(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PActedRequest) input: TActedRequest,
  ) {
    ctx.state.requireOpsApi();
    const user = await User.findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    if (user.email == null) {
      throw new ApplicationError(
        "This account has no email address to notify.",
      );
    }
    const existing = await AccountDeletionRequest.findPendingForUser(id);
    if (existing != null) {
      throw new ApplicationError(
        "A deletion is already scheduled for this account.",
      );
    }
    const { request, cancelToken } = await AccountDeletionRequest.request({
      userId: id,
      requestedByUserId: input.actingStaffUserId ?? null,
      reason: input.reason,
    });
    await this.mailer.sendMail(
      messageAccountDeletionRequested({
        email: user.email,
        when: new Date(request.executeAt!).toLocaleString(undefined, {
          dateStyle: "long",
          timeStyle: "short",
        }),
        cancelLink: this.#link(`/support/deletion-cancel/${cancelToken}`),
        contactLink: this.#link("/support"),
      }),
    );
    // On the bell as well as in the email.
    //
    // This is the one notification in the app where silence is the
    // destructive option: the window closes by itself and the account goes.
    // The email is the formal notice and carries the cancel link, but an
    // email can sit unread in a folder for two days — the bell is seen by
    // anybody who opens the app at all, which is exactly the population
    // whose account is about to be deleted.
    try {
      await Notification.create({
        userId: id,
        kind: "account-deletion-scheduled",
        ticketId: null,
        body: `This account is scheduled for deletion on ${new Date(
          request.executeAt!,
        ).toLocaleString(undefined, {
          dateStyle: "long",
          timeStyle: "short",
        })}. Check your email for the link to stop it, or contact support.`,
        authorName: null,
        fromAssistant: false,
      });
    } catch {
      // Best-effort, like every other notification: the email is the notice
      // of record and has already been sent.
    }
    void StaffAuditEvent.record({
      userId: input.actingStaffUserId ?? null,
      action: "account-deletion-requested",
      detail: `account ${id} — ${input.reason} (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { deletionRequest: request.toDetails() };
  }

  @http.POST("/_/internal/accounts/{id}/cancel-deletion")
  async cancelAccountDeletion(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PActedRequest) input: TActedRequest,
  ) {
    ctx.state.requireOpsApi();
    const pending = await AccountDeletionRequest.findPendingForUser(id);
    if (pending == null) {
      ctx.response.status = 404;
      return;
    }
    const cancelled = await pending.cancel("staff");
    void StaffAuditEvent.record({
      userId: input.actingStaffUserId ?? null,
      action: "account-deletion-cancelled",
      detail: `account ${id} — ${input.reason} (via ops app)`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { deletionRequest: cancelled.toDetails() };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

type AccountStats = {
  readonly accountsTotal: number;
  readonly newLast7Days: number;
  readonly avgLoginsPerActiveUserPerWeek: number;
  readonly avgSessionsPerActiveUserPerWeek: number;
  readonly signupTrend: readonly number[];
  readonly signupTrendToday: readonly number[];
  readonly signupTrendAllTime: readonly number[];
  /** One signup count per day for the last 365 days, oldest first. */
  readonly signupTrendYear: readonly number[];
  readonly byCountry: readonly {
    readonly country: string;
    readonly count: number;
  }[];
  readonly byLanguage: readonly {
    readonly language: string;
    readonly count: number;
  }[];
  readonly bySignupMethod: readonly {
    readonly method: string;
    readonly count: number;
  }[];
  readonly kidsVsGrownups: readonly {
    readonly kind: string;
    readonly count: number;
  }[];
  /** Accounts whose address is confirmed; the rest cannot be written to. */
  readonly accountsVerified: number;
  /** When the most recent account was created, ISO, or null on an empty desk. */
  readonly newestSignupAt: string | null;
  /** Accounts with at least one kid profile — households, counted once each. */
  readonly householdsWithKid: number;
  /** The largest number of profiles on any single account. */
  readonly mostProfilesInOne: number;
  /** Ad campaigns by state; "running" means on screen right now. */
  readonly campaignCounts: {
    readonly running: number;
    readonly paused: number;
    readonly scheduled: number;
    readonly draft: number;
    readonly finished: number;
    readonly archived: number;
  };
  /** Accounts with no sign-in for 28 days (or never), longest-quiet first. */
  readonly inactive: {
    readonly count: number;
    readonly neverSignedIn: number;
    readonly longest: readonly {
      readonly userId: number;
      readonly name: string;
      readonly daysSinceLogin: number;
    }[];
  };
  /** Account deletion requests by state, with the most recent few. */
  readonly deletions: {
    readonly pending: number;
    readonly completed30d: number;
    readonly cancelled30d: number;
    readonly recent: readonly {
      readonly userId: number;
      readonly name: string;
      readonly state: "pending" | "completed" | "cancelled";
      readonly requestedAt: string;
      readonly executeAt: string;
      readonly reason: string | null;
    }[];
  };
  readonly topCountry: string | null;
  readonly computedAt: string;
};

const ACCOUNT_STATS_TTL_MS = 10 * 60 * 1000;
let accountStatsCache: {
  readonly data: AccountStats;
  readonly at: number;
} | null = null;

/**
 * Account-side aggregate stats for the ops app's own Dashboard — same
 * queries and bucketing as this repo's own `computeDashboard()`
 * (`support/controller.ts`), deliberately reimplemented rather than
 * imported so the ops app's contract here doesn't silently shift if that
 * function's shape changes for the in-repo desk's own reasons.
 */
async function computeAccountStats(): Promise<AccountStats> {
  const now = Date.now();
  if (
    accountStatsCache != null &&
    now - accountStatsCache.at < ACCOUNT_STATS_TTL_MS
  ) {
    return accountStatsCache.data;
  }
  const knex = User.knex();

  const accountsTotal = await User.query().resultSize();
  const since7 = new Date(now - 7 * DAY_MS);
  const newLast7Days = await User.query()
    .where("createdAt", ">=", since7)
    .resultSize();

  const since14 = new Date(now - 14 * DAY_MS);
  const recentUsers = await User.query()
    .select("createdAt")
    .where("createdAt", ">=", since14);
  const byDay = new Map<string, number>();
  for (const u of recentUsers) {
    const day = new Date(u.createdAt!).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const signupTrend: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    signupTrend.push(byDay.get(day) ?? 0);
  }

  const HOUR_MS = 60 * 60 * 1000;
  const since24h = new Date(now - 24 * HOUR_MS);
  const todayUsers = await User.query()
    .select("createdAt")
    .where("createdAt", ">=", since24h);
  const byHour = new Map<string, number>();
  for (const u of todayUsers) {
    const hourKey = new Date(u.createdAt!).toISOString().slice(0, 13);
    byHour.set(hourKey, (byHour.get(hourKey) ?? 0) + 1);
  }
  const signupTrendToday: number[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourKey = new Date(now - i * HOUR_MS).toISOString().slice(0, 13);
    signupTrendToday.push(byHour.get(hourKey) ?? 0);
  }

  const firstUser = await User.query()
    .select("createdAt")
    .orderBy("createdAt", "asc")
    .first();
  // id and name as well: the inactive and deletion lists further down name
  // people, and this is the one read of the table.
  const allUsers = await User.query().select("id", "name", "createdAt");
  const byMonth = new Map<string, number>();
  for (const u of allUsers) {
    const monthKey = new Date(u.createdAt!).toISOString().slice(0, 7);
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + 1);
  }
  /**
   * One count per day for the last year, for the desk's signup calendar.
   *
   * Built from `allUsers`, which is already in memory for the monthly series
   * and the inactive/deletion lists below — a year of daily buckets is a walk
   * over a list this read has already paid for, not a second query.
   *
   * UTC days, matching every other bucket in this function. A calendar drawn
   * in the reader's zone would disagree with the monthly totals beside it at
   * every month boundary, which is a worse problem than a cell that turns
   * over a few hours early for somebody in Sydney.
   */
  const byDayYear = new Map<string, number>();
  for (const u of allUsers) {
    const dayKey = new Date(u.createdAt!).toISOString().slice(0, 10);
    byDayYear.set(dayKey, (byDayYear.get(dayKey) ?? 0) + 1);
  }
  const signupTrendYear: number[] = [];
  for (let i = 364; i >= 0; i--) {
    signupTrendYear.push(
      byDayYear.get(new Date(now - i * DAY_MS).toISOString().slice(0, 10)) ?? 0,
    );
  }

  const signupTrendAllTime: number[] = [];
  const firstMonth = new Date(
    firstUser?.createdAt != null
      ? new Date(firstUser.createdAt).getTime()
      : now,
  );
  firstMonth.setUTCDate(1);
  const cursor = new Date(firstMonth);
  const nowMonth = new Date(now);
  while (
    cursor.getUTCFullYear() < nowMonth.getUTCFullYear() ||
    (cursor.getUTCFullYear() === nowMonth.getUTCFullYear() &&
      cursor.getUTCMonth() <= nowMonth.getUTCMonth())
  ) {
    signupTrendAllTime.push(byMonth.get(cursor.toISOString().slice(0, 7)) ?? 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const countryRows = (await knex(User.tableName)
    .select("signup_country")
    .whereNotNull("signup_country")
    .count({ count: "*" })
    .groupBy("signup_country")) as {
    signup_country: string;
    count: number | string;
  }[];
  const sortedCountries = countryRows
    .map((r) => ({ country: r.signup_country, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);
  const byCountry = sortedCountries.slice(0, 8);
  const otherCount = sortedCountries
    .slice(8)
    .reduce((sum, r) => sum + r.count, 0);
  if (otherCount > 0) {
    byCountry.push({ country: "other", count: otherCount });
  }

  const localeRows = (await knex(User.tableName)
    .select("locale")
    .whereNotNull("locale")
    .count({ count: "*" })
    .groupBy("locale")) as { locale: string; count: number | string }[];
  const sortedLocales = localeRows
    .map((r) => ({ language: r.locale, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);
  const byLanguage = sortedLocales.slice(0, 8);
  const otherLocaleCount = sortedLocales
    .slice(8)
    .reduce((sum, r) => sum + r.count, 0);
  if (otherLocaleCount > 0) {
    byLanguage.push({ language: "other", count: otherLocaleCount });
  }

  const providerRows = (await knex("user_external_id")
    .select("provider")
    .count({ count: "*" })
    .groupBy("provider")) as { provider: string; count: number | string }[];
  const noProvider = knex("user_external_id").select("user_id");
  const passwordOnly = (await knex(User.tableName)
    .whereNotNull("password_hash")
    .whereNotIn("id", noProvider)
    .count({ count: "*" })
    .first()) as { count: number | string } | undefined;
  const magicLinkOnly = (await knex(User.tableName)
    .whereNull("password_hash")
    .whereNotIn("id", knex("user_external_id").select("user_id"))
    .count({ count: "*" })
    .first()) as { count: number | string } | undefined;
  const bySignupMethod = [
    ...providerRows.map((r) => ({
      method: r.provider,
      count: Number(r.count),
    })),
    { method: "password", count: Number(passwordOnly?.count ?? 0) },
    { method: "magic-link", count: Number(magicLinkOnly?.count ?? 0) },
  ];

  const kindRows = (await knex("profile")
    .select("kind")
    .count({ count: "*" })
    .groupBy("kind")) as { kind: string; count: number | string }[];
  const kidsVsGrownups = kindRows.map((r) => ({
    kind: r.kind,
    count: Number(r.count),
  }));

  // What the desk's "Who signed up" panel asks next, once it has shown the
  // split: of these accounts, how many are reachable, when did the last one
  // arrive, and how many households actually put a child on the product.
  // Each is one aggregate over a table already being read here.
  const verifiedRow = (await knex("user")
    .where("email_verified", true)
    .count({ count: "*" })
    .first()) as { count: number | string } | undefined;
  const accountsVerified = Number(verifiedRow?.count ?? 0);

  const newestRow = (await knex("user").max({ at: "created_at" }).first()) as
    | { at: string | number | Date | null }
    | undefined;
  const newestSignupAt =
    newestRow?.at == null ? null : new Date(newestRow.at).toISOString();

  // Households, not profiles: an account with three children counts once,
  // because the question is how many families use the kid side at all.
  const kidHouseholdRow = (await knex("profile")
    .where("kind", "kid")
    .countDistinct({ count: "user_id" })
    .first()) as { count: number | string } | undefined;
  const householdsWithKid = Number(kidHouseholdRow?.count ?? 0);

  const perAccountRows = (await knex("profile")
    .select("user_id")
    .count({ count: "*" })
    .groupBy("user_id")) as { user_id: number; count: number | string }[];
  const mostProfilesInOne = perAccountRows.reduce(
    (max, r) => Math.max(max, Number(r.count)),
    0,
  );

  // Campaigns by state, for the desk's Notices & campaigns panel. "Running"
  // is derived the way the sponsor slot derives it — scheduled, inside its
  // window, not archived — so the desk's count and what learners actually
  // see can never disagree. Everything else is the stored status.
  const campaigns = await AdCampaign.query();
  const campaignCounts = {
    running: 0,
    paused: 0,
    scheduled: 0,
    draft: 0,
    finished: 0,
    archived: 0,
  };
  for (const c of campaigns) {
    if (c.archived) campaignCounts.archived += 1;
    else if (c.live(now)) campaignCounts.running += 1;
    else if (c.status === "paused") campaignCounts.paused += 1;
    else if (c.status === "scheduled") campaignCounts.scheduled += 1;
    else if (c.status === "draft") campaignCounts.draft += 1;
    else campaignCounts.finished += 1;
  }

  // Who has gone quiet, and who is leaving. Both are questions the desk gets
  // asked by name, so each carries a short list beside its count — names
  // only, never addresses; the desk's customer pages hold those behind their
  // own reveal.
  const lastLoginRows = (await knex("security_event")
    .select("user_id")
    .max({ at: "created_at" })
    .where("type", "login")
    .groupBy("user_id")) as { user_id: number; at: string | number | Date }[];
  const lastLoginByUser = new Map(
    lastLoginRows.map((r) => [r.user_id, new Date(r.at).getTime()]),
  );
  const INACTIVE_AFTER = 28 * DAY_MS;
  const inactiveList = allUsers
    .map((u) => {
      const id = u.id!;
      const created =
        u.createdAt != null ? new Date(u.createdAt).getTime() : now;
      const last = lastLoginByUser.get(id) ?? created;
      return {
        userId: id,
        name: u.name ?? "",
        daysSinceLogin: Math.floor((now - last) / DAY_MS),
        everSignedIn: lastLoginByUser.has(id),
        quietFor: now - last,
      };
    })
    .filter((u) => u.quietFor >= INACTIVE_AFTER)
    .sort((a, b) => b.daysSinceLogin - a.daysSinceLogin);
  const inactive = {
    count: inactiveList.length,
    neverSignedIn: inactiveList.filter((u) => !u.everSignedIn).length,
    longest: inactiveList
      .slice(0, 6)
      .map(({ userId, name, daysSinceLogin }) => ({
        userId,
        name,
        daysSinceLogin,
      })),
  };

  const deletionRows = (await knex("account_deletion_request")
    .select(
      "user_id",
      "reason",
      "execute_at",
      "cancelled_at",
      "completed_at",
      "created_at",
    )
    .orderBy("created_at", "desc")
    .limit(200)) as {
    user_id: number;
    reason: string | null;
    execute_at: string | number | Date;
    cancelled_at: string | number | Date | null;
    completed_at: string | number | Date | null;
    created_at: string | number | Date;
  }[];
  const nameOf = new Map(allUsers.map((u) => [u.id!, u.name ?? ""]));
  const since30 = now - 30 * DAY_MS;
  const stateOf = (
    r: (typeof deletionRows)[number],
  ): "pending" | "completed" | "cancelled" =>
    r.completed_at != null
      ? "completed"
      : r.cancelled_at != null
        ? "cancelled"
        : "pending";
  const deletions = {
    pending: deletionRows.filter((r) => stateOf(r) === "pending").length,
    completed30d: deletionRows.filter(
      (r) =>
        stateOf(r) === "completed" &&
        new Date(r.completed_at!).getTime() >= since30,
    ).length,
    cancelled30d: deletionRows.filter(
      (r) =>
        stateOf(r) === "cancelled" &&
        new Date(r.cancelled_at!).getTime() >= since30,
    ).length,
    recent: deletionRows.slice(0, 6).map((r) => ({
      userId: r.user_id,
      name: nameOf.get(r.user_id) ?? "",
      state: stateOf(r),
      requestedAt: new Date(r.created_at).toISOString(),
      executeAt: new Date(r.execute_at).toISOString(),
      reason: r.reason ?? null,
    })),
  };

  const sinceDays = 28;
  const sinceLogin = new Date(now - sinceDays * DAY_MS);
  const loginRow = (await knex("security_event")
    .where("type", "login")
    .where("created_at", ">=", sinceLogin)
    .count({ logins: "*" })
    .countDistinct({ activeUsers: "user_id" })
    .first()) as
    | { logins: number | string; activeUsers: number | string }
    | undefined;
  const logins = Number(loginRow?.logins ?? 0);
  const activeLoginUsers = Number(loginRow?.activeUsers ?? 0);
  const avgLoginsPerActiveUserPerWeek =
    logins === 0 || activeLoginUsers === 0
      ? 0
      : logins / (activeLoginUsers * (sinceDays / 7));

  const avgSessionsPerActiveUserPerWeek =
    await PracticeSession.avgSessionsPerActiveUserPerWeek();

  const topCountryRow = byCountry.find((r) => r.country !== "other");
  const topCountry = topCountryRow != null ? topCountryRow.country : null;

  const data: AccountStats = {
    accountsTotal,
    newLast7Days,
    avgLoginsPerActiveUserPerWeek,
    avgSessionsPerActiveUserPerWeek,
    signupTrend,
    signupTrendToday,
    signupTrendAllTime,
    signupTrendYear,
    byCountry,
    byLanguage,
    bySignupMethod,
    kidsVsGrownups,
    accountsVerified,
    newestSignupAt,
    householdsWithKid,
    mostProfilesInOne,
    campaignCounts,
    inactive,
    deletions,
    topCountry,
    computedAt: new Date(now).toISOString(),
  };
  accountStatsCache = { data, at: now };
  return data;
}
