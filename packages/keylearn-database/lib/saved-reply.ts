import { type SavedReplyDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * A canned reply starting point staff can drop into a thread and edit before
 * sending. Shared across the whole desk, not per-staff-member — the same
 * "thanks, we're on it" opener is useful to whoever picks up the ticket next.
 */
export class SavedReply extends TimestampMixin(Model) {
  static override readonly tableName = "saved_reply";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["title", "body"],
    properties: {
      id: { type: "integer" },
      title: { type: "string", minLength: 1, maxLength: 128 },
      body: { type: "string", minLength: 1, maxLength: 4000 },
      usedCount: { type: "integer" },
      createdBy: { type: ["integer", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { title } = SavedReply.jsonSchema.properties;
    table.increments("id").primary();
    table.string("title", title.maxLength).notNullable();
    table.text("body").notNullable();
    table.integer("used_count").unsigned().notNullable().defaultTo(0);
    // Not a foreign key — same reasoning as SupportTicket.userId: a reply a
    // departed staffer wrote should not vanish along with their account.
    table.integer("created_by").unsigned().nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  title?: string;
  body?: string;
  usedCount?: number;
  createdBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;

  static async create({
    title,
    body,
    createdBy = null,
  }: {
    readonly title: string;
    readonly body: string;
    readonly createdBy?: number | null;
  }): Promise<SavedReply> {
    return await SavedReply.query().insertAndFetch({
      title,
      body,
      createdBy,
      updatedAt: new Date(),
    });
  }

  static async update(
    id: number,
    patch: { readonly title?: string; readonly body?: string },
  ): Promise<SavedReply | null> {
    return (
      (await SavedReply.query().patchAndFetchById(id, {
        ...patch,
        updatedAt: new Date(),
      })) ?? null
    );
  }

  static async listAll(): Promise<SavedReply[]> {
    return await SavedReply.query().orderBy("title");
  }

  static async incrementUsed(id: number): Promise<void> {
    await SavedReply.query().findById(id).increment("usedCount", 1);
  }

  toDetails(): SavedReplyDetails {
    return {
      id: this.id!,
      title: this.title!,
      body: this.body!,
      usedCount: this.usedCount ?? 0,
      updatedAt: new Date(this.updatedAt!).toISOString(),
    };
  }
}

SavedReply.relationMappings = {};
