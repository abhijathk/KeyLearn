import { createHash } from "node:crypto";
import {
  type SupportMessageDetails,
  type SupportTicketDetails,
} from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";
import { Random } from "./util.ts";

export type SupportTicketKind = "support" | "business";
export type SupportTicketStatus =
  | "open"
  | "flagged"
  | "waiting"
  | "closed"
  | "spam"
  // Unconfirmed, invisible in the Inbox until the submitter confirms via the
  // emailed one-shot link — see issueConfirmToken/redeemConfirmToken.
  | "holding";

/**
 * The automation agent's read of a ticket's tone, written only by
 * `POST /_/support/agent/tickets/{id}/sentiment` — three buckets, not a
 * score: fine, worth a look in the daily digest, or escalate now. Only
 * `critical` forces `status: "flagged"` on its own; `frustrated` is tagged
 * for visibility but doesn't block the agent's own attempt to help.
 */
export type SupportTicketSentiment = "neutral" | "frustrated" | "critical";

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "••••";
  }
  return `${email[0]}${"•".repeat(Math.max(at - 1, 3))}${email.slice(at)}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SupportTicket extends TimestampMixin(Model) {
  static override readonly tableName = "support_ticket";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["kind", "name", "email", "subject", "message", "status"],
    properties: {
      id: { type: "integer" },
      userId: { type: ["integer", "null"] },
      kind: { type: "string", enum: ["support", "business"] },
      name: { type: "string", minLength: 1, maxLength: 64 },
      email: { type: "string", minLength: 1, maxLength: 128 },
      subject: { type: "string", minLength: 1, maxLength: 128 },
      message: { type: "string", minLength: 1, maxLength: 4000 },
      csatRating: { type: ["integer", "null"], minimum: 1, maximum: 5 },
      csatNote: { type: ["string", "null"], maxLength: 2000 },
      status: {
        type: "string",
        enum: ["open", "flagged", "waiting", "closed", "spam", "holding"],
      },
      // False only while a signed-out "support" submission sits in the
      // email-confirmation holding queue. Every other submission — signed
      // in, or kind: "business" — starts (and stays) confirmed; the mock
      // says those are "never queued".
      confirmed: { type: "boolean" },
      staffReply: { type: ["string", "null"], maxLength: 4000 },
      repliedBy: { type: ["integer", "null"] },
      ip: { type: ["string", "null"], maxLength: 64 },
      // Which Answer/AnswerRule auto-replied to this ticket, if any —
      // cleared the moment the sender writes again (a human had to step
      // back in), so whatever's still set when the ticket closes is what
      // actually solved it. Not a foreign key, same reasoning as repliedBy:
      // a later-deleted answer must not break the ticket row.
      autoAnswerId: { type: ["integer", "null"] },
      autoRuleId: { type: ["integer", "null"] },
      sentiment: {
        type: ["string", "null"],
        enum: ["neutral", "frustrated", "critical", null],
      },
      // Orthogonal to `status`: an archived ticket keeps whatever status it
      // had (closed, spam, even open) — archiving only takes it out of the
      // default Inbox view, the way the holding queue does, without
      // pretending its resolution changed.
      archived: { type: "boolean" },
      // Captured once at creation from CF-IPCountry, same rule as
      // User.signupCountry — never updated again.
      country: { type: ["string", "null"], minLength: 2, maxLength: 2 },
      // How many times a guest reply has moved this ticket from closed back
      // to open — see replyToThread.
      reopenCount: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { name, email, subject, ip } = SupportTicket.jsonSchema.properties;
    table.increments("id").primary();
    table.integer("user_id").unsigned().nullable().index();
    table.string("kind", 16).notNullable();
    table.string("name", name.maxLength).notNullable();
    table.string("email", email.maxLength).notNullable();
    table.string("subject", subject.maxLength).notNullable();
    table.text("message").notNullable();
    table.string("status", 16).notNullable().defaultTo("open");
    table.text("staff_reply").nullable();
    table.integer("replied_by").unsigned().nullable();
    table.timestamp("replied_at").nullable();
    table.string("ip", ip.maxLength).nullable();
    table.integer("auto_answer_id").unsigned().nullable();
    table.integer("auto_rule_id").unsigned().nullable();
    table.string("sentiment", 16).nullable();
    table.boolean("confirmed").notNullable().defaultTo(true);
    // One-shot — cleared on redemption, see redeemConfirmToken.
    table.string("confirm_token_hash", 64).nullable();
    // Long-lived, NOT one-shot: looked up on every /support/t/:token visit,
    // so a signed-out submitter can follow their own conversation without an
    // account. Unique so a token can only ever resolve to one ticket.
    table.string("thread_token_hash", 64).notNullable().unique();
    // Set when the ticket moves to "closed", cleared on reopen. A thread
    // token's guest-access window is `closedAt + 90d`, checked by the
    // controller (a UI/behaviour concern, not this model's job) — not here.
    table.timestamp("closed_at").nullable();
    table.boolean("archived").notNullable().defaultTo(false);
    table.string("country", 2).nullable();
    table.integer("reopen_count").unsigned().notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["status", "created_at"]);
    table.index(["kind", "status"]);
  }

  readonly id?: number;
  userId?: number | null;
  kind?: SupportTicketKind;
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  status?: SupportTicketStatus;
  confirmed?: number | boolean;
  staffReply?: string | null;
  repliedBy?: number | null;
  repliedAt?: Date | null;
  ip?: string | null;
  autoAnswerId?: number | null;
  autoRuleId?: number | null;
  sentiment?: SupportTicketSentiment | null;
  confirmTokenHash?: string | null;
  threadTokenHash?: string;
  /** Soft delete from the owner's own list; the desk keeps the conversation. */
  deletedByUserAt?: Date | null;
  /** What the unread count and the rail dot are counted against. */
  lastReadAt?: Date | null;
  /** One to five, once the case has closed. */
  csatRating?: number | null;
  csatNote?: string | null;
  csatRatedAt?: Date | null;
  csatDismissedAt?: Date | null;
  closedAt?: Date | null;
  archived?: number | boolean;
  country?: string | null;
  reopenCount?: number;
  createdAt?: Date;
  updatedAt?: Date;

  /**
   * Creates a ticket and mints its long-lived thread token in the same
   * write — `thread_token_hash` is not-null at the schema level, so every
   * ticket needs one from the moment it exists, not just the ones a guest
   * happens to be tracking. Only the hash is persisted; the plaintext is
   * returned once, to be emailed or redirected to (`/support/t/<token>`).
   */
  static async create({
    userId = null,
    kind,
    name,
    email,
    subject,
    message,
    status = "open",
    confirmed = true,
    ip = null,
    country = null,
  }: {
    readonly userId?: number | null;
    readonly kind: SupportTicketKind;
    readonly name: string;
    readonly email: string;
    readonly subject: string;
    readonly message: string;
    readonly status?: SupportTicketStatus;
    readonly confirmed?: boolean;
    readonly ip?: string | null;
    readonly country?: string | null;
  }): Promise<{ ticket: SupportTicket; threadToken: string }> {
    const threadToken = Random.string(20);
    const ticket = await SupportTicket.query().insertAndFetch({
      userId,
      kind,
      name,
      email,
      subject,
      message,
      status,
      confirmed,
      threadTokenHash: hashToken(threadToken),
      ip,
      country,
    });
    return { ticket, threadToken };
  }

  static async listQueue({
    kind,
    status,
    archived,
    q,
    limit = 50,
  }: {
    readonly kind?: SupportTicketKind;
    readonly status?: SupportTicketStatus;
    /** Omitted or false: the default Inbox view, archived rows hidden. True: only archived rows. */
    readonly archived?: boolean;
    /**
     * Free-text search over name/email/subject/message — reaches closed
     * tickets too, since the Inbox search is meant to find "that one from
     * last month", not just what's still open.
     */
    readonly q?: string;
    readonly limit?: number;
  } = {}): Promise<SupportTicket[]> {
    let query = SupportTicket.query();
    if (kind != null) {
      query = query.where("kind", kind);
    }
    if (status != null) {
      query = query.where("status", status);
    } else {
      // Holding-queue rows are unconfirmed and stay out of the default
      // Inbox view — ask for them explicitly (status: "holding") to see them.
      query = query.whereNot("status", "holding");
    }
    query = archived
      ? query.where("archived", true)
      : query.whereNot("archived", true);
    const term = q?.trim();
    if (term) {
      const like = `%${term}%`;
      query = query.where((builder) =>
        builder
          .where("name", "like", like)
          .orWhere("email", "like", like)
          .orWhere("subject", "like", like)
          .orWhere("message", "like", like),
      );
    }
    return await query
      .orderBy("createdAt", "desc")
      .limit(Math.min(Math.max(limit, 1), 200));
  }

  static async findById(id: number): Promise<SupportTicket | null> {
    return (await SupportTicket.query().findById(id)) ?? null;
  }

  /**
   * Deletes holding-queue tickets that never got confirmed within the
   * window — an unconfirmed submission carries an unverified email address,
   * so keeping it forever would just be an ever-growing pile of unproven
   * claims. Confirmed tickets are never in status "holding", so this can't
   * touch a real conversation.
   */
  static async deleteExpiredHolding(olderThan: Date): Promise<number> {
    return await SupportTicket.query()
      .where("status", "holding")
      .where("createdAt", "<", olderThan)
      .delete();
  }

  /**
   * Looks up a ticket by its long-lived thread token — used on every
   * `/support/t/:token` visit. Expiry (a closed thread's link stops working
   * 90 days after `closedAt`) is a controller-level decision, not enforced
   * here: it needs "now", which is a request-time concern, not a query one.
   */
  static async findByThreadToken(token: string): Promise<SupportTicket | null> {
    return (
      (await SupportTicket.query().findOne({
        threadTokenHash: hashToken(token),
      })) ?? null
    );
  }

  /**
   * Issues a fresh one-shot confirmation token for a holding-queue ticket,
   * replacing any prior one. Only the hash is persisted; the plaintext is
   * returned once, to be emailed.
   */
  static async issueConfirmToken(ticketId: number): Promise<string> {
    const token = Random.string(20);
    await SupportTicket.query()
      .findById(ticketId)
      .patch({ confirmTokenHash: hashToken(token) });
    return token;
  }

  /**
   * Redeems a confirmation token, one shot: on success the token is cleared
   * and the ticket leaves the holding queue (`confirmed: true`,
   * `status: "open"`). Returns null for an unknown or already-used token.
   */
  static async redeemConfirmToken(
    token: string,
  ): Promise<SupportTicket | null> {
    const ticket = await SupportTicket.query().findOne({
      confirmTokenHash: hashToken(token),
    });
    if (ticket == null) {
      return null;
    }
    return await ticket.$query().patchAndFetch({
      confirmTokenHash: null,
      confirmed: true,
      status: "open",
      updatedAt: new Date(),
    });
  }

  /**
   * Mints a fresh thread token for an existing ticket, replacing the old one
   * (the prior token stops working). Only the hash is persisted; the
   * plaintext is returned once.
   *
   * Used whenever the controller needs to hand a submitter a working
   * `/support/t/<token>` link after the ticket's original one-time token has
   * already been spent — folding a duplicate resubmission into its existing
   * ticket, or emailing a staff reply out to the real address.
   */
  static async reissueThreadToken(ticketId: number): Promise<string> {
    const token = Random.string(20);
    await SupportTicket.query()
      .findById(ticketId)
      .patch({ threadTokenHash: hashToken(token) });
    return token;
  }

  /** @deprecated Kept for existing rows; new replies go through SupportMessage instead. */
  async reply({
    staffUserId,
    reply,
    status,
  }: {
    readonly staffUserId: number;
    readonly reply: string;
    readonly status: SupportTicketStatus;
  }): Promise<SupportTicket> {
    return await this.$query().patchAndFetch({
      staffReply: reply,
      repliedBy: staffUserId,
      repliedAt: new Date(),
      status,
      closedAt: status === "closed" ? new Date() : null,
      updatedAt: new Date(),
    });
  }

  async setStatus(status: SupportTicketStatus): Promise<SupportTicket> {
    return await this.$query().patchAndFetch({
      status,
      closedAt: status === "closed" ? new Date() : null,
      updatedAt: new Date(),
    });
  }

  /**
   * Same transition as `setStatus("open")`, plus the reopen counter — used
   * only by the guest-reply path (a sender writing again after the ticket
   * had gone closed/waiting), which is the one place "reopen" has a real
   * meaning. `autoFlag` escalates straight to "flagged" instead of "open"
   * once the count crosses the threshold, when the site's
   * second-reopen-auto-flag setting is on.
   */
  async reopen({
    autoFlag,
  }: {
    readonly autoFlag: boolean;
  }): Promise<SupportTicket> {
    const reopenCount = (this.reopenCount ?? 0) + 1;
    const status = autoFlag && reopenCount >= 2 ? "flagged" : "open";
    return await this.$query().patchAndFetch({
      status,
      reopenCount,
      closedAt: null,
      updatedAt: new Date(),
    });
  }

  /** Hides (or restores) a ticket from the default Inbox view — its status is untouched either way. */
  async setArchived(archived: boolean): Promise<SupportTicket> {
    return await this.$query().patchAndFetch({
      archived,
      updatedAt: new Date(),
    });
  }

  /**
   * Records the automation agent's tone read. Whether a `critical` read
   * also escalates the ticket is the caller's decision (the support
   * controller's agent-sentiment endpoint), not this model's — setting the
   * field and moving the queue are different concerns even though they're
   * usually triggered together.
   */
  async setSentiment(
    sentiment: SupportTicketSentiment,
  ): Promise<SupportTicket> {
    return await this.$query().patchAndFetch({
      sentiment,
      updatedAt: new Date(),
    });
  }

  /** Records which Answer/AnswerRule auto-replied to this ticket. */
  static async attachAutoAnswer(
    ticketId: number,
    answerId: number,
    ruleId: number,
  ): Promise<void> {
    await SupportTicket.query()
      .findById(ticketId)
      .patch({ autoAnswerId: answerId, autoRuleId: ruleId });
  }

  /**
   * Clears the auto-answer attribution — the sender wrote again, so a
   * human had to step back in and the eventual close no longer counts as
   * solved by the bot alone. A no-op once already clear.
   */
  async clearAutoAttribution(): Promise<SupportTicket> {
    if (this.autoAnswerId == null && this.autoRuleId == null) {
      return this;
    }
    return await this.$query().patchAndFetch({
      autoAnswerId: null,
      autoRuleId: null,
    });
  }

  /**
   * @param messages The thread's messages, oldest first, when the caller has
   *   already loaded them (e.g. via `SupportMessage.listForTicket`) — omitted
   *   for list views that only need the ticket's own fields.
   */
  toDetails({
    reveal = false,
    messages = [],
  }: {
    readonly reveal?: boolean;
    readonly messages?: readonly SupportMessageDetails[];
  } = {}): SupportTicketDetails {
    return {
      id: this.id!,
      kind: this.kind!,
      name: this.name!,
      email: reveal ? this.email! : maskEmail(this.email!),
      subject: this.subject!,
      message: this.message!,
      status: this.status!,
      sentiment: this.sentiment ?? null,
      confirmed: Boolean(this.confirmed),
      staffReply: this.staffReply ?? null,
      repliedAt:
        this.repliedAt != null ? new Date(this.repliedAt).toISOString() : null,
      closedAt:
        this.closedAt != null ? new Date(this.closedAt).toISOString() : null,
      archived: Boolean(this.archived),
      messages,
      createdAt: new Date(this.createdAt!).toISOString(),
      country: this.country ?? null,
    };
  }
}

SupportTicket.relationMappings = {};
