import { readFile } from "node:fs/promises";
import {
  body,
  controller,
  http,
  pathParam,
  queryParam,
} from "@fastr/controller";
import { Context } from "@fastr/core";
import { ApplicationError, ForbiddenError, NotFoundError } from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { DataDir, Env, isAdminEmail, listStaffEmails } from "@keylearn/config";
import {
  AccountDeletionRequest,
  checkUnlockPasscode,
  Credential,
  LearnerResponse,
  maskEmail,
  PracticeSession,
  Profile,
  SecurityEvent,
  Staff,
  StaffAuditEvent,
  StaffSettings,
  SupportAttachment,
  SupportTicket,
  User,
  verifyTotp,
} from "@keylearn/database";
import { UserDataFactory } from "@keylearn/result-userdata";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { z } from "zod";
import { messageAccountDeletionRequested } from "../auth/email.ts";
import { clientIp, rateLimit } from "../auth/ratelimit.ts";
import { staffAccessStatus } from "../auth/staff-access.ts";
import { refreshStaffCache } from "../auth/staff-cache.ts";
import { resolveTotpSecret } from "../auth/totp-crypto.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
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

  @http.GET("/_/internal/accounts/search")
  async searchAccounts(
    ctx: Context<RouterState & AuthState>,
    @queryParam("query", pQuery) query: string | undefined,
    @queryParam("actingStaffUserId", pActingStaffUserId)
    actingStaffUserId: number | undefined,
  ) {
    ctx.state.requireOpsApi();
    const term = query?.trim();
    const users = await (term
      ? User.query()
          .where((q) =>
            q
              .where("email", "like", `%${term}%`)
              .orWhere("name", "like", `%${term}%`),
          )
          .orderBy("createdAt", "desc")
          .limit(20)
      : User.query().orderBy("createdAt", "desc").limit(10));

    const results = await Promise.all(
      users.map(async (u) => {
        const profileCount = await Profile.query()
          .where("userId", u.id!)
          .resultSize();
        const lastLogin = await SecurityEvent.query()
          .where({ userId: u.id!, type: "login" })
          .orderBy("createdAt", "desc")
          .first();
        return {
          id: u.id!,
          name: u.name!,
          email: maskEmail(u.email!),
          emailVerified: Boolean(u.emailVerified),
          createdAt: new Date(u.createdAt!).toISOString(),
          signInMethod: deriveSignInMethod(u),
          profileCount,
          lastSeen:
            lastLogin?.createdAt != null
              ? new Date(lastLogin.createdAt).toISOString()
              : null,
        };
      }),
    );

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
      })),
    };
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
  const allUsers = await User.query().select("createdAt");
  const byMonth = new Map<string, number>();
  for (const u of allUsers) {
    const monthKey = new Date(u.createdAt!).toISOString().slice(0, 7);
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + 1);
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
    byCountry,
    byLanguage,
    bySignupMethod,
    kidsVsGrownups,
    topCountry,
    computedAt: new Date(now).toISOString(),
  };
  accountStatsCache = { data, at: now };
  return data;
}
