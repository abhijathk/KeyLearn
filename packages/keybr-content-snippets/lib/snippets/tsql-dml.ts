import { type Snippet } from "../types.ts";

/**
 * Changing data in T-SQL.
 *
 * The differences from Postgres that actually cost people time: OUTPUT rather
 * than RETURNING, MERGE rather than ON CONFLICT, UPDATE ... FROM with the
 * alias in an unfamiliar place, and TOP where LIMIT would be.
 */
export const tsqlDml: readonly Snippet[] = [
  {
    id: "tsql-dml-insert-output",
    title: "Insert and get the generated key back",
    level: 2,
    tags: ["dml", "insert"],
    code: `-- OUTPUT is T-SQL's RETURNING. INSERTED is the pseudo-table holding the
-- rows as they landed, defaults and identity values included.
INSERT INTO account (email, created_at)
OUTPUT INSERTED.account_id, INSERTED.created_at
VALUES ('ada@example.com', sysutcdatetime());`,
  },
  {
    id: "tsql-dml-insert-select",
    title: "Insert the result of a query",
    level: 2,
    tags: ["dml", "insert"],
    code: `-- Backfilling without the data leaving the server, which is both faster
-- and the only version that stays consistent under concurrent writes.
INSERT INTO title_genre (title_id, genre_id)
SELECT
    t.title_id,
    g.genre_id
FROM title AS t
INNER JOIN genre AS g ON t.primary_genre = g.genre_name
WHERE t.primary_genre IS NOT NULL;`,
  },
  {
    id: "tsql-dml-update-from",
    title: "Update one table from another",
    level: 3,
    tags: ["dml", "update"],
    code: `-- The alias goes after UPDATE and the join in the FROM. Getting this
-- backwards is the most common T-SQL syntax error there is.
UPDATE t
SET original_language_id = s.language_id
FROM title AS t
INNER JOIN staging_title AS s ON t.title_id = s.title_id
WHERE
    t.original_language_id <> s.language_id
    OR t.original_language_id IS NULL;`,
  },
  {
    id: "tsql-dml-update-output",
    title: "See exactly which rows an update changed",
    level: 3,
    tags: ["dml", "update"],
    code: `-- DELETED holds the row as it was, INSERTED as it now is — so one
-- statement produces its own before-and-after audit trail.
UPDATE subscription
SET end_date = CAST(sysutcdatetime() AS DATE)
OUTPUT DELETED.end_date AS old_end_date, INSERTED.end_date AS new_end_date
WHERE account_id = 42 AND end_date IS NULL;`,
  },
  {
    id: "tsql-dml-delete-join",
    title: "Delete rows based on another table",
    level: 3,
    tags: ["dml", "delete"],
    code: `-- The alias after DELETE says which table loses rows. Omit it and SQL
-- Server cannot tell which side of the join you meant.
DELETE w
FROM watch_history AS w
INNER JOIN profile AS p ON w.profile_id = p.profile_id
WHERE p.deleted_at IS NOT NULL;`,
  },
  {
    id: "tsql-dml-delete-top",
    title: "Delete in batches so the log does not explode",
    level: 4,
    tags: ["dml", "delete"],
    code: `-- One enormous DELETE takes a lock and fills the transaction log. In
-- batches it can be interrupted, and other sessions keep working.
DELETE TOP (5000)
FROM search_history
WHERE created_at < dateadd(YEAR, -2, sysutcdatetime());`,
  },
  {
    id: "tsql-dml-merge",
    title: "Insert, update and delete against a source in one pass",
    level: 5,
    tags: ["dml", "merge"],
    code: `-- T-SQL's upsert. Always terminate MERGE with a semicolon; without one
-- the error it raises points nowhere near the real problem.
MERGE INTO title AS tgt
USING staging_title AS src
    ON tgt.title_id = src.title_id
WHEN MATCHED AND src.is_deleted = 1 THEN DELETE
WHEN MATCHED THEN UPDATE SET title_name = src.title_name
WHEN NOT MATCHED BY TARGET
    THEN
    INSERT (title_id, title_name) VALUES (src.title_id, src.title_name);`,
  },
  {
    id: "tsql-dml-transaction",
    title: "Make several changes all or nothing",
    level: 3,
    tags: ["dml", "transaction"],
    code: `-- XACT_ABORT ON makes a runtime error roll the whole thing back. Without
-- it, some errors abort only the statement and leave the rest committed.
SET XACT_ABORT ON;

BEGIN TRANSACTION;

UPDATE subscription
SET end_date = CAST(sysutcdatetime() AS DATE)
WHERE subscription_id = 91;

INSERT INTO subscription (account_id, plan_id, start_date)
VALUES (42, 3, CAST(sysutcdatetime() AS DATE));

COMMIT TRANSACTION;`,
  },
  {
    id: "tsql-dml-try-catch",
    title: "Roll back when something throws",
    level: 4,
    tags: ["dml", "transaction"],
    code: `-- XACT_STATE tells you whether the transaction can still be committed.
-- Calling ROLLBACK when there is nothing open raises an error of its own.
BEGIN TRY
    BEGIN TRANSACTION;
    DELETE FROM download
    WHERE expires_at < sysutcdatetime();
    COMMIT TRANSACTION;
END TRY

BEGIN CATCH
    IF xact_state() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;`,
  },
  {
    id: "tsql-dml-isnull",
    title: "Substitute a value for null",
    level: 2,
    tags: ["dml", "null"],
    code: `-- ISNULL takes the type of its first argument; COALESCE follows the
-- standard and takes several. Prefer COALESCE unless you need the other.
UPDATE account
SET country_id = COALESCE(country_id, 0)
WHERE country_id IS NULL;`,
  },
];
