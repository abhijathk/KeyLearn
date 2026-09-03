import { randomBytes } from "node:crypto";
import {
  body,
  controller,
  http,
  pathParam,
  queryParam,
} from "@fastr/controller";
import { Context } from "@fastr/core";
import { ApplicationError, NotFoundError } from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { AdCampaign, AdStat } from "@keylearn/database";
import { z } from "zod";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import { Mailer } from "../mail/index.ts";
import { AD_LIMITS, AD_TEMPLATES, AdRefused, checkAdText } from "./limits.ts";
import { acceptLogo } from "./logo.ts";
import { adsEnabled } from "./readers.ts";
import { bookingMail, reportMail, weekWindow } from "./report.ts";

const pId = zod(z.coerce.number().int().positive());
const pArchived = zod(
  z
    .enum(["0", "1", "true", "false"])
    .optional()
    .catch(undefined)
    .transform((raw) => raw === "1" || raw === "true"),
);

const TScreen = z.object({
  template: z.enum(AD_TEMPLATES),
  headline: z.string().trim().min(1).max(AD_LIMITS.headline),
  support: z.string().trim().max(AD_LIMITS.support).optional(),
  button: z.string().trim().max(AD_LIMITS.button).optional(),
  code: z.string().trim().max(AD_LIMITS.code).optional(),
  href: z.string().trim().url().max(500),
  goal: z.number().int().min(0).optional(),
  raised: z.number().int().min(0).optional(),
});

const THex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{3,8}$/, "Colours are hex values like #0B2B3F.");

const TPalette = z.object({
  bar: THex.optional(),
  text: THex.optional(),
  button: THex.optional(),
  buttonInk: THex.optional(),
  barDark: THex.optional(),
  accent: THex.optional(),
  treatment: z.enum(["solid", "flag", "gradient", "accent"]).optional(),
});

const TCampaign = z.object({
  advertiser: z.string().trim().min(1).max(AD_LIMITS.advertiser),
  screens: z.array(TScreen).min(1).max(AD_LIMITS.screensPerCampaign),
  palette: TPalette,
  /** A data URI; sanitised and re-encoded before it is stored. */
  logo: z.string().max(200_000).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  dismissible: z.boolean().default(true),
  capPerDay: z.number().int().min(0).max(20).default(3),
  pauseForNotices: z.boolean().default(true),
  soleOccupancy: z.boolean().default(false),
  weeklyPence: z.number().int().min(0).max(10_000_00).default(0),
  reportDay: z.number().int().min(0).max(6).default(1),
  reportHour: z.number().int().min(0).max(23).default(9),
  reportZone: z.string().trim().max(64).default("UTC"),
  reportFormat: z.enum(["designed", "text"]).default("designed"),
  reportTo: z
    .array(z.string().trim().email())
    .max(AD_LIMITS.reportRecipients)
    .default([]),
});
type TCampaign = z.infer<typeof TCampaign>;
const PCampaign = zod(TCampaign);

const TStatusChange = z.object({
  status: z.enum(["draft", "scheduled", "paused", "finished"]),
  /** Who approved it, from the desk's own signed-in staff member. */
  approvedBy: z.string().trim().max(120).optional(),
});
type TStatusChange = z.infer<typeof TStatusChange>;
const PStatusChange = zod(TStatusChange);

const TArchive = z.object({ archived: z.boolean() });
type TArchive = z.infer<typeof TArchive>;
const PArchive = zod(TArchive);

/** An IANA name we can actually format in, checked rather than assumed. */
function checkZone(zone: string): void {
  // Node will happily format in "+05:30", and an offset is exactly what a
  // report must not be pinned to: it would arrive an hour early or late
  // for half the year. Only a region name, or plain UTC, is accepted.
  if (zone !== "UTC" && !/^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$/.test(zone)) {
    throw new AdRefused(
      "reportZone",
      `"${zone}" is not a time zone name. Use a name like Europe/London, not an offset.`,
    );
  }
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(new Date());
  } catch {
    throw new AdRefused(
      "reportZone",
      `"${zone}" is not a time zone name. Use a name like Europe/London, not an offset.`,
    );
  }
}

/**
 * Refuses copy that breaks a published rule, naming the field so the
 * composer can put the message beside the box it belongs to.
 */
