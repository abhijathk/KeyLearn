import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";

/** The four things a reset can clear, and what each one means. */
export type SecurityResetScope = {
  /** Send a link to set a new password — the way back in for an SSO-only account. */
  readonly password: boolean;
  /** Turn two-step verification off, secret and all. */
  readonly twoFactor: boolean;
  /** Void the printed recovery codes without touching two-step itself. */
  readonly recoveryCodes: boolean;
  /** Clear the grown-up PIN. */
  readonly parentPin: boolean;
};

export const EMPTY_SCOPE: SecurityResetScope = {
  password: false,
  twoFactor: false,
  recoveryCodes: false,
  parentPin: false,
};

/**
 * A security reset that has been asked for and not yet confirmed.
 *
 * The row exists to bind the emailed code to *what it was asked to do*.
 * Without it, the code would authorise the purpose rather than the
 * request: somebody could ask to clear a forgotten PIN, receive a code
 * for that, and then spend it turning two-step verification off. The
 * choice is made first, recorded here, and the code that arrives can only
 * ever perform this row.
 *
 * One pending request per account — asking again replaces the previous
 * one, exactly as issuing a new code replaces the previous code.
 */
export class SecurityReset extends Model {
  static override readonly tableName = "security_reset";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override readonly idColumn = "userId";
  static override jsonSchema = {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "integer" },
      password: { type: "boolean" },
      twoFactor: { type: "boolean" },
      recoveryCodes: { type: "boolean" },
      parentPin: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.integer("user_id").unsigned().primary();
    table.boolean("password").notNullable().defaultTo(false);
    table.boolean("two_factor").notNullable().defaultTo(false);
    table.boolean("recovery_codes").notNullable().defaultTo(false);
    table.boolean("parent_pin").notNullable().defaultTo(false);
    table.timestamp("asked_at").notNullable().defaultTo(knex.fn.now());
  }

  /**
   * Matched to the life of the code it is paired with. A request that
   * outlived its code would sit there waiting for the next one — which is
   * how a stale selection gets performed by a code asked for later.
   */
  static readonly expireTime = 15 * 60 * 1000;

  userId?: number;
  password?: number | boolean;
  twoFactor?: number | boolean;
  recoveryCodes?: number | boolean;
  parentPin?: number | boolean;
  askedAt?: Date;

  /** What this row asks for, as booleans whatever the driver returned. */
  scope(): SecurityResetScope {
    return {
      password: Boolean(this.password),
      twoFactor: Boolean(this.twoFactor),
      recoveryCodes: Boolean(this.recoveryCodes),
      parentPin: Boolean(this.parentPin),
    };
  }

  /** Records the choice, replacing whatever was pending before. */
  static async ask(
    userId: number,
    scope: SecurityResetScope,
  ): Promise<SecurityReset> {
    // Delete-then-insert for the same reason as SupportPinProof: one row
    // per key, and no upsert that works on both sqlite and MySQL.
    await SecurityReset.query().deleteById(userId);
    return await SecurityReset.query().insertAndFetch({
      userId,
      password: scope.password,
      twoFactor: scope.twoFactor,
      recoveryCodes: scope.recoveryCodes,
      parentPin: scope.parentPin,
      askedAt: new Date(),
    });
  }

  /** The pending request, or null if there is none or it has expired. */
  static async pendingFor(userId: number): Promise<SecurityReset | null> {
    const row = await SecurityReset.query().findById(userId);
    if (row == null) {
      return null;
    }
    if (
      Date.now() - Number(new Date(row.askedAt!)) >
      SecurityReset.expireTime
    ) {
      return null;
    }
    return row;
  }

  static async clear(userId: number): Promise<void> {
    await SecurityReset.query().deleteById(userId);
  }

  /** Anything past its life, swept on the way past. */
  static async sweep(): Promise<void> {
    await SecurityReset.query()
      .delete()
      .where("askedAt", "<", new Date(Date.now() - SecurityReset.expireTime));
  }
}

SecurityReset.relationMappings = {};
