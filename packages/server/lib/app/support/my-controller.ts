import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { ForbiddenError, NotFoundError } from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { type SessionState } from "@fastr/middleware-session";
import { DataDir } from "@keylearn/config";
import {
  SupportAttachment,
  SupportDraft,
  SupportMessage,
  SupportTicket,
} from "@keylearn/database";
import { z } from "zod";
import {
  proveSupportPin,
  requireParentPinForSupport,
  revokeSupportPin,
} from "../auth/parent-pin.ts";
import { rateLimit } from "../auth/ratelimit.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import {
  deskIsTyping,
  forwardArchiveToQdesk,
  forwardCsatToQdesk,
  forwardReplyToQdesk,
  forwardTicketToQdesk,
} from "./qdesk-forward.ts";

/**
 * The account holder's own support section — the pane inside the account
 * window, not the public form and not the staff desk.
 *
 * Three rules hold on every route here, and they are the reason this is a
 * separate controller rather than more methods on the public one:
 *
 * 1. **Signed in.** There is no token-in-a-link path; the account is the
 *    identity, which is also why nobody is asked to type their own name and
 *    email into a form we already have them for.
 * 2. **Past the grown-up PIN.** On a household with a learner profile the
 *    whole section is a grown-up's, reading included — see auth/parent-pin.
 * 3. **Their own ticket.** Every id is checked against the signed-in user
 *    before anything is read or written. An account cannot reach another's
 *    conversation, or another's attachment, by guessing a number.
 */

const TNewTicket = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  /** Uploaded before send; bound to the first message once it exists. */
  attachmentIds: z.array(z.number().int().positive()).max(10).optional(),
});
type TNewTicket = z.infer<typeof TNewTicket>;
const PNewTicket = zod(TNewTicket);

const TReply = z.object({
  message: z.string().trim().min(1).max(2000),
  attachmentIds: z.array(z.number().int().positive()).max(10).optional(),
  /**
   * Client-generated, unique per message. The offline outbox replays sends
   * that may already have landed; this is what stops a replay becoming a
   * second copy of somebody's message.
   */
  clientId: z.string().trim().min(8).max(64).optional(),
});
type TReply = z.infer<typeof TReply>;
const PReply = zod(TReply);

const TDraft = z.object({
  ticketId: z.number().int().positive().nullable().optional(),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().max(2000).nullable().optional(),
});
type TDraft = z.infer<typeof TDraft>;
const PDraft = zod(TDraft);

const TUpload = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  /** The file itself, base64. See the note on `uploadAttachment`. */
  data: z.string().min(1),
});
type TUpload = z.infer<typeof TUpload>;
const PUpload = zod(TUpload);

const TCsat = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(2000).nullable().optional(),
});
type TCsat = z.infer<typeof TCsat>;
const PCsat = zod(TCsat);

const TPin = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/),
});
type TPin = z.infer<typeof TPin>;
const PPin = zod(TPin);

const pId = zod(z.coerce.number().int().positive());

@injectable()
@controller()
export class MyTicketsController {
  constructor(@inject(DataDir) private readonly dataDir: DataDir) {}

