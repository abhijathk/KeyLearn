import { type Knex } from "knex";

/**
 * The durable queue for forwards to QDesk that are not customer messages —
 * ratings, thumbs, "that sorted it", archives. The server's
 * `support/qdesk-outbox.ts` owns the behaviour; this is only the table, so
 * it is created with every other table at bootstrap rather than on the
 * first rating after a deploy.
 *
 * No model class: the outbox is read and written with the query builder.
 */
export const SupportQdeskOutbox = {
  tableName: "support_qdesk_outbox",
  createTable(knex: Knex, table: Knex.CreateTableBuilder): void {
    table.increments("id").primary();
    table.string("kind", 24).notNullable();
    table.integer("ticket_id").unsigned().notNullable();
    table.string("path", 255).notNullable();
    table.text("body").notNullable();
    table.string("idem_key", 64).notNullable().unique();
    table.string("dedupe_key", 128).notNullable().index();
    table.string("account_key", 160).notNullable();
    table.integer("attempts").notNullable().defaultTo(0);
    // Epoch milliseconds throughout: one representation on both engines,
    // and nothing to convert when comparing to Date.now().
    table.bigInteger("next_attempt_at").notNullable();
    table.bigInteger("created_at").notNullable();
    table.bigInteger("delivered_at").nullable();
    table.bigInteger("failed_at").nullable();
    table.integer("last_status").nullable();
    // Named: knex's generated name is 65 characters, and MySQL refuses
    // identifiers over 64 (SQLite does not care, so only production saw it).
    table.index(
      ["delivered_at", "failed_at", "next_attempt_at"],
      "support_qdesk_outbox_due_index",
    );
  },
} as const;
