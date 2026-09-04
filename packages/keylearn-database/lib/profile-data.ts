import { createHash } from "node:crypto";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";

/**
 * Which file a row holds. One row per (account, learner, kind).
 *
 * `results` and `classic` are practice history, `braille` is braille progress,
 * `a11y` is the accessibility preferences, and `local` is the mirror of the
 * learner's browser storage — the accent, the theme, the kids world, and the
 * rest of what the app keeps on the device.
 *
 * The last two were added on 4 Sep 2026. Until then they were the only learner
 * state with no copy in the database at all: not a stale one, none. A lost disk
 * took every household's accessibility settings with it, which for the learners
 * who need them is the difference between the app being usable and not.
 */
export type ProfileDataKind =
  | "results"
  | "braille"
  | "classic"
  | "a11y"
  | "local";

/**
 * A durable copy of a learner's data file.
 *
 * The files under `DATA_DIR` remain the working copy — they are appended to on
 * every completed lesson and served back verbatim, and nothing here changes that
 * path. What they are not is durable: they live on one machine's disk, and a
 * host that is lost, replaced or resized takes every learner's history with it.
 * The database is backed up; the disk may not be.
 *
 * So this is a periodic snapshot, not a second source of truth. `digest` exists
 * so that a sweep over thousands of unchanged files costs one hash each and no
 * writes at all — most learners do not practise most days.
 */
export class ProfileData extends Model {
  static override readonly tableName = "profile_data";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["userId", "kind", "digest"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      // Null for the account-level history, which belongs to no learner.
      profileId: { type: ["null", "integer"] },
      kind: { type: "string", minLength: 1, maxLength: 16 },
      digest: { type: "string", minLength: 64, maxLength: 64 },
      bytes: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.integer("profile_id").unsigned().nullable();
    table.string("kind", 16).notNullable();
    // The file verbatim. `binary` maps to LONGBLOB on MySQL and BLOB on SQLite.
    table.binary("payload").nullable();
    table.string("digest", 64).notNullable();
    table.integer("bytes").notNullable().defaultTo(0);
    table.timestamp("synced_at").notNullable().defaultTo(knex.fn.now());
    // One row per file. MySQL treats NULLs as distinct in a unique index, so
    // the account-level row (profile_id IS NULL) is matched on explicitly in
    // `store` rather than relying on this to collapse duplicates.
    table.unique(["user_id", "profile_id", "kind"]);
    table
      .foreign("user_id")
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
  }

  readonly id?: number;
  userId?: number;
  profileId?: number | null;
  kind?: ProfileDataKind;
  payload?: Buffer | null;
  digest?: string;
  bytes?: number;
  syncedAt?: Date;

  static digestOf(payload: Buffer): string {
    return createHash("sha256").update(payload).digest("hex");
  }

  /** The digest already stored, or null when this file has never been synced. */
  static async digestFor(
    userId: number,
    profileId: number | null,
    kind: ProfileDataKind,
  ): Promise<string | null> {
    const row = await ProfileData.query()
      .select("digest")
      .where("userId", userId)
      .where("kind", kind)
      .where((q) =>
        profileId == null
          ? q.whereNull("profileId")
          : q.where("profileId", profileId),
      )
      .first();
    return row?.digest ?? null;
  }

  /**
   * Write the snapshot, unless an identical one is already stored.
   *
   * Returns whether anything was written, so a sweep can report how much it
   * actually did rather than how much it looked at.
   */
  static async store(
    userId: number,
    profileId: number | null,
    kind: ProfileDataKind,
    payload: Buffer,
  ): Promise<boolean> {
    const digest = ProfileData.digestOf(payload);
    const existing = await ProfileData.digestFor(userId, profileId, kind);
    if (existing === digest) {
      return false;
    }
    const patch = {
      payload,
      digest,
      bytes: payload.length,
      syncedAt: new Date(),
    };
    if (existing == null) {
      await ProfileData.query().insert({ userId, profileId, kind, ...patch });
    } else {
      await ProfileData.query()
        .patch(patch)
        .where("userId", userId)
        .where("kind", kind)
        .where((q) =>
          profileId == null
            ? q.whereNull("profileId")
            : q.where("profileId", profileId),
        );
    }
    return true;
  }

  /** Every snapshot for an account — used to restore a lost disk. */
  static async listForUser(userId: number): Promise<ProfileData[]> {
    return await ProfileData.query().where("userId", userId).orderBy("id");
  }

  /**
   * Forget an account's snapshots.
   *
   * Deleting the account cascades, but a learner deleted on their own, or a
   * cleared history, has to be erased here too — otherwise "delete my data"
   * would leave a copy behind in the very place that is backed up.
   */
  static async deleteFor(
    userId: number,
    profileId: number | null,
    // Omitted when the learner themselves is going, which takes everything.
    // Named when only one kind is being cleared — erasing a braille snapshot
    // because someone cleared their typing history would lose data they never
    // asked to lose.
    kind?: ProfileDataKind,
  ): Promise<void> {
    const query = ProfileData.query()
      .delete()
      .where("userId", userId)
      .where((q) =>
        profileId == null
          ? q.whereNull("profileId")
          : q.where("profileId", profileId),
      );
    if (kind != null) {
      query.where("kind", kind);
    }
    await query;
  }
}
