import { type Knex } from "knex";
import { type JSONSchema, Model, type Pojo, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/** The longest comment a feedback card accepts. */
export const LEARNER_COMMENT_MAX = 500;

/**
 * One learner's answer to a poll or a feedback card (control centre spec
 * §8): the desk's notice id, the account, the choice or the stars, and an
 * optional comment.
 *
 * One row per account per notice, changeable until the card is closed —
 * votes are per account, never per profile, and a kid profile is never
 * asked, so there is no profile column to get that wrong with.
 *
 * The comment is personal data. It is exported with the account, deleted
 * with the account, and reduced to the star after twelve months by
 * `LearnerResponseSweep` (decided 2 Sep 2026). `hiddenAt` is moderation:
 * a staff member drops a comment's text from the inbox; the star stays.
 *
 * `noticeId` is the desk's id (QDesk owns the notice), not a foreign key.
 */
export class LearnerResponse extends TimestampMixin(Model) {
  static override readonly tableName = "learner_response";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["noticeId", "userId"],
    properties: {
      id: { type: "integer" },
      noticeId: { type: "integer" },
      userId: { type: "integer" },
      /** Index into the poll's options; null for a feedback card. */
      choice: { type: ["integer", "null"], minimum: 0, maximum: 3 },
      /** 1–5 for a feedback card; null for a poll. */
      stars: { type: ["integer", "null"], minimum: 1, maximum: 5 },
      text: { type: ["string", "null"], maxLength: LEARNER_COMMENT_MAX },
      /** Set when the contact-detail detector fired on the text. */
      flagged: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("notice_id").notNullable();
    table.integer("user_id").unsigned().notNullable();
    table.integer("choice").nullable();
    table.integer("stars").nullable();
    table.string("text", LEARNER_COMMENT_MAX).nullable();
    table.boolean("flagged").notNullable().defaultTo(false);
    table.timestamp("hidden_at").nullable();
    /* When the comment text was dropped (retention or moderation), so the
     * inbox can say "comment removed" rather than "no comment". */
    table.timestamp("text_dropped_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["notice_id", "user_id"]);
    table.index(["notice_id", "created_at"]);
    table.index(["user_id"]);
  }

  readonly id?: number;
  noticeId?: number;
  userId?: number;
  choice?: number | null;
  stars?: number | null;
  text?: string | null;
  flagged?: number | boolean;
  hiddenAt?: Date | null;
  textDroppedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  override $parseDatabaseJson(json: Pojo): Pojo {
    json = super.$parseDatabaseJson(json);
    for (const name of [
      "createdAt",
      "updatedAt",
      "hiddenAt",
      "textDroppedAt",
    ]) {
      const value = json[name];
      if (value != null && !(value instanceof Date)) {
        json[name] = new Date(value);
      }
    }
    return json;
  }

  /** The account's own row for a notice, or null. */
  static async findFor(
    noticeId: number,
    userId: number,
  ): Promise<LearnerResponse | null> {
    return (
      (await LearnerResponse.query().findOne({ noticeId, userId })) ?? null
    );
  }

  /** Writes or replaces the account's answer. */
  static async upsert({
    noticeId,
    userId,
    choice = null,
    stars = null,
    text = null,
    flagged = false,
  }: {
    readonly noticeId: number;
    readonly userId: number;
    readonly choice?: number | null;
    readonly stars?: number | null;
    readonly text?: string | null;
    readonly flagged?: boolean;
  }): Promise<LearnerResponse> {
    const existing = await LearnerResponse.findFor(noticeId, userId);
    if (existing != null) {
      return await existing.$query().patchAndFetch({
        choice,
        stars,
        text,
        flagged,
        hiddenAt: null,
        textDroppedAt: null,
        updatedAt: new Date(),
      });
    }
    return await LearnerResponse.query().insertAndFetch({
      noticeId,
      userId,
      choice,
      stars,
      text,
      flagged,
    });
  }

  /** The live tally for a poll or a feedback card. Never any text. */
  static async resultsFor(noticeId: number): Promise<LearnerResults> {
    const rows = await LearnerResponse.query()
      .where("noticeId", noticeId)
      .select("choice", "stars", "text", "textDroppedAt", "hiddenAt");
    const choices = [0, 0, 0, 0];
    const stars = [0, 0, 0, 0, 0];
    let count = 0;
    let comments = 0;
    let starSum = 0;
    let rated = 0;
    for (const row of rows) {
      count += 1;
      if (row.choice != null && row.choice >= 0 && row.choice < 4) {
        choices[row.choice] += 1;
      }
      if (row.stars != null && row.stars >= 1 && row.stars <= 5) {
        stars[row.stars - 1] += 1;
        starSum += row.stars;
        rated += 1;
      }
      if (row.text != null && row.text !== "") {
        comments += 1;
      }
    }
    return {
      count,
      choices,
      stars,
      average: rated === 0 ? null : Math.round((starSum / rated) * 10) / 10,
      comments,
    };
  }

  /** Feedback rows with a comment (or a dropped one), newest first, for the desk's inbox. */
  static async listFeedback({
    noticeId = null,
    before = null,
    limit = 50,
  }: {
    readonly noticeId?: number | null;
    readonly before?: number | null;
    readonly limit?: number;
  } = {}): Promise<LearnerResponse[]> {
    let query = LearnerResponse.query()
      .whereNotNull("stars")
      .where((b) => b.whereNotNull("text").orWhereNotNull("textDroppedAt"))
      .orderBy("id", "desc")
      .limit(Math.max(1, Math.min(200, limit)));
    if (noticeId != null) {
      query = query.where("noticeId", noticeId);
    }
    if (before != null) {
      query = query.where("id", "<", before);
    }
    return await query;
  }

  /** Moderation: drops the comment text, keeps the star. */
  static async hide(id: number): Promise<boolean> {
    const now = new Date();
    return (
      (await LearnerResponse.query()
        .findById(id)
        .patch({
          text: null,
          hiddenAt: now,
          textDroppedAt: now,
          updatedAt: now,
        })) > 0
    );
  }

  /** Retention: drops every comment older than `before`, keeps the star. */
  static async dropTextBefore(before: Date): Promise<number> {
    const now = new Date();
    return await LearnerResponse.query()
      .whereNotNull("text")
      .where("createdAt", "<", before)
      .patch({ text: null, textDroppedAt: now, updatedAt: now });
  }

  /** Everything the account has answered, for the data export. */
  static async listForUser(userId: number): Promise<LearnerResponse[]> {
    return await LearnerResponse.query().where("userId", userId).orderBy("id");
  }

  /** The account is being erased; its answers go with it. */
  static async deleteForUser(userId: number): Promise<number> {
    return await LearnerResponse.query().where("userId", userId).delete();
  }

  toDetails(): LearnerResponseDetails {
    return {
      id: this.id!,
      noticeId: this.noticeId!,
      choice: this.choice ?? null,
      stars: this.stars ?? null,
      text: this.text ?? null,
      textDropped: this.textDroppedAt != null,
      flagged: Boolean(this.flagged),
      hidden: this.hiddenAt != null,
      createdAt: new Date(this.createdAt!).toISOString(),
      updatedAt: new Date(this.updatedAt!).toISOString(),
    };
  }
}

export type LearnerResults = {
  /** Every account that answered. */
  readonly count: number;
  /** Votes per option index, for a poll. */
  readonly choices: readonly number[];
  /** Ratings per star (index 0 is one star), for a feedback card. */
  readonly stars: readonly number[];
  readonly average: number | null;
  /** How many answers carry a comment right now. */
  readonly comments: number;
};

export type LearnerResponseDetails = {
  readonly id: number;
  readonly noticeId: number;
  readonly choice: number | null;
  readonly stars: number | null;
  readonly text: string | null;
  readonly textDropped: boolean;
  readonly flagged: boolean;
  readonly hidden: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};
