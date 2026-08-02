import { SQL } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { sqlAnalytics } from "./sql-analytics.ts";
import { sqlDdl } from "./sql-ddl.ts";
import { sqlDml } from "./sql-dml.ts";
import { sqlJoins } from "./sql-joins.ts";
import { sqlLogic } from "./sql-logic.ts";
import { sqlQuality } from "./sql-quality.ts";
import { sqlWindows } from "./sql-windows.ts";
import { tsqlDdl } from "./tsql-ddl.ts";
import { tsqlDml } from "./tsql-dml.ts";

/**
 * SQL for the QA and analyst track, on a streaming-service schema.
 *
 * PostgreSQL, because it is the dialect the plan this corpus follows is
 * written against and the one whose behaviour is closest to the standard.
 * Where another dialect differs enough to matter, the comment says so.
 *
 * The formatter is sqlfluff. It is not installed by default, and the gate
 * skips with a warning when it is missing rather than failing a contributor's
 * test run — but CI has to have it, or the claim that these follow a style is
 * only an intention.
 */
export const sqlPostgres: SnippetSet = {
  syntax: "sql_postgres",
  framework: "SQL",
  language: "PostgreSQL",
  standard: "sqlfluff (Postgres)",
  formatter: {
    command: "sqlfluff",
    args: ["format", "--dialect", "postgres", "-"],
    extension: ".sql",
  },
  lineComment: ["--"],
  lexicon: SQL,
  topics: [
    { id: "ddl", name: "Tables & constraints" },
    { id: "index", name: "Indexes & views" },
    { id: "dml", name: "Insert, update, delete" },
    { id: "transaction", name: "Transactions" },
    { id: "join", name: "Joins" },
    { id: "subquery", name: "Subqueries & CASE" },
    { id: "window", name: "Window functions" },
    { id: "cte", name: "CTEs & recursion" },
    { id: "analytics", name: "Cohorts & revenue" },
    { id: "quality", name: "Data quality" },
  ],
  snippets: [
    ...sqlDdl,
    ...sqlDml,
    ...sqlJoins,
    ...sqlLogic,
    ...sqlWindows,
    ...sqlAnalytics,
    ...sqlQuality,
  ],
};

/**
 * The same schema in T-SQL.
 *
 * A second language under the same SQL heading rather than a separate entry:
 * choosing the engine is a choice about this lesson, not about which skill is
 * being practised.
 */
export const sqlServer: SnippetSet = {
  syntax: "sql_tsql",
  framework: "SQL",
  language: "SQL Server",
  standard: "sqlfluff (T-SQL)",
  formatter: {
    command: "sqlfluff",
    args: ["format", "--dialect", "tsql", "-"],
    extension: ".sql",
  },
  lineComment: ["--"],
  lexicon: SQL,
  topics: [
    { id: "ddl", name: "Tables & constraints" },
    { id: "index", name: "Indexes & views" },
    { id: "dml", name: "Insert, update, delete" },
    { id: "transaction", name: "Transactions" },
  ],
  snippets: [...tsqlDdl, ...tsqlDml],
};
