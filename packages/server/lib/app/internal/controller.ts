import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { ApplicationError } from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import {
  AccountDeletionRequest,
  maskEmail,
  Profile,
  SecurityEvent,
  StaffAuditEvent,
  StaffSettings,
  SupportTicket,
  User,
  verifyTotp,
} from "@keylearn/database";
import { UserDataFactory } from "@keylearn/result-userdata";
import { z } from "zod";
import { messageAccountDeletionRequested } from "../auth/email.ts";
import { clientIp } from "../auth/ratelimit.ts";
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

const TActedRequest = z.object({
  reason: z.string().trim().min(1).max(500),
  actingStaffUserId: z.number().int().positive().optional(),
});
type TActedRequest = z.infer<typeof TActedRequest>;
const PActedRequest = zod(TActedRequest);

const pId = zod(z.coerce.number().int().positive());

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
    const user = await User.findByEmail(input.email);
    if (user == null) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    const status = await staffAccessStatus(user);
    if (!status.ok) {
      // "not-staff" and "needs-2fa" (no passkey/TOTP configured at all —
      // distinct from "configured, but this request omitted the code")
      // both pass straight through; a signed-out status can't happen
      // here since `user` is non-null.
      ctx.response.body = { ok: false, reason: status.reason };
      return;
    }
    if (input.password == null || user.passwordHash == null) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    const verified = await User.loginWithPassword(input.email, input.password);
    if (verified == null) {
      ctx.response.body = { ok: false, reason: "invalid" };
      return;
    }
    if (user.totpEnabled) {
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
