import { type Snippet } from "../types.ts";

/**
 * Week 3: window functions, and the interview patterns built on them.
 *
 * The difference from GROUP BY is the whole idea: a window computes across a
 * set of rows and still returns every row. That is what makes "each row next
 * to its group's total" a single query instead of a join to a subquery.
 */
export const sqlWindows: readonly Snippet[] = [
  {
    id: "sql-win-row-number",
    title: "Number the rows within each group",
    level: 3,
    tags: ["query", "window"],
    code: `-- PARTITION BY restarts the numbering per profile; ORDER BY decides
-- which row is 1. Without the ORDER BY the numbering is arbitrary.
SELECT
    profile_id,
    title_id,
    row_number() OVER (PARTITION BY profile_id ORDER BY started_at DESC) AS n
FROM watch_history;`,
  },
  {
    id: "sql-win-rank-dense",
    title: "The three ranking functions, side by side",
    level: 3,
    tags: ["query", "window"],
    code: `-- On a tie: row_number invents an order, rank leaves a gap after the
-- tie, dense_rank does not. Choosing the wrong one is a classic off-by-one.
SELECT
    title_id,
    row_number() OVER (ORDER BY plays DESC) AS row_num,
    rank() OVER (ORDER BY plays DESC) AS rank_with_gaps,
    dense_rank() OVER (ORDER BY plays DESC) AS rank_no_gaps
FROM title_plays;`,
  },
  {
    id: "sql-win-top-n",
    title: "The top N per group",
    level: 4,
    tags: ["query", "window"],
    code: `-- A window function cannot go in a WHERE, because filtering happens
-- before the window is computed. Hence the wrapping subquery.
SELECT
    profile_id,
    title_id,
    started_at
FROM (
    SELECT
        profile_id,
        title_id,
        started_at,
        row_number() OVER (
            PARTITION BY profile_id ORDER BY started_at DESC
        ) AS n
    FROM watch_history
) AS ranked
WHERE n <= 3;`,
  },
  {
    id: "sql-win-dedupe",
    title: "Keep one row per key, the newest",
    level: 4,
    tags: ["query", "window", "quality"],
    code: `-- The current-state pattern: rank by recency, keep the first. It reads
-- more clearly than a correlated max() and runs in one pass.
SELECT
    account_id,
    plan_id,
    start_date
FROM (
    SELECT
        s.*,
        row_number() OVER (
            PARTITION BY account_id ORDER BY start_date DESC
        ) AS n
    FROM subscription AS s
) AS latest
WHERE n = 1;`,
  },
  {
    id: "sql-win-partition-total",
    title: "Every row beside its group's total",
    level: 3,
    tags: ["query", "window"],
    code: `-- A window with no ORDER BY covers the whole partition, so this is the
-- group total repeated on every row — which is exactly what a share needs.
SELECT
    country_id,
    account_id,
    amount,
    sum(amount) OVER (PARTITION BY country_id) AS country_total
FROM payment_by_account;`,
  },
  {
    id: "sql-win-percent",
    title: "Each row's share of its group",
    level: 4,
    tags: ["query", "window"],
    code: `-- The whole point of windows: the numerator and the denominator come
-- from different scopes in one pass, with no self-join.
SELECT
    country_id,
    account_id,
    round(
        100.0 * amount / sum(amount) OVER (PARTITION BY country_id), 2
    ) AS pct_of_country
FROM payment_by_account;`,
  },
  {
    id: "sql-win-running-total",
    title: "A running total",
    level: 4,
    tags: ["query", "window"],
    code: `-- Adding ORDER BY to a window changes its default frame to everything
-- up to the current row, which is what turns a sum into a running sum.
SELECT
    payment_date,
    amount,
    sum(amount) OVER (ORDER BY payment_date) AS running_total
FROM payment
ORDER BY payment_date;`,
  },
  {
    id: "sql-win-moving-average",
    title: "A moving average over a fixed window",
    level: 5,
    tags: ["query", "window"],
    code: `-- ROWS counts rows; RANGE counts values. With a gap in the dates these
-- give different answers, and ROWS is almost always the one intended.
SELECT
    day,
    signups,
    avg(signups) OVER (
        ORDER BY day
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS seven_day_avg
FROM daily_signups
ORDER BY day;`,
  },
  {
    id: "sql-win-lag",
    title: "Compare a row with the one before it",
    level: 4,
    tags: ["query", "window"],
    code: `-- The third argument is the default when there is no previous row, so
-- the first month shows a change of zero rather than a null.
SELECT
    month,
    revenue,
    revenue - lag(revenue, 1, 0) OVER (ORDER BY month) AS change
FROM monthly_revenue
ORDER BY month;`,
  },
  {
    id: "sql-win-lead",
    title: "Look ahead to the next row",
    level: 4,
    tags: ["query", "window"],
    code: `-- Pairing each row with the next is how you measure the gap between
-- events — session length, time to churn, delay between payments.
SELECT
    profile_id,
    started_at,
    lead(started_at) OVER (
        PARTITION BY profile_id ORDER BY started_at
    ) - started_at AS gap_to_next
FROM watch_history;`,
  },
  {
    id: "sql-win-first-value",
    title: "The first value in the window, on every row",
    level: 4,
    tags: ["query", "window"],
    code: `-- The frame has to be widened to the whole partition: with an ORDER BY
-- and the default frame, "last" only ever means "the current row".
SELECT
    profile_id,
    started_at,
    first_value(title_id) OVER (
        PARTITION BY profile_id
        ORDER BY started_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS first_title
FROM watch_history;`,
  },
  {
    id: "sql-win-ntile",
    title: "Split rows into equal buckets",
    level: 4,
    tags: ["query", "window"],
    code: `-- Deciles of spend. NTILE divides by row count, not by value, so the
-- buckets are equal in size and not in range.
SELECT
    account_id,
    lifetime_value,
    ntile(10) OVER (ORDER BY lifetime_value) AS decile
FROM account_value;`,
  },
  {
    id: "sql-win-percentile",
    title: "A true percentile",
    level: 5,
    tags: ["window", "query", "aggregate"],
    code: `-- The median is the 0.5 percentile. Reporting an average alongside it
-- is how you notice a distribution with a long tail.
SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds_watched) AS median,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY seconds_watched) AS p95,
    avg(seconds_watched) AS mean
FROM watch_history;`,
  },
  {
    id: "sql-win-named",
    title: "Name a window and reuse it",
    level: 4,
    tags: ["query", "window", "style"],
    code: `-- One definition, three uses. Repeating the OVER clause is where a
-- typo hides: two of them agree and the third quietly does not.
SELECT
    profile_id,
    started_at,
    row_number() OVER w AS n,
    lag(title_id) OVER w AS previous_title,
    lead(title_id) OVER w AS next_title
FROM watch_history
WINDOW w AS (PARTITION BY profile_id ORDER BY started_at);`,
  },
  {
    id: "sql-win-count-distinct",
    title: "Running distinct counts are not a window",
    level: 5,
    tags: ["query", "window"],
    code: `-- count(DISTINCT ...) is not allowed as a window function. The way
-- round it is to mark each value's first appearance and add those up.
SELECT
    day,
    sum(is_first) OVER (ORDER BY day) AS cumulative_users
FROM (
    SELECT
        date_trunc('day', started_at) AS day,
        CASE
            WHEN row_number() OVER (
                PARTITION BY profile_id ORDER BY started_at
            ) = 1 THEN 1
            ELSE 0
        END AS is_first
    FROM watch_history
) AS marked;`,
  },
  {
    id: "sql-win-gaps-islands",
    title: "Group consecutive events into sessions",
    level: 5,
    tags: ["query", "window"],
    code: `-- Gaps and islands: mark where a new session starts, then take a
-- running sum of those marks as the session id. Worth memorising.
SELECT
    profile_id,
    started_at,
    sum(new_session) OVER (
        PARTITION BY profile_id ORDER BY started_at
    ) AS session_id
FROM (
    SELECT
        profile_id,
        started_at,
        CASE
            WHEN started_at - lag(started_at) OVER (
                PARTITION BY profile_id ORDER BY started_at
            ) > INTERVAL '30 minutes' THEN 1
            ELSE 0
        END AS new_session
    FROM watch_history
) AS marked;`,
  },
  {
    id: "sql-win-monotonic",
    title: "Check that a sequence never goes backwards",
    level: 5,
    tags: ["query", "window", "quality"],
    code: `-- A funnel must not run in reverse and a running total must not fall.
-- Any row this returns is a data bug, not a business result.
SELECT *
FROM (
    SELECT
        day,
        cumulative_users,
        lag(cumulative_users) OVER (ORDER BY day) AS previous
    FROM daily_cumulative
) AS checked
WHERE previous IS NOT NULL AND cumulative_users < previous;`,
  },
];
