import { type StaffSettingsDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * One row per staff member's own desk preferences.
 *
 * `userId` is deliberately not a foreign key: staff membership itself is
 * decided by the `STAFF_EMAILS` env allowlist rather than a DB column (see
 * the staff-access rewrite), so this table should not hard-reference a
 * concept that is no longer DB-authoritative. A row is created lazily on
 * first save — {@link getForUser} hands back usable defaults rather than
 * requiring one to exist first.
 */
export class StaffSettings extends TimestampMixin(Model) {
  static override readonly tableName = "staff_settings";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["userId"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      signature: { type: ["string", "null"], maxLength: 500 },
      notifyNew: { type: "boolean" },
      // "HH:MM", 24-hour — plain 5-character strings rather than a SQL time
      // column, so both database engines this app supports agree on it.
      quietFrom: { type: ["string", "null"], minLength: 5, maxLength: 5 },
      quietTo: { type: ["string", "null"], minLength: 5, maxLength: 5 },
      confidenceThreshold: { type: "integer" },
      overdueHours: { type: "integer" },
      requireRevealReason: { type: "boolean" },
      showLastLoginLocation: { type: "boolean" },
      compactDensity: { type: "boolean" },
      relativeTimestamps: { type: "boolean" },
      showCountryFlag: { type: "boolean" },
      desktopPush: { type: "boolean" },
      soundAlert: { type: "boolean" },
      escalationOnly: { type: "boolean" },
      defaultLandingPage: { type: "string", enum: ["dashboard", "inbox"] },
      secondReopenAutoFlag: { type: "boolean" },
      autoCloseIdleDays: { type: "integer" },
      sentimentSensitivity: {
        type: "string",
        enum: ["mild", "moderate", "strict"],
      },
    },
  } satisfies JSONSchema;

  static readonly defaultConfidenceThreshold = 85;
  static readonly defaultOverdueHours = 48;
  static readonly defaultAutoCloseIdleDays = 0;
  static readonly defaultSentimentSensitivity = "moderate" as const;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().unique();
    table.string("signature", 500).nullable();
    table.boolean("notify_new").notNullable().defaultTo(true);
    table.string("quiet_from", 5).nullable();
    table.string("quiet_to", 5).nullable();
    table.date("away_until").nullable();
    table
      .integer("confidence_threshold")
      .unsigned()
      .notNullable()
      .defaultTo(StaffSettings.defaultConfidenceThreshold);
    table
      .integer("overdue_hours")
      .unsigned()
      .notNullable()
      .defaultTo(StaffSettings.defaultOverdueHours);
    table.boolean("require_reveal_reason").notNullable().defaultTo(true);
    table.boolean("show_last_login_location").notNullable().defaultTo(true);
    table.boolean("compact_density").notNullable().defaultTo(false);
    table.boolean("relative_timestamps").notNullable().defaultTo(false);
    table.boolean("show_country_flag").notNullable().defaultTo(false);
    table.boolean("desktop_push").notNullable().defaultTo(false);
    table.boolean("sound_alert").notNullable().defaultTo(false);
    table.boolean("escalation_only").notNullable().defaultTo(false);
    table
      .string("default_landing_page", 16)
      .notNullable()
      .defaultTo("dashboard");
    table.boolean("second_reopen_auto_flag").notNullable().defaultTo(false);
    table
      .integer("auto_close_idle_days")
      .unsigned()
      .notNullable()
      .defaultTo(StaffSettings.defaultAutoCloseIdleDays);
    table
      .string("sentiment_sensitivity", 16)
      .notNullable()
      .defaultTo(StaffSettings.defaultSentimentSensitivity);
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  userId?: number;
  signature?: string | null;
  notifyNew?: number | boolean;
  quietFrom?: string | null;
  quietTo?: string | null;
  awayUntil?: string | null;
  confidenceThreshold?: number;
  overdueHours?: number;
  requireRevealReason?: number | boolean;
  showLastLoginLocation?: number | boolean;
  compactDensity?: number | boolean;
  relativeTimestamps?: number | boolean;
  showCountryFlag?: number | boolean;
  desktopPush?: number | boolean;
  soundAlert?: number | boolean;
  escalationOnly?: number | boolean;
  defaultLandingPage?: "dashboard" | "inbox";
  secondReopenAutoFlag?: number | boolean;
  autoCloseIdleDays?: number;
  sentimentSensitivity?: "mild" | "moderate" | "strict";
  createdAt?: Date;
  updatedAt?: Date;

  static readonly #newRowDefaults = {
    notifyNew: true,
    quietFrom: null,
    quietTo: null,
    awayUntil: null,
    confidenceThreshold: StaffSettings.defaultConfidenceThreshold,
    overdueHours: StaffSettings.defaultOverdueHours,
    requireRevealReason: true,
    showLastLoginLocation: true,
    compactDensity: false,
    relativeTimestamps: false,
    showCountryFlag: false,
    desktopPush: false,
    soundAlert: false,
    escalationOnly: false,
    defaultLandingPage: "dashboard" as const,
    secondReopenAutoFlag: false,
    autoCloseIdleDays: StaffSettings.defaultAutoCloseIdleDays,
    sentimentSensitivity: StaffSettings.defaultSentimentSensitivity,
  };

  /** Hands back usable settings even before this staffer has ever saved any. */
  static async getForUser(userId: number): Promise<StaffSettings> {
    const existing = await StaffSettings.query().findOne({ userId });
    if (existing != null) {
      return existing;
    }
    return StaffSettings.fromJson({ userId, ...StaffSettings.#newRowDefaults });
  }

  static async upsert(
    userId: number,
    patch: {
      readonly signature?: string | null;
      readonly notifyNew?: boolean;
      readonly quietFrom?: string | null;
      readonly quietTo?: string | null;
      readonly awayUntil?: string | null;
      readonly confidenceThreshold?: number;
      readonly overdueHours?: number;
      readonly requireRevealReason?: boolean;
      readonly showLastLoginLocation?: boolean;
      readonly compactDensity?: boolean;
      readonly relativeTimestamps?: boolean;
      readonly showCountryFlag?: boolean;
      readonly desktopPush?: boolean;
      readonly soundAlert?: boolean;
      readonly escalationOnly?: boolean;
      readonly defaultLandingPage?: "dashboard" | "inbox";
      readonly secondReopenAutoFlag?: boolean;
      readonly autoCloseIdleDays?: number;
      readonly sentimentSensitivity?: "mild" | "moderate" | "strict";
    },
  ): Promise<StaffSettings> {
    const existing = await StaffSettings.query().findOne({ userId });
    if (existing != null) {
      return await existing
        .$query()
        .patchAndFetch({ ...patch, updatedAt: new Date() });
    }
    return await StaffSettings.query().insertAndFetch({
      userId,
      ...patch,
      updatedAt: new Date(),
    });
  }

  /**
   * A single shared threshold for auto-reply decisions, read before any
   * specific staff member is involved in a ticket.
   *
   * Deliberately unsophisticated, per the plan: whichever staff member's
   * settings were saved most recently, or the hard defaults if nobody has
   * ever saved any — not a real per-team setting, just a "good enough for a
   * two-person team" stand-in for one. The desk-wide behaviours among the
   * newer settings (second-reopen auto-flag, idle auto-close) are read this
   * same way, for the same reason.
   */
  static async siteDefault(): Promise<StaffSettings> {
    const latest = await StaffSettings.query()
      .orderBy("updatedAt", "desc")
      .first();
    if (latest != null) {
      return latest;
    }
    return StaffSettings.fromJson({
      userId: 0,
      ...StaffSettings.#newRowDefaults,
    });
  }

  toDetails(): StaffSettingsDetails {
    return {
      signature: this.signature ?? null,
      notifyNew: this.notifyNew == null ? true : Boolean(this.notifyNew),
      quietFrom: this.quietFrom ?? null,
      quietTo: this.quietTo ?? null,
      awayUntil: this.awayUntil ?? null,
      confidenceThreshold:
        this.confidenceThreshold ?? StaffSettings.defaultConfidenceThreshold,
      overdueHours: this.overdueHours ?? StaffSettings.defaultOverdueHours,
      requireRevealReason:
        this.requireRevealReason == null
          ? true
          : Boolean(this.requireRevealReason),
      showLastLoginLocation:
        this.showLastLoginLocation == null
          ? true
          : Boolean(this.showLastLoginLocation),
      compactDensity: Boolean(this.compactDensity),
      relativeTimestamps: Boolean(this.relativeTimestamps),
      showCountryFlag: Boolean(this.showCountryFlag),
      desktopPush: Boolean(this.desktopPush),
      soundAlert: Boolean(this.soundAlert),
      escalationOnly: Boolean(this.escalationOnly),
      defaultLandingPage: this.defaultLandingPage ?? "dashboard",
      secondReopenAutoFlag: Boolean(this.secondReopenAutoFlag),
      autoCloseIdleDays:
        this.autoCloseIdleDays ?? StaffSettings.defaultAutoCloseIdleDays,
      sentimentSensitivity:
        this.sentimentSensitivity ?? StaffSettings.defaultSentimentSensitivity,
    };
  }
}

StaffSettings.relationMappings = {};
