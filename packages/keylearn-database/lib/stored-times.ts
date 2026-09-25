import { type Knex } from "knex";
import { Model } from "objection";

/**
 * Rewrites SQLite timestamps stored as text into the epoch milliseconds every
 * other row holds.
 *
 * On SQLite a `datetime` column is whatever was written. The app writes
 * `Date`s, which knex binds as epoch milliseconds — but a row that took the
 * column's `CURRENT_TIMESTAMP` default instead got the text
 * "2026-08-21 07:23:33" (UTC), and a few older writers left ISO strings, one
 * of them JSON-quoted. Mixed in one column this breaks three things: SQLite
 * sorts every TEXT after every INTEGER, so "newest first" puts the oldest
 * rows on top; a comparison against a bound `Date` is TEXT-vs-INTEGER and so
 * always the same answer, whatever the time; and `new Date(text)` reads the
 * default's zone-less text as server-local time, which made a new support
 * ticket look ten hours old.
 *
 * Idempotent and cheap after the first run: it touches only `datetime`
 * columns, only rows whose value is still TEXT, and only values SQLite can
 * parse as a date — anything else is counted and left exactly as it was.
 * MySQL has real datetime columns and nothing to do.
 */
export async function normalizeStoredTimes(
  knex: Knex = Model.knex(),
): Promise<{ readonly fixed: number; readonly unparsed: number }> {
  if (!isSqlite(knex)) {
    return { fixed: 0, unparsed: 0 };
  }
  let fixed = 0;
  let unparsed = 0;
  const tables = (await knex.raw(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
  )) as { name: string }[];
  for (const { name: table } of tables) {
    const columns = (await knex.raw(`pragma table_info(${quote(table)})`)) as {
      name: string;
      type: string;
    }[];
    for (const { name: column, type } of columns) {
      if (!/^(datetime|timestamp)$/i.test(type)) {
        continue;
      }
      const t = quote(table);
      const c = quote(column);
      // julianday() understands the default's "YYYY-MM-DD HH:MM:SS" (UTC)
      // and ISO strings with a T and a Z; trim() drops stray JSON quotes.
      const value = `trim(${c}, '"')`;
      const changed = (await knex.raw(
        `update ${t} set ${c} = cast(round((julianday(${value}) - 2440587.5) * 86400000) as integer) ` +
          `where typeof(${c}) = 'text' and julianday(${value}) is not null`,
      )) as unknown;
      fixed += changes(changed);
      const [{ n }] = (await knex.raw(
        `select count(*) as n from ${t} where typeof(${c}) = 'text'`,
      )) as { n: number }[];
      unparsed += Number(n);
    }
  }
  return { fixed, unparsed };
}

function isSqlite(knex: Knex): boolean {
  return /sqlite/i.test(String(knex.client.dialect ?? ""));
}

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/** Rows changed by an update, however the driver reports it. */
function changes(result: unknown): number {
  const r = result as { changes?: number } | number | undefined;
  if (typeof r === "number") {
    return r;
  }
  return Number(r?.changes ?? 0);
}
