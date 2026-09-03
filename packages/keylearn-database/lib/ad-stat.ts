import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";

/**
 * What an advertiser is shown at the end of the week, and nothing more.
 *
 * One row per campaign per screen per day, holding two counters. There is
 * no row per reader and no identifier of any kind, which is what lets the
 * weekly report say how many without ever being able to say who.
 *
 * Deduplication lives in {@link AdSeen} instead, as a rolling hash with a
 * lifetime measured in hours.
 */
export class AdStat extends Model {
  static override readonly tableName = "ad_stat";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["campaignId", "screen", "day"],
    properties: {
      id: { type: "integer" },
      campaignId: { type: "integer" },
      screen: { type: "integer", minimum: 0, maximum: 2 },
      /** Local date as YYYY-MM-DD, so a day is a day rather than a timestamp range. */
      day: { type: "string", minLength: 10, maxLength: 10 },
      views: { type: "integer" },
      clicks: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("campaign_id").unsigned().notNullable();
    table.integer("screen").unsigned().notNullable();
    table.string("day", 10).notNullable();
    table.integer("views").unsigned().notNullable().defaultTo(0);
    table.integer("clicks").unsigned().notNullable().defaultTo(0);
    table.unique(["campaign_id", "screen", "day"]);
    table.index(["campaign_id", "day"]);
  }

  readonly id?: number;
  campaignId?: number;
  screen?: number;
  day?: string;
  views?: number;
  clicks?: number;

  /** Adds one to a counter, creating the day's row the first time. */
  static async bump(
    campaignId: number,
    screen: number,
    column: "views" | "clicks",
    when: Date = new Date(),
  ): Promise<void> {
    const day = when.toISOString().slice(0, 10);
    const existing = await AdStat.query().findOne({ campaignId, screen, day });
    if (existing == null) {
      await AdStat.query().insert({
        campaignId,
        screen,
        day,
        views: column === "views" ? 1 : 0,
        clicks: column === "clicks" ? 1 : 0,
      });
      return;
    }
    await AdStat.query().findById(existing.id!).increment(column, 1);
  }

  /** Totals for one campaign between two days, inclusive, by screen. */
  static async forCampaign(
    campaignId: number,
    fromDay: string,
    toDay: string,
  ): Promise<readonly AdStatRow[]> {
    const rows = await AdStat.query()
      .where("campaignId", campaignId)
      .where("day", ">=", fromDay)
      .where("day", "<=", toDay);
    const byScreen = new Map<number, { views: number; clicks: number }>();
    for (const row of rows) {
      const at = byScreen.get(row.screen!) ?? { views: 0, clicks: 0 };
      at.views += row.views ?? 0;
      at.clicks += row.clicks ?? 0;
      byScreen.set(row.screen!, at);
    }
    return [...byScreen.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([screen, at]) => ({ screen, views: at.views, clicks: at.clicks }));
  }

  /** Daily rows older than the window are summarised away by the sweep. */
  static async deleteBefore(day: string): Promise<number> {
    return await AdStat.query().where("day", "<", day).delete();
  }
}

export type AdStatRow = {
  readonly screen: number;
  readonly views: number;
  readonly clicks: number;
};

/**
 * The twenty-four hour memory that stops one reader being counted twice.
 *
 * A row is a hash of the session and the day, never the session itself, and
 * it is swept hourly. Nothing here survives a day, and nothing here can be
 * joined to an account.
 */
export class AdSeen extends Model {
  static override readonly tableName = "ad_seen";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["hash", "expiresAt"],
    properties: {
      id: { type: "integer" },
      hash: { type: "string", minLength: 16, maxLength: 64 },
      expiresAt: {},
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.string("hash", 64).notNullable().unique();
    table.timestamp("expires_at").notNullable();
    table.index(["expires_at"]);
  }

  readonly id?: number;
  hash?: string;
  expiresAt?: Date;

  /**
   * True the first time this hash is offered and false afterwards, which is
   * exactly the question "should this count?".
   */
  static async first(hash: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = await AdSeen.query().findOne({ hash });
    if (existing != null) {
      if (new Date(existing.expiresAt!).getTime() > now) {
        return false;
      }
      await AdSeen.query()
        .findById(existing.id!)
        .patch({ expiresAt: new Date(now + ttlMs) });
      return true;
    }
    try {
      await AdSeen.query().insert({ hash, expiresAt: new Date(now + ttlMs) });
      return true;
    } catch {
      // Two requests raced; the other one counted it.
      return false;
    }
  }

  static async sweep(now: number = Date.now()): Promise<number> {
    return await AdSeen.query().where("expiresAt", "<", new Date(now)).delete();
  }
}
