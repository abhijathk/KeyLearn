import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * A file somebody attached to a support conversation.
 *
 * The row holds what a query might ever want — who it belongs to, what it
 * is called, its type and size — and the bytes live on disk under
 * `DataDir.supportAttachmentFile(id)`. A screenshot of a broken certificate
 * is a few hundred kilobytes of opaque data that nothing ever looks inside;
 * keeping it in a column would make every backup, dump and replica carry
 * it, for no gain.
 *
 * `ticketId` is null while the very first message is being composed —
 * there is no ticket yet to hang it on. Such a row is owned by `userId`
 * alone, and is bound to the ticket the moment it is created. This is the
 * common case rather than an edge one: the screenshot of the thing that
 * went wrong is usually the reason somebody is writing at all.
 *
 * `messageId` is null while the file is still being composed. Attachments
 * upload the moment they are chosen, not when Send is pressed — so a large
 * screenshot is not re-sent with every retry of a failing message, and the
 * progress bar has something real to report. They are bound to a message
 * when that message is finally sent; anything still unbound after a while
 * is an abandoned compose and gets swept.
 */
export class SupportAttachment extends TimestampMixin(Model) {
  static override readonly tableName = "support_attachment";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["fileName", "mimeType", "size"],
    properties: {
      id: { type: "integer" },
      ticketId: { type: ["integer", "null"] },
      messageId: { type: ["integer", "null"] },
      // Who uploaded it. Every read is checked against this and the
      // ticket's owner, so one account cannot fetch another's files by
      // guessing an id.
      userId: { type: ["integer", "null"] },
      fileName: { type: "string", minLength: 1, maxLength: 200 },
      mimeType: { type: "string", minLength: 1, maxLength: 100 },
      size: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("ticket_id")
      .unsigned()
      // Null while the first message of a not-yet-existing ticket is
      // being composed; bound on create.
      .nullable()
      .references("id")
      .inTable("support_ticket")
      .onDelete("CASCADE");
    // Null until the message it belongs to is sent.
    table.integer("message_id").unsigned().nullable();
    table.integer("user_id").unsigned().nullable();
    table.string("file_name", 200).notNullable();
    table.string("mime_type", 100).notNullable();
    table.integer("size").unsigned().notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["ticket_id", "message_id"]);
    // Finding a person's unbound uploads when their ticket is created.
    table.index(["user_id", "ticket_id"]);
    // The sweep for abandoned uploads reads this shape.
    table.index(["message_id", "created_at"]);
  }

  readonly id?: number;
  ticketId?: number | null;
  messageId?: number | null;
  userId?: number | null;
  fileName?: string;
  mimeType?: string;
  size?: number;
  createdAt?: Date;

  /**
   * What a browser is allowed to send. Deliberately a short allow-list
   * rather than a block-list: this desk needs screenshots and paperwork,
   * and every other type is a question nobody asked.
   */
  static readonly ALLOWED_TYPES: ReadonlySet<string> = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ]);

  /** 10 MB, matching what the compose box tells people. */
  static readonly MAX_BYTES = 10 * 1024 * 1024;

  static async listForTicket(ticketId: number): Promise<SupportAttachment[]> {
    return await SupportAttachment.query()
      .where("ticketId", ticketId)
      .orderBy("id", "asc");
  }

  /** The ones already sent, grouped by the message that carried them. */
  static async byMessage(
    ticketId: number,
  ): Promise<Map<number, SupportAttachment[]>> {
    const rows = await SupportAttachment.query()
      .where("ticketId", ticketId)
      .whereNotNull("messageId")
      .orderBy("id", "asc");
    const map = new Map<number, SupportAttachment[]>();
    for (const row of rows) {
      const list = map.get(row.messageId!) ?? [];
      list.push(row);
      map.set(row.messageId!, list);
    }
    return map;
  }

  /** Uploaded but not yet sent — what the compose tray shows on reload. */
  static async pendingFor(
    ticketId: number,
    userId: number,
  ): Promise<SupportAttachment[]> {
    return await SupportAttachment.query()
      .where("ticketId", ticketId)
      .where("userId", userId)
      .whereNull("messageId")
      .orderBy("id", "asc");
  }

  /**
   * What somebody has uploaded for a ticket that does not exist yet.
   *
   * Keyed on the user alone, which is safe because there is exactly one
   * new-message surface per account — the same reason the draft table
   * uses a null ticket id for it.
   */
  static async unboundFor(userId: number): Promise<SupportAttachment[]> {
    return await SupportAttachment.query()
      .where("userId", userId)
      .whereNull("ticketId")
      .orderBy("id", "asc");
  }

  /** Claimed by the ticket the moment it exists. */
  static async bindToTicket(
    userId: number,
    ticketId: number,
  ): Promise<number[]> {
    const rows = await SupportAttachment.unboundFor(userId);
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((r) => r.id!);
    await SupportAttachment.query().whereIn("id", ids).patch({ ticketId });
    return ids;
  }

  toDetails() {
    return {
      id: this.id!,
      fileName: this.fileName!,
      mimeType: this.mimeType!,
      size: this.size!,
      // The page decides between a thumbnail and a file chip on this alone.
      isImage: this.mimeType!.startsWith("image/"),
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

SupportAttachment.relationMappings = {};
