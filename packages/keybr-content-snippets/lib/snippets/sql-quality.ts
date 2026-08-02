import { type Snippet } from "../types.ts";

/**
 * Months 2 and 3: the QA half — profiling, validity, consistency, temporal
 * rules, reconciliation and anomaly detection.
 *
 * These are the queries that find bugs rather than answer questions, and the
 * habit they build is worth more than any single one of them: before trusting
 * a table, ask it what is wrong with itself. Every query here should return
 * nothing on healthy data, which makes each one usable as a test.
 */
export const sqlQuality: readonly Snippet[] = [
  {
    id: "sql-q-profile",
    title: "Profile a table in one query",
    level: 3,
    tags: ["quality", "profiling"],
    code: `-- The first thing to run against a table you have been handed: size,
-- distinctness, range and how much of it is missing.
SELECT
    count(*) AS rows,
    count(DISTINCT account_id) AS distinct_accounts,
    min(payment_date) AS earliest,
    max(payment_date) AS latest,
    count(*) FILTER (WHERE amount IS NULL) AS null_amounts
FROM payment;`,
  },
  {
    id: "sql-q-null-ratio",
    title: "How much of each column is missing",
    level: 3,
    tags: ["quality", "profiling"],
    code: `-- A column that is 100% null is dead; one that is 3% null is a rule
-- somebody is not enforcing. Both are worth knowing before you report on it.
SELECT
    round(100.0 * count(*) FILTER (WHERE country_id IS NULL) / count(*), 2)
        AS pct_no_country,
    round(100.0 * count(*) FILTER (WHERE email IS NULL) / count(*), 2)
        AS pct_no_email
FROM account;`,
  },
  {
    id: "sql-q-blank-vs-null",
    title: "Find blanks masquerading as values",
    level: 3,
    tags: ["quality", "validity"],
    code: `-- An empty string is not null, so it passes NOT NULL and every
-- completeness check, while being just as useless.
SELECT count(*) AS blank_names
FROM title
WHERE title_name IS NULL OR btrim(title_name) = '';`,
  },
  {
    id: "sql-q-duplicates",
    title: "Duplicates on a key that should be unique",
    level: 2,
    tags: ["quality", "duplicates"],
    code: `-- If this returns rows, every count built on this table is wrong, and
-- fixing the report before fixing the data only hides it.
SELECT
    account_id,
    title_id,
    count(*) AS copies
FROM rating
GROUP BY account_id, title_id
HAVING count(*) > 1;`,
  },
  {
    id: "sql-q-case-duplicates",
    title: "Duplicates that differ only in case or spacing",
    level: 4,
    tags: ["quality", "duplicates"],
    code: `-- 'Ada@Example.com ' and 'ada@example.com' are two rows and one person.
-- Normalising before grouping is what finds them.
SELECT
    lower(btrim(email)) AS normalised,
    count(*) AS copies
FROM account
GROUP BY 1
HAVING count(*) > 1;`,
  },
  {
    id: "sql-q-referential",
    title: "Referential integrity without a foreign key",
    level: 3,
    tags: ["quality", "integrity"],
    code: `-- What a foreign key would have prevented. Run it once per relation
-- that has no constraint behind it.
SELECT count(*) AS orphaned_watches
FROM watch_history AS w
LEFT JOIN title AS t ON w.title_id = t.title_id
WHERE t.title_id IS NULL;`,
  },
  {
    id: "sql-q-range",
    title: "Values outside their allowed range",
    level: 2,
    tags: ["quality", "validity"],
    code: `-- Boundaries first: a rating of 0 or 6 is a bug the application let
-- through, and it is usually an off-by-one somewhere upstream.
SELECT count(*) AS out_of_range
FROM rating
WHERE score < 1 OR score > 5;`,
  },
  {
    id: "sql-q-negative",
    title: "Signs that should not occur",
    level: 2,
    tags: ["quality", "validity"],
    code: `-- A negative duration or a negative payment is either a refund stored
-- in the wrong table or a bug. Either way it should not be silent.
SELECT count(*) AS impossible_rows
FROM watch_history
WHERE seconds_watched < 0;`,
  },
  {
    id: "sql-q-format",
    title: "Values that do not match their format",
    level: 3,
    tags: ["quality", "validity"],
    code: `-- Deliberately loose: a strict email pattern rejects addresses that are
-- perfectly valid, and a check that cries wolf gets switched off.
SELECT count(*) AS malformed_emails
FROM account
WHERE email !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$';`,
  },
  {
    id: "sql-q-cross-field",
    title: "Fields that disagree with each other",
    level: 3,
    tags: ["quality", "consistency"],
    code: `-- Each column is individually valid; together they are impossible. This
-- is the class of bug no single-column check will ever find.
SELECT subscription_id
FROM subscription
WHERE end_date IS NOT NULL AND end_date < start_date;`,
  },
  {
    id: "sql-q-future-dates",
    title: "Dates that have not happened yet",
    level: 2,
    tags: ["quality", "temporal"],
    code: `-- Almost always a timezone bug or a clock that is wrong, and it shows
-- up first as a report that counts tomorrow's revenue today.
SELECT count(*) AS future_payments
FROM payment
WHERE payment_date > current_date;`,
  },
  {
    id: "sql-q-overlaps",
    title: "Periods that overlap when they must not",
    level: 5,
    tags: ["quality", "temporal"],
    code: `-- Two live subscriptions on one account means somebody is being billed
-- twice. The comparison is the standard overlap test: each starts before
-- the other ends.
SELECT
    a.subscription_id,
    b.subscription_id AS overlaps_with
FROM subscription AS a
INNER JOIN subscription AS b
    ON
        a.account_id = b.account_id
        AND a.subscription_id < b.subscription_id
        AND a.start_date <= coalesce(b.end_date, DATE '9999-12-31')
        AND b.start_date <= coalesce(a.end_date, DATE '9999-12-31');`,
  },
  {
    id: "sql-q-gaps",
    title: "Gaps in a sequence that should be continuous",
    level: 5,
    tags: ["quality", "temporal", "window"],
    code: `-- A missing month in a billing history is either a free period nobody
-- recorded or revenue nobody collected.
SELECT
    account_id,
    month,
    lag(month) OVER (PARTITION BY account_id ORDER BY month) AS previous
FROM monthly_billing
WHERE month - lag(month) OVER (
    PARTITION BY account_id ORDER BY month
) > INTERVAL '1 month';`,
  },
  {
    id: "sql-q-freshness",
    title: "Whether the data is still arriving",
    level: 3,
    tags: ["quality", "temporal"],
    code: `-- The check that catches a broken pipeline. A table full of correct
-- rows that stopped updating on Tuesday passes every other test here.
SELECT
    max(started_at) AS latest_row,
    now() - max(started_at) AS staleness
FROM watch_history
HAVING now() - max(started_at) > INTERVAL '6 hours';`,
  },
  {
    id: "sql-q-control-total",
    title: "Compare a total against its source",
    level: 4,
    tags: ["quality", "reconciliation"],
    code: `-- The reconciliation that matters: not that both tables have rows, but
-- that they add up to the same number.
SELECT
    (SELECT sum(amount) FROM payment) AS source_total,
    (SELECT sum(amount) FROM payment_summary) AS summary_total,
    (SELECT sum(amount) FROM payment)
    - (SELECT sum(amount) FROM payment_summary) AS difference;`,
  },
  {
    id: "sql-q-row-counts",
    title: "Row counts either side of a load",
    level: 3,
    tags: ["quality", "reconciliation"],
    code: `-- Cheap, and the first thing to check when a report looks light. Equal
-- counts prove nothing about content, but unequal counts prove a problem.
SELECT
    (SELECT count(*) FROM staging_title) AS staged,
    (SELECT count(*) FROM title) AS loaded,
    (SELECT count(*) FROM staging_title)
    - (SELECT count(*) FROM title) AS not_loaded;`,
  },
  {
    id: "sql-q-both-directions",
    title: "Reconcile both ways at once",
    level: 4,
    tags: ["quality", "reconciliation", "set"],
    code: `-- EXCEPT is not symmetric, so one direction alone finds half the
-- problem. Labelling each side says which half without running it twice.
SELECT
    'missing from target' AS side,
    title_id
FROM (
    SELECT title_id FROM staging_title
    EXCEPT
    SELECT title_id FROM title
) AS a
UNION ALL
SELECT
    'unexpected in target' AS side,
    title_id
FROM
    (
        SELECT title_id FROM title
        EXCEPT
        SELECT title_id FROM staging_title
    ) AS b;`,
  },
  {
    id: "sql-q-idempotency",
    title: "Whether a load can safely be re-run",
    level: 4,
    tags: ["quality", "pipeline"],
    code: `-- A pipeline that doubles its rows on a second run is one retry away
-- from a wrong report, and the retry always happens eventually.
SELECT
    load_date,
    count(*) AS rows,
    count(DISTINCT natural_key) AS distinct_keys
FROM fact_watch
GROUP BY load_date
HAVING count(*) <> count(DISTINCT natural_key);`,
  },
  {
    id: "sql-q-outliers",
    title: "Values far from the middle",
    level: 5,
    tags: ["quality", "anomaly"],
    code: `-- Median and interquartile range rather than mean and deviation: the
-- outlier you are hunting for is exactly what drags a mean off course.
WITH bounds AS (
    SELECT
        percentile_cont(0.25) WITHIN GROUP (ORDER BY amount) AS q1,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY amount) AS q3
    FROM payment
)

SELECT p.*
FROM payment AS p
CROSS JOIN bounds AS b
WHERE
    p.amount < b.q1 - 1.5 * (b.q3 - b.q1)
    OR p.amount > b.q3 + 1.5 * (b.q3 - b.q1);`,
  },
  {
    id: "sql-q-daily-drift",
    title: "A day that looks nothing like the days before it",
    level: 5,
    tags: ["quality", "anomaly", "window"],
    code: `-- Comparing each day against its own recent average catches a pipeline
-- that half-failed — the kind that still delivers rows, just fewer.
SELECT
    day,
    rows_loaded,
    avg_7d
FROM (
    SELECT
        day,
        rows_loaded,
        avg(rows_loaded) OVER (
            ORDER BY day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING
        ) AS avg_7d
    FROM daily_load
) AS compared
WHERE avg_7d IS NOT NULL AND rows_loaded < avg_7d * 0.5;`,
  },
  {
    id: "sql-q-distribution-shift",
    title: "A category whose share moved",
    level: 5,
    tags: ["quality", "anomaly"],
    code: `-- Totals can hold steady while the mix underneath changes completely,
-- which is how a broken category hides inside a healthy-looking number.
SELECT
    genre_id,
    round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct_this_month
FROM watch_history AS w
INNER JOIN title_genre AS tg ON w.title_id = tg.title_id
WHERE w.started_at >= date_trunc('month', current_date)
GROUP BY genre_id
ORDER BY pct_this_month DESC;`,
  },
  {
    id: "sql-q-explain",
    title: "Find out what the query actually did",
    level: 4,
    tags: ["quality", "performance"],
    code: `-- ANALYZE runs it and reports the real numbers. A planner estimate that
-- is orders out from the actual row count is the usual reason for a scan.
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    p.account_id,
    sum(p.amount)
FROM payment AS p
WHERE p.payment_date >= current_date - INTERVAL '30 days'
GROUP BY p.account_id;`,
  },
];
