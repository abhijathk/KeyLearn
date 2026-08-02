import { type Snippet } from "../types.ts";

/**
 * Week 2: subqueries, EXISTS, CASE and set operations.
 *
 * The week where SQL stops being one flat SELECT. The recurring lesson is
 * about nulls: `NOT IN` against a set containing one is the trap almost
 * everybody falls into once, and the reason `NOT EXISTS` is the safer habit.
 */
export const sqlLogic: readonly Snippet[] = [
  {
    id: "sql-sub-scalar",
    title: "A subquery that returns one value",
    level: 2,
    tags: ["query", "subquery"],
    code: `-- Runs once and yields a single number, so it can sit anywhere a
-- literal could.
SELECT
    title_name,
    release_year
FROM title
WHERE release_year > (SELECT avg(release_year) FROM title);`,
  },
  {
    id: "sql-sub-select-list",
    title: "A subquery in the select list",
    level: 3,
    tags: ["query", "subquery"],
    code: `-- Readable, and fine for a handful of rows. For a large result a LEFT
-- JOIN to a grouped subquery does the same work once instead of per row.
SELECT
    a.account_id,
    (
        SELECT count(*)
        FROM payment AS p
        WHERE p.account_id = a.account_id
    ) AS payments
FROM account AS a;`,
  },
  {
    id: "sql-sub-in",
    title: "Match against a list from another query",
    level: 2,
    tags: ["query", "subquery"],
    code: `-- IN is fine here because the inner query cannot produce a null: the
-- column is the primary key of its own table.
SELECT title_name
FROM title
WHERE title_id IN (
    SELECT title_id
    FROM title_genre
    WHERE genre_id = 7
);`,
  },
  {
    id: "sql-sub-not-in-trap",
    title: "The NOT IN null trap",
    level: 4,
    tags: ["query", "subquery", "null"],
    code: `-- If the inner query returns even one null, NOT IN is never true and
-- this returns nothing at all — silently, with no error. Guard it, or use
-- NOT EXISTS, which has no such behaviour.
SELECT a.account_id
FROM account AS a
WHERE a.country_id NOT IN (
    SELECT c.country_id
    FROM country AS c
    WHERE c.country_id IS NOT NULL
);`,
  },
  {
    id: "sql-sub-not-exists",
    title: "The safe way to ask what is missing",
    level: 3,
    tags: ["query", "subquery"],
    code: `-- NOT EXISTS is null-safe and usually the fastest of the three ways to
-- write an anti-join. Make it the habit and the trap never arises.
SELECT a.account_id
FROM account AS a
WHERE NOT EXISTS (
    SELECT 1
    FROM payment AS p
    WHERE p.account_id = a.account_id
);`,
  },
  {
    id: "sql-sub-exists",
    title: "Ask only whether a row exists",
    level: 2,
    tags: ["query", "subquery"],
    code: `-- EXISTS stops at the first match, so SELECT 1 is idiomatic: nothing
-- reads the columns, only whether a row came back.
SELECT t.title_name
FROM title AS t
WHERE EXISTS (
    SELECT 1
    FROM watch_history AS w
    WHERE w.title_id = t.title_id
);`,
  },
  {
    id: "sql-sub-correlated",
    title: "A subquery that sees the outer row",
    level: 4,
    tags: ["query", "subquery"],
    code: `-- Correlated: it runs once per outer row, which is why it is expressive
-- and why it is slow on a large table. Reach for a window function first.
SELECT
    p.profile_id,
    p.title_id
FROM watch_history AS p
WHERE p.started_at = (
    SELECT max(w.started_at)
    FROM watch_history AS w
    WHERE w.profile_id = p.profile_id
);`,
  },
  {
    id: "sql-case-bucket",
    title: "Sort rows into buckets",
    level: 2,
    tags: ["subquery", "query", "case"],
    code: `-- The ELSE matters: without it, anything the conditions miss becomes
-- null and quietly disappears from a later GROUP BY.
SELECT
    title_name,
    CASE
        WHEN release_year >= 2020 THEN 'recent'
        WHEN release_year >= 2000 THEN 'modern'
        ELSE 'classic'
    END AS era
FROM title;`,
  },
  {
    id: "sql-case-conditional-count",
    title: "Count only the rows that qualify",
    level: 3,
    tags: ["subquery", "query", "case", "aggregate"],
    code: `-- FILTER is the standard spelling and reads far better than a CASE
-- inside count(). MySQL and SQL Server still need the CASE form.
SELECT
    count(*) AS payments,
    count(*) FILTER (WHERE amount > 20) AS large_payments,
    count(*) FILTER (WHERE amount = 0) AS free_months
FROM payment;`,
  },
  {
    id: "sql-case-pivot",
    title: "Turn rows into columns",
    level: 4,
    tags: ["subquery", "query", "case", "aggregate"],
    code: `-- A pivot by hand: one conditional aggregate per column. Verbose, and
-- the only version that works in every dialect.
SELECT
    date_trunc('month', payment_date) AS month,
    sum(amount) FILTER (WHERE currency = 'AUD') AS aud,
    sum(amount) FILTER (WHERE currency = 'USD') AS usd,
    sum(amount) FILTER (WHERE currency = 'GBP') AS gbp
FROM payment
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "sql-case-order",
    title: "Sort by something that is not a column",
    level: 3,
    tags: ["subquery", "query", "case"],
    code: `-- A CASE in the ORDER BY gives an arbitrary order a name, instead of
-- relying on how the values happen to sort alphabetically.
SELECT
    plan_name,
    monthly_price
FROM subscription_plan
ORDER BY CASE plan_name
    WHEN 'Basic' THEN 1
    WHEN 'Standard' THEN 2
    WHEN 'Premium' THEN 3
    ELSE 4
END;`,
  },
  {
    id: "sql-coalesce",
    title: "Substitute a value for null",
    level: 1,
    tags: ["subquery", "query", "null"],
    code: `-- Without this, an account with no payments returns null rather than
-- zero, and every total downstream becomes null too.
SELECT
    a.account_id,
    coalesce(sum(p.amount), 0) AS lifetime_value
FROM account AS a
LEFT JOIN payment AS p ON a.account_id = p.account_id
GROUP BY a.account_id;`,
  },
  {
    id: "sql-nullif",
    title: "Avoid dividing by zero",
    level: 3,
    tags: ["subquery", "query", "null"],
    code: `-- NULLIF turns the zero into a null, and division by null is null
-- rather than an error that stops the whole query.
SELECT
    title_id,
    sum(seconds_watched) / nullif(count(*), 0) AS avg_seconds
FROM watch_history
GROUP BY title_id;`,
  },
  {
    id: "sql-union-all",
    title: "Stack two result sets",
    level: 2,
    tags: ["subquery", "query", "set"],
    code: `-- UNION ALL keeps duplicates and does no sorting. Plain UNION removes
-- duplicates, which costs a sort — only ask for it when you mean it.
SELECT
    account_id,
    'payment' AS event
FROM payment
UNION ALL
SELECT
    account_id,
    'refund' AS event
FROM refund;`,
  },
  {
    id: "sql-except",
    title: "What is in one set and not the other",
    level: 3,
    tags: ["query", "set", "quality"],
    code: `-- The reconciliation query in one line. Run it both ways round: EXCEPT
-- is not symmetric, and each direction finds a different kind of bug.
SELECT title_id FROM staging_title
EXCEPT
SELECT title_id FROM title;`,
  },
  {
    id: "sql-intersect",
    title: "What appears in both",
    level: 3,
    tags: ["subquery", "query", "set"],
    code: `-- Deduplicates by default, so it answers "which ids are in both" and
-- not "how many times".
SELECT title_id FROM watch_history
INTERSECT
SELECT title_id FROM download;`,
  },
  {
    id: "sql-having",
    title: "Filter on an aggregate",
    level: 2,
    tags: ["subquery", "query", "aggregate"],
    code: `-- WHERE filters rows before grouping; HAVING filters groups after. Put
-- a row condition in HAVING and the query does far more work than it needs.
SELECT
    profile_id,
    count(*) AS watches
FROM watch_history
WHERE started_at >= DATE '2026-01-01'
GROUP BY profile_id
HAVING count(*) > 50;`,
  },
  {
    id: "sql-distinct-on",
    title: "One row per group, chosen by an order",
    level: 4,
    tags: ["subquery", "query", "postgres"],
    code: `-- Postgres-only, and the shortest way to say "the latest per profile".
-- The ORDER BY must lead with the DISTINCT ON columns.
SELECT DISTINCT ON (profile_id)
    profile_id,
    title_id,
    started_at
FROM watch_history
ORDER BY profile_id, started_at DESC;`,
  },
];
