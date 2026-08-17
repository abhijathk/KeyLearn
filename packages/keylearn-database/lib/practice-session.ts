import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * One row per sync flush — nothing else.
 *
 * Deliberately skeletal: the only question this table exists to answer is
 * "how often does an active account practise", and that does not need (and
 * must never gain) a lesson, a speed, an accuracy or a keystroke — the
 * support/analytics surface must never see practice content.
 *
 * `userId` is a real foreign key here, unlike the non-FK userId columns
 * elsewhere in this package (SupportTicket, StaffAuditEvent, SecurityEvent):
 * those are evidence of something that happened and must outlive the
 * account that caused it, but an aggregate practice count tied to a real,
 * still-registered account should not survive deleting that account.
 */
export class PracticeSession extends TimestampMixin(Model) {
  static override readonly tableName = "practice_session";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["userId"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "created_at"]);
  }

  readonly id?: number;
  userId?: number;
  createdAt?: Date;

  /** One insert per sync flush — the caller decides what counts as one. */
  static async record(userId: number): Promise<void> {
    await PracticeSession.query().insert({ userId });
  }

  /**
   * Average practice sessions per active user per week, over the trailing
   * window — `count(*) / (count(distinct user_id) * weeks)`. `0` when
   * nothing was recorded, rather than a division by zero.
   */
  static async avgSessionsPerActiveUserPerWeek(
    sinceDays = 28,
  ): Promise<number> {
    const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);
    const row = (await PracticeSession.knex()(PracticeSession.tableName)
      .where("created_at", ">=", since)
      .count({ sessions: "*" })
      .countDistinct({ activeUsers: "user_id" })
      .first()) as
      | { sessions: number | string; activeUsers: number | string }
      | undefined;
    const sessions = Number(row?.sessions ?? 0);
    const activeUsers = Number(row?.activeUsers ?? 0);
    if (sessions === 0 || activeUsers === 0) {
      return 0;
    }
    return sessions / (activeUsers * (sinceDays / 7));
  }
}

PracticeSession.relationMappings = {};