  /**
   * Signed in, past the PIN, and it is theirs. Every route starts here.
   * Returning the ticket rather than a boolean means no caller can forget
   * to load it afterwards and accidentally act on an id it never checked.
   */
  async #mine(
    ctx: Context<RouterState & SessionState & AuthState>,
    id: number,
  ): Promise<SupportTicket> {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    const ticket = await SupportTicket.findById(id);
    if (ticket == null || ticket.userId !== user.id) {
      // Deliberately the same answer as a ticket that does not exist:
      // "forbidden" on somebody else's id confirms that the id is real.
      throw new NotFoundError();
    }
    if (ticket.deletedByUserAt != null) {
      throw new NotFoundError();
    }
    return ticket;
  }

  // ── the grown-up PIN, scoped to this visit ──

  /**
   * Proving the PIN for support, which is not the same act as proving it
   * for profile management — see `proveSupportPin`. The PIN itself is the
   * one PIN the household has; what differs is how long the proof lasts.
   */
  @http.POST("/_/support/my/pin")
  async provePin(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PPin) input: TPin,
  ) {
    // A four-digit PIN is 10^4, so the limiter is what makes it mean
    // anything. Same budget as the account route it mirrors.
    rateLimit(ctx, "pin", 10, 300_000);
    const user = ctx.state.requireUser();
    if (user.parentPinHash == null) {
      throw new ForbiddenError("No grown-up PIN is set on this account.");
    }
    if (!(await user.verifyParentPin(input.pin))) {
      throw new ForbiddenError("That PIN is not right.");
    }
    await proveSupportPin(ctx, user);
    ctx.response.body = { ok: true };
  }

  /**
   * Leaving the section gives the proof back.
   *
   * On a shared family tablet the account stays signed in and the device
   * changes hands, so "a grown-up proved this fifteen minutes ago" is not
   * evidence that a grown-up is holding it now. Closing the window is the
   * moment that stops being true, so that is the moment the proof ends.
   *
   * Deliberately unauthenticated beyond the session: this only ever takes
   * a permission away, so the worst a forged call can do is ask somebody
   * for their PIN again.
   */
  @http.POST("/_/support/my/pin/revoke")
  async revokePin(ctx: Context<RouterState & SessionState & AuthState>) {
    await revokeSupportPin(ctx);
    ctx.response.body = { ok: true };
  }

  // ── the list ──

  @http.GET("/_/support/my/tickets")
  async listMine(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);

    const tickets = await SupportTicket.query()
      .where("userId", user.id!)
      .whereNull("deletedByUserAt")
      .orderBy("updatedAt", "desc")
      .limit(100);

    const ids = tickets.map((t) => t.id!);
    const drafts = await SupportDraft.ticketIdsWithDrafts(user.id!);
    const withAttachments = new Set(
      ids.length === 0
        ? []
        : (
            await SupportAttachment.query()
              .select("ticketId")
              .whereIn("ticketId", ids)
              .whereNotNull("messageId")
          ).map((a) => a.ticketId!),
    );

    // Unread is "messages from them, after the last time this account
    // opened the thread". Counted per ticket rather than kept as a running
    // number, so it cannot drift out of step with the messages themselves.
    const unread = new Map<number, number>();
    if (ids.length > 0) {
      const rows = (await SupportMessage.query()
        .select("ticketId")
        .count({ n: "*" })
        .whereIn("ticketId", ids)
        .whereNot("sender", "them")
        // System notes are not replies; counting them made "Passed to a
        // person" bump the badge the chip says is unread messages.
        .whereNot("sender", "system")
        .groupBy("ticketId")) as unknown as {
        ticketId: number;
        n: number | string;
      }[];
      const totals = new Map(rows.map((r) => [r.ticketId, Number(r.n)]));
      for (const ticket of tickets) {
        if (ticket.lastReadAt == null) {
          unread.set(ticket.id!, totals.get(ticket.id!) ?? 0);
        }
      }
      // For threads opened before, count only what landed after that
      // moment. One grouped query rather than one per ticket: the loop
      // that used to be here was an N+1 on a list of up to a hundred.
      const seen = tickets.filter((t) => t.lastReadAt != null);
      if (seen.length > 0) {
        const rows = (await SupportMessage.query()
          .select("ticketId", "createdAt")
          .whereIn(
            "ticketId",
            seen.map((t) => t.id!),
          )
          .whereNot("sender", "them")
          .whereNot("sender", "system")) as unknown as {
          ticketId: number;
          createdAt: Date | number;
        }[];
        const readAt = new Map(
          seen.map((t) => [t.id!, Number(new Date(t.lastReadAt!))]),
        );
        for (const t of seen) {
          unread.set(t.id!, 0);
        }
        for (const row of rows) {
          if (
            Number(new Date(row.createdAt)) > (readAt.get(row.ticketId) ?? 0)
          ) {
            unread.set(row.ticketId, (unread.get(row.ticketId) ?? 0) + 1);
          }
        }
      }
    }

    ctx.response.body = {
      tickets: tickets.map((t) => ({
        id: t.id,
        reference: reference(t.id!),
        subject: t.subject,
        status: t.status,
        unread: unread.get(t.id!) ?? 0,
        hasDraft: drafts.has(t.id!),
        hasAttachments: withAttachments.has(t.id!),
        updatedAt: new Date(t.updatedAt!).toISOString(),
        // When it was opened — the delete and rating cards say so, because
        // a reference and a subject alone don't always identify which of
        // two similar conversations is about to be removed.
        createdAt: new Date(t.createdAt!).toISOString(),
        // The rating card only appears on a closed case that has neither
        // been rated nor waved away.
        askCsat:
          t.status === "closed" &&
          t.csatRating == null &&
          t.csatDismissedAt == null,
      })),
      // What the rail dot reads.
      unreadTotal: [...unread.values()].reduce((a, b) => a + b, 0),
    };
  }

  // ── one conversation ──

  @http.GET("/_/support/my/tickets/{id}")
  async getMine(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const user = ctx.state.requireUser();
    const ticket = await this.#mine(ctx, id);
    const messages = await SupportMessage.listForTicket(id);
    // Newest 40 by default; "Load earlier" asks for the rest, so a long
    // history is not paid for on every first paint.
    const shown = ctx.request.url.includes("all=1")
      ? messages
      : messages.slice(-40);
    const attachments = await SupportAttachment.byMessage(id);

    // Opening the thread is what marks it read. Done here rather than on a
    // separate call so the two cannot disagree.
    //
    // Skipped when nothing has arrived since the last stamp: the thread
    // polls every 20 seconds while it is open, and an unconditional patch
    // turns idle reading into a write per poll per open thread.
    const newest = messages.at(-1)?.createdAt;
    if (
      newest != null &&
      (ticket.lastReadAt == null ||
        new Date(ticket.lastReadAt) < new Date(newest))
    ) {
      await ticket.$query().patch({ lastReadAt: new Date() });
    }

    ctx.response.body = {
      id: ticket.id,
      reference: reference(ticket.id!),
      subject: ticket.subject,
      status: ticket.status,
      createdAt: new Date(ticket.createdAt!).toISOString(),
      hasEarlier: messages.length > shown.length,
      // Whether somebody at the desk is writing, right now. Asked on the
      // thread's own poll rather than on a channel of its own: it is one
      // boolean, and a person typing takes longer than a poll interval.
      deskTyping: await deskIsTyping(ticket.id!),
      messages: shown.map((m) => ({
        id: m.id,
        sender: m.sender,
        authorName: m.authorName ?? null,
        kind: m.kind ?? null,
        body: m.body,
        createdAt: new Date(m.createdAt!).toISOString(),
        // The second tick. This endpoint builds its own message shape
        // rather than using SupportMessage.toDetails(), so anything new
        // on the model has to be added here too or it never leaves the
        // server.
        deliveredAt:
          m.deliveredAt != null ? new Date(m.deliveredAt).toISOString() : null,
        attachments: (attachments.get(m.id!) ?? []).map((a) => a.toDetails()),
      })),
      // Anything uploaded and not yet sent, so the compose tray survives a
      // reload the same way the draft does.
      pending: (await SupportAttachment.pendingFor(id, user.id!)).map((a) =>
        a.toDetails(),
      ),
      draft: (await SupportDraft.find(user.id!, id))?.toDetails() ?? null,
      csat:
        ticket.csatRating == null
          ? null
          : { rating: ticket.csatRating, note: ticket.csatNote ?? null },
    };
  }

  // ── writing ──

  @http.POST("/_/support/my/tickets")
  async createMine(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PNewTicket) input: TNewTicket,
  ) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    rateLimit(ctx, "support-my-ticket", 5, 60 * 60 * 1000);

    // The account holder's own name and address. Nobody signed in is asked
    // to type an address we already have, and nobody can put somebody
    // else's on a ticket.
    const { ticket } = await SupportTicket.create({
      userId: user.id!,
      kind: "support",
      name: user.name ?? "",
      email: user.email ?? "",
      subject: input.subject,
      message: input.message,
      status: "open",
      confirmed: true,
    });

    const first = await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "them",
      body: input.message,
    });
    // Anything uploaded while this was still a blank form belongs to the
    // first message; the explicit list is honoured too, for a client that
    // sends one.
    await SupportAttachment.bindToTicket(user.id!, ticket.id!);
    const pending = await SupportAttachment.pendingFor(ticket.id!, user.id!);
    await this.#bindAttachments(
      ticket.id!,
      first.id!,
      user.id!,
      pending.map((a) => a.id!),
    );
    await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "system",
      kind: "handover",
      body: "Sent. We'll reply here and by email — you don't need to keep this open.",
    });
    await SupportDraft.clear(user.id!, null);

    forwardTicketToQdesk({
      id: ticket.id!,
      kind: "support",
      name: ticket.name!,
      email: ticket.email!,
      subject: ticket.subject!,
      message: ticket.message!,
      userId: user.id!,
      messageId: first.id!,
    });

    ctx.response.body = { id: ticket.id, reference: reference(ticket.id!) };
  }

  @http.POST("/_/support/my/tickets/{id}/reply")
  async replyMine(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PReply) input: TReply,
  ) {
    const user = ctx.state.requireUser();
    const ticket = await this.#mine(ctx, id);

    // Idempotency for the offline outbox. A replay finds the message it
    // already sent and is told so, rather than posting it twice.
    if (input.clientId != null) {
      const existing = await SupportMessage.query()
        .where("clientId", input.clientId)
        // Scoped to this ticket. A bare lookup on the id alone meant a
        // collision from any other account returned "already sent" and
        // dropped a real message.
        .where("ticketId", id)
        .first();
      if (existing != null) {
        ctx.response.body = { id: existing.id, duplicate: true };
        return;
      }
    }
    // Spam closes a thread for good — the desk's own rule is that a reply
    // cannot resurrect it.
    if (ticket.status === "spam") {
      throw new ForbiddenError("This conversation is closed.");
    }

    const message = await SupportMessage.create({
      ticketId: id,
      sender: "them",
      body: input.message,
      clientId: input.clientId ?? null,
    });
    await this.#bindAttachments(
      id,
      message.id!,
      user.id!,
      input.attachmentIds ?? [],
    );
    await SupportDraft.clear(user.id!, id);

    // A reply reopens a finished conversation rather than sending them off
    // to start again: the context is here and it is the same problem.
    if (ticket.status === "closed" || ticket.status === "waiting") {
      await ticket.setStatus("open");
    }
    forwardReplyToQdesk(id, input.message, message.id!);

    ctx.response.body = { id: message.id, duplicate: false };
  }

  /**
   * Reading a draft back — on opening the new-ticket form, or after the PIN
   * gate has been cleared.
   *
   * A GET rather than reusing the PUT: `SupportDraft.put` treats an empty
   * body as "there is nothing left to keep" and deletes the row, so asking
   * for a draft by sending nulls would destroy the thing being asked for.
   */
  @http.GET("/_/support/my/draft")
  async getDraft(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    const raw = ctx.request.url.split("?")[1] ?? "";
    const ticketId = Number(new URLSearchParams(raw).get("ticketId") ?? "");
    const draft = await SupportDraft.find(
      user.id!,
      Number.isFinite(ticketId) && ticketId > 0 ? ticketId : null,
    );
    ctx.response.body = { draft: draft?.toDetails() ?? null };
  }

  /** Saved as they type, so nothing is lost to a PIN lapse or a closed tab. */
  @http.PUT("/_/support/my/draft")
  async putDraft(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PDraft) input: TDraft,
  ) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    if (input.ticketId != null) {
      await this.#mine(ctx, input.ticketId);
    }
    const draft = await SupportDraft.put({
      userId: user.id!,
      ticketId: input.ticketId ?? null,
      subject: input.subject ?? null,
      body: input.body ?? null,
    });
    ctx.response.body = { draft: draft?.toDetails() ?? null };
  }

  // ── attachments ──

  /**
   * Uploaded when chosen, not when sent.
   *
   * Base64 in a JSON body rather than multipart: this stack has no
   * multipart parser, and adding one for a path that carries a screenshot
   * and the occasional PDF is a dependency and a new class of parser bug
   * for no gain. The cost is the 33% inflation, which the limit accounts
   * for.
   *
   * The bytes go to disk under DATA_DIR; the row keeps only what a query
   * would want.
   */
  @http.POST("/_/support/my/tickets/{id}/attachments")
  async uploadAttachment(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PUpload) input: TUpload,
  ) {
    const user = ctx.state.requireUser();
    await this.#mine(ctx, id);
    ctx.response.body = await this.#store(ctx, user.id!, id, input);
  }

  /**
   * The same upload, before there is a ticket to attach it to.
   *
   * The screenshot of the thing that went wrong is usually the reason
   * somebody is writing in the first place, so the first message has to be
   * able to carry one. The row is owned by the account until `createMine`
   * binds it.
   */
  @http.POST("/_/support/my/attachments")
  async uploadUnbound(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PUpload) input: TUpload,
  ) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    ctx.response.body = await this.#store(ctx, user.id!, null, input);
  }

  /** What the new-message tray shows after a reload. */
  @http.GET("/_/support/my/attachments")
  async listUnbound(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    const rows = await SupportAttachment.unboundFor(user.id!);
    ctx.response.body = { pending: rows.map((r) => r.toDetails()) };
  }

  async #store(
    ctx: Context<RouterState & SessionState & AuthState>,
    userId: number,
    ticketId: number | null,
    input: TUpload,
  ) {
    rateLimit(ctx, "support-attachment", 40, 60 * 60 * 1000);

    if (!SupportAttachment.ALLOWED_TYPES.has(input.mimeType)) {
      throw new ForbiddenError(
        "That kind of file can't be attached. Screenshots and PDFs only.",
      );
    }
    const bytes = Buffer.from(input.data, "base64");
    if (bytes.length === 0) {
      throw new ForbiddenError("That file appears to be empty.");
    }
    if (bytes.length > SupportAttachment.MAX_BYTES) {
      throw new ForbiddenError("That file is over 10 MB.");
    }
    // A ticketless tray that grows without bound is a disk-filling hole
    // that never needs a ticket to be created at all.
    if (ticketId == null) {
      const held = await SupportAttachment.unboundFor(userId);
      if (held.length >= 10) {
        throw new ForbiddenError(
          "That's as many files as one message can carry. Send this one first.",
        );
      }
    }

    const row = await SupportAttachment.query().insertAndFetch({
      ticketId,
      messageId: null,
      userId,
      // The name is stored for display only and never used as a path.
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: bytes.length,
    });
    const path = this.dataDir.supportAttachmentFile(row.id!);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);

    return row.toDetails();
  }

  @http.GET("/_/support/my/attachments/{id}")
  async downloadAttachment(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    const row = await SupportAttachment.query().findById(id);
    if (row == null) {
      throw new NotFoundError();
    }
    // Checked against the ticket's owner, not just the uploader: staff can
    // attach a re-issued certificate, and the customer must be able to
    // fetch it.
    const ticket = await SupportTicket.findById(row.ticketId!);
    if (
      ticket == null ||
      ticket.userId !== user.id ||
      ticket.deletedByUserAt != null
    ) {
      throw new NotFoundError();
    }
    const bytes = await readFile(this.dataDir.supportAttachmentFile(row.id!));
    ctx.response.headers.set("content-type", row.mimeType!);
    // Two intents, one route. `?download` forces a save; without it an
    // image renders in place, which is what viewing one full size means.
    //
    // Inline is only ever allowed for a bitmap. SVG and HTML are excluded
    // by the upload allow-list precisely because inlining them would run
    // somebody else's markup on our origin, and `nosniff` stops a
    // mislabelled file being treated as either.
    const download = ctx.request.url.includes("download");
    const inlineOk = !download && row.mimeType!.startsWith("image/");
    const safeName = row.fileName!.replace(/[^\w.\- ]+/g, "_");
    ctx.response.headers.set(
      "content-disposition",
      `${inlineOk ? "inline" : "attachment"}; filename="${safeName}"`,
    );
    ctx.response.headers.set("x-content-type-options", "nosniff");
    ctx.response.body = bytes;
  }

  /** Removing one from the tray before it is sent. */
  @http.DELETE("/_/support/my/attachments/{id}")
  async removeAttachment(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    const row = await SupportAttachment.query().findById(id);
    if (row == null || row.userId !== user.id) {
      throw new NotFoundError();
    }
    if (row.messageId != null) {
      // Already sent. Unsending is not a thing this desk offers, and
      // quietly removing a file the other side has read would be worse.
      throw new ForbiddenError("That file has already been sent.");
    }
    await unlink(this.dataDir.supportAttachmentFile(row.id!)).catch(() => {});
    await row.$query().delete();
    ctx.response.body = { ok: true };
  }

  /** Whose name and address a new ticket will carry. */
  @http.GET("/_/support/my/me")
  async me(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    await requireParentPinForSupport(ctx, user);
    ctx.response.body = { name: user.name ?? "", email: user.email ?? "" };
  }

  /**
   * "Yes, that sorted it."
   *
   * Closing it from the customer's side rather than waiting for staff to
   * notice: they are the only person who knows, and asking them and then
   * ignoring the answer would be worse than not asking.
   */
  @http.POST("/_/support/my/tickets/{id}/sorted")
  async markSorted(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const ticket = await this.#mine(ctx, id);
    await ticket.setStatus("closed");
    await SupportMessage.create({
      ticketId: id,
      sender: "system",
      body: "Marked as sorted.",
      kind: "handover",
    });
    ctx.response.body = { ok: true };
  }

  /**
   * "Not really."
   *
   * Reopens the conversation and leaves it with the assistant, rather
   * than putting it straight into the human queue. A no usually means the
   * answer missed something the person has not said yet, and the fastest
   * way to that is another turn — the queue is a handful of people, and
   * joining it can cost a day for something a follow-up question settles
   * in a minute.
   *
   * It is not a trap: the assistant hands over by itself the moment
   * anyone asks for a person, and again once a thread has been reopened
   * twice (see the agent's own escalation policy). Both paths still exist
   * — this only stops a single "not really" from spending them.
   */
  @http.POST("/_/support/my/tickets/{id}/not-sorted")
  async notSortedMine(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const ticket = await this.#mine(ctx, id);
    // "open" is what a reply sets, and what the assistant picks up.
    await ticket.setStatus("open");
    await SupportMessage.create({
      ticketId: id,
      sender: "system",
      body: "Still open. Tell us what's not right and we'll keep working on it.",
      kind: "handover",
    });
    ctx.response.body = { ok: true };
  }

  // ── the rating ──

  @http.POST("/_/support/my/tickets/{id}/csat")
  async rate(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PCsat) input: TCsat,
  ) {
    const ticket = await this.#mine(ctx, id);
    await ticket.$query().patch({
      csatRating: input.rating,
      csatNote: input.note ?? null,
      csatRatedAt: new Date(),
    });
    // The rating is only worth collecting if the people who answered the
    // ticket ever see it.
    forwardCsatToQdesk(id, input.rating, input.note ?? null);
    ctx.response.body = { ok: true };
  }

  @http.POST("/_/support/my/tickets/{id}/csat/dismiss")
  async dismissCsat(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const ticket = await this.#mine(ctx, id);
    await ticket.$query().patch({ csatDismissedAt: new Date() });
    ctx.response.body = { ok: true };
  }

  // ── removing it from your own list ──

  @http.DELETE("/_/support/my/tickets/{id}")
  async removeMine(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const ticket = await this.#mine(ctx, id);
    // A soft delete. The desk keeps the conversation and archives it — both
    // because a support thread is the record of what was promised, and
    // because somebody writing in again about the same thing should not
    // meet a team with no memory of it.
    await ticket.$query().patch({ deletedByUserAt: new Date() });
    forwardArchiveToQdesk(id);
    ctx.response.body = { ok: true };
  }

  /** Binds uploads to the message that carried them, ownership checked. */
  async #bindAttachments(
    ticketId: number,
    messageId: number,
    userId: number,
    ids: readonly number[],
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await SupportAttachment.query()
      .patch({ messageId })
      .whereIn("id", [...ids])
      .where("ticketId", ticketId)
      .where("userId", userId)
      .whereNull("messageId");
  }
}

/**
 * The reference a person quotes back.
 *
 * The row id, prefixed and padded: ticket 1 is KEY0000001. Sequential by
 * request — it reads as a reference number, it sorts, and somebody reading
 * it down the phone gets it right first time.
 *
 * The cost of sequential is that it publishes the count: anyone holding a
 * reference knows roughly how many support tickets this product has ever
 * had. That is a deliberate trade, not an oversight.
 *
 * Derived rather than stored, so it needs no column and can never drift
 * from the id it describes. Seven digits carries ten million tickets; past
 * that it simply grows a digit rather than wrapping, so nothing collides.
 */
export function reference(id: number): string {
  return `KEY${String(id).padStart(7, "0")}`;
}
