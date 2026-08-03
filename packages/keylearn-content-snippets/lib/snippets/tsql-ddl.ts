import { type Snippet } from "../types.ts";

/**
 * The same schema in T-SQL, where SQL Server differs from Postgres.
 *
 * Not a translation exercise for its own sake: most QA and analyst work sits
 * on whichever engine the company bought, and the differences that bite are
 * small and constant — IDENTITY instead of GENERATED, GETDATE instead of now,
 * TOP instead of LIMIT, and a NULL-handling story of its own. Typing both is
 * how you stop guessing which one you are in.
 */
export const tsqlDdl: readonly Snippet[] = [
  {
    id: "tsql-ddl-create",
    title: "Create a table with an identity key",
    level: 1,
    tags: ["ddl", "create"],
    code: `-- IDENTITY(1,1) is the T-SQL spelling. SYSUTCDATETIME beats GETDATE:
-- storing local time is how a report ends up an hour out twice a year.
CREATE TABLE genre (
    genre_id INT IDENTITY (1, 1) PRIMARY KEY,
    genre_name NVARCHAR(100) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT sysutcdatetime()
);`,
  },
  {
    id: "tsql-ddl-nvarchar",
    title: "Choose a string type that holds every alphabet",
    level: 2,
    tags: ["ddl", "types"],
    code: `-- NVARCHAR stores Unicode; VARCHAR does not, and a title in Japanese
-- turns into question marks the day somebody adds one.
CREATE TABLE title (
    title_id INT IDENTITY (1, 1) PRIMARY KEY,
    title_name NVARCHAR(300) NOT NULL,
    release_year SMALLINT NULL
);`,
  },
  {
    id: "tsql-ddl-foreign-key",
    title: "Point one table at another",
    level: 2,
    tags: ["ddl", "constraint"],
    code: `-- Naming the constraint means the error message tells you which rule was
-- broken rather than quoting a generated string nobody recognises.
CREATE TABLE season (
    season_id INT IDENTITY (1, 1) PRIMARY KEY,
    title_id INT NOT NULL,
    season_number INT NOT NULL,
    CONSTRAINT fk_season_title FOREIGN KEY (title_id) REFERENCES title (
        title_id
    ),
    CONSTRAINT uq_season_number UNIQUE (title_id, season_number)
);`,
  },
  {
    id: "tsql-ddl-check",
    title: "Constrain the values a column may hold",
    level: 2,
    tags: ["ddl", "constraint"],
    code: `-- DECIMAL rather than FLOAT for money, for the same reason as anywhere
-- else: FLOAT cannot hold 0.10 and will not reconcile.
CREATE TABLE payment (
    payment_id INT IDENTITY (1, 1) PRIMARY KEY,
    account_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    CONSTRAINT ck_payment_amount CHECK (amount >= 0)
);`,
  },
  {
    id: "tsql-ddl-index",
    title: "Index the column you filter on",
    level: 2,
    tags: ["ddl", "index"],
    code: `-- INCLUDE carries extra columns in the leaf pages, so a query reading
-- only these two never has to visit the table at all.
CREATE NONCLUSTERED INDEX ix_watch_history_profile
    ON watch_history (profile_id)
    INCLUDE (title_id, started_at);`,
  },
  {
    id: "tsql-ddl-filtered-index",
    title: "Index only the rows you actually query",
    level: 4,
    tags: ["ddl", "index"],
    code: `-- SQL Server calls it a filtered index; Postgres calls it partial. Same
-- idea, and the same large saving on a mostly-closed table.
CREATE NONCLUSTERED INDEX ix_subscription_open
    ON subscription (account_id)
    WHERE end_date IS NULL;`,
  },
  {
    id: "tsql-ddl-view",
    title: "A view for a query people keep rewriting",
    level: 2,
    tags: ["ddl", "view"],
    code: `-- One definition of "active", so two dashboards cannot quietly disagree
-- about how many subscribers there are.
CREATE VIEW active_subscription
AS
SELECT
    subscription_id,
    account_id,
    plan_id,
    start_date
FROM subscription
WHERE end_date IS NULL;`,
  },
  {
    id: "tsql-ddl-alter",
    title: "Add a column and a constraint",
    level: 2,
    tags: ["ddl", "alter"],
    code: `-- WITH NOCHECK skips validating the rows already there, which is the
-- difference between a fast migration and one that locks the table.
ALTER TABLE account ADD referral_code NVARCHAR(40) NULL;

ALTER TABLE payment WITH NOCHECK
ADD CONSTRAINT ck_payment_positive CHECK (amount > 0);`,
  },
  {
    id: "tsql-ddl-computed",
    title: "A column derived from the others",
    level: 4,
    tags: ["ddl", "create"],
    code: `-- PERSISTED stores the result so it can be indexed. Without it the
-- expression is recomputed on every read.
ALTER TABLE watch_history
ADD minutes_watched AS (seconds_watched / 60.0) PERSISTED;`,
  },
  {
    id: "tsql-ddl-temporal",
    title: "Let the database keep the history for you",
    level: 5,
    tags: ["ddl", "create"],
    code: `-- A system-versioned table records every previous version of every row,
-- which is the slowly-changing-dimension problem solved by the engine.
CREATE TABLE subscription_plan (
    plan_id INT NOT NULL PRIMARY KEY,
    plan_name NVARCHAR(60) NOT NULL,
    monthly_price DECIMAL(10, 2) NOT NULL,
    valid_from DATETIME2 GENERATED ALWAYS AS ROW START NOT NULL,
    valid_to DATETIME2 GENERATED ALWAYS AS ROW END NOT NULL,
    PERIOD FOR SYSTEM_TIME (valid_from, valid_to)
)
WITH (SYSTEM_VERSIONING = ON);`,
  },
];
