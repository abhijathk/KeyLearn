import { inject, injectable } from "@fastr/invert";
import { AdCampaign, AdSeen, AdStat, Notice } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { Mailer } from "../mail/index.ts";
import { fetchDeskNotices } from "../support/qdesk-forward.ts";
import { reportMail, weekWindow } from "./report.ts";

const MINUTE_MS = 60 * 1000;
/** Five minutes: fine enough that a notice credit is nearly exact, coarse enough to be free. */
const TICK_MS = 5 * MINUTE_MS;
/** Daily counters are kept for two years, which outlives any campaign. */
const STAT_RETENTION_DAYS = 730;

/**
 * Everything the sponsor slot needs doing on a clock.
 *
 * Four jobs share one timer because they share one question, which is what
 * the current minute means for a campaign:
 *
 *  - a campaign whose finish has passed is closed, so it stops appearing
 *    in the live list without anybody having to remember;
 *  - a campaign paused by a site notice is credited the minutes it lost,
 *    which is what makes "your notice comes first" a promise we can keep
 *    without refunding by hand;
 *  - a report is sent when the advertiser's own day and hour arrive in the
 *    advertiser's own zone;
 *  - the day's view-deduplication hashes are deleted once they expire.
 *
 * Runs in the cluster primary only, like every other sweep, so a four
 * worker deployment sends one report rather than four.
 */
@injectable({ singleton: true })
export class AdSweep {
  #timer: NodeJS.Timeout | null = null;
  /** When the last tick ran, so a credit is the real elapsed time. */
  #lastTick = Date.now();

  constructor(@inject(Mailer) private readonly mailer: Mailer) {}

  start(): void {
    if (this.#timer != null) {
      return;
    }
    this.#lastTick = Date.now();
    void this.runOnce();
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, TICK_MS);
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  async runOnce(now: number = Date.now()): Promise<void> {
    try {
      const elapsedMin = Math.max(
        0,
        Math.round((now - this.#lastTick) / MINUTE_MS),
      );
      this.#lastTick = now;
      await this.closeFinished(now);
      await this.creditForNotices(elapsedMin, now);
      await this.sendDueReports(now);
      await AdSeen.sweep(now);
      await AdStat.deleteBefore(
        new Date(now - STAT_RETENTION_DAYS * 24 * 60 * MINUTE_MS)
          .toISOString()
          .slice(0, 10),
      );
    } catch (err: any) {
      Logger.warn(err, "Sponsor slot sweep failed");
    }
  }

  /** A campaign past its finish is closed, credited time included. */
  async closeFinished(now: number): Promise<number> {
    const rows = await AdCampaign.query().where("status", "scheduled");
    let closed = 0;
    for (const row of rows) {
      if (row.finishesAt.getTime() <= now) {
        await AdCampaign.query()
          .findById(row.id!)
          .patch({ status: "finished", updatedAt: new Date(now) });
        closed += 1;
      }
    }
    if (closed > 0) {
      Logger.info("Sponsor slot: closed %d finished campaign(s)", closed);
    }
    return closed;
  }

  /**
   * While a site notice holds the bar, every campaign that asked to stand
   * aside for one is owed the time back.
   *
   * The credit is added to `creditedMinutes`, which the run's finish is
   * read through, so a campaign paused for six hours simply runs six hours
   * longer. Campaigns that chose to share the bar with a notice are not
   * credited, because they were not paused.
   */
  async creditForNotices(elapsedMin: number, now: number): Promise<number> {
    if (elapsedMin <= 0) {
      return 0;
    }
    if (!(await noticeHoldsTheBar())) {
      return 0;
    }
    const live = await AdCampaign.liveNow(now);
    let credited = 0;
    for (const row of live) {
      if (row.pauseForNotices !== false && Boolean(row.pauseForNotices)) {
        await AdCampaign.credit(row.id!, elapsedMin);
        credited += 1;
      }
    }
    return credited;
  }

  /**
   * Sends the weekly report to every campaign whose chosen moment has
   * arrived in its chosen zone.
   *
   * "Its chosen moment" is deliberately a day and an hour rather than an
   * instant: an advertiser who asked for Monday at nine in Sydney gets it
   * at nine in Sydney in January and in July alike, which an offset could
   * not have promised.
   */
  async sendDueReports(now: number): Promise<number> {
    const rows = await AdCampaign.query().whereIn("status", [
      "scheduled",
      "paused",
      "finished",
    ]);
    let sent = 0;
    for (const row of rows) {
      const details = row.toDetails();
      if (details.report.to.length === 0 || details.archived) {
        // An archived campaign is filed away, and filing something away
        // must stop the mail as well as the line.
        continue;
      }
      if (!isReportDue(row, now)) {
        continue;
      }
      const { fromDay, toDay } = weekWindow(new Date(now));
      const stats = await AdStat.forCampaign(row.id!, fromDay, toDay);
      // A campaign that has finished and has nothing left to report on is
      // let go rather than sent an empty mail every week for ever.
      if (
        details.status === "finished" &&
        stats.every((s) => s.views === 0 && s.clicks === 0)
      ) {
        await AdCampaign.query()
          .findById(row.id!)
          .patch({ lastReportAt: new Date(now) });
        continue;
      }
      const message = reportMail(details, stats, fromDay, toDay);
      for (const to of details.report.to) {
        try {
          await this.mailer.sendMail({ ...message, to });
        } catch (err: any) {
          Logger.warn(err, "Sponsor slot: weekly report failed to send");
        }
      }
      await AdCampaign.query()
        .findById(row.id!)
        .patch({ lastReportAt: new Date(now) });
      sent += 1;
    }
    return sent;
  }
}

/** Whether a site-wide notice is on screen right now, local or from the desk. */
export async function noticeHoldsTheBar(): Promise<boolean> {
  const local = await Notice.activeNotices();
  if (local.some((n) => n.display === "banner" || n.display === "window")) {
    return true;
  }
  try {
    const desk = await fetchDeskNotices();
    return desk.some((n) => n.display === "banner" || n.display === "window");
  } catch {
    // The desk being unreachable is not a reason to credit everybody.
    return false;
  }
}

/**
 * Whether this campaign's report hour has arrived and has not been served.
 *
 * The two halves matter equally: the day and hour are read in the
 * advertiser's zone, and `lastReportAt` stops the same hour sending twelve
 * mails as the five-minute tick passes through it.
 */
export function isReportDue(row: AdCampaign, now: number): boolean {
  const zone = row.reportZone ?? "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(now));
  } catch {
    return false;
  }
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdayIndex = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ].indexOf(get("weekday"));
  const hour = Number(get("hour")) % 24;
  if (weekdayIndex !== (row.reportDay ?? 1) || hour !== (row.reportHour ?? 9)) {
    return false;
  }
  const last =
    row.lastReportAt == null ? 0 : new Date(row.lastReportAt).getTime();
  // Anything inside the last twenty hours means this send hour is done;
  // a week apart is the real cadence, so the window has room to spare.
  return now - last > 20 * 60 * MINUTE_MS;
}
