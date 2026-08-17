import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * A single row (id 1) tracking whether the automation agent is currently
 * paused on a model-quota/rate-limit failure — read by the Settings
 * banner (mockup step 11), written once per pause by the quota-alert
 * endpoint. A real table rather than in-process memory: the server runs
 * several worker processes (`SERVER_HTTP_WORKERS`), and in-memory state
 * set by whichever worker handles the alert wouldn't be visible to the
 * worker that later serves the Settings page.
 */
export class AgentStatus extends TimestampMixin(Model) {
  static override readonly tableName = "agent_status";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "integer" },
      pausedModel: { type: ["string", "null"], maxLength: 64 },
      enabled: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.integer("id").primary();
    table.timestamp("paused_since").nullable();
    table.string("paused_model", 64).nullable();
    table.boolean("enabled").notNullable().defaultTo(true);
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  pausedSince?: Date | null;
  pausedModel?: string | null;
  enabled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  static async current(): Promise<AgentStatus> {
    const existing = await AgentStatus.query().findById(1);
    if (existing != null) {
      return existing;
    }
    return await AgentStatus.query().insertAndFetch({
      id: 1,
      pausedSince: null,
      pausedModel: null,
      enabled: true,
    });
  }

  /**
   * The staff kill switch — off routes every ticket to the human queue
   * immediately, same effect as a quota pause, until turned back on.
   * Independent of the quota-pause fields: a staff-off and a quota-pause
   * can both be true at once without conflicting.
   */
  static async setEnabled(enabled: boolean): Promise<AgentStatus> {
    const status = await AgentStatus.current();
    return await status.$query().patchAndFetch({
      enabled,
      updatedAt: new Date(),
    });
  }

  /**
   * Records a new pause — a no-op if already paused, so a burst of 429s
   * from the same outage doesn't repeatedly reset the "paused since"
   * clock the Settings banner shows.
   */
  static async pause(model: string): Promise<AgentStatus> {
    const status = await AgentStatus.current();
    if (status.pausedSince != null) {
      return status;
    }
    return await status.$query().patchAndFetch({
      pausedSince: new Date(),
      pausedModel: model,
      updatedAt: new Date(),
    });
  }

  static async clear(): Promise<AgentStatus> {
    const status = await AgentStatus.current();
    return await status.$query().patchAndFetch({
      pausedSince: null,
      pausedModel: null,
      updatedAt: new Date(),
    });
  }
}

AgentStatus.relationMappings = {};
