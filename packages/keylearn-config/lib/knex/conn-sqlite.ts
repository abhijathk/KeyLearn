import { type Knex } from "knex";
import sqlite from "knex/lib/dialects/better-sqlite3/index.js";
import { knexSnakeCaseMappers } from "objection";
import { fixTimestamps } from "./util.ts";

export function connectSqlite(
  config: Knex.BetterSqlite3ConnectionConfig,
): Knex.Config {
  return {
    __client: "sqlite",
    client: sqlite,
    connection: { ...config },
    useNullAsDefault: true,
    // SQLite ignores foreign keys (and ON DELETE CASCADE) unless asked per
    // connection — enable it so deleting an account cascades to its profiles.
    pool: {
      afterCreate: (
        conn: { pragma: (sql: string) => void },
        done: (err: Error | null, conn: unknown) => void,
      ) => {
        try {
          conn.pragma("foreign_keys = ON");
          done(null, conn);
        } catch (err) {
          done(err as Error, conn);
        }
      },
    },
    debug: Boolean(process.env.KNEX_DEBUG),
    ...knexSnakeCaseMappers(),
    postProcessResponse: fixTimestamps,
  } as Knex.Config;
}
