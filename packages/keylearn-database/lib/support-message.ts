import { type SupportMessageDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

export type SupportMessageSender = "them" | "us" | "auto" | "agent" | "system";

/**
 * One message in a support ticket's conversation.
 *
 * Replaces `SupportTicket`'s old single staffReply/repliedBy/repliedAt slot
 * with a real thread: a guest can reply from their own thread link, staff
 * reply from the desk, and an auto-matched Answer or a system note ("marked
 * resolved") both need a place in the same timeline as a human message.
 * Append-only, like `StaffAuditEvent` — nothing here is ever edited.
 */
export class SupportMessage extends TimestampMixin(Model) {
  static override readonly tableName = "support_message";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["ticketId", "sender", "body"],
    properties: {
      id: { type: "integer" },
      ticketId: { type: "integer" },
      sender: {
        type: "string",
        enum: ["them", "us", "auto", "agent", "system"],
      },
      body: { type: "string", minLength: 1, maxLength: 4000 },
      staffUserId: { type: ["integer", "null"] },
      emailed: { type: "boolean" },
      // The name the SENDER chose to be seen as on this thread — a desk
      // staffer's working name or the assistant's configured name.
      // Never an account name: it's shown to the customer.
      authorName: { type: ["string", "null"], maxLength: 64 },
      // Idempotency for the offline outbox — see schema.ts.
      clientId: { type: ["string", "null"], maxLength: 64 },
      /**
       * What this message *is*, when that changes how it must be shown.
       * Null for ordinary text. "crisis" is the fixed emergency redirect,
       * which is drawn as its own block rather than a bubble — nothing
       * about it should read as the assistant chatting. "handover" is the
       * line that says a person has taken over.
       */
      kind: { type: ["string", "null"], enum: ["crisis", "handover", null] },
    },
  } satisfies JSONSchema;
  // deliveredAt is left out of jsonSchema.properties for the same reason
  // every other timestamp in this package is (see SupportTicket's
  // csatRatedAt): declaring a Date column there makes the validator
  // serialise the value on its way to the driver, and MySQL rejects the
  // quoted string with ER_TRUNCATED_WRONG_VALUE. SQLite accepts it, so
  // this fails only in production and only on delivery — the tests in
  // support/delivery-ticks.test.ts run against MySQL for that reason.
  //
  // answerIds is intentionally left out of jsonSchema.properties — it's a
  // plain string column (JSON-encoded), hand-parsed in toDetails(), same
  // pattern as User.recoveryCodes. Including it here would make AJV
  // validate the raw string against a type it never has.

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    // A message must always belong to a ticket — a real foreign key, unlike
    // the non-FK userId columns elsewhere in this package (see
    // SupportTicket.userId / PracticeSession for the reasoning behind those).
    table
      .integer("ticket_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("support_ticket")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.string("sender", 16).notNullable();
    table.text("body").notNullable();
    table.string("author_name", 64).nullable();
    // Who sent it, when sender is "us" — not a foreign key, for the same
    // reason as SupportTicket.userId: a departed staffer's messages must not
    // vanish from a thread they actually wrote.
    table.integer("staff_user_id").unsigned().nullable();
    table.boolean("emailed").notNullable().defaultTo(false);
    // Which Answer(s) an agent reply was drafted from — JSON-encoded number
    // array, null for every non-agent message. Purely informational (desk
    // attribution, mockup step 02's "drafted from Answer #14"); nothing
    // reads it back to make a decision.
    table.text("answer_ids").nullable();
    // Set once the desk has taken the message, not when it was sent —
    // the difference is the whole point of a second tick.
    table.timestamp("delivered_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    // A thread reads oldest-first — this is the index that query serves.
    table.index(["ticket_id", "created_at"]);
  }

  readonly id?: number;
  ticketId?: number;
  sender?: SupportMessageSender;
  body?: string;
  staffUserId?: number | null;
  emailed?: number | boolean;
  authorName?: string | null;
  clientId?: string | null;
  kind?: string | null;
  answerIds?: string | null;
  deliveredAt?: Date | null;
  createdAt?: Date;

  static async create({
    ticketId,
    sender,
    body,
    staffUserId = null,
    emailed = false,
    answerIds = null,
    authorName = null,
    clientId = null,
    kind = null,
  }: {
    readonly ticketId: number;
    readonly sender: SupportMessageSender;
    readonly body: string;
    readonly staffUserId?: number | null;
    readonly emailed?: boolean;
    readonly answerIds?: readonly number[] | null;
    readonly authorName?: string | null;
    /** Client-generated, unique per message — the offline outbox's guard. */
    readonly clientId?: string | null;
    readonly kind?: "crisis" | "crisis-quiet" | "handover" | null;
  }): Promise<SupportMessage> {
    return await SupportMessage.query().insertAndFetch({
      ticketId,
      sender,
      body,
      staffUserId,
      emailed,
      authorName,
      answerIds:
        answerIds != null && answerIds.length > 0
          ? JSON.stringify(answerIds)
          : null,
      clientId,
      kind,
    });
  }

  /**
   * A ticket's conversation, oldest first.
   *
   * Unlike almost everything else in this package, a thread is read
   * top-to-bottom like an email chain, not newest-first like a queue or log.
   */
  static async listForTicket(ticketId: number): Promise<SupportMessage[]> {
    return await SupportMessage.query()
      .where("ticketId", ticketId)
      .orderBy("createdAt", "asc")
      .orderBy("id", "asc");
  }

  toDetails(): SupportMessageDetails {
    return {
      id: this.id!,
      sender: this.sender!,
      body: this.body!,
      emailed: Boolean(this.emailed),
      authorName: this.authorName ?? null,
      answerIds:
        this.answerIds != null
          ? (JSON.parse(this.answerIds) as number[])
          : null,
      deliveredAt:
        this.deliveredAt != null
          ? new Date(this.deliveredAt).toISOString()
          : null,
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }

  /**
   * Marks a message as taken by the desk.
   *
   * Best-effort on purpose: a tick that fails to appear is a cosmetic
   * loss, and must never fail the delivery it is describing.
   */
  static async markDelivered(id: number): Promise<void> {
    try {
      await SupportMessage.query()
        .findById(id)
        .patch({ deliveredAt: new Date() });
    } catch (err) {
      console.error("support-message: could not record delivery", err);
    }
  }
}

SupportMessage.relationMappings = {};
