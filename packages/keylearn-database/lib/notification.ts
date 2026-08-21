import { type NotificationDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

export type NotificationKind = "ticket-reply";

/**
 * A signed-in account's in-app "you have an update" indicator — the
 * replacement for emailing every support-ticket reply to someone who
 * already has an account to check. One row per unread-worthy event, not a
 * join table; a household shares one account, so this is coarse on
 * purpose rather than per-profile.
 */
export class Notification extends TimestampMixin(Model) {
  static override readonly tableName = "notification";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["userId", "kind"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      kind: { type: "string", enum: ["ticket-reply"] },
      ticketId: { type: ["integer", "null"] },
      // A short snapshot of the reply, denormalized onto the row rather
      // than requiring a separate authenticated thread-view page — that's
      // a real follow-up feature, not something to fake with a stale or
      // rotating guest thread token just to make this link somewhere.
      body: { type: ["string", "null"], maxLength: 240 },
      // Who the customer should see this from — a staffer's desk name, or
      // the assistant's. Stored per notification rather than looked up,
      // because it is a property of the message that caused it and the
      // person who wrote it may have changed name since.
      authorName: { type: ["string", "null"], maxLength: 64 },
      // Whether the assistant wrote it. Stored rather than guessed from
      // the name: the promise the thread makes — that the assistant is
      // never passed off as a person — has to hold on the bell too.
      fromAssistant: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.string("kind", 32).notNullable();
    // Not a foreign key, same reasoning as SupportTicket.userId elsewhere in
    // this package: a later-deleted ticket must not break a still-relevant
    // notification row.
    table.integer("ticket_id").unsigned().nullable();
    table.string("body", 240).nullable();
    table.string("author_name", 64).nullable();
    table.boolean("from_assistant").notNullable().defaultTo(false);
    table.timestamp("read_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "read_at"]);
  }

  readonly id?: number;
  userId?: number;
  kind?: NotificationKind;
  ticketId?: number | null;
  body?: string | null;
  authorName?: string | null;
  fromAssistant?: boolean;
  readAt?: Date | null;
  createdAt?: Date;

  static async create({
    userId,
    kind,
    ticketId = null,
    body = null,
    authorName = null,
    fromAssistant = false,
  }: {
    readonly userId: number;
    readonly kind: NotificationKind;
    readonly ticketId?: number | null;
    readonly body?: string | null;
    readonly authorName?: string | null;
    readonly fromAssistant?: boolean;
  }): Promise<Notification> {
    return await Notification.query().insertAndFetch({
      userId,
      kind,
      ticketId,
      body: body != null ? body.slice(0, 240) : null,
      authorName,
      fromAssistant,
    });
  }

  /** Newest first, capped — a badge/list, not an archive. */
  static async listForUser(
    userId: number,
    limit = 20,
  ): Promise<Notification[]> {
    return await Notification.query()
      .where("userId", userId)
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  static async countUnread(userId: number): Promise<number> {
    return await Notification.query()
      .where("userId", userId)
      .whereNull("readAt")
      .resultSize();
  }

  /**
   * Marks one notification read, scoped to its owner — a guessed id must
   * not let one account mark (or even confirm the existence of) another
   * account's notification.
   */
  static async markRead(
    id: number,
    userId: number,
  ): Promise<Notification | null> {
    const notification = await Notification.query().findOne({ id, userId });
    if (notification == null) {
      return null;
    }
    if (notification.readAt != null) {
      return notification;
    }
    return await notification.$query().patchAndFetch({ readAt: new Date() });
  }

  /**
   * Removed from the person's own list.
   *
   * A real delete rather than a "dismissed" flag: a notification is a
   * nudge about something that lives elsewhere, and once it has been
   * dealt with there is nothing to keep. The ticket it points at is the
   * record, and that is untouched.
   *
   * Scoped to (id, userId) so a guessed id belonging to another account
   * silently no-ops rather than reporting whether it exists.
   */
  static async dismiss(id: number, userId: number): Promise<void> {
    await Notification.query().delete().where({ id, userId });
  }

  /** The whole list at once. */
  static async dismissAll(userId: number): Promise<void> {
    await Notification.query().delete().where({ userId });
  }

  toDetails(): NotificationDetails {
    return {
      id: this.id!,
      kind: this.kind!,
      ticketId: this.ticketId ?? null,
      body: this.body ?? null,
      authorName: this.authorName ?? null,
      fromAssistant: Boolean(this.fromAssistant),
      // Filled in by the caller, which has the ticket to hand.
      reference: null,
      subject: null,
      status: null,
      read: this.readAt != null,
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

Notification.relationMappings = {};
