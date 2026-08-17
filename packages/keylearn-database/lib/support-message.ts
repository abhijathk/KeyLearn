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
    },
  } satisfies JSONSchema;
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
  answerIds?: string | null;
  createdAt?: Date;

  static async create({
    ticketId,
    sender,
    body,
    staffUserId = null,
    emailed = false,
    answerIds = null,
  }: {
    readonly ticketId: number;
    readonly sender: SupportMessageSender;
    readonly body: string;
    readonly staffUserId?: number | null;
    readonly emailed?: boolean;
    readonly answerIds?: readonly number[] | null;
  }): Promise<SupportMessage> {
    return await SupportMessage.query().insertAndFetch({
      ticketId,
      sender,
      body,
      staffUserId,
      emailed,
      answerIds:
        answerIds != null && answerIds.length > 0
          ? JSON.stringify(answerIds)
          : null,
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
      answerIds:
        this.answerIds != null
          ? (JSON.parse(this.answerIds) as number[])
          : null,
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

SupportMessage.relationMappings = {};
