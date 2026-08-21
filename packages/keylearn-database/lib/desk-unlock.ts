import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";
import { hashPassword, verifyPassword } from "./password.ts";

/**
 * The failsafe passcode for unlocking Tab &amp; automation, and the record of
 * everything that has tried it.
 *
 * The primary way in is a passkey. This exists for the case the passkey
 * cannot be used — a lost or forgotten device, an admin on someone else's
 * machine — because the thing being guarded is the switch that stops every
 * customer being answered, and a support desk that cannot reach its own
 * kill switch in an emergency has been made worse, not safer.
 *
 * Stored as a scrypt hash rather than in the environment, and this differs
 * from how the app's other secrets are held for a specific reason: those
 * are long random strings, and a passcode is six digits. Six digits is a
 * million possibilities, which is nothing offline — so it must never be
 * recoverable from a leaked database or backup, and the only defence that
 * survives leaking is that there is nothing there to reverse. Online it is
 * defended separately, by the lockout below.
 *
 * One row, id 1, for the same reason {@link AgentStatus} is: several worker
 * processes serve requests, and a failure counter kept in memory would let
 * an attacker have N times as many guesses by being spread across workers.
 */
export class DeskUnlock extends TimestampMixin(Model) {
  static override readonly tableName = "desk_unlock";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "integer" },
      passcodeHash: { type: ["string", "null"], maxLength: 255 },
      failedCount: { type: "integer" },
      lastFailureIp: { type: ["string", "null"], maxLength: 45 },
      // Date columns stay out of jsonSchema — see the note in Staff.
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.integer("id").primary();
    table.string("passcode_hash", 255).nullable();
    table.integer("failed_count").unsigned().notNullable().defaultTo(0);
    table.timestamp("locked_until").nullable();
    table.timestamp("last_failure_at").nullable();
    table.string("last_failure_ip", 45).nullable();
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  passcodeHash?: string | null;
  failedCount?: number;
  lockedUntil?: Date | null;
  lastFailureAt?: Date | null;
  lastFailureIp?: string | null;
  createdAt?: Date;
  updatedAt?: Date;

  /** Wrong guesses tolerated before the passcode stops answering at all. */
  static readonly MAX_FAILURES = 5;

  /**
   * How long the passcode is refused for, by how many times it has already
   * been locked. Doubling, and then flat — an attacker gets a handful of
   * guesses a day, while an admin who has genuinely fat-fingered it twice
   * is not shut out for the rest of the afternoon.
   */
  static lockoutMs(lockNumber: number): number {
    const minutes = [15, 30, 60][Math.min(lockNumber, 2)]!;
    return minutes * 60_000;
  }

  static async current(): Promise<DeskUnlock> {
    const existing = await DeskUnlock.query().findById(1);
    if (existing != null) {
      return existing;
    }
    return await DeskUnlock.query().insertAndFetch({
      id: 1,
      passcodeHash: null,
      failedCount: 0,
      lastFailureIp: null,
    });
  }

  static async setPasscode(passcode: string): Promise<void> {
    const row = await DeskUnlock.current();
    await row.$query().patch({
      passcodeHash: await hashPassword(passcode),
      failedCount: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    });
  }

  static async hasPasscode(): Promise<boolean> {
    return (await DeskUnlock.current()).passcodeHash != null;
  }

  /**
   * Takes the passcode from `ADMIN_UNLOCK_PASSCODE` the first time, so a
   * fresh deployment has a working failsafe before anyone has signed in to
   * set one.
   *
   * Only ever runs when no passcode is stored. It must not re-apply on
   * later boots: an admin who changes the passcode in the app, while a
   * stale env var lingers on the server, would otherwise have it silently
   * reverted to the old value at the next restart.
   */
  static async bootstrap(fromEnv: string): Promise<boolean> {
    if (fromEnv.trim() === "" || (await DeskUnlock.hasPasscode())) {
      return false;
    }
    await DeskUnlock.setPasscode(fromEnv.trim());
    return true;
  }
}

export type UnlockResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "no-passcode" }
  | { readonly ok: false; readonly reason: "locked"; readonly until: Date }
  | {
      readonly ok: false;
      readonly reason: "wrong";
      readonly remaining: number;
    };

/**
 * Checks a passcode, counting the failure if it is wrong.
 *
 * Deliberately not applied to the passkey path. A passkey is a
 * cryptographic challenge — a wrong answer carries no information and
 * cannot be ground down by repetition — so counting its failures would buy
 * nothing, and locking on them would hand anyone who can reach the sign-in
 * page a way to disable the admin's access to the kill switch by failing
 * five times on purpose. Rate-limit what is guessable; leave alone what is
 * not.
 */
export async function checkUnlockPasscode(
  passcode: string,
  ip: string | null,
  now: Date = new Date(),
): Promise<UnlockResult> {
  const row = await DeskUnlock.current();
  if (row.passcodeHash == null) {
    return { ok: false, reason: "no-passcode" };
  }
  if (row.lockedUntil != null && row.lockedUntil.getTime() > now.getTime()) {
    return { ok: false, reason: "locked", until: row.lockedUntil };
  }

  if (await verifyPassword(passcode, row.passcodeHash)) {
    // A success clears the count, so a day of ordinary use never accumulates
    // its way into a lockout.
    await row.$query().patch({
      failedCount: 0,
      lockedUntil: null,
      updatedAt: now,
    });
    return { ok: true };
  }

  const failed = (row.failedCount ?? 0) + 1;
  if (failed >= DeskUnlock.MAX_FAILURES) {
    // How many times this has already happened decides how long the next one
    // lasts. Derived from the total rather than stored separately so it
    // cannot be reset by a lucky guess between attacks.
    const lockNumber = Math.floor(failed / DeskUnlock.MAX_FAILURES) - 1;
    const until = new Date(now.getTime() + DeskUnlock.lockoutMs(lockNumber));
    await row.$query().patch({
      failedCount: failed,
      lockedUntil: until,
      lastFailureAt: now,
      lastFailureIp: ip,
      updatedAt: now,
    });
    return { ok: false, reason: "locked", until };
  }

  await row.$query().patch({
    failedCount: failed,
    lastFailureAt: now,
    lastFailureIp: ip,
    updatedAt: now,
  });
  return {
    ok: false,
    reason: "wrong",
    remaining: DeskUnlock.MAX_FAILURES - failed,
  };
}

DeskUnlock.relationMappings = {};
