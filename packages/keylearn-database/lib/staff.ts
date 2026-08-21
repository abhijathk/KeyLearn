import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * Who is allowed into the support desk.
 *
 * This used to be the `STAFF_EMAILS` environment variable, and that had a
 * property worth naming before giving it up: granting access was a deploy,
 * so a stolen session could not promote a second account. Moving the list
 * into the database trades that for being able to add a colleague without
 * shipping a release.
 *
 * The trade is only defensible because of what is NOT in this table:
 * **there is no role column, and no row here can make anyone an admin.**
 * Admin is `ADMIN_EMAIL` in the environment and nothing else, so the
 * escalation path the env allowlist was protecting — a compromised session
 * granting itself more power — still does not exist. A stolen staff
 * session can reach the desk; it cannot promote anyone, because the only
 * account that may add staff is one this table cannot name.
 *
 * Keyed by email rather than by user id because an address is allowlisted
 * before its owner has signed up — the person is told "you're on the desk
 * now, go and register", and the row has to exist first. A `user.staff`
 * column could not express that, which is why the vestigial one on `user`
 * was never wired up.
 *
 * Removal is a timestamp, not a DELETE: the audit log refers to people by
 * the account that acted, and a former staff member's entries must keep
 * resolving to a real row after they have gone.
 */
export class Staff extends TimestampMixin(Model) {
  static override readonly tableName = "staff";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["email"],
    properties: {
      id: { type: "integer" },
      email: { type: "string", maxLength: 320 },
      addedByUserId: { type: ["integer", "null"] },
      // `disabledAt` is deliberately absent — see the note in AgentStatus and
      // the rest of this package: declaring a Date column here makes Objection
      // serialise it before it reaches the driver, which MySQL then rejects
      // with ER_TRUNCATED_WRONG_VALUE. SQLite accepts it, so the bug only
      // shows up in production.
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id");
    // Stored lower-cased by every writer here, so the unique index is a real
    // constraint and not one that "Sam@..." can walk straight past.
    table.string("email", 320).notNullable().unique();
    table.integer("added_by_user_id").unsigned().nullable();
    table.timestamp("disabled_at").nullable();
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  email?: string;
  addedByUserId?: number | null;
  disabledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  /** Every address currently allowed in — the set the sync cache is built from. */
  static async activeEmails(): Promise<readonly string[]> {
    const rows = await Staff.query().whereNull("disabled_at").select("email");
    return rows.map((row) => row.email!);
  }

  /** Including the removed, for the management screen's history. */
  static async listAll(): Promise<readonly Staff[]> {
    return await Staff.query().orderBy("email");
  }

  /**
   * Adds an address, or reinstates one that was removed.
   *
   * Reinstating rather than inserting a second row is what keeps the unique
   * index usable: "remove Sam, then add Sam again" is an ordinary thing to
   * do, and it must not fail on a constraint or leave two rows disagreeing
   * about whether Sam is staff.
   */
  static async add(
    email: string,
    addedByUserId: number | null,
  ): Promise<Staff> {
    const normalised = email.trim().toLowerCase();
    const existing = await Staff.query().findOne({ email: normalised });
    if (existing != null) {
      return await existing.$query().patchAndFetch({
        disabledAt: null,
        addedByUserId,
        updatedAt: new Date(),
      });
    }
    return await Staff.query().insertAndFetch({
      email: normalised,
      addedByUserId,
      disabledAt: null,
    });
  }

  /** Soft-removes an address. Returns false if it was not on the list. */
  static async remove(email: string): Promise<boolean> {
    const normalised = email.trim().toLowerCase();
    const existing = await Staff.query().findOne({ email: normalised });
    if (existing == null || existing.disabledAt != null) {
      return false;
    }
    await existing.$query().patch({
      disabledAt: new Date(),
      updatedAt: new Date(),
    });
    return true;
  }

  /**
   * Copies `STAFF_EMAILS` in the first time the table exists, so upgrading
   * does not lock the current desk out of its own app.
   *
   * Only ever called from the branch of `createSchema` that just created the
   * table. Seeding on "the table is empty" instead would be a live security
   * hole rather than a convenience: an admin who removes every other staff
   * member would find them all restored by the next restart.
   */
  static async seed(emails: readonly string[]): Promise<number> {
    let added = 0;
    for (const email of emails) {
      const normalised = email.trim().toLowerCase();
      if (normalised === "") {
        continue;
      }
      await Staff.query().insert({
        email: normalised,
        addedByUserId: null,
        disabledAt: null,
      });
      added++;
    }
    return added;
  }
}

Staff.relationMappings = {};
