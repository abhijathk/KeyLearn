import { type Snippet } from "../types.ts";

/**
 * Week 4 and the analyst headliners: CTEs, recursion, cohorts, retention,
 * revenue and funnels.
 *
 * The queries an analyst is actually asked for, and the ones an interview
 * asks about. Each is written as a chain of named steps rather than a single
 * nested expression — the point of a CTE is that somebody can read it in six
 * months, which for this kind of query is the whole job.
 */
export const sqlAnalytics: readonly Snippet[] = [
  {
    id: "sql-cte-basic",
    title: "Name a step instead of nesting it",
    level: 3,
    tags: ["query", "cte"],
    code: `-- The same query as a subquery, read top to bottom instead of inside
-- out. That is the entire argument for a CTE, and it is enough.
WITH recent_payments AS (
    SELECT
        account_id,
        sum(amount) AS total
    FROM payment
    WHERE payment_date >= current_date - INTERVAL '90 days'
    GROUP BY account_id
)

SELECT
    a.email,
    r.total
FROM account AS a
INNER JOIN recent_payments AS r ON a.account_id = r.account_id;`,
  },
  {
    id: "sql-cte-chain",
    title: "Chain several steps",
    level: 4,
    tags: ["query", "cte"],
    code: `-- Each step is testable on its own: comment out the rest and select
-- from any one of them to see what it produced.
WITH active AS (
    SELECT account_id
    FROM subscription
    WHERE end_date IS NULL
),

spend AS (
    SELECT
        account_id,
        sum(amount) AS total
    FROM payment
    GROUP BY account_id
)

SELECT
    a.account_id,
    coalesce(s.total, 0) AS total
FROM active AS a
LEFT JOIN spend AS s ON a.account_id = s.account_id;`,
  },
  {
    id: "sql-cte-recursive-dates",
    title: "Build a date spine",
    level: 5,
    tags: ["query", "cte", "recursive"],
    code: `-- A row per month whether or not anything happened in it, so a report
-- shows a zero rather than skipping the month and hiding the outage.
WITH RECURSIVE months AS (
    SELECT DATE '2026-01-01' AS month
    UNION ALL
    SELECT month + INTERVAL '1 month'
    FROM months
    WHERE month < DATE '2026-12-01'
)

SELECT month FROM months;`,
  },
  {
    id: "sql-cte-recursive-tree",
    title: "Walk a hierarchy",
    level: 5,
    tags: ["query", "cte", "recursive"],
    code: `-- The anchor selects the roots; the recursive half joins back to what
-- it has already found. Without the depth guard a cycle runs forever.
WITH RECURSIVE tree AS (
    SELECT
        genre_id,
        parent_id,
        1 AS depth
    FROM genre
    WHERE parent_id IS NULL
    UNION ALL
    SELECT
        g.genre_id,
        g.parent_id,
        t.depth + 1
    FROM genre AS g
    INNER JOIN tree AS t ON g.parent_id = t.genre_id
    WHERE t.depth < 10
)

SELECT * FROM tree;`,
  },
  {
    id: "sql-analytics-mau",
    title: "Monthly active users",
    level: 3,
    tags: ["query", "analytics"],
    code: `-- DISTINCT is doing the work: one person watching thirty times is one
-- active user, and forgetting that is the most common way to overstate it.
SELECT
    date_trunc('month', started_at) AS month,
    count(DISTINCT profile_id) AS active_profiles
FROM watch_history
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "sql-analytics-new-vs-returning",
    title: "Split new users from returning ones",
    level: 4,
    tags: ["query", "analytics"],
    code: `-- Comparing each visit against the account's first tells you which half
-- of a growth number is acquisition and which half is retention.
WITH first_seen AS (
    SELECT
        profile_id,
        min(date_trunc('month', started_at)) AS cohort
    FROM watch_history
    GROUP BY profile_id
)

SELECT
    date_trunc('month', w.started_at) AS month,
    count(DISTINCT w.profile_id) FILTER (
        WHERE date_trunc('month', w.started_at) = f.cohort
    ) AS new_profiles,
    count(DISTINCT w.profile_id) FILTER (
        WHERE date_trunc('month', w.started_at) > f.cohort
    ) AS returning_profiles
FROM watch_history AS w
INNER JOIN first_seen AS f ON w.profile_id = f.profile_id
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "sql-analytics-cohort",
    title: "Cohort retention",
    level: 5,
    tags: ["query", "analytics", "cohort"],
    code: `-- Group people by when they arrived, then count how many came back in
-- each later month. The month offset is what makes cohorts comparable.
WITH cohorts AS (
    SELECT
        profile_id,
        date_trunc('month', min(started_at)) AS cohort_month
    FROM watch_history
    GROUP BY profile_id
),

activity AS (
    SELECT DISTINCT
        w.profile_id,
        date_trunc('month', w.started_at) AS active_month
    FROM watch_history AS w
)

SELECT
    c.cohort_month,
    (
        extract(YEAR FROM age(a.active_month, c.cohort_month)) * 12
        + extract(MONTH FROM age(a.active_month, c.cohort_month))
    ) AS months_since,
    count(DISTINCT a.profile_id) AS retained
FROM cohorts AS c
INNER JOIN activity AS a ON c.profile_id = a.profile_id
GROUP BY 1, 2
ORDER BY 1, 2;`,
  },
  {
    id: "sql-analytics-churn",
    title: "Churn in a month",
    level: 4,
    tags: ["query", "analytics"],
    code: `-- Churn is a rate, not a count: the same twenty cancellations mean
-- something different against a hundred subscribers than a thousand.
SELECT
    date_trunc('month', end_date) AS month,
    count(*) AS cancelled,
    round(
        100.0 * count(*) / nullif(
            (
                SELECT count(*) FROM subscription
                WHERE end_date IS NULL
            ), 0
        ), 2
    ) AS churn_pct
FROM subscription
WHERE end_date IS NOT NULL
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "sql-analytics-mrr",
    title: "Monthly recurring revenue",
    level: 4,
    tags: ["query", "analytics", "revenue"],
    code: `-- Only subscriptions live during the month count, which is why the
-- join spans the period rather than testing a single date.
SELECT
    m.month,
    sum(p.monthly_price) AS mrr
FROM
    generate_series(
        DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month'
    ) AS m (month)
INNER JOIN subscription AS s
    ON
        s.start_date <= m.month
        AND (s.end_date IS NULL OR s.end_date > m.month)
INNER JOIN subscription_plan AS p ON s.plan_id = p.plan_id
GROUP BY m.month
ORDER BY m.month;`,
  },
  {
    id: "sql-analytics-arpa",
    title: "Average revenue per account",
    level: 3,
    tags: ["query", "analytics", "revenue"],
    code: `-- Dividing total revenue by paying accounts, not by all accounts. Which
-- denominator you chose is the first question anyone will ask.
SELECT
    date_trunc('month', payment_date) AS month,
    round(sum(amount) / nullif(count(DISTINCT account_id), 0), 2) AS arpa
FROM payment
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "sql-analytics-funnel",
    title: "A conversion funnel",
    level: 5,
    tags: ["query", "analytics", "funnel"],
    code: `-- Each step counts people who reached at least that far, so the numbers
-- can only fall. A step that rises is a bug in the query, not a result.
WITH steps AS (
    SELECT
        account_id,
        max(CASE WHEN event = 'signup' THEN 1 ELSE 0 END) AS signed_up,
        max(CASE WHEN event = 'trial' THEN 1 ELSE 0 END) AS trialled,
        max(CASE WHEN event = 'paid' THEN 1 ELSE 0 END) AS paid
    FROM account_event
    GROUP BY account_id
)

SELECT
    sum(signed_up) AS signed_up,
    sum(trialled) AS trialled,
    sum(paid) AS paid,
    round(100.0 * sum(paid) / nullif(sum(signed_up), 0), 2) AS signup_to_paid
FROM steps;`,
  },
  {
    id: "sql-analytics-segments",
    title: "Segment accounts by engagement",
    level: 4,
    tags: ["query", "analytics", "case"],
    code: `-- Bands rather than a raw number: "twelve hours" means nothing until
-- somebody says which band it falls in.
WITH usage AS (
    SELECT
        p.account_id,
        sum(w.seconds_watched) / 3600.0 AS hours
    FROM watch_history AS w
    INNER JOIN profile AS p ON w.profile_id = p.profile_id
    WHERE w.started_at >= current_date - INTERVAL '30 days'
    GROUP BY p.account_id
)

SELECT
    CASE
        WHEN hours >= 40 THEN 'heavy'
        WHEN hours >= 10 THEN 'regular'
        WHEN hours > 0 THEN 'light'
        ELSE 'dormant'
    END AS segment,
    count(*) AS accounts
FROM usage
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "sql-analytics-mom-growth",
    title: "Month-on-month growth",
    level: 4,
    tags: ["query", "analytics", "window"],
    code: `-- NULLIF guards the first month, where the previous value is null and
-- the division would otherwise take the whole column with it.
SELECT
    month,
    revenue,
    round(
        100.0 * (revenue - lag(revenue) OVER (ORDER BY month))
        / nullif(lag(revenue) OVER (ORDER BY month), 0), 2
    ) AS growth_pct
FROM monthly_revenue
ORDER BY month;`,
  },
  {
    id: "sql-analytics-ltv",
    title: "Lifetime value with a floor of zero",
    level: 3,
    tags: ["query", "analytics", "revenue"],
    code: `-- The LEFT JOIN keeps accounts that never paid, and the COALESCE makes
-- them zero rather than null — otherwise they vanish from every average.
SELECT
    a.account_id,
    coalesce(sum(p.amount), 0) AS lifetime_value,
    count(p.payment_id) AS payments
FROM account AS a
LEFT JOIN payment AS p ON a.account_id = p.account_id
GROUP BY a.account_id
ORDER BY lifetime_value DESC;`,
  },
  {
    id: "sql-analytics-top-per-country",
    title: "The most-watched title in each country",
    level: 5,
    tags: ["query", "analytics", "window"],
    code: `-- Aggregate first, rank second. Ranking before aggregating is the
-- mistake that makes this query return the wrong title convincingly.
WITH plays AS (
    SELECT
        a.country_id,
        w.title_id,
        count(*) AS plays
    FROM watch_history AS w
    INNER JOIN profile AS p ON w.profile_id = p.profile_id
    INNER JOIN account AS a ON p.account_id = a.account_id
    GROUP BY a.country_id, w.title_id
)

SELECT
    country_id,
    title_id,
    plays
FROM (
    SELECT
        plays.*,
        row_number() OVER (
            PARTITION BY country_id ORDER BY plays DESC
        ) AS n
    FROM plays
) AS ranked
WHERE n = 1;`,
  },
];
