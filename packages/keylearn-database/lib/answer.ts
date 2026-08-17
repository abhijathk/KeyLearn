import {
  type AnswerDetails,
  type AnswerRuleDetails,
} from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * A short published article the support desk can hand back automatically or
 * suggest while someone is still typing their question.
 *
 * `hitCount` and `solvedCount` are the whole matching system's feedback
 * loop: an article that is matched often but rarely marked as having solved
 * anything is confidently wrong, and that is only visible because both
 * counters exist side by side.
 */
export class Answer extends TimestampMixin(Model) {
  static override readonly tableName = "answer";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["title", "body"],
    properties: {
      id: { type: "integer" },
      title: { type: "string", minLength: 1, maxLength: 128 },
      body: { type: "string", minLength: 1, maxLength: 4000 },
      published: { type: "boolean" },
      hitCount: { type: "integer" },
      solvedCount: { type: "integer" },
      reopenedCount: { type: "integer" },
      createdBy: { type: ["integer", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { title } = Answer.jsonSchema.properties;
    table.increments("id").primary();
    table.string("title", title.maxLength).notNullable();
    table.text("body").notNullable();
    table.boolean("published").notNullable().defaultTo(true);
    table.integer("hit_count").unsigned().notNullable().defaultTo(0);
    table.integer("solved_count").unsigned().notNullable().defaultTo(0);
    table.integer("reopened_count").unsigned().notNullable().defaultTo(0);
    // Not a foreign key — same reasoning as SupportTicket.userId: an article
    // a departed staffer wrote should not vanish along with their account.
    table.integer("created_by").unsigned().nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["published"]);
  }

  readonly id?: number;
  title?: string;
  body?: string;
  published?: number | boolean;
  hitCount?: number;
  solvedCount?: number;
  reopenedCount?: number;
  createdBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  rules?: AnswerRule[];

  static async create({
    title,
    body,
    published = true,
    createdBy = null,
  }: {
    readonly title: string;
    readonly body: string;
    readonly published?: boolean;
    readonly createdBy?: number | null;
  }): Promise<Answer> {
    return await Answer.query().insertAndFetch({
      title,
      body,
      published,
      createdBy,
      updatedAt: new Date(),
    });
  }

  static async update(
    id: number,
    patch: {
      readonly title?: string;
      readonly body?: string;
      readonly published?: boolean;
    },
  ): Promise<Answer | null> {
    return (
      (await Answer.query().patchAndFetchById(id, {
        ...patch,
        updatedAt: new Date(),
      })) ?? null
    );
  }

  /** Published articles, most successful first — hit/solved-rate sorted. */
  static async listPublished(): Promise<Answer[]> {
    return await Answer.query()
      .where("published", true)
      .orderBy("solvedCount", "desc")
      .orderBy("hitCount", "desc");
  }

  static async findById(id: number): Promise<Answer | null> {
    return (await Answer.query().findById(id)) ?? null;
  }

  static async incrementHit(id: number): Promise<void> {
    await Answer.query().findById(id).increment("hitCount", 1);
  }

  static async incrementSolved(id: number): Promise<void> {
    await Answer.query().findById(id).increment("solvedCount", 1);
  }

  static async incrementReopened(id: number): Promise<void> {
    await Answer.query().findById(id).increment("reopenedCount", 1);
  }

  toDetails(): AnswerDetails {
    return {
      id: this.id!,
      title: this.title!,
      body: this.body!,
      published: Boolean(this.published),
      hitCount: this.hitCount ?? 0,
      solvedCount: this.solvedCount ?? 0,
      reopenedCount: this.reopenedCount ?? 0,
      createdAt: new Date(this.createdAt!).toISOString(),
      updatedAt: new Date(this.updatedAt!).toISOString(),
    };
  }
}

/**
 * A keyword/phrase rule that points at an {@link Answer}.
 *
 * Matching itself (keyword/phrase overlap scoring) is a small pure function
 * on the server, not here — this row only holds the data it scores against.
 * `keywords` is one delimited string rather than a JSON column so it stays
 * trivially portable between the two database engines this app supports.
 */
export class AnswerRule extends TimestampMixin(Model) {
  static override readonly tableName = "answer_rule";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["answerId", "keywords"],
    properties: {
      id: { type: "integer" },
      answerId: { type: "integer" },
      // Comma-or-newline-delimited keywords/phrases, split by the matcher.
      keywords: { type: "string", minLength: 1, maxLength: 1000 },
      // A rule that only ever suggests an article — never auto-sent as a reply.
      suggestOnly: { type: "boolean" },
      firedCount: { type: "integer" },
      solvedCount: { type: "integer" },
      reopenedCount: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("answer_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("answer")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.text("keywords").notNullable();
    table.boolean("suggest_only").notNullable().defaultTo(false);
    table.integer("fired_count").unsigned().notNullable().defaultTo(0);
    table.integer("solved_count").unsigned().notNullable().defaultTo(0);
    table.integer("reopened_count").unsigned().notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["answer_id"]);
  }

  readonly id?: number;
  answerId?: number;
  keywords?: string;
  suggestOnly?: number | boolean;
  firedCount?: number;
  solvedCount?: number;
  reopenedCount?: number;
  createdAt?: Date;
  answer?: Answer;

  static async create({
    answerId,
    keywords,
    suggestOnly = false,
  }: {
    readonly answerId: number;
    readonly keywords: string;
    readonly suggestOnly?: boolean;
  }): Promise<AnswerRule> {
    return await AnswerRule.query().insertAndFetch({
      answerId,
      keywords,
      suggestOnly,
    });
  }

  static async update(
    id: number,
    patch: {
      readonly keywords?: string;
      readonly suggestOnly?: boolean;
    },
  ): Promise<AnswerRule | null> {
    return (await AnswerRule.query().patchAndFetchById(id, patch)) ?? null;
  }

  /** Every rule, with its parent article eagerly loaded — the desk always shows both together. */
  static async listAll(): Promise<AnswerRule[]> {
    return await AnswerRule.query().withGraphFetched("answer").orderBy("id");
  }

  static async incrementFired(id: number): Promise<void> {
    await AnswerRule.query().findById(id).increment("firedCount", 1);
  }

  static async incrementSolved(id: number): Promise<void> {
    await AnswerRule.query().findById(id).increment("solvedCount", 1);
  }

  static async incrementReopened(id: number): Promise<void> {
    await AnswerRule.query().findById(id).increment("reopenedCount", 1);
  }

  toDetails(): AnswerRuleDetails {
    return {
      id: this.id!,
      answerId: this.answerId!,
      keywords: this.keywords!,
      suggestOnly: Boolean(this.suggestOnly),
      firedCount: this.firedCount ?? 0,
      solvedCount: this.solvedCount ?? 0,
      reopenedCount: this.reopenedCount ?? 0,
      answer: this.answer != null ? this.answer.toDetails() : null,
    };
  }
}

Answer.relationMappings = {
  rules: {
    relation: Model.HasManyRelation,
    modelClass: AnswerRule,
    join: {
      from: "answer.id",
      to: "answer_rule.answer_id",
    },
  },
};

AnswerRule.relationMappings = {
  answer: {
    relation: Model.BelongsToOneRelation,
    modelClass: Answer,
    join: {
      from: "answer_rule.answer_id",
      to: "answer.id",
    },
  },
};
