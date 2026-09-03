import { type SecurityEventDetails } from "@keylearn/pages-shared";
import { siteNumber } from "@keylearn/site-config";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * Things worth telling an account owner about after the fact.
 *
 * The list is deliberately about *account control* rather than ordinary use: a
 * parent should be able to answer "did someone else get into this account, and
 * what did they change?" without wading through practice activity.
 */
export type SecurityEventType =
  | "login"
  | "login-failed"
  | "logout"
  | "password-changed"
  | "password-reset"
  | "email-change-requested"
  | "email-changed"
  | "passkey-added"
  | "passkey-removed"
  | "sso-linked"
  | "sso-link-refused"
  | "signed-out-everywhere"
  | "two-factor-enabled"
  | "two-factor-disabled"
  | "parent-pin-set"
  | "security-reset"
  | "profile-deleted"
  | "account-delete-failed"
  | "account-deleted"
  // The organisation tier: learner-PIN acts are security acts (A7/A8 —
  // the events name outcomes, never the PIN itself).
  | "learner-pin-set"
  | "learner-pin-cleared"
  | "learner-pin-unlocked"
  | "learner-pin-locked";

/**
 * An append-only record of security-relevant account activity.
 *
 * Its purpose is detection, not prevention: an account takeover that leaves no
 * trace is one nobody can notice or reconstruct afterwards. Rows are written
 * best-effort — recording must never be able to fail the action it describes.
 */
export class SecurityEvent extends TimestampMixin(Model) {
  static override readonly tableName = "security_event";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["type"],
    properties: {
      id: { type: "integer" },
      userId: { type: ["integer", "null"] },
      type: { type: "string", minLength: 1, maxLength: 32 },
      ip: { type: ["string", "null"], maxLength: 64 },
      userAgent: { type: ["string", "null"], maxLength: 256 },
      detail: { type: ["string", "null"], maxLength: 256 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { type, ip, userAgent, detail } = SecurityEvent.jsonSchema.properties;
    table.increments("id").primary();
    // Nullable and NOT a foreign key: a failed sign-in has no account yet, and
    // the trail of a deleted account should not vanish with it.
    table.integer("user_id").unsigned().nullable().index();
    table.string("type", type.maxLength).notNullable();
    table.string("ip", ip.maxLength).nullable();
    table.string("user_agent", userAgent.maxLength).nullable();
    table.string("detail", detail.maxLength).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "created_at"]);
  }

  /**
   * How long an entry is kept.
   *
   * The log exists so an owner can notice and reconstruct a compromise, and that
   * is a question about the recent past. Keeping it indefinitely would turn a
   * security feature into a standing record of when a household signs in and
   * from where — which is precisely the sort of thing that should not accumulate
   * on an app used by children.
   */
  /** Shipped value; the control centre can tighten it (retention.securityEventDays). */
  static readonly defaultRetentionDays = 30;

  static get retentionMs(): number {
    return siteNumber("retention.securityEventDays") * 24 * 3600 * 1000;
  }

  /** A secondary cap, so one noisy account cannot fill the table. */
  static readonly keepPerUser = 200;

  readonly id?: number;
  userId?: number | null;
  type?: string;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
  createdAt?: Date;

  /**
   * Records an event. Never throws: an audit write must not be able to turn a
   * successful password change into a failed request.
   */
  static async record({
    userId = null,
    type,
    ip = null,
    userAgent = null,
    detail = null,
  }: {
    readonly userId?: number | null;
    readonly type: SecurityEventType;
    readonly ip?: string | null;
    readonly userAgent?: string | null;
    readonly detail?: string | null;
  }): Promise<void> {
    try {
      await SecurityEvent.query().insert({
        userId,
        type,
        ip: truncate(ip, 64),
        userAgent: truncate(userAgent, 256),
        detail: truncate(detail, 256),
      });
      await SecurityEvent.#pruneOccasionally();
    } catch {
      // Deliberately swallowed — see above.
    }
  }

  // Pruning on every write would put a DELETE on the sign-in path for no gain;
  // the cutoff moves by the minute, not the millisecond.
  static #lastPrune = 0;
  static readonly pruneEveryMs = 10 * 60 * 1000;

  static async #pruneOccasionally(): Promise<void> {
    const now = Date.now();
    if (now - SecurityEvent.#lastPrune < SecurityEvent.pruneEveryMs) {
      return;
    }
    SecurityEvent.#lastPrune = now;
    await SecurityEvent.deleteExpired(now);
  }

  /** Drops entries past the retention window. */
  static async deleteExpired(now: number = Date.now()): Promise<void> {
    await SecurityEvent.query()
      .where("createdAt", "<", new Date(now - SecurityEvent.retentionMs))
      .delete();
  }

  static async listForUser(
    userId: number,
    limit = 50,
  ): Promise<SecurityEvent[]> {
    // Bounded by the same window the rows are kept for, so a reader never sees
    // an entry that is only still present because the sweep has not run.
    const cutoff = new Date(Date.now() - SecurityEvent.retentionMs);
    return await SecurityEvent.query()
      .where("userId", userId)
      .where("createdAt", ">=", cutoff)
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(Math.min(Math.max(limit, 1), SecurityEvent.keepPerUser));
  }

  /**
   * The most recent event of a given type for a user, e.g. their last
   * login — the staff roster's "signed in Nh ago". Same retention window as
   * {@link listForUser}: an event past the window is treated as gone, not
   * stale.
   */
  static async lastOfType(
    userId: number,
    type: SecurityEventType,
  ): Promise<SecurityEvent | null> {
    const cutoff = new Date(Date.now() - SecurityEvent.retentionMs);
    return (
      (await SecurityEvent.query()
        .where("userId", userId)
        .where("type", type)
        .where("createdAt", ">=", cutoff)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .first()) ?? null
    );
  }

  /** Drops an account's trail. Called when the account itself is erased. */
  static async deleteForUser(userId: number): Promise<void> {
    await SecurityEvent.query().where("userId", userId).delete();
  }

  toDetails(): SecurityEventDetails {
    return {
      id: this.id!,
      type: this.type!,
      ip: this.ip ?? null,
      userAgent: this.userAgent ?? null,
      detail: this.detail ?? null,
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

SecurityEvent.relationMappings = {};

function truncate(value: string | null, max: number): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}
