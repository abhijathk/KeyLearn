import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";

/**
 * Where visitors and new accounts came from, one day at a time.
 *
 * One row per source, medium and campaign per day, holding two counters.
 * Like {@link AdStat} there is no row per visitor and no identifier of any
 * kind: the desk can say "forty visits and three accounts came from the
 * parents' Facebook group on Tuesday" and can never say who.
 *
 * Deduplication of visits is a rolling hash in `AdSeen`, gone within a day.
 */
export class VisitStat extends Model {
  static override readonly tableName = "visit_stat";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["day", "source", "medium", "campaign"],
    properties: {
      id: { type: "integer" },
      /** UTC date as YYYY-MM-DD. */
      day: { type: "string", minLength: 10, maxLength: 10 },
      source: { type: "string", minLength: 1, maxLength: 64 },
      medium: { type: "string", minLength: 1, maxLength: 32 },
      campaign: { type: "string", minLength: 1, maxLength: 64 },
      visits: { type: "integer" },
      signups: { type: "integer" },
    },
  } satisfies JSONSchema;

  /**
   * The most distinct sources one day may hold. Campaign names arrive in
   * links anyone can write, so without a ceiling a script could fill the
   * table with junk; past it, a day's new sources count as "(other)".
   */
  static readonly maxRowsPerDay = 300;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.string("day", 10).notNullable();
    table.string("source", 64).notNullable();
    table.string("medium", 32).notNullable();
    table.string("campaign", 64).notNullable();
    table.integer("visits").unsigned().notNullable().defaultTo(0);
    table.integer("signups").unsigned().notNullable().defaultTo(0);
    // Named explicitly: knex's generated name would pass MySQL's 64-character
    // limit today, but only just.
    table.unique(["day", "source", "medium", "campaign"], {
      indexName: "visit_stat_day_source_uq",
    });
    table.index(["day"], "visit_stat_day_ix");
  }

  readonly id?: number;
  day?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  visits?: number;
  signups?: number;

  /** Adds one to a counter, creating the day's row the first time. */
  static async bump(
    origin: VisitOrigin,
    column: "visits" | "signups",
    when: Date = new Date(),
  ): Promise<void> {
    const day = when.toISOString().slice(0, 10);
    let key = { day, ...origin };
    let existing = await VisitStat.query().findOne(key);
    if (existing == null) {
      const [{ count }] = (await VisitStat.query()
        .where("day", day)
        .count("id as count")) as unknown as [{ count: number | string }];
      if (Number(count) >= VisitStat.maxRowsPerDay) {
        key = {
          day,
          source: "(other)",
          medium: "(other)",
          campaign: "(other)",
        };
        existing = await VisitStat.query().findOne(key);
      }
    }
    if (existing == null) {
      try {
        await VisitStat.query().insert({
          ...key,
          visits: column === "visits" ? 1 : 0,
          signups: column === "signups" ? 1 : 0,
        });
        return;
      } catch {
        // Another request created the row first; count on it instead.
        existing = await VisitStat.query().findOne(key);
        if (existing == null) {
          return;
        }
      }
    }
    await VisitStat.query().findById(existing.id!).increment(column, 1);
  }

  /** Every row between two days, inclusive. */
  static async between(
    fromDay: string,
    toDay: string,
  ): Promise<readonly VisitStatRow[]> {
    const rows = await VisitStat.query()
      .where("day", ">=", fromDay)
      .where("day", "<=", toDay);
    return rows.map((row) => ({
      day: row.day!,
      source: row.source!,
      medium: row.medium!,
      campaign: row.campaign!,
      visits: row.visits ?? 0,
      signups: row.signups ?? 0,
    }));
  }

  /** Rows older than the window are not kept. */
  static async deleteBefore(day: string): Promise<number> {
    return await VisitStat.query().where("day", "<", day).delete();
  }
}

export type VisitOrigin = {
  readonly source: string;
  readonly medium: string;
  readonly campaign: string;
};

export type VisitStatRow = VisitOrigin & {
  readonly day: string;
  readonly visits: number;
  readonly signups: number;
};
