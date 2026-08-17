import { type NoticeDetails, type NoticeKind } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

export type NoticeLevel = "info" | "warning";
export type NoticeDisplay = "banner" | "window";

export class Notice extends TimestampMixin(Model) {
  static override readonly tableName = "notice";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["message", "level"],
    properties: {
      id: { type: "integer" },
      message: { type: "string", minLength: 1, maxLength: 280 },
      // Kept for old rows; new code reads/writes `kind` instead.
      level: { type: "string", enum: ["info", "warning"] },
      kind: { type: "string", enum: ["incident", "maintenance", "feature"] },
      // The thin top-of-page strip by default; "window" is the rare, blocking
      // exception for a message someone actually needs to stop and read.
      display: { type: "string", enum: ["banner", "window"] },
      active: { type: "boolean" },
      // "everyone" | "signed-in" | "kids" | a locale code.
      audience: { type: "string", minLength: 1, maxLength: 16 },
      dismissible: { type: "boolean" },
      createdBy: { type: ["integer", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { message } = Notice.jsonSchema.properties;
    table.increments("id").primary();
    table.string("message", message.maxLength).notNullable();
    table.string("level", 16).notNullable().defaultTo("info");
    // What kind of announcement this is — drives the icon/tone in the UI.
    // `level` stays for backward compatibility; new code reads `kind`.
    table.string("kind", 16).notNullable().defaultTo("feature");
    table.string("display", 16).notNullable().defaultTo("banner");
    table.boolean("active").notNullable().defaultTo(true);
    // Null startsAt means "live now"; null endsAt means "no scheduled end".
    table.timestamp("starts_at").nullable();
    table.timestamp("ends_at").nullable();
    table.string("audience", 16).notNullable().defaultTo("everyone");
    table.boolean("dismissible").notNullable().defaultTo(true);
    table.integer("created_by").unsigned().nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["active", "created_at"]);
  }

  readonly id?: number;
  message?: string;
  level?: NoticeLevel;
  kind?: NoticeKind;
  display?: NoticeDisplay;
  active?: number | boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  audience?: string;
  dismissible?: number | boolean;
  createdBy?: number | null;
  createdAt?: Date;

  static async create({
    message,
    level,
    kind = "feature",
    display = "banner",
    startsAt = null,
    endsAt = null,
    audience = "everyone",
    dismissible = true,
    createdBy,
  }: {
    readonly message: string;
    /** Rarely set explicitly — derived from `kind` below when omitted, since `kind` is what the UI actually reads now. */
    readonly level?: NoticeLevel;
    readonly kind?: NoticeKind;
    readonly display?: NoticeDisplay;
    readonly startsAt?: Date | null;
    readonly endsAt?: Date | null;
    readonly audience?: string;
    readonly dismissible?: boolean;
    readonly createdBy: number;
  }): Promise<Notice> {
    // Earlier this deactivated every other active notice first, on the
    // assumption that only one banner could show at a time. That assumption
    // no longer holds — an incident, a maintenance window and a feature
    // announcement can all be live together (see activeNotices) — so
    // creating one no longer touches any other row.
    return await Notice.query().insertAndFetch({
      message,
      level: level ?? (kind === "incident" ? "warning" : "info"),
      kind,
      display,
      active: true,
      startsAt,
      endsAt,
      audience,
      dismissible,
      createdBy,
    });
  }

  /**
   * Every notice currently live: active, within its scheduled window, and
   * matching the audience (`"everyone"` always matches). Replaces the old
   * single-notice `activeNotice()` — the mock shows several stacked at once
   * (an incident, a maintenance window and a feature announcement together),
   * so this reads as a list rather than "the latest one".
   */
  static async activeNotices(audience?: string): Promise<Notice[]> {
    const now = new Date();
    let query = Notice.query()
      .where("active", true)
      .where((q) => q.whereNull("startsAt").orWhere("startsAt", "<=", now))
      .where((q) => q.whereNull("endsAt").orWhere("endsAt", ">=", now));
    if (audience != null) {
      query = query.where((q) =>
        q.where("audience", "everyone").orWhere("audience", audience),
      );
    }
    return await query.orderBy("createdAt", "desc");
  }

  /**
   * Flips a notice's active flag directly — no longer deactivates every
   * other row when turning one on, since more than one may be live together.
   */
  static async setActive(id: number, active: boolean): Promise<void> {
    await Notice.query().findById(id).patch({ active });
  }

  /** Permanently removes a notice row — distinct from retracting it, which just clears `active`. */
  static async delete(id: number): Promise<boolean> {
    return (await Notice.query().deleteById(id)) > 0;
  }

  /** Edits a notice's fields in place — a PATCH-style partial update. */
  static async update(
    id: number,
    patch: {
      readonly message?: string;
      readonly level?: NoticeLevel;
      readonly kind?: NoticeKind;
      readonly display?: NoticeDisplay;
      readonly startsAt?: Date | null;
      readonly endsAt?: Date | null;
      readonly audience?: string;
      readonly dismissible?: boolean;
    },
  ): Promise<Notice | null> {
    return (await Notice.query().patchAndFetchById(id, patch)) ?? null;
  }

  toDetails(): NoticeDetails {
    return {
      id: this.id!,
      message: this.message!,
      level: this.level!,
      kind: this.kind ?? "feature",
      display: this.display ?? "banner",
      startsAt:
        this.startsAt != null ? new Date(this.startsAt).toISOString() : null,
      endsAt: this.endsAt != null ? new Date(this.endsAt).toISOString() : null,
      audience: this.audience ?? "everyone",
      dismissible: this.dismissible == null ? true : Boolean(this.dismissible),
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

Notice.relationMappings = {};
