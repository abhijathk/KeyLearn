import { type Snippet } from "../types.ts";

/**
 * Week 1 of the plan: joins, and the integrity checks they make possible.
 *
 * The QA half and the reporting half of the same skill. An inner join answers
 * "what matches"; a left join with a null test answers "what is missing", and
 * that second question is the one that finds bugs. Both are here in the order
 * the plan introduces them.
 */
export const sqlJoins: readonly Snippet[] = [
  {
    id: "sql-join-inner",
    title: "Join two tables on a key",
    level: 1,
    tags: ["query", "join"],
    code: `-- An inner join answers "what matches". Rows with no partner on either
-- side simply vanish, which is exactly what hides a data problem.
SELECT
    t.title_name,
    g.genre_name
FROM title AS t
INNER JOIN title_genre AS tg ON t.title_id = tg.title_id
INNER JOIN genre AS g ON tg.genre_id = g.genre_id;`,
  },
  {
    id: "sql-join-alias",
    title: "Alias every table and qualify every column",
    level: 1,
    tags: ["query", "join", "style"],
    code: `-- Qualifying columns costs a few characters and saves the afternoon a
-- new column with the same name is added to the other table.
SELECT
    a.account_id,
    a.email,
    c.country_name
FROM account AS a
INNER JOIN country AS c ON a.country_id = c.country_id;`,
  },
  {
    id: "sql-join-left",
    title: "Keep rows that have no match",
    level: 1,
    tags: ["query", "join"],
    code: `-- The QA workhorse. Every account appears, whether or not it has ever
-- paid, and the missing ones come back as nulls rather than disappearing.
SELECT
    a.account_id,
    p.payment_date
FROM account AS a
LEFT JOIN payment AS p ON a.account_id = p.account_id;`,
  },
  {
    id: "sql-join-antijoin",
    title: "Find the rows with no match at all",
    level: 2,
    tags: ["query", "join", "quality"],
    code: `-- Left join plus IS NULL is the anti-join: accounts that have never paid.
-- The filter must be in the WHERE, not the ON — see the next snippet.
SELECT a.account_id
FROM account AS a
LEFT JOIN payment AS p ON a.account_id = p.account_id
WHERE p.payment_id IS NULL;`,
  },
  {
    id: "sql-join-on-vs-where",
    title: "Filter in ON, not WHERE, on the outer side",
    level: 3,
    tags: ["query", "join"],
    code: `-- A condition on the outer table in the WHERE turns a LEFT JOIN back
-- into an INNER one: unmatched rows have a null there and fail the test.
-- In the ON, it restricts what may match and keeps every left-hand row.
SELECT
    a.account_id,
    p.amount
FROM account AS a
LEFT JOIN payment AS p
    ON
        a.account_id = p.account_id
        AND p.payment_date >= DATE '2026-01-01';`,
  },
  {
    id: "sql-join-orphans",
    title: "Look for orphaned rows",
    level: 2,
    tags: ["query", "join", "quality"],
    code: `-- A foreign key would make this impossible. Where the constraint is
-- missing, this is how you learn it should not have been.
SELECT w.watch_id
FROM watch_history AS w
LEFT JOIN profile AS p ON w.profile_id = p.profile_id
WHERE p.profile_id IS NULL;`,
  },
  {
    id: "sql-join-multi",
    title: "Build a report across several tables",
    level: 2,
    tags: ["query", "join"],
    code: `-- Read the join chain as a sentence: a watch belongs to a profile, which
-- belongs to an account, which sits in a country.
SELECT
    c.country_name,
    t.title_name,
    w.started_at
FROM watch_history AS w
INNER JOIN profile AS p ON w.profile_id = p.profile_id
INNER JOIN account AS a ON p.account_id = a.account_id
INNER JOIN country AS c ON a.country_id = c.country_id
INNER JOIN title AS t ON w.title_id = t.title_id;`,
  },
  {
    id: "sql-join-self",
    title: "Join a table to itself",
    level: 3,
    tags: ["query", "join"],
    code: `-- Two aliases for one table. The inequality stops each pair appearing
-- twice and stops every row matching itself.
SELECT
    a.title_name AS earlier,
    b.title_name AS later
FROM title AS a
INNER JOIN title AS b
    ON
        a.release_year = b.release_year
        AND a.title_id < b.title_id;`,
  },
  {
    id: "sql-join-duplicates",
    title: "Find duplicates on a key that should be unique",
    level: 2,
    tags: ["query", "quality", "duplicates"],
    code: `-- The first query to run against any table you have been handed. If
-- this returns rows, every count downstream of it is wrong.
SELECT
    email,
    count(*) AS copies
FROM account
GROUP BY email
HAVING count(*) > 1;`,
  },
  {
    id: "sql-join-fanout",
    title: "Notice when a join multiplies your rows",
    level: 4,
    tags: ["query", "join", "quality"],
    code: `-- Joining to a one-to-many table before aggregating counts the parent
-- once per child. If these two disagree, the sum above is inflated.
SELECT
    count(*) AS joined_rows,
    count(DISTINCT t.title_id) AS distinct_titles
FROM title AS t
INNER JOIN title_genre AS tg ON t.title_id = tg.title_id;`,
  },
  {
    id: "sql-join-aggregate-safe",
    title: "Aggregate before joining to avoid the fan-out",
    level: 4,
    tags: ["query", "join"],
    code: `-- Collapse the many side first, then join one row to one row. The sum
-- is then correct however many payments an account has.
SELECT
    a.account_id,
    coalesce(p.total, 0) AS lifetime_value
FROM account AS a
LEFT JOIN (
    SELECT
        account_id,
        sum(amount) AS total
    FROM payment
    GROUP BY account_id
) AS p ON a.account_id = p.account_id;`,
  },
  {
    id: "sql-join-full",
    title: "Keep the unmatched rows from both sides",
    level: 3,
    tags: ["query", "join", "quality"],
    code: `-- The reconciliation join: one query showing what is in the source and
-- not the target, and the reverse, without running two.
SELECT
    s.title_id AS source_id,
    t.title_id AS target_id
FROM staging_title AS s
FULL OUTER JOIN title AS t ON s.title_id = t.title_id
WHERE s.title_id IS NULL OR t.title_id IS NULL;`,
  },
  {
    id: "sql-join-cross",
    title: "Every combination, on purpose",
    level: 3,
    tags: ["query", "join"],
    code: `-- Deliberate here: a row per country per month, so a report can show a
-- zero rather than skipping the month entirely.
SELECT
    c.country_name,
    m.month
FROM country AS c
CROSS JOIN generate_series(
    DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month'
) AS m (month);`,
  },
  {
    id: "sql-join-lateral",
    title: "Take the top row per group with a lateral join",
    level: 5,
    tags: ["query", "join"],
    code: `-- LATERAL lets the subquery see the outer row, so this runs once per
-- profile and stops at one — far cheaper than ranking the whole table.
SELECT
    p.profile_id,
    recent.title_id,
    recent.started_at
FROM profile AS p
CROSS JOIN LATERAL (
    SELECT
        w.title_id,
        w.started_at
    FROM watch_history AS w
    WHERE w.profile_id = p.profile_id
    ORDER BY w.started_at DESC
    LIMIT 1
) AS recent;`,
  },
  {
    id: "sql-join-using",
    title: "Join on a shared column name",
    level: 2,
    tags: ["query", "join"],
    code: `-- USING is shorter and returns one merged column instead of two. It
-- only works when both sides spell the key the same way.
SELECT
    title_id,
    title_name,
    genre_id
FROM title
INNER JOIN title_genre USING (title_id);`,
  },
  {
    id: "sql-join-null-key",
    title: "Remember that nulls never join",
    level: 3,
    tags: ["query", "join", "null"],
    code: `-- A null key matches nothing, not even another null, so rows with a
-- missing country silently leave any inner join. Count them deliberately.
SELECT count(*) AS accounts_without_country
FROM account
WHERE country_id IS NULL;`,
  },
];
