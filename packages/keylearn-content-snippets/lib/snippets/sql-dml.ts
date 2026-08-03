import { type Snippet } from "../types.ts";

/**
 * Changing the data: insert, update, delete, upsert, transactions.
 *
 * The other half missing from most SQL study plans. Every one of these can
 * destroy data if the WHERE clause is wrong, which is why the habits matter
 * more here than anywhere else in the language: check the SELECT first, wrap
 * anything you are unsure of in a transaction, and let RETURNING tell you what
 * actually happened rather than assuming.
 */
export const sqlDml: readonly Snippet[] = [
  {
    id: "sql-dml-insert",
    title: "Insert a row, naming the columns",
    level: 1,
    tags: ["dml", "insert"],
    code: `-- Naming the columns means the statement keeps working when somebody
-- adds a column in the middle of the table.
INSERT INTO genre (genre_name)
VALUES ('Documentary');`,
  },
  {
    id: "sql-dml-insert-many",
    title: "Insert several rows in one statement",
    level: 1,
    tags: ["dml", "insert"],
    code: `-- One statement, one round trip, one transaction: either all four land
-- or none of them do.
INSERT INTO genre (genre_name)
VALUES ('Drama'),
('Comedy'),
('Thriller'),
('Documentary');`,
  },
  {
    id: "sql-dml-insert-returning",
    title: "Get back the id the database generated",
    level: 2,
    tags: ["dml", "insert"],
    code: `-- RETURNING beats inserting and then selecting: no second query, and no
-- chance of reading somebody else's row in between.
INSERT INTO account (email, created_at)
VALUES ('ada@example.com', now())
RETURNING account_id, created_at;`,
  },
  {
    id: "sql-dml-insert-select",
    title: "Insert the result of a query",
    level: 2,
    tags: ["dml", "insert"],
    code: `-- Backfilling a new table from an existing one, without the data ever
-- leaving the database.
INSERT INTO title_genre (title_id, genre_id)
SELECT
    t.title_id,
    g.genre_id
FROM title AS t
JOIN genre AS g ON g.genre_name = t.primary_genre
WHERE t.primary_genre IS NOT NULL;`,
  },
  {
    id: "sql-dml-upsert",
    title: "Insert, or update if it is already there",
    level: 3,
    tags: ["dml", "upsert"],
    code: `-- The idempotent write: run it twice and the second run changes nothing.
-- EXCLUDED holds the row that was proposed and rejected.
INSERT INTO rating (profile_id, title_id, score, rated_at)
VALUES (42, 1001, 5, now())
ON CONFLICT (profile_id, title_id)
DO UPDATE SET
    score = excluded.score,
    rated_at = excluded.rated_at;`,
  },
  {
    id: "sql-dml-upsert-nothing",
    title: "Insert only if it is not already there",
    level: 2,
    tags: ["dml", "upsert"],
    code: `-- DO NOTHING makes a re-run harmless, which is what you want from a
-- loader that may be replayed after a partial failure.
INSERT INTO title_genre (title_id, genre_id)
VALUES (1001, 7)
ON CONFLICT DO NOTHING;`,
  },
  {
    id: "sql-dml-update",
    title: "Update rows that match a condition",
    level: 1,
    tags: ["dml", "update"],
    code: `-- Run it as a SELECT with the same WHERE first. An UPDATE with a wrong
-- WHERE is discovered by the people it affects.
UPDATE account
SET email_verified_at = now()
WHERE
    account_id = 42
    AND email_verified_at IS NULL;`,
  },
  {
    id: "sql-dml-update-returning",
    title: "See exactly which rows an update touched",
    level: 2,
    tags: ["dml", "update"],
    code: `-- Turns "UPDATE 0" into an answer. Nothing matched is a very different
-- problem from everything matched.
UPDATE subscription
SET end_date = current_date
WHERE
    account_id = 42
    AND end_date IS NULL
RETURNING subscription_id, plan_id, start_date;`,
  },
  {
    id: "sql-dml-update-from",
    title: "Update one table from another",
    level: 3,
    tags: ["dml", "update"],
    code: `-- Postgres spells the join UPDATE ... FROM. The WHERE is what connects
-- the two tables; leave it off and every row gets the same value.
UPDATE title AS t
SET original_language_id = s.language_id
FROM staging_title AS s
WHERE
    s.title_id = t.title_id
    AND t.original_language_id IS DISTINCT FROM s.language_id;`,
  },
  {
    id: "sql-dml-update-case",
    title: "Set different values in one pass",
    level: 3,
    tags: ["dml", "update"],
    code: `-- One statement rather than three, so the table is scanned once and no
-- row can be caught between two of them.
UPDATE subscription_plan
SET
    monthly_price = CASE
        WHEN plan_name = 'Basic' THEN 7.99
        WHEN plan_name = 'Standard' THEN 12.99
        WHEN plan_name = 'Premium' THEN 17.99
        ELSE monthly_price
    END
WHERE plan_name IN ('Basic', 'Standard', 'Premium');`,
  },
  {
    id: "sql-dml-update-null-trap",
    title: "Compare values that may be null",
    level: 3,
    tags: ["dml", "update", "null"],
    code: `-- <> is never true when either side is null, so a plain inequality
-- silently skips every row where the old value was missing.
UPDATE account AS a
SET country_id = s.country_id
FROM staging_account AS s
WHERE
    s.account_id = a.account_id
    AND a.country_id IS DISTINCT FROM s.country_id;`,
  },
  {
    id: "sql-dml-delete",
    title: "Delete rows that match a condition",
    level: 1,
    tags: ["dml", "delete"],
    code: `-- Select it first. DELETE has no undo, and the WHERE clause is the only
-- thing standing between one row and the whole table.
DELETE FROM search_history
WHERE created_at < current_date - INTERVAL '2 years';`,
  },
  {
    id: "sql-dml-delete-using",
    title: "Delete rows based on another table",
    level: 3,
    tags: ["dml", "delete"],
    code: `-- USING is the DELETE equivalent of a join. Written as a subquery it is
-- easier to read; written like this it is usually faster.
DELETE FROM watch_history AS w
USING profile AS p
WHERE
    p.profile_id = w.profile_id
    AND p.deleted_at IS NOT NULL;`,
  },
  {
    id: "sql-dml-delete-duplicates",
    title: "Delete duplicates, keeping the earliest",
    level: 4,
    tags: ["dml", "delete", "duplicates"],
    code: `-- ctid is the physical row address, which is what lets you tell two
-- otherwise identical rows apart when there is no unique key to use.
DELETE FROM rating AS r
WHERE r.ctid NOT IN (
    SELECT min(inner_r.ctid)
    FROM rating AS inner_r
    GROUP BY inner_r.profile_id, inner_r.title_id
);`,
  },
  {
    id: "sql-dml-soft-delete",
    title: "Mark a row deleted instead of removing it",
    level: 2,
    tags: ["dml", "update"],
    code: `-- Keeps the history and the foreign keys intact. The cost is that every
-- query from now on has to remember the filter.
UPDATE profile
SET deleted_at = now()
WHERE
    profile_id = 7
    AND deleted_at IS NULL;`,
  },
  {
    id: "sql-dml-transaction",
    title: "Make several changes all or nothing",
    level: 2,
    tags: ["dml", "transaction"],
    code: `-- Either both statements land or neither does. Without the transaction,
-- a failure halfway leaves a cancelled subscription that still bills.
BEGIN;

UPDATE subscription
SET end_date = current_date
WHERE subscription_id = 91;

INSERT INTO subscription (account_id, plan_id, start_date)
VALUES (42, 3, current_date);

COMMIT;`,
  },
  {
    id: "sql-dml-rollback",
    title: "Check the damage before committing to it",
    level: 2,
    tags: ["dml", "transaction"],
    code: `-- The safest way to run an unfamiliar UPDATE: do it, look at the count,
-- and only then decide whether to keep it.
BEGIN;

DELETE FROM download
WHERE expires_at < current_date - INTERVAL '30 days';

-- Wrong number of rows? ROLLBACK instead.
COMMIT;`,
  },
  {
    id: "sql-dml-savepoint",
    title: "Undo part of a transaction",
    level: 4,
    tags: ["dml", "transaction"],
    code: `-- A savepoint lets one step fail without discarding the work before it,
-- which matters in a long migration that is expensive to restart.
BEGIN;

UPDATE account SET country_id = 61 WHERE account_id = 42;

SAVEPOINT before_backfill;

UPDATE profile SET language_id = 1 WHERE account_id = 42;

ROLLBACK TO SAVEPOINT before_backfill;

COMMIT;`,
  },
  {
    id: "sql-dml-lock-row",
    title: "Read a row you are about to change",
    level: 5,
    tags: ["dml", "transaction", "locking"],
    code: `-- FOR UPDATE holds the row until the transaction ends, so two concurrent
-- sessions cannot both read the old balance and both write back a new one.
BEGIN;

SELECT balance
FROM account_credit
WHERE account_id = 42
FOR UPDATE;

UPDATE account_credit
SET balance = balance - 9.99
WHERE account_id = 42;

COMMIT;`,
  },
  {
    id: "sql-dml-merge",
    title: "Insert, update and delete in one statement",
    level: 5,
    tags: ["dml", "merge"],
    code: `-- Standard SQL's answer to the upsert, and the one that also handles
-- rows that have disappeared from the source.
MERGE INTO title AS t
USING staging_title AS s ON s.title_id = t.title_id
WHEN MATCHED AND s.is_deleted THEN
    DELETE
WHEN MATCHED THEN
    UPDATE SET title_name = s.title_name
WHEN NOT MATCHED THEN
    INSERT (title_id, title_name)
    VALUES (s.title_id, s.title_name);`,
  },
  {
    id: "sql-dml-cte-delete",
    title: "Move rows to an archive and delete them together",
    level: 5,
    tags: ["dml", "delete", "cte"],
    code: `-- The delete and the insert see the same snapshot, so nothing can be
-- archived without being removed or removed without being archived.
WITH moved AS (
    DELETE FROM watch_history
    WHERE started_at < current_date - INTERVAL '3 years'
    RETURNING *
)

INSERT INTO watch_history_archive
SELECT * FROM moved;`,
  },
  {
    id: "sql-dml-truncate",
    title: "Empty a table quickly",
    level: 3,
    tags: ["dml", "delete"],
    code: `-- Far faster than DELETE because it does not scan, and far more
-- dangerous for the same reason: there is no WHERE clause to get wrong.
TRUNCATE TABLE staging_title;`,
  },
];
