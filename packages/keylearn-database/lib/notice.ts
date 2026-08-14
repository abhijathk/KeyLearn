import { type NoticeDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

export type NoticeLevel = "info" | "warning";

/**
 * A short site-wide announcement staff can post and later retract — the
 * quick "we're aware of an issue" banner that pairs with a spike of support
 * tickets about the same thing.
 *
 * Only one notice is ever active at a time, so the banner stays simple: the
 * most recent active row is the one shown.
 */
export class Notice extends TimestampMixin(Model) {
  static override readonly tableName = "notice";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["message", "level"],
    properties: {
      id: { type: "integer" },
      message: { type: "string", minLength: 1, maxLength: 280 },
      level: { type: "string", enum: ["info", "warning"] },
      active: { type: "boolean" },
      createdBy: { type: ["integer", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { message } = Notice.jsonSchema.properties;
    table.increments("id").primary();
    table.string("message", message.maxLength).notNullable();
    table.string("level", 16).notNullable().defaultTo("info");
    table.boolean("active").notNullable().defaultTo(true);
    table.integer("created_by").unsigned().nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["active", "created_at"]);
  }

  readonly id?: number;
  message?: string;
  level?: NoticeLevel;
  active?: number | boolean;
  createdBy?: number | null;
  createdAt?: Date;

  static async create({
    message,
    level = "info",
    createdBy,
  }: {
    readonly message: string;
    readonly level?: NoticeLevel;
    readonly createdBy: number;
  }): Promise<Notice> {
    // A new notice replaces whatever was active — one banner at a time.
    await Notice.query().patch({ active: false }).where("active", true);
    return await Notice.query().insertAndFetch({
      message,
      level,
      active: true,
      createdBy,
    });
  }

  /** The one banner to show, or null if nothing is active. */
  static async activeNotice(): Promise<Notice | null> {
    return (
      (await Notice.query()
        .where("active", true)
        .orderBy("createdAt", "desc")
        .first()) ?? null
    );
  }

  static async setActive(id: number, active: boolean): Promise<void> {
    if (active) {
      // Same one-at-a-time rule as create().
      await Notice.query().patch({ active: false }).where("active", true);
    }
    await Notice.query().findById(id).patch({ active });
  }

  toDetails(): NoticeDetails {
    return {
      id: this.id!,
      message: this.message!,
      level: this.level!,
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

Notice.relationMappings = {};
