import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";

/**
 * "This browser has proved the grown-up PIN for support."
 *
 * A row rather than a session key, and the reason is a race that cost a
 * long evening to find.
 *
 * The session is stored as one blob and rewritten in full on every
 * request — the rolling expiry changes each second, so there is always
 * something to write. Two requests overlapping is therefore last-writer-
 * wins over the *whole* session: a request that loaded before the revoke
 * and committed after it wrote the deleted key straight back. Closing the
 * account window does exactly that, because leaving the pane fires the
 * rail's unread count at the same moment as the revoke. The PIN was
 * revoked and then immediately un-revoked, every time.
 *
 * A row of its own has no such neighbours. Deleting it is atomic, it
 * cannot be resurrected by an unrelated request, and it is visible to
 * every worker at once.
 *
 * Keyed on the session id, not the user: the proof belongs to the browser
 * that gave it, so proving on the tablet must not open the section on the
 * father's laptop.
 */
export class SupportPinProof extends Model {
  static override readonly tableName = "support_pin_proof";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override readonly idColumn = "sessionId";
  static override jsonSchema = {
    type: "object",
    required: ["sessionId", "userId"],
    properties: {
      sessionId: { type: "string", minLength: 1, maxLength: 64 },
      userId: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.string("session_id", 64).primary();
    table.integer("user_id").unsigned().notNullable();
    table.timestamp("proved_at").notNullable().defaultTo(knex.fn.now());
    // The sweep reads this shape.
    table.index(["proved_at"]);
  }

  sessionId?: string;
  userId?: number;
  provedAt?: Date;

  /** Recorded when the PIN is entered correctly. */
  static async prove(sessionId: string, userId: number): Promise<void> {
    const provedAt = new Date();
    // Delete-then-insert rather than an upsert: this table has one row per
    // session and no dialect-portable upsert exists across the sqlite and
    // MySQL this runs on.
    await SupportPinProof.query().deleteById(sessionId);
    await SupportPinProof.query().insert({ sessionId, userId, provedAt });
  }

  /** Handed back when the section is left. */
  static async revoke(sessionId: string): Promise<void> {
    await SupportPinProof.query().deleteById(sessionId);
  }

  /**
   * Whether this browser proved it within `ttlMs`.
   *
   * The user id is checked as well as the session id: a session that has
   * since been signed into a different account must not inherit the
   * previous one's proof.
   */
  static async proved(
    sessionId: string,
    userId: number,
    ttlMs: number,
  ): Promise<boolean> {
    const row = await SupportPinProof.query().findById(sessionId);
    if (row == null || row.userId !== userId) {
      return false;
    }
    return Date.now() - Number(new Date(row.provedAt!)) <= ttlMs;
  }

  /** Anything past its life, swept on the way past. */
  static async sweep(ttlMs: number): Promise<void> {
    await SupportPinProof.query()
      .delete()
      .where("provedAt", "<", new Date(Date.now() - ttlMs));
  }
}

SupportPinProof.relationMappings = {};
