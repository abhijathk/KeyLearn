import { createHash } from "node:crypto";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";

/**
 * Per-ACCOUNT failure counters, with an escalating lockout.
 *
 * The request limiter in the server is keyed by client IP and lives in
 * memory, which is exactly what a distributed guesser walks around: a
 * thousand addresses each staying under the per-IP limit still add up to a
 * thousand guesses a minute against the one account. A row here is keyed by
 * what is being guessed AT — an address, an account — so the count is the
 * same whichever address the guesses arrive from, and it is shared by every
 * worker because it is in the database.
 *
 * Escalation: `limit` failures inside `windowMs` locks the subject for
 * `lockMs`; each further lock doubles, up to `maxLockMs`. A successful sign-in
 * clears it, and a subject left alone for a day starts again from the bottom.
 *
 * Timestamps are epoch milliseconds in integer columns — not TIMESTAMP — so
 * the arithmetic is the same on SQLite and MySQL.
 */
export type ThrottleKind = "password" | "totp" | "pin" | "lookup";

export type ThrottlePolicy = {
  readonly limit: number;
  readonly windowMs: number;
  readonly lockMs: number;
  readonly maxLockMs: number;
};

/** 10 failures in 15 minutes → locked 15 minutes, then 30, 60, … up to a day. */
export const ACCOUNT_LOCKOUT: ThrottlePolicy = {
  limit: 10,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
  maxLockMs: 24 * 3600_000,
};

/** A day without trouble resets the escalation level. */
const LEVEL_DECAY_MS = 24 * 3600_000;

export class AuthThrottle extends Model {
  static override readonly tableName = "auth_throttle";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["kind", "subject"],
    properties: {
      id: { type: "integer" },
      kind: { type: "string", minLength: 1, maxLength: 16 },
      subject: { type: "string", minLength: 1, maxLength: 80 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.string("kind", 16).notNullable();
    table.string("subject", 80).notNullable();
    table.integer("failures").notNullable().defaultTo(0);
    table.bigInteger("window_start").notNullable().defaultTo(0);
    table.bigInteger("locked_until").notNullable().defaultTo(0);
    table.integer("level").notNullable().defaultTo(0);
    table.unique(["kind", "subject"]);
    table.index(["window_start"]);
  }

  readonly id?: number;
  kind?: string;
  subject?: string;
  failures?: number;
  windowStart?: number | string;
  lockedUntil?: number | string;
  level?: number;

  /**
   * The subject for an email address. Hashed so the table is not a second
   * list of every address anybody ever typed into the sign-in form —
   * including the ones that have no account.
   */
  static forEmail(email: string): string {
    return (
      "e:" +
      createHash("sha256")
        .update(email.trim().toLowerCase())
        .digest("hex")
        .slice(0, 64)
    );
  }

  static forUser(userId: number): string {
    return `u:${userId}`;
  }

  /** Milliseconds of lock remaining, or 0 when the subject may try. */
  static async lockedFor(
    kind: ThrottleKind,
    subject: string,
    now: number = Date.now(),
  ): Promise<number> {
    const row = await AuthThrottle.query().findOne({ kind, subject });
    if (row == null) {
      return 0;
    }
    return Math.max(0, Number(row.lockedUntil ?? 0) - now);
  }

  /**
   * Counts one failure. Answers the lock now in force (ms), 0 if none —
   * so the failure that trips the lock can say so too.
   */
  static async recordFailure(
    kind: ThrottleKind,
    subject: string,
    policy: ThrottlePolicy = ACCOUNT_LOCKOUT,
    now: number = Date.now(),
  ): Promise<number> {
    if (Math.random() < 0.01) {
      void AuthThrottle.sweep(now).catch(() => {});
    }
    let row = await AuthThrottle.query().findOne({ kind, subject });
    if (row == null) {
      try {
        await AuthThrottle.query().insert({
          kind,
          subject,
          failures: 1,
          windowStart: now,
          lockedUntil: 0,
          level: 0,
        });
        return policy.limit <= 1
          ? await AuthThrottle.#lock(kind, subject, 0, policy, now)
          : 0;
      } catch {
        // Lost the race to insert: another request created it. Count on it.
        row = await AuthThrottle.query().findOne({ kind, subject });
        if (row == null) {
          return 0;
        }
      }
    }
    const lockedUntil = Number(row.lockedUntil ?? 0);
    if (lockedUntil > now) {
      // Failures while locked neither extend nor escalate the lock — or a
      // guesser could keep the owner out forever just by continuing.
      return lockedUntil - now;
    }
    let level = row.level ?? 0;
    if (lockedUntil > 0 && now - lockedUntil > LEVEL_DECAY_MS) {
      level = 0;
    }
    const windowStart = Number(row.windowStart ?? 0);
    let failures: number;
    if (now - windowStart > policy.windowMs) {
      await AuthThrottle.query()
        .findById(row.id!)
        .patch({ failures: 1, windowStart: now, level });
      failures = 1;
    } else {
      // Incremented in the database rather than read-modify-written, so a
      // burst of parallel guesses cannot all read the same count.
      await AuthThrottle.query().findById(row.id!).increment("failures", 1);
      const fresh = await AuthThrottle.query().findById(row.id!);
      failures = fresh?.failures ?? 1;
    }
    if (failures >= policy.limit) {
      return await AuthThrottle.#lock(kind, subject, level, policy, now);
    }
    return 0;
  }

  static async #lock(
    kind: ThrottleKind,
    subject: string,
    level: number,
    policy: ThrottlePolicy,
    now: number,
  ): Promise<number> {
    const ms = Math.min(policy.lockMs * 2 ** level, policy.maxLockMs);
    await AuthThrottle.query()
      .where({ kind, subject })
      .patch({
        failures: 0,
        windowStart: now,
        lockedUntil: now + ms,
        level: level + 1,
      });
    return ms;
  }

  /** A success: forget the failures and the escalation. */
  static async clear(kind: ThrottleKind, subject: string): Promise<void> {
    await AuthThrottle.query().delete().where({ kind, subject });
  }

  /** Rows nobody has touched in two days and that hold no live lock. */
  static async sweep(now: number = Date.now()): Promise<void> {
    await AuthThrottle.query()
      .delete()
      .where("windowStart", "<", now - 2 * LEVEL_DECAY_MS)
      .where("lockedUntil", "<", now);
  }
}

AuthThrottle.relationMappings = {};