function checkCopy(input: TCampaign): void {
  const problems = [
    checkAdText("advertiser", input.advertiser),
    ...input.screens.flatMap((screen, index) =>
      [
        checkAdText(`screens.${index}.headline`, screen.headline),
        screen.support != null
          ? checkAdText(`screens.${index}.support`, screen.support)
          : null,
        screen.button != null
          ? checkAdText(`screens.${index}.button`, screen.button)
          : null,
      ].filter((p) => p != null),
    ),
  ].filter((p) => p != null);
  if (problems.length > 0) {
    throw new AdRefused(problems[0]!.field, problems[0]!.reason);
  }
  for (const [index, screen] of input.screens.entries()) {
    if (!screen.href.startsWith("https://")) {
      throw new AdRefused(
        `screens.${index}.href`,
        "A destination must be an https link, so a click cannot be redirected anywhere else.",
      );
    }
  }
}

/**
 * The desk's half of the sponsor slot.
 *
 * Every route is `requireOpsApi()`, exactly like site configuration: the
 * composer, the approval and the audit trail live in QDesk, and the row it
 * writes lives here because this is where the line is served, counted and
 * reported on. Nothing here trusts the desk with the rules, though. The
 * character limits, the refused wording, the https-only destination and
 * the logo sanitiser all run on this side, so a campaign written by any
 * other means is held to the same published contract.
 */
@injectable()
@controller()
export class AdsInternalController {
  constructor(@inject(Mailer) private readonly mailer: Mailer) {}

  /** Every campaign, newest booking first, with this week's counters. */
  @http.GET("/_/internal/ads")
  async list(
    ctx: Context<RouterState & AuthState>,
    @queryParam("archived", pArchived) archived: boolean,
  ) {
    ctx.state.requireOpsApi();
    const rows = await AdCampaign.listAll(archived);
    const { fromDay, toDay } = weekWindow(new Date());
    const campaigns = [];
    for (const row of rows) {
      const stats = await AdStat.forCampaign(row.id!, fromDay, toDay);
      campaigns.push({
        ...row.toDetails(),
        thisWeek: {
          views: stats.reduce((sum, s) => sum + s.views, 0),
          clicks: stats.reduce((sum, s) => sum + s.clicks, 0),
          byScreen: stats,
        },
      });
    }
    ctx.response.body = { campaigns, adsEnabled: adsEnabled() };
  }

  @http.POST("/_/internal/ads")
  async create(
    ctx: Context<RouterState & AuthState>,
    @body.json(PCampaign) input: TCampaign,
  ) {
    ctx.state.requireOpsApi();
    checkCopy(input);
    checkZone(input.reportZone);
    const logo = normaliseLogo(input.logo);
    const row = await AdCampaign.query().insert({
      advertiser: input.advertiser,
      status: "draft",
      screens: JSON.stringify(input.screens),
      palette: JSON.stringify(input.palette),
      logo,
      logoType: logo == null ? null : logo.slice(5, logo.indexOf(";")),
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      dismissible: input.dismissible,
      capPerDay: input.capPerDay,
      pauseForNotices: input.pauseForNotices,
      soleOccupancy: input.soleOccupancy,
      weeklyPence: input.weeklyPence,
      reportDay: input.reportDay,
      reportHour: input.reportHour,
      reportZone: input.reportZone,
      reportFormat: input.reportFormat,
      reportTo: input.reportTo.join(","),
      // Long enough that it cannot be guessed, short enough to paste into
      // an email without wrapping.
      previewToken: randomBytes(18).toString("base64url"),
      creditedMinutes: 0,
    });
    ctx.response.body = row.toDetails();
  }

