import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * A temporary cooldown on new support-ticket submissions from one email,
 * applied automatically after repeated off-topic/spam tickets (see the
 * agent's `close-spam` endpoint). One row per email — `blockCount` tracks
 * how many times this address has earned a cooldown, so a repeat after an
 * earlier block expires escalates to a staff alert instead of silently
 * re-blocking forever.
 */
export class SupportBlock extends TimestampMixin(Model) {
  static override readonly tableName = "support_block";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["email"],
    properties: {
      id: { type: "integer" },
      email: { type: "string", minLength: 1, maxLength: 128 },
      blockCount: { type: "integer" },
      reason: { type: ["string", "null"], maxLength: 256 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.string("email", 128).notNullable().unique();
    table.timestamp("blocked_until").nullable();
    table.integer("block_count").notNullable().defaultTo(0);
    table.string("reason", 256).nullable();
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  email?: string;
  blockedUntil?: Date | null;
  blockCount?: number;
  reason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;

  static #norm(email: string): string {
    return email.trim().toLowerCase();
  }

  static async currentFor(email: string): Promise<SupportBlock | null> {
    const row = await SupportBlock.query()
      .whereRaw("lower(email) = ?", [SupportBlock.#norm(email)])
      .first();
    return row ?? null;
  }

  static async isBlocked(email: string): Promise<boolean> {
    const row = await SupportBlock.currentFor(email);
    return row?.blockedUntil != null && new Date(row.blockedUntil) > new Date();
  }

  /** Applies (or extends) a cooldown — increments `blockCount` by one. */
  static async applyBlock(
    email: string,
    durationMs: number,
    reason: string,
  ): Promise<SupportBlock> {
    const existing = await SupportBlock.currentFor(email);
    const blockedUntil = new Date(Date.now() + durationMs);
    if (existing == null) {
      return await SupportBlock.query().insertAndFetch({
        email: SupportBlock.#norm(email),
        blockedUntil,
        blockCount: 1,
        reason,
      });
    }
    return await existing.$query().patchAndFetch({
      blockedUntil,
      blockCount: (existing.blockCount ?? 0) + 1,
      reason,
      updatedAt: new Date(),
    });
  }
}

SupportBlock.relationMappings = {};
