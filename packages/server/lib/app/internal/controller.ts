import {
  body,
  controller,
  http,
  pathParam,
  queryParam,
} from "@fastr/controller";
import { Context } from "@fastr/core";
import { ApplicationError } from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { Env, listStaffEmails } from "@keylearn/config";
import {
  AccountDeletionRequest,
  Credential,
  maskEmail,
  PracticeSession,
  Profile,
  SecurityEvent,
  StaffAuditEvent,
  StaffSettings,
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
import { resolveTotpSecret } from "../auth/totp-crypto.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import { Mailer } from "../mail/index.ts";
import { deriveSignInMethod } from "../support/controller.ts";

const TStaffAuthVerify = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).optional(),
  totp: z.string().trim().min(1).optional(),
});
type TStaffAuthVerify = z.infer<typeof TStaffAuthVerify>;
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
  @http.GET("/_/internal/site-settings")
  async getSiteSettings(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireOpsApi();
    const settings = await StaffSettings.siteDefault();
    ctx.response.body = {
      showLastLoginLocation: Boolean(
        settings.toDetails().showLastLoginLocation,
      ),
    };
  }

  @http.PUT("/_/internal/site-settings")
  async updateSiteSettings(
    ctx: Context<RouterState & AuthState>,
    @body.json(PSiteSettingsUpdate) input: TSiteSettingsUpdate,
  ) {
    ctx.state.requireOpsApi();
    const settings = await StaffSettings.upsert(input.actingStaffUserId, {
      showLastLoginLocation: input.showLastLoginLocation,
    });
    void StaffAuditEvent.record({
      userId: input.actingStaffUserId,
      action: "settings-changed",
      detail: "showLastLoginLocation (via ops app)",
      ip: clientIp(ctx),
    });
    ctx.response.body = {
      showLastLoginLocation: Boolean(
        settings.toDetails().showLastLoginLocation,
      ),
    };
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
    const siteSettings = await StaffSettings.siteDefault();
    const showLocation = siteSettings.toDetails().showLastLoginLocation;
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
