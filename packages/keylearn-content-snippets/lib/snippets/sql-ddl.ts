import { type Snippet } from "../types.ts";

/**
 * Defining the shape of the data: tables, keys, constraints, indexes, views.
 *
 * The gap in most SQL study plans, which teach querying and never creating —
 * so people arrive able to write a window function and unable to say what a
 * foreign key does. Constraints are where correctness is cheapest: a rule the
 * database enforces cannot be forgotten by the next person to write an insert.
 *
 * PostgreSQL, on the streaming schema the rest of the corpus uses.
 */
export const sqlDdl: readonly Snippet[] = [
  {
    id: "sql-ddl-create-basic",
    title: "Create a table with a key and a default",
    level: 1,
    tags: ["ddl", "create"],
    code: `-- Identity columns replaced serial in modern Postgres: they are standard
-- SQL and the sequence cannot be written to by accident.
CREATE TABLE genre (
    genre_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    genre_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  },
  {
    id: "sql-ddl-not-null",
    title: "Say which columns may not be empty",
    level: 1,
    tags: ["ddl", "constraint"],
    code: `-- NOT NULL is the cheapest correctness rule there is, and the one most
-- often left off "just for now".
CREATE TABLE country (
    country_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    country_name TEXT NOT NULL,
    iso_code CHAR(2) NOT NULL
);`,
  },
  {
    id: "sql-ddl-unique",
    title: "Refuse duplicates at the source",
    level: 2,
    tags: ["ddl", "constraint"],
    code: `-- A uniqueness rule in the application is a suggestion; here it is a
-- promise, and it survives the next script somebody runs by hand.
CREATE TABLE platform (
    platform_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    platform_name TEXT NOT NULL,
    CONSTRAINT platform_name_unique UNIQUE (platform_name)
);`,
  },
  {
    id: "sql-ddl-foreign-key",
    title: "Point one table at another",
    level: 2,
    tags: ["ddl", "constraint"],
    code: `-- Without this, an orphaned row is a bug you find in a reconciliation
-- query six months later. With it, the insert simply fails.
CREATE TABLE season (
    season_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title_id INTEGER NOT NULL REFERENCES title (title_id),
    season_number INTEGER NOT NULL,
    CONSTRAINT season_number_unique UNIQUE (title_id, season_number)
);`,
  },
  {
    id: "sql-ddl-on-delete",
    title: "Decide what happens when the parent goes",
    level: 3,
    tags: ["ddl", "constraint"],
    code: `-- CASCADE for rows that cannot exist alone; RESTRICT for rows that are
-- evidence. Deleting a title should not silently delete its payments.
CREATE TABLE episode (
    episode_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES season (season_id) ON DELETE CASCADE,
    title_name TEXT NOT NULL
);`,
  },
  {
    id: "sql-ddl-check",
    title: "Constrain the values a column may hold",
    level: 2,
    tags: ["ddl", "constraint"],
    code: `-- A CHECK turns "ratings are 1 to 5" from a line in a document nobody
-- reads into something the database will not let anyone break.
CREATE TABLE rating (
    rating_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profile (profile_id),
    title_id INTEGER NOT NULL REFERENCES title (title_id),
    score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    rated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  },
  {
    id: "sql-ddl-check-dates",
    title: "Constrain a date range so it cannot run backwards",
    level: 3,
    tags: ["ddl", "constraint"],
    code: `-- end_date IS NULL means "still current", so the check has to allow it —
-- the classic mistake is a rule that quietly rejects every open row.
CREATE TABLE subscription (
    subscription_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account (account_id),
    plan_id INTEGER NOT NULL REFERENCES subscription_plan (plan_id),
    start_date DATE NOT NULL,
    end_date DATE,
    CONSTRAINT subscription_dates_ordered CHECK (
        end_date IS NULL OR end_date >= start_date
    )
);`,
  },
  {
    id: "sql-ddl-composite-key",
    title: "A join table keyed by the pair it joins",
    level: 2,
    tags: ["ddl", "create"],
    code: `-- The composite primary key is the uniqueness rule: a title cannot carry
-- the same genre twice, and no surrogate id is needed to say so.
CREATE TABLE title_genre (
    title_id INTEGER NOT NULL REFERENCES title (title_id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genre (genre_id),
    PRIMARY KEY (title_id, genre_id)
);`,
  },
  {
    id: "sql-ddl-numeric-money",
    title: "Store money as numeric, never as float",
    level: 2,
    tags: ["ddl", "types"],
    code: `-- Floating point cannot represent 0.10 exactly, so a column of them will
-- not reconcile against the finance system and nobody will know why.
CREATE TABLE payment (
    payment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account (account_id),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL,
    payment_date DATE NOT NULL
);`,
  },
  {
    id: "sql-ddl-timestamptz",
    title: "Store instants with their time zone",
    level: 2,
    tags: ["ddl", "types"],
    code: `-- timestamptz stores a real instant; timestamp stores a wall clock with
-- no idea which one, and reads differently on every machine.
CREATE TABLE watch_history (
    watch_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profile (profile_id),
    title_id INTEGER NOT NULL REFERENCES title (title_id),
    started_at TIMESTAMPTZ NOT NULL,
    seconds_watched INTEGER NOT NULL CHECK (seconds_watched >= 0)
);`,
  },
  {
    id: "sql-ddl-enum-lookup",
    title: "A lookup table rather than free text",
    level: 3,
    tags: ["ddl", "create"],
    code: `-- A lookup table can be joined, counted and renamed. A text column with
-- 'active', 'Active' and 'ACTIVE' in it can only be apologised for.
CREATE TABLE subscription_status (
    status_code TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

INSERT INTO subscription_status (status_code, description)
VALUES ('active', 'Currently billing'),
('paused', 'Temporarily suspended'),
('cancelled', 'Ended by the customer');`,
  },
  {
    id: "sql-ddl-index",
    title: "Index the column you filter on",
    level: 2,
    tags: ["ddl", "index"],
    code: `-- Foreign keys are not indexed automatically in Postgres, which is why a
-- join that should be instant turns into a sequential scan.
CREATE INDEX watch_history_profile_idx ON watch_history (profile_id);`,
  },
  {
    id: "sql-ddl-index-composite",
    title: "A composite index, in the order it is queried",
    level: 3,
    tags: ["ddl", "index"],
    code: `-- Leftmost columns first: this serves a filter on profile_id, and on
-- profile_id with started_at, but not on started_at alone.
CREATE INDEX watch_history_profile_started_idx
ON watch_history (profile_id, started_at DESC);`,
  },
  {
    id: "sql-ddl-index-partial",
    title: "Index only the rows you actually query",
    level: 4,
    tags: ["ddl", "index"],
    code: `-- Current subscriptions are a small slice of the table, and a partial
-- index over them is a fraction of the size and stays in memory.
CREATE INDEX subscription_active_idx
ON subscription (account_id)
WHERE end_date IS NULL;`,
  },
  {
    id: "sql-ddl-unique-partial",
    title: "Allow only one current row per parent",
    level: 4,
    tags: ["ddl", "index", "constraint"],
    code: `-- Enforces "one open subscription per account" while leaving any number
-- of closed ones. A plain unique constraint could not express that.
CREATE UNIQUE INDEX subscription_one_open_per_account
ON subscription (account_id)
WHERE end_date IS NULL;`,
  },
  {
    id: "sql-ddl-alter-add",
    title: "Add a column to a table already in use",
    level: 2,
    tags: ["ddl", "alter"],
    code: `-- Nullable first, backfill, then add the NOT NULL. Adding it in one step
-- has to rewrite every existing row and holds a lock while it does.
ALTER TABLE account ADD COLUMN referral_code TEXT;`,
  },
  {
    id: "sql-ddl-alter-constraint",
    title: "Add a constraint without locking the table for the check",
    level: 4,
    tags: ["ddl", "alter"],
    code: `-- NOT VALID applies the rule to new rows immediately and skips the scan;
-- VALIDATE then checks the existing rows without blocking writes.
ALTER TABLE payment
ADD CONSTRAINT payment_amount_positive CHECK (amount > 0) NOT VALID;

ALTER TABLE payment VALIDATE CONSTRAINT payment_amount_positive;`,
  },
  {
    id: "sql-ddl-alter-rename",
    title: "Rename a column and a table",
    level: 2,
    tags: ["ddl", "alter"],
    code: `-- Renaming is instant and invisible to the data, and breaks every query
-- that named the old column. Grep before you run it.
ALTER TABLE title RENAME COLUMN title_name TO name;

ALTER TABLE title RENAME TO catalog_title;`,
  },
  {
    id: "sql-ddl-drop-column",
    title: "Drop a column safely",
    level: 2,
    tags: ["ddl", "alter"],
    code: `-- IF EXISTS makes the migration re-runnable, which matters the day it
-- half-succeeds against production.
ALTER TABLE account DROP COLUMN IF EXISTS legacy_customer_ref;`,
  },
  {
    id: "sql-ddl-view",
    title: "A view for a query people keep rewriting",
    level: 2,
    tags: ["ddl", "view"],
    code: `-- One definition of "active subscription" that every report shares, so
-- two dashboards cannot quietly disagree about the number.
CREATE VIEW active_subscription AS
SELECT
    s.subscription_id,
    s.account_id,
    s.plan_id,
    s.start_date
FROM subscription AS s
WHERE s.end_date IS NULL;`,
  },
  {
    id: "sql-ddl-materialized-view",
    title: "A materialised view for an expensive aggregate",
    level: 4,
    tags: ["ddl", "view"],
    code: `-- Stores the result rather than the query, so it is fast to read and
-- stale until refreshed. That trade is the whole decision.
CREATE MATERIALIZED VIEW monthly_watch_totals AS
SELECT
    date_trunc('month', started_at) AS month,
    title_id,
    sum(seconds_watched) AS seconds_watched
FROM watch_history
GROUP BY 1, 2;

REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_watch_totals;`,
  },
  {
    id: "sql-ddl-comment",
    title: "Write down what a column means",
    level: 1,
    tags: ["ddl", "documentation"],
    code: `-- Lives with the schema rather than in a document that goes stale, and
-- shows up in every tool that introspects the database.
COMMENT ON COLUMN payment.amount IS
'Charged amount in the currency of the currency column, tax inclusive.';`,
  },
];
