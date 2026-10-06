/**
 * Raw query rows, keyed as the table spells its columns.
 *
 * A raw `knex(table)` result is not the same shape everywhere. The MySQL
 * connection maps result keys to camelCase (`knexSnakeCaseMappers` in
 * `conn-mysql.ts`); the SQLite one does not, because its own
 * `postProcessResponse` replaces the mapper's. So code that read
 * `row.user_id` worked in every test and on every laptop, and read
 * `undefined` in production — the desk's country list, its quiet-account
 * list, its deletion states and Tab's reopen rate were all wrong on day one
 * (release, 7 Oct 2026). Rows read through here have snake_case keys
 * whichever database answered.
 */
export function snakeKeys<T>(rows: readonly object[]): T[] {
  return rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
          value,
        ]),
      ) as T,
  );
}
