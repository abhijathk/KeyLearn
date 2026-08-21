import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * What somebody has written and not yet sent.
 *
 * On the server rather than in the tab, and that is the whole point of it.
 * The grown-up PIN lapses after fifteen minutes; a long, careful complaint
 * takes longer than people think. A draft in `sessionStorage` dies at
 * exactly the moment it was needed — the person hits Send, meets the PIN
 * gate, and loses three hundred words about a double charge in the place
 * they came to because something had already gone wrong.
 *
 * One row per composing surface:
 *
 * - `ticketId` set — a reply being written into an existing conversation.
 * - `ticketId` null — a new ticket being composed, subject and all.
 *
 * Saved debounced as they type, deleted the moment the thing is sent.
 */
export class SupportDraft extends TimestampMixin(Model) {
  static override readonly tableName = "support_draft";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["userId"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      ticketId: { type: ["integer", "null"] },
      // Only used by a new-ticket draft; a reply has no subject of its own.
      subject: { type: ["string", "null"], maxLength: 200 },
      body: { type: ["string", "null"], maxLength: 4000 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable();
    table
      .integer("ticket_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("support_ticket")
      .onDelete("CASCADE");
    table.string("subject", 200).nullable();
    table.text("body").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    // One draft per surface. A second row for the same conversation would
    // mean two half-written replies and no way to say which is current.
    table.unique(["user_id", "ticket_id"], {
      indexName: "support_draft_one_per_surface",
    });
  }

  readonly id?: number;
  userId?: number;
  ticketId?: number | null;
  subject?: string | null;
  body?: string | null;
  createdAt?: Date;
  updatedAt?: Date;

  /**
   * Writes the draft, or clears it when there is nothing left to keep.
   *
   * An empty body deletes rather than storing a blank row: otherwise every
   * conversation somebody has ever clicked into carries a "Draft" marker
   * for a message they thought better of.
   */
  static async put({
    userId,
    ticketId = null,
    subject = null,
    body = null,
  }: {
    readonly userId: number;
    readonly ticketId?: number | null;
    readonly subject?: string | null;
    readonly body?: string | null;
  }): Promise<SupportDraft | null> {
    const empty = (body ?? "").trim() === "" && (subject ?? "").trim() === "";
    if (empty) {
      await SupportDraft.clear(userId, ticketId);
      return null;
    }
    const existing = await SupportDraft.find(userId, ticketId);
    if (existing != null) {
      return await existing
        .$query()
        .patchAndFetch({ subject, body, updatedAt: new Date() });
    }
    return await SupportDraft.query().insertAndFetch({
      userId,
      ticketId,
      subject,
      body,
      updatedAt: new Date(),
    });
  }

  static async find(
    userId: number,
    ticketId: number | null,
  ): Promise<SupportDraft | null> {
    const query = SupportDraft.query().where("userId", userId);
    return (
      (await (
        ticketId == null
          ? query.whereNull("ticketId")
          : query.where("ticketId", ticketId)
      ).first()) ?? null
    );
  }

  static async clear(userId: number, ticketId: number | null): Promise<void> {
    const query = SupportDraft.query().delete().where("userId", userId);
    await (ticketId == null
      ? query.whereNull("ticketId")
      : query.where("ticketId", ticketId));
  }

  /** Which of this user's conversations carry an unsent reply — the chip marker. */
  static async ticketIdsWithDrafts(userId: number): Promise<Set<number>> {
    const rows = await SupportDraft.query()
      .select("ticketId")
      .where("userId", userId)
      .whereNotNull("ticketId");
    return new Set(rows.map((r) => r.ticketId!));
  }

  toDetails() {
    return {
      subject: this.subject ?? "",
      body: this.body ?? "",
      updatedAt: new Date(this.updatedAt!).toISOString(),
    };
  }
}

SupportDraft.relationMappings = {};
