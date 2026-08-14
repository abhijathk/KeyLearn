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
import { Env } from "@keylearn/config";
import {
  Notice,
  StaffAuditEvent,
  SupportTicket,
  type SupportTicketKind,
  User,
} from "@keylearn/database";
import { z } from "zod";
import { messageBusinessEnquiry } from "../auth/email.ts";
import { clientIp, rateLimit } from "../auth/ratelimit.ts";
import { staffAccessStatus } from "../auth/staff-access.ts";
import {
  recordFailure,
  requireCaptchaIfSuspicious,
} from "../auth/turnstile.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import { Mailer } from "../mail/index.ts";

const jsonOpts = { maxLength: 4096 };

// A submission is flagged rather than rejected when it looks like spam or
// phishing — it still reaches a human, just sorted for extra scrutiny. A
// hard reject would also catch a real user whose question happens to
// mention a link, and there is no way to tell the two apart from the text
// alone.
const URL_RE = /https?:\/\/[^\s]+/gi;
const ALLOWED_HOSTS = new Set(["keylearn.org", "www.keylearn.org"]);
const URGENT_WORDS =
  /\b(urgent|verify now|act now|click here|limited time|password (?:has )?expired?|you'?ve won|claim your prize)\b/i;

function looksSuspicious(message: string): boolean {
  const urls = message.match(URL_RE) ?? [];
  if (urls.length >= 3) {
    return true;
  }
  const offSiteLink = urls.some((raw) => {
    try {
      return !ALLOWED_HOSTS.has(new URL(raw).hostname.toLowerCase());
    } catch {
      return true;
    }
  });
  return offSiteLink && URGENT_WORDS.test(message);
}

const STATUSES = ["open", "flagged", "waiting", "closed", "spam"] as const;

const TCreateTicket = z.object({
  kind: z.enum(["support", "business"]),
  name: z.string().trim().min(1).max(64),
  email: z.string().trim().min(1).max(128).email(),
  subject: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(4000),
  turnstileToken: z.string().max(4096).optional(),
  // Hidden form field a real visitor never fills in. Any value here means a
  // bot filled out every field it could find — accepted-and-dropped rather
  // than rejected, so it never learns which signal caught it.
  website: z.string().max(256).optional(),
});
type TCreateTicket = z.infer<typeof TCreateTicket>;
const PCreateTicket = zod(TCreateTicket, () => {
  throw new ApplicationError("Check the form and try again");
});

const TReply = z.object({
  reply: z.string().trim().min(1).max(4000),
  status: z.enum(STATUSES),
});
type TReply = z.infer<typeof TReply>;
const PReply = zod(TReply);

const TStatus = z.object({ status: z.enum(STATUSES) });
type TStatus = z.infer<typeof TStatus>;
const PStatus = zod(TStatus);

const TNotice = z.object({
  message: z.string().trim().min(1).max(280),
  level: z.enum(["info", "warning"]).optional(),
});
type TNotice = z.infer<typeof TNotice>;
const PNotice = zod(TNotice);

const pId = zod(z.coerce.number().int().positive());
// A missing query param arrives as `null`, not `undefined` — `.optional()`
// only accepts the latter, so an absent filter would 400 rather than mean
// "no filter". `.catch(undefined)` absorbs that (and anything else
// unparseable) into "no filter" instead of rejecting the request.
const pKind = zod(z.enum(["support", "business"]).optional().catch(undefined));
const pStatus = zod(z.enum(STATUSES).optional().catch(undefined));

@injectable()
@controller()
export class Controller {
  constructor(
    @inject("canonicalUrl") readonly canonicalUrl: string,
    readonly mailer: Mailer,
  ) {}

  #link(path: string): string {
    return String(new URL(path, this.canonicalUrl));
  }

  @http.POST("/_/support/tickets")
  async createTicket(
    ctx: Context<RouterState & AuthState>,
    @body.json(PCreateTicket, jsonOpts) input: TCreateTicket,
  ) {
    rateLimit(ctx, "support-ticket", 5, 60 * 60 * 1000);
    await requireCaptchaIfSuspicious(ctx, input.turnstileToken);

    if (input.website) {
      // Honeypot tripped. Same body shape as a real submission — the caller
      // (and whatever filled the hidden field) sees no difference.
      ctx.response.body = { ok: true };
      return;
    }

    const suspicious = looksSuspicious(input.message);
    if (suspicious) {
      recordFailure(ctx);
    }

    const ticket = await SupportTicket.create({
      userId: ctx.state.user?.id ?? null,
      kind: input.kind,
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      status: suspicious ? "flagged" : "open",
      ip: clientIp(ctx),
    });

    if (input.kind === "business") {
      const inbox = Env.getString("SUPPORT_INBOX_EMAIL", "");
      if (inbox) {
        void (async () => {
          try {
            await this.mailer.sendMail(
              messageBusinessEnquiry({
                to: inbox,
                name: input.name,
                fromEmail: input.email,
                subject: input.subject,
                message: input.message,
                ticketLink: this.#link("/support/desk"),
              }),
            );
          } catch {
            // A mail outage must never fail the submission — the ticket is
            // already saved and still reachable from the queue.
          }
        })();
      }
    }

    // Wrapped in a real JSON body rather than a bare 204 — the client's
    // support-ticket request expects an application/json response even on
    // success, and an empty 204 carries no Content-Type for it to match,
    // which turned every successful submission into a client-side error.
    ctx.response.body = { ok: true };
    ctx.response.headers.set("X-Ticket-Id", String(ticket.id));
  }

  /**
   * Read-only status the staff sign-in screen polls after every sign-in
   * attempt — data instead of a thrown error, so the screen can tell
   * "wrong account" apart from "right account, no second factor yet"
   * instead of showing one generic failure for both. Never throws and
   * never audits: {@link requireStaff} is still the real, audited gate on
   * every endpoint below.
   */
  @http.GET("/_/support/desk/access")
  async deskAccess(ctx: Context<RouterState & AuthState>) {
    ctx.response.body = await staffAccessStatus(ctx.state.user);
  }

  @http.GET("/_/support/tickets")
  async listTickets(
    ctx: Context<RouterState & AuthState>,
    @queryParam("kind", pKind) kind: SupportTicketKind | undefined,
    @queryParam("status", pStatus)
    status: "open" | "flagged" | "waiting" | "closed" | "spam" | undefined,
  ) {
    await ctx.state.requireStaff();
    const tickets = await SupportTicket.listQueue({ kind, status });
    ctx.response.body = tickets.map((t) => t.toDetails());
  }

  @http.GET("/_/support/tickets/{id}")
  async getTicket(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    ctx.response.body = ticket.toDetails();
  }

  /**
   * The one deliberate way to see a submitter's real address. Everything
   * else that returns a ticket masks it — this is a separate, audited
   * action rather than a side effect of opening a thread.
   */
  @http.POST("/_/support/tickets/{id}/reveal-email")
  async revealEmail(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "reveal-email",
      detail: `ticket ${id}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { email: ticket.email };
  }

  @http.PUT("/_/support/tickets/{id}")
  async replyToTicket(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PReply, jsonOpts) input: TReply,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const updated = await ticket.reply({
      staffUserId: staff.id!,
      reply: input.reply,
      status: input.status,
    });
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "reply-ticket",
      detail: `ticket ${id} → ${input.status}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = updated.toDetails();
  }

  /** A status-only move — "waiting on them", "close", "spam" — no reply sent. */
  @http.PUT("/_/support/tickets/{id}/status")
  async setTicketStatus(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PStatus, jsonOpts) input: TStatus,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const updated = await ticket.setStatus(input.status);
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "ticket-status",
      detail: `ticket ${id} → ${input.status}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = updated.toDetails();
  }

  @http.GET("/_/support/notice")
  async getActiveNotice(ctx: Context<RouterState & AuthState>) {
    const notice = await Notice.activeNotice();
    // Wrapped rather than a bare nullable body — a `null` body gets turned
    // into an empty 204 response by the framework, which res.json() can't
    // parse. Wrapping keeps this a real, always-parseable JSON response.
    ctx.response.body = { notice: notice?.toDetails() ?? null };
    ctx.response.headers.set("Cache-Control", "public, max-age=30");
  }

  @http.POST("/_/support/notices")
  async createNotice(
    ctx: Context<RouterState & AuthState>,
    @body.json(PNotice, jsonOpts) input: TNotice,
  ) {
    const staff = await ctx.state.requireStaff();
    const notice = await Notice.create({
      message: input.message,
      level: input.level,
      createdBy: staff.id!,
    });
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "notice-published",
      detail: input.message.slice(0, 120),
      ip: clientIp(ctx),
    });
    ctx.response.body = notice.toDetails();
  }

  @http.PUT("/_/support/notices/{id}")
  async setNoticeActive(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(zod(z.object({ active: z.boolean() })), jsonOpts)
    input: { active: boolean },
  ) {
    const staff = await ctx.state.requireStaff();
    await Notice.setActive(id, input.active);
    if (!input.active) {
      void StaffAuditEvent.record({
        userId: staff.id,
        action: "notice-retracted",
        detail: `notice ${id}`,
        ip: clientIp(ctx),
      });
    }
    ctx.response.status = 204;
  }

  /** Read-only. Nothing on the desk edits or deletes a row here. */
  @http.GET("/_/support/audit")
  async listAudit(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const events = await StaffAuditEvent.listRecent(100);
    const userIds = [
      ...new Set(events.map((e) => e.userId).filter((id) => id != null)),
    ] as number[];
    const users = await User.loadAll(userIds);
    ctx.response.body = events.map((e) =>
      e.toDetails(
        e.userId != null ? (users.get(e.userId)?.name ?? null) : null,
      ),
    );
  }
}
