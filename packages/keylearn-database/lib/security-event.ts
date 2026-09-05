import { type SecurityEventDetails } from "@keylearn/pages-shared";
import { siteNumber } from "@keylearn/site-config";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";
import { Notification } from "./notification.ts";

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
  /**
   * The changes worth interrupting somebody for, and what to call them.
   *
   * The "was this you?" set: every one of these is something only the
   * account holder should be able to do, and every one of them is what an
   * attacker does first after getting in — change the password so the owner
   * cannot, move the address so the reset goes elsewhere, add a passkey to
   * keep the door open, turn off the second factor that would have stopped
   * any of it.
   *
   * Deliberately NOT here: `login`, which happens constantly and would
   * train people to ignore the bell — the exact outcome that makes the
   * alerts above worthless. `login-failed` for the same reason, plus it is
   * the one an attacker can trigger at will to bury a real alert under
   * noise. Both stay in the security log, where somebody investigating will
   * find them.
   */
  static readonly ALERTABLE: Readonly<
    Partial<Record<SecurityEventType, string>>
  > = {
    "password-changed": "Your password was changed.",
    "password-reset": "Your password was reset.",
    "email-changed": "The email address on this account was changed.",
    "email-change-requested":
      "Somebody asked to change the email address on this account.",
    "passkey-added": "A new passkey was added to this account.",
    "passkey-removed": "A passkey was removed from this account.",
    "two-factor-enabled": "Two-step verification was turned on.",
    "two-factor-disabled": "Two-step verification was turned off.",
    "sso-linked": "A sign-in service was linked to this account.",
    "signed-out-everywhere": "This account was signed out on every device.",
    "security-reset": "This account's security settings were reset.",
    "parent-pin-set": "The grown-up PIN on this account was changed.",
  };

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
      await SecurityEvent.#alert(userId, type);
    } catch {
      // Deliberately swallowed — see above.
    }
  }

  /**
   * Raise the bell for a change the owner needs to have noticed.
   *
   * Here rather than at each call site because there are a dozen of those
   * and they are added to: a security act that forgets to announce itself is
   * indistinguishable from one nobody performed. Recording the event is the
   * one thing every such act already does, so it is the one place this
   * cannot be forgotten.
   *
   * Its own try/catch inside the caller's: a failed notification must not
   * cost the audit row, which is the record of last resort.
   */
  static async #alert(
    userId: number | null,
    type: SecurityEventType,
  ): Promise<void> {
    const body = SecurityEvent.ALERTABLE[type];
    if (userId == null || body == null) {
      return;
    }
    try {
      await Notification.create({
        userId,
        kind: "security-alert",
        ticketId: null,
        body: `${body} If that was not you, change your password and contact support.`,
        authorName: null,
        fromAssistant: false,
      });
    } catch {
      // Best-effort, like every other notification.
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
