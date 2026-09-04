import { type Knex } from "knex";
import { type JSONSchema, Model, type Pojo, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * A paid sponsor slot: the line above the header, sold by the week
 * (control centre phase 4).
 *
 * Campaigns live here rather than in QDesk, unlike notices, and the reason
 * is where the work happens: delivery, click counting and the weekly report
 * mail are all KeyLearn's, so keeping the row here removes an asset copy, a
 * feed pull and a mail relay between the two apps. QDesk keeps the composer,
 * the unlock and its own audit trail, and edits through the internal API
 * exactly as it does for the site configuration.
 *
 * `screens` and `palette` are JSON in a text column, the same choice
 * `Notice.options` makes: they are read and written whole by one owner and
 * never queried across rows.
 */
export class AdCampaign extends TimestampMixin(Model) {
  static override readonly tableName = "ad_campaign";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["startsAt", "endsAt"],
    properties: {
      id: { type: "integer" },
      /**
       * The trading name shown on the line. Optional: an advertiser whose
       * logo is their recognition may run without it, and the reader is
       * told who paid either way — see `toPublic` and the why-this-ad page,
       * which fall back to the destination's host.
       */
      advertiser: { type: "string", maxLength: 32 },
      /** draft · scheduled · paused · finished. "Running" is a date range, not a state. */
      status: {
        type: "string",
        enum: ["draft", "scheduled", "paused", "finished"],
      },
      /** JSON array of screens; see {@link AdScreen}. One to three. */
      screens: { type: "string", maxLength: 8000 },
      /** JSON object of brand colours; see {@link AdPalette}. */
      palette: { type: "string", maxLength: 2000 },
      /** The logo as a data URI, sanitised on upload. Small by contract. */
      logo: { type: ["string", "null"], maxLength: 60000 },
      logoType: { type: ["string", "null"], maxLength: 32 },
      dismissible: { type: "boolean" },
      /** 0 means no cap. */
      capPerDay: { type: "integer", minimum: 0, maximum: 20 },
      /** Whether a live notice pauses it and credits the time back. */
      pauseForNotices: { type: "boolean" },
      soleOccupancy: { type: "boolean" },
      /** Pence, so no floating point ever touches money. */
      weeklyPence: { type: "integer", minimum: 0 },
      reportDay: { type: "integer", minimum: 0, maximum: 6 },
      reportHour: { type: "integer", minimum: 0, maximum: 23 },
      /** An IANA zone name, never an offset: a report must not drift with daylight saving. */
      reportZone: { type: "string", maxLength: 64 },
      reportFormat: { type: "string", enum: ["designed", "text"] },
      /** Comma-separated, at most three. */
      reportTo: { type: ["string", "null"], maxLength: 320 },
      /** Unguessable, for the advertiser's preview link. */
      previewToken: { type: "string", maxLength: 64 },
      approvedBy: { type: ["string", "null"], maxLength: 120 },
      lastReportAt: {},
      archived: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.string("advertiser", 32).notNullable().defaultTo("");
    table.string("status", 16).notNullable().defaultTo("draft");
    table.text("screens").notNullable();
    table.text("palette").notNullable();
    table.text("logo").nullable();
    table.string("logo_type", 32).nullable();
    table.timestamp("starts_at").notNullable();
    table.timestamp("ends_at").notNullable();
    table.boolean("dismissible").notNullable().defaultTo(true);
    table.integer("cap_per_day").unsigned().notNullable().defaultTo(3);
    table.boolean("pause_for_notices").notNullable().defaultTo(true);
    table.boolean("sole_occupancy").notNullable().defaultTo(false);
    table.integer("weekly_pence").unsigned().notNullable().defaultTo(0);
    table.integer("report_day").unsigned().notNullable().defaultTo(1);
    table.integer("report_hour").unsigned().notNullable().defaultTo(9);
    table.string("report_zone", 64).notNullable().defaultTo("UTC");
    table.string("report_format", 16).notNullable().defaultTo("designed");
    table.string("report_to", 320).nullable();
    table.string("preview_token", 64).notNullable();
    table.string("approved_by", 120).nullable();
    /* When the weekly report last went out, so a sweep that runs every few
     * minutes inside the send hour sends once rather than every tick. */
    table.timestamp("last_report_at").nullable();
    /* Archiving is filing, not deleting. It is deliberately a flag rather
     * than a status: a campaign keeps whatever it ended as, so restoring it
     * puts back the campaign that was filed rather than a "restored" one. */
    table.boolean("archived").notNullable().defaultTo(false);
    /* Minutes owed back because a notice held the bar. The run's finish is
     * read as endsAt plus this, so a credit never needs a second date. */
    table.integer("credited_minutes").unsigned().notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["status", "starts_at"]);
    table.index(["preview_token"]);
  }

  readonly id?: number;
  advertiser?: string;
  status?: AdStatus;
  screens?: string;
  palette?: string;
  logo?: string | null;
  logoType?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  dismissible?: number | boolean;
  capPerDay?: number;
  pauseForNotices?: number | boolean;
  soleOccupancy?: number | boolean;
  weeklyPence?: number;
  reportDay?: number;
  reportHour?: number;
  reportZone?: string;
  reportFormat?: "designed" | "text";
  reportTo?: string | null;
  previewToken?: string;
  approvedBy?: string | null;
  lastReportAt?: Date | null;
  archived?: number | boolean;
  creditedMinutes?: number;
  createdAt?: Date;
  updatedAt?: Date;

  override $parseDatabaseJson(json: Pojo): Pojo {
    json = super.$parseDatabaseJson(json);
    for (const name of ["createdAt", "updatedAt", "startsAt", "endsAt"]) {
      const value = json[name];
      if (value != null && !(value instanceof Date)) {
        json[name] = new Date(value);
      }
    }
    return json;
  }

  get screenList(): readonly AdScreen[] {
    try {
      const parsed = JSON.parse(this.screens ?? "[]");
      return Array.isArray(parsed) ? (parsed as AdScreen[]) : [];
    } catch {
      return [];
    }
  }

  get paletteValue(): AdPalette {
    try {
      const parsed = JSON.parse(this.palette ?? "{}");
      return typeof parsed === "object" && parsed != null
        ? (parsed as AdPalette)
        : {};
    } catch {
      return {};
    }
  }

  /** The moment the run actually finishes, including any credited time. */
  get finishesAt(): Date {
    return new Date(
      new Date(this.endsAt!).getTime() + (this.creditedMinutes ?? 0) * 60_000,
    );
  }

  /** Whether the campaign should be on screen at `now`. */
  live(now: number = Date.now()): boolean {
    return (
      !this.archived &&
      this.status === "scheduled" &&
      new Date(this.startsAt!).getTime() <= now &&
      this.finishesAt.getTime() > now
    );
  }

  /**
   * Campaigns for the desk's list. Archived ones are filed away rather than
   * gone, so they are excluded by default and asked for by name.
   */
  static async listAll(archived = false): Promise<AdCampaign[]> {
    const rows = await AdCampaign.query().orderBy("startsAt", "desc");
    return rows.filter((row) => Boolean(row.archived) === archived);
  }

  /** Files a campaign away, or brings it back exactly as it was. */
  static async setArchived(id: number, archived: boolean): Promise<void> {
    await AdCampaign.query()
      .findById(id)
      .patch({ archived, updatedAt: new Date() });
  }

  /** Every campaign that should be on screen now, oldest booking first. */
  static async liveNow(now: number = Date.now()): Promise<AdCampaign[]> {
    const rows = await AdCampaign.query()
      .where("status", "scheduled")
      .orderBy("id");
    return rows.filter((row) => row.live(now));
  }

  static async findByToken(token: string): Promise<AdCampaign | null> {
    return (await AdCampaign.query().findOne({ previewToken: token })) ?? null;
  }

  /** Adds credited minutes when a notice held the bar. */
  static async credit(id: number, minutes: number): Promise<void> {
    if (minutes <= 0) {
      return;
    }
    await AdCampaign.query().findById(id).increment("creditedMinutes", minutes);
  }

  toDetails(): AdCampaignDetails {
    return {
      id: this.id!,
      advertiser: this.advertiser ?? "",
      status: this.status ?? "draft",
      screens: this.screenList,
      palette: this.paletteValue,
      hasLogo: this.logo != null,
      startsAt: new Date(this.startsAt!).toISOString(),
      endsAt: new Date(this.endsAt!).toISOString(),
      finishesAt: this.finishesAt.toISOString(),
      creditedMinutes: this.creditedMinutes ?? 0,
      dismissible: this.dismissible == null ? true : Boolean(this.dismissible),
      capPerDay: this.capPerDay ?? 3,
      pauseForNotices:
        this.pauseForNotices == null ? true : Boolean(this.pauseForNotices),
      soleOccupancy: Boolean(this.soleOccupancy),
      weeklyPence: this.weeklyPence ?? 0,
      report: {
        day: this.reportDay ?? 1,
        hour: this.reportHour ?? 9,
        zone: this.reportZone ?? "UTC",
        format: this.reportFormat ?? "designed",
        to: (this.reportTo ?? "")
          .split(",")
          .map((address) => address.trim())
          .filter((address) => address !== ""),
      },
      previewToken: this.previewToken!,
      approvedBy: this.approvedBy ?? null,
      archived: Boolean(this.archived),
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }

  /** What a reader's browser is given: no money, no contacts, no token. */
  toPublic(): AdPublic {
    return {
      id: this.id!,
      advertiser: this.advertiser ?? "",
      screens: this.screenList,
      palette: this.paletteValue,
      hasLogo: this.logo != null,
      dismissible: this.dismissible == null ? true : Boolean(this.dismissible),
    };
  }
}

export type AdStatus = "draft" | "scheduled" | "paused" | "finished";

/** One screen of a campaign. Every limit here is enforced by the server. */
export type AdScreen = {
  readonly template: "offer" | "logo" | "sponsor" | "ends" | "cause" | "house";
  readonly headline: string;
  readonly support?: string;
  readonly button?: string;
  readonly code?: string;
  /** Where a click goes. Stored, never taken from a request. */
  readonly href: string;
  /** For the cause template. */
  readonly goal?: number;
  readonly raised?: number;
};

export type AdPalette = {
  readonly bar?: string;
  readonly text?: string;
  readonly button?: string;
  readonly buttonInk?: string;
  readonly barDark?: string;
  readonly accent?: string;
  readonly treatment?: "solid" | "flag" | "gradient" | "accent";
  /**
   * The colours a split or a blend runs through, in order (4 Sep 2026).
   *
   * Absent, the pair that was always here — `bar` then `accent` — is used, so
   * a campaign booked before this renders exactly as it did. The palette is
   * JSON in a text column, which is why widening it needs no migration; what
   * it does need is for the bar to distrust every value, since this arrives
   * from the desk and ends up in a CSS declaration.
   */
  readonly stops?: readonly string[];
  /** Relative shares of the bar, one per stop. Normalised, so any total works. */
  readonly weights?: readonly number[];
  /** Transition width between stops, 0–100, for `gradient` only. */
  readonly blend?: number;
};

export type AdCampaignDetails = {
  readonly id: number;
  readonly advertiser: string;
  readonly status: AdStatus;
  readonly screens: readonly AdScreen[];
  readonly palette: AdPalette;
  readonly hasLogo: boolean;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly finishesAt: string;
  readonly creditedMinutes: number;
  readonly dismissible: boolean;
  readonly capPerDay: number;
  readonly pauseForNotices: boolean;
  readonly soleOccupancy: boolean;
  readonly weeklyPence: number;
  readonly report: {
    readonly day: number;
    readonly hour: number;
    readonly zone: string;
    readonly format: "designed" | "text";
    readonly to: readonly string[];
  };
  readonly previewToken: string;
  readonly approvedBy: string | null;
  readonly archived: boolean;
  readonly createdAt: string;
};

export type AdPublic = {
  readonly id: number;
  readonly advertiser: string;
  readonly screens: readonly AdScreen[];
  readonly palette: AdPalette;
  readonly hasLogo: boolean;
  readonly dismissible: boolean;
};
