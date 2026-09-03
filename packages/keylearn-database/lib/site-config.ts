import { type Knex } from "knex";
import { type JSONSchema, Model, type Pojo, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * The stored site configuration: one row per registry key that has been
 * changed away from its shipped default. A key with no row is at its
 * default, which is what makes "restore defaults" a delete and release drift
 * a comparison against the registry rather than a migration.
 *
 * A real table rather than in-process memory for the same reason
 * `AgentStatus` is: the server runs several worker processes and every one
 * of them must apply the same value. Values are JSON in a text column —
 * this schema has no JSON column type — parsed by the typed accessors here
 * and validated by the registry before they ever arrive.
 *
 * Timestamps are normalised on read: sqlite hands back the stored number
 * and mysql2 a Date, and the history serialiser calls `toISOString()`.
 */
export class SiteConfig extends TimestampMixin(Model) {
  static override readonly tableName = "site_config";
  // The key is the primary key; Objection assumes "id" unless told.
  static override readonly idColumn = "key";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["key", "value"],
    properties: {
      key: { type: "string", minLength: 1, maxLength: 64 },
      value: { type: "string", maxLength: 65535 },
      /** The registry default at the time of the write, for the drift flag. */
      defaultAtWrite: { type: ["string", "null"], maxLength: 65535 },
      updatedBy: { type: ["integer", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { key } = SiteConfig.jsonSchema.properties;
    table.string("key", key.maxLength).primary();
    table.text("value").notNullable();
    table.text("default_at_write").nullable();
    // Unsigned int and NOT a foreign key: the row must outlive the account
    // of whoever set it, same as the audit log.
    table.integer("updated_by").unsigned().nullable();
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly key?: string;
  value?: string;
  defaultAtWrite?: string | null;
  updatedBy?: number | null;
  updatedAt?: Date;
  createdAt?: Date;

  override $parseDatabaseJson(json: Pojo): Pojo {
    json = super.$parseDatabaseJson(json);
    for (const name of ["createdAt", "updatedAt"]) {
      const value = json[name];
      if (value != null && !(value instanceof Date)) {
        json[name] = new Date(value);
      }
    }
    return json;
  }

  /** The stored value, decoded. */
  get decoded(): unknown {
    return this.value == null ? undefined : JSON.parse(this.value);
  }

  /** The default the value was written against, or undefined if unknown. */
  get defaultAtWriteDecoded(): unknown {
    return this.defaultAtWrite == null
      ? undefined
      : JSON.parse(this.defaultAtWrite);
  }

  /** Every stored value, keyed. What the per-worker cache loads. */
  static async all(trx?: Knex.Transaction): Promise<Map<string, unknown>> {
    const rows = await SiteConfig.query(trx);
    const map = new Map<string, unknown>();
    for (const row of rows) {
      map.set(row.key!, row.decoded);
    }
    return map;
  }

  /** One stored row, or null when the key is at its default. */
  static async find(
    key: string,
    trx?: Knex.Transaction,
  ): Promise<SiteConfig | null> {
    return (await SiteConfig.query(trx).findById(key)) ?? null;
  }

  /** Stores a value for a key, creating or replacing the row. */
  static async put(
    key: string,
    value: unknown,
    updatedBy: number | null,
    trx?: Knex.Transaction,
    defaultAtWrite?: unknown,
  ): Promise<void> {
    const encoded = JSON.stringify(value);
    const defaults =
      defaultAtWrite === undefined ? null : JSON.stringify(defaultAtWrite);
    const now = new Date();
    const existing = await SiteConfig.query(trx).findById(key);
    if (existing == null) {
      await SiteConfig.query(trx).insert({
        key,
        value: encoded,
        defaultAtWrite: defaults,
        updatedBy,
        updatedAt: now,
      });
    } else {
      await SiteConfig.query(trx).findById(key).patch({
        value: encoded,
        defaultAtWrite: defaults,
        updatedBy,
        updatedAt: now,
      });
    }
  }

  /** Returns a key to its shipped default by removing its row. */
  static async remove(key: string, trx?: Knex.Transaction): Promise<void> {
    await SiteConfig.query(trx).deleteById(key);
  }
}

SiteConfig.relationMappings = {};

/**
 * One row per change: who, when, from what, to what. Written in the same
 * transaction as the value, so a value can never change without its
 * history row, and revert is "write the old value back", which produces a
 * new row of its own (spec §12.6) rather than deleting anything.
 *
 * `oldValue` / `newValue` are JSON, or null for "the shipped default".
 */
export class SiteConfigHistory extends TimestampMixin(Model) {
  static override readonly tableName = "site_config_history";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["key"],
    properties: {
      id: { type: "integer" },
      key: { type: "string", minLength: 1, maxLength: 64 },
      oldValue: { type: ["string", "null"], maxLength: 65535 },
      newValue: { type: ["string", "null"], maxLength: 65535 },
      actorUserId: { type: ["integer", "null"] },
      reason: { type: ["string", "null"], maxLength: 500 },
      revertOf: { type: ["integer", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { key, reason } = SiteConfigHistory.jsonSchema.properties;
    table.increments("id").primary();
    table.string("key", key.maxLength).notNullable();
    table.text("old_value").nullable();
    table.text("new_value").nullable();
    table.integer("actor_user_id").unsigned().nullable();
    table.string("reason", reason.maxLength).nullable();
    // The history row this one undid, when it is a revert.
    table.integer("revert_of").unsigned().nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["created_at"]);
    table.index(["key", "created_at"]);
  }

  readonly id?: number;
  key?: string;
  oldValue?: string | null;
  newValue?: string | null;
  actorUserId?: number | null;
  reason?: string | null;
  revertOf?: number | null;
  createdAt?: Date;

  override $parseDatabaseJson(json: Pojo): Pojo {
    json = super.$parseDatabaseJson(json);
    const value = json["createdAt"];
    if (value != null && !(value instanceof Date)) {
      json["createdAt"] = new Date(value);
    }
    return json;
  }

  /** `undefined` for "the default", otherwise the decoded value. */
  get oldDecoded(): unknown {
    return this.oldValue == null ? undefined : JSON.parse(this.oldValue);
  }

  get newDecoded(): unknown {
    return this.newValue == null ? undefined : JSON.parse(this.newValue);
  }

  /**
   * Records a change. Unlike the audit log this DOES throw: the history row
   * is part of the write, and a change that cannot be recorded must not
   * happen. Values are `undefined` for "the default".
   */
  static async record(
    {
      key,
      oldValue,
      newValue,
      actorUserId = null,
      reason = null,
      revertOf = null,
    }: {
      readonly key: string;
      readonly oldValue: unknown;
      readonly newValue: unknown;
      readonly actorUserId?: number | null;
      readonly reason?: string | null;
      readonly revertOf?: number | null;
    },
    trx?: Knex.Transaction,
  ): Promise<SiteConfigHistory> {
    return await SiteConfigHistory.query(trx).insertAndFetch({
      key,
      oldValue: oldValue === undefined ? null : JSON.stringify(oldValue),
      newValue: newValue === undefined ? null : JSON.stringify(newValue),
      actorUserId,
      reason:
        reason == null || reason.trim() === ""
          ? null
          : reason.trim().slice(0, 500),
      revertOf,
    });
  }

  static async findById(id: number): Promise<SiteConfigHistory | null> {
    return (await SiteConfigHistory.query().findById(id)) ?? null;
  }

  static async listRecent(
    limit = 100,
    key?: string,
  ): Promise<SiteConfigHistory[]> {
    let query = SiteConfigHistory.query()
      .orderBy("id", "desc")
      .limit(Math.min(Math.max(limit, 1), 500));
    if (key != null) {
      query = query.where("key", key);
    }
    return await query;
  }
}

SiteConfigHistory.relationMappings = {};