  @http.PUT("/_/internal/ads/{id}")
  async update(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PCampaign) input: TCampaign,
  ) {
    ctx.state.requireOpsApi();
    const existing = await AdCampaign.query().findById(id);
    if (existing == null) {
      throw new NotFoundError();
    }
    checkCopy(input);
    checkZone(input.reportZone);
    const logo =
      input.logo === undefined ? existing.logo : normaliseLogo(input.logo);
    await AdCampaign.query()
      .findById(id)
      .patch({
        advertiser: input.advertiser,
        screens: JSON.stringify(input.screens),
        palette: JSON.stringify(input.palette),
        logo,
        logoType: logo == null ? null : logo.slice(5, logo.indexOf(";")),
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        dismissible: input.dismissible,
        capPerDay: input.capPerDay,
        pauseForNotices: input.pauseForNotices,
        soleOccupancy: input.soleOccupancy,
        weeklyPence: input.weeklyPence,
        reportDay: input.reportDay,
        reportHour: input.reportHour,
        reportZone: input.reportZone,
        reportFormat: input.reportFormat,
        reportTo: input.reportTo.join(","),
        updatedAt: new Date(),
      });
    ctx.response.body = (await AdCampaign.query().findById(id))!.toDetails();
  }

  /**
   * Publish, pause, or close a campaign. Publishing is the moment the
   * booking mail goes out, because that is when the preview link becomes
   * a promise rather than a draft.
   */
  @http.POST("/_/internal/ads/{id}/status")
  async setStatus(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PStatusChange) input: TStatusChange,
  ) {
    ctx.state.requireOpsApi();
    const existing = await AdCampaign.query().findById(id);
    if (existing == null) {
      throw new NotFoundError();
    }
    if (input.status === "scheduled" && existing.screenList.length === 0) {
      throw new AdRefused("screens", "A campaign needs at least one screen.");
    }
    const wasScheduled = existing.status === "scheduled";
    await AdCampaign.query()
      .findById(id)
      .patch({
        status: input.status,
        approvedBy:
          input.status === "scheduled"
            ? (input.approvedBy ?? existing.approvedBy ?? null)
            : existing.approvedBy,
        updatedAt: new Date(),
      });
    const row = (await AdCampaign.query().findById(id))!;
    if (input.status === "scheduled" && !wasScheduled) {
      await this.#sendBooking(row);
    }
    ctx.response.body = row.toDetails();
  }

  /**
   * Files a campaign away, or brings it back.
   *
   * Archiving is not deleting and not stopping: it is what an admin does
   * with last quarter's campaigns so this quarter's list is readable. The
   * campaign keeps its status, its figures and its dates, and an archived
   * one never runs whatever those dates say, so filing something away can
   * never accidentally put it back on the page.
   */
  @http.POST("/_/internal/ads/{id}/archive")
  async archive(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PArchive) input: TArchive,
  ) {
    ctx.state.requireOpsApi();
    const existing = await AdCampaign.query().findById(id);
    if (existing == null) {
      throw new NotFoundError();
    }
    if (input.archived && existing.status === "scheduled") {
      throw new AdRefused(
        "archived",
        "This campaign is still running. Close or pause it first, then archive it.",
      );
    }
    await AdCampaign.setArchived(id, input.archived);
    ctx.response.body = (await AdCampaign.query().findById(id))!.toDetails();
  }

  /** A draft may be removed. Anything that has run is kept for the record. */
  @http.DELETE("/_/internal/ads/{id}")
  async remove(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireOpsApi();
    const existing = await AdCampaign.query().findById(id);
    if (existing == null) {
      throw new NotFoundError();
    }
    if (existing.status !== "draft") {
      throw new AdRefused(
        "status",
        "Only a draft can be deleted. Close the campaign instead, so its figures survive.",
      );
    }
    await AdCampaign.query().deleteById(id);
    ctx.response.body = { ok: true };
  }

  /** The figures behind one campaign, for the desk's own detail view. */
  @http.GET("/_/internal/ads/{id}/stats")
  async stats(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireOpsApi();
    const row = await AdCampaign.query().findById(id);
    if (row == null) {
      throw new NotFoundError();
    }
    const { fromDay, toDay } = weekWindow(new Date());
    const week = await AdStat.forCampaign(row.id!, fromDay, toDay);
    const all = await AdStat.forCampaign(row.id!, "0000-00-00", "9999-99-99");
    ctx.response.body = { week, all, fromDay, toDay };
  }

  /**
   * Sends this week's report now, to the same addresses and in the same
   * format the schedule would use. Exists so nobody has to wait until
   * Monday to find out whether the mail is right.
   */
  @http.POST("/_/internal/ads/{id}/send-report")
  async sendReport(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireOpsApi();
    const row = await AdCampaign.query().findById(id);
    if (row == null) {
      throw new NotFoundError();
    }
    const details = row.toDetails();
    if (details.report.to.length === 0) {
      throw new AdRefused(
        "reportTo",
        "This campaign has no report address. Add one before sending.",
      );
    }
    const { fromDay, toDay } = weekWindow(new Date());
    const stats = await AdStat.forCampaign(row.id!, fromDay, toDay);
    const message = reportMail(details, stats, fromDay, toDay);
    for (const to of details.report.to) {
      await this.mailer.sendMail({ ...message, to });
    }
    ctx.response.body = { ok: true, sent: details.report.to.length };
  }

  async #sendBooking(row: AdCampaign): Promise<void> {
    const details = row.toDetails();
    if (details.report.to.length === 0) {
      return;
    }
    const message = bookingMail(details);
    for (const to of details.report.to) {
      try {
        await this.mailer.sendMail({ ...message, to });
      } catch {
        // A booking confirmation that fails to send must never leave the
        // campaign unscheduled; the desk shows the preview link too.
      }
    }
  }
}

/** Runs an uploaded logo through the sanitiser, or clears it. */
function normaliseLogo(value: string | null | undefined): string | null {
  if (value == null || value === "") {
    return null;
  }
  const result = acceptLogo(value);
  if (!result.ok) {
    throw new AdRefused("logo", result.reason);
  }
  return result.dataUri;
}
