import { Env } from "@keylearn/config";
import { type AdCampaignDetails, type AdStatRow } from "@keylearn/database";
import { type Mailer } from "../mail/index.ts";

/**
 * The weekly report an advertiser is sent, and the confirmation they get
 * when a campaign is scheduled.
 *
 * Two rules run through both. The first is that we send figures, not
 * inferences: views, clicks, and the rate between them, for the week that
 * has closed. There is no demographic breakdown, no geography and no
 * device split, because we do not collect any of it and a report that
 * implied otherwise would be a lie about the product. The second is that
 * an advertiser chooses the shape of their own mail: some want the
 * designed version, some want plain text their systems can parse, and
 * `reportFormat` decides which is sent rather than which is preferred.
 */

const INK = "#141620";
const MUTED = "#6b7280";
const BORDER = "#e6e8ee";
const PAGE_BG = "#eef0f4";
const CARD_BG = "#ffffff";
const ACCENT = "#37c871";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Consolas,monospace";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function siteUrl(path: string): string {
  return String(
    new URL(path, Env.getString("APP_URL", "https://www.keylearn.org/")),
  );
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * The seven days that ended yesterday, as ISO dates.
 *
 * A report covers a week that is over. Including today would mean the
 * figures changed after the mail was written, which is the one thing a
 * report must never do.
 */
export function weekWindow(now: Date): {
  readonly fromDay: string;
  readonly toDay: string;
} {
  const end = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  return {
    fromDay: start.toISOString().slice(0, 10),
    toDay: end.toISOString().slice(0, 10),
  };
}

/** A date read the way a person writes it, in the advertiser's own zone. */
export function inZone(iso: string, zone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

/** Whole numbers with thousands separators; a count is never a decimal. */
function count(value: number): string {
  return value.toLocaleString("en-GB");
}

function rate(views: number, clicks: number): string {
  return views === 0 ? "0.00%" : `${((clicks / views) * 100).toFixed(2)}%`;
}

export type ReportTotals = {
  readonly views: number;
  readonly clicks: number;
};

export function totalsOf(stats: readonly AdStatRow[]): ReportTotals {
  return {
    views: stats.reduce((sum, row) => sum + row.views, 0),
    clicks: stats.reduce((sum, row) => sum + row.clicks, 0),
  };
}

/** The plain-text report, for an advertiser who asked for text. */
export function reportText(
  campaign: AdCampaignDetails,
  stats: readonly AdStatRow[],
  fromDay: string,
  toDay: string,
): string {
  const totals = totalsOf(stats);
  const lines = [
    `KeyLearn weekly report`,
    `${campaign.advertiser}`,
    `${fromDay} to ${toDay}`,
    ``,
    `Views    ${count(totals.views)}`,
    `Clicks   ${count(totals.clicks)}`,
    `Rate     ${rate(totals.views, totals.clicks)}`,
    ``,
  ];
  if (campaign.screens.length > 1) {
    lines.push(`By screen`);
    for (const [index, screen] of campaign.screens.entries()) {
      const row = stats.find((s) => s.screen === index);
      lines.push(
        `  ${index + 1}. ${screen.headline}`,
        `     views ${count(row?.views ?? 0)}   clicks ${count(row?.clicks ?? 0)}   rate ${rate(row?.views ?? 0, row?.clicks ?? 0)}`,
      );
    }
    lines.push(``);
  }
  lines.push(
    `Campaign runs to ${inZone(campaign.finishesAt, campaign.report.zone)}.`,
    `Preview: ${siteUrl(`/ad-preview/${campaign.previewToken}`)}`,
    ``,
    `These are counts of the line being shown and clicked. KeyLearn collects`,
    `nothing about the people who read it, so there is no audience breakdown`,
    `in this report and there will not be one.`,
  );
  return lines.join("\n");
}

function statCell(label: string, value: string, hint = ""): string {
  return `<td style="padding:0 8px 0 0;vertical-align:top">
  <div style="border:1px solid ${BORDER};border-radius:10px;padding:14px 16px">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${MUTED}">${esc(label)}</div>
    <div style="font-family:${FONT};font-size:28px;font-weight:700;color:${INK};padding-top:4px">${esc(value)}</div>
    ${hint === "" ? "" : `<div style="font-family:${FONT};font-size:12px;color:${MUTED};padding-top:2px">${esc(hint)}</div>`}
  </div>
</td>`;
}

/** The designed report: one card, three figures, and the per-screen table. */
export function reportHtml(
  campaign: AdCampaignDetails,
  stats: readonly AdStatRow[],
  fromDay: string,
  toDay: string,
): string {
  const totals = totalsOf(stats);
  const perScreen =
    campaign.screens.length <= 1
      ? ""
      : `<h2 style="font-family:${FONT};font-size:14px;font-weight:700;color:${INK};margin:28px 0 8px">By screen</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr>
    <th align="left" style="font-family:${FONT};font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};padding:6px 8px 6px 0;border-bottom:1px solid ${BORDER}">Screen</th>
    <th align="right" style="font-family:${FONT};font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};padding:6px 0;border-bottom:1px solid ${BORDER}">Views</th>
    <th align="right" style="font-family:${FONT};font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};padding:6px 0 6px 16px;border-bottom:1px solid ${BORDER}">Clicks</th>
    <th align="right" style="font-family:${FONT};font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};padding:6px 0 6px 16px;border-bottom:1px solid ${BORDER}">Rate</th>
  </tr>
  ${campaign.screens
    .map((screen, index) => {
      const row = stats.find((s) => s.screen === index);
      return `<tr>
    <td style="font-family:${FONT};font-size:13px;color:${INK};padding:9px 8px 9px 0;border-bottom:1px solid ${BORDER}">${esc(screen.headline)}</td>
    <td align="right" style="font-family:${MONO};font-size:13px;color:${INK};padding:9px 0;border-bottom:1px solid ${BORDER}">${count(row?.views ?? 0)}</td>
    <td align="right" style="font-family:${MONO};font-size:13px;color:${INK};padding:9px 0 9px 16px;border-bottom:1px solid ${BORDER}">${count(row?.clicks ?? 0)}</td>
    <td align="right" style="font-family:${MONO};font-size:13px;color:${MUTED};padding:9px 0 9px 16px;border-bottom:1px solid ${BORDER}">${rate(row?.views ?? 0, row?.clicks ?? 0)}</td>
  </tr>`;
    })
    .join("")}
</table>`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAGE_BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${CARD_BG};border-radius:14px;padding:32px 34px">
  <tr><td>
    <span style="font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-.02em;color:${INK}">Key<span style="color:${ACCENT}">Learn</span></span>
    <div style="font-family:${FONT};font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};padding-top:18px">Weekly report</div>
    <h1 style="font-family:${FONT};font-size:22px;font-weight:700;color:${INK};margin:4px 0 2px">${esc(campaign.advertiser)}</h1>
    <div style="font-family:${FONT};font-size:13px;color:${MUTED}">${esc(inZone(`${fromDay}T00:00:00Z`, campaign.report.zone))} to ${esc(inZone(`${toDay}T00:00:00Z`, campaign.report.zone))}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">
      <tr>
        ${statCell("Views", count(totals.views), "times the line was shown")}
        ${statCell("Clicks", count(totals.clicks), "readers who followed it")}
        ${statCell("Rate", rate(totals.views, totals.clicks), "clicks per view")}
      </tr>
    </table>

    ${perScreen}

    <div style="border-top:1px solid ${BORDER};margin-top:26px;padding-top:18px">
      <div style="font-family:${FONT};font-size:13px;color:${MUTED}">Your campaign runs to <b style="color:${INK}">${esc(inZone(campaign.finishesAt, campaign.report.zone))}</b>.</div>
      <div style="padding-top:14px"><a href="${esc(siteUrl(`/ad-preview/${campaign.previewToken}`))}" style="display:inline-block;background:${ACCENT};color:#fff;font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:9px">See your campaign</a></div>
    </div>

    <p style="font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};margin:22px 0 0">These are counts of the line being shown and clicked. KeyLearn collects nothing about the people who read it, so there is no audience breakdown in this report and there will not be one.</p>
  </td></tr>
</table>
<div style="font-family:${FONT};font-size:11px;color:${MUTED};padding-top:14px">Sent every ${esc(DAY_NAMES[campaign.report.day] ?? "Monday")} at ${String(campaign.report.hour).padStart(2, "0")}:00 ${esc(campaign.report.zone)}.</div>
</td></tr>
</table>
</body></html>`;
}

/** The message itself, in whichever format the advertiser asked for. */
export function reportMail(
  campaign: AdCampaignDetails,
  stats: readonly AdStatRow[],
  fromDay: string,
  toDay: string,
): Omit<Mailer.Message, "to"> {
  const subject = `${campaign.advertiser} on KeyLearn: ${fromDay} to ${toDay}`;
  const text = reportText(campaign, stats, fromDay, toDay);
  if (campaign.report.format === "text") {
    return { subject, text };
  }
  return { subject, text, html: reportHtml(campaign, stats, fromDay, toDay) };
}

/** Sent once, when a campaign is scheduled: the dates and the preview link. */
export function bookingMail(
  campaign: AdCampaignDetails,
): Omit<Mailer.Message, "to"> {
  const preview = siteUrl(`/ad-preview/${campaign.previewToken}`);
  const from = inZone(campaign.startsAt, campaign.report.zone);
  const to = inZone(campaign.finishesAt, campaign.report.zone);
  const text = [
    `Your KeyLearn campaign is booked.`,
    ``,
    `Advertiser   ${campaign.advertiser}`,
    `Running      ${from} to ${to}`,
    `Screens      ${campaign.screens.length}`,
    `Reports      every ${DAY_NAMES[campaign.report.day] ?? "Monday"} at ${String(campaign.report.hour).padStart(2, "0")}:00 ${campaign.report.zone}`,
    ``,
    `See exactly how it looks, in both themes:`,
    preview,
    ``,
    `Changes before the start date are free. Reply to this email with the`,
    `wording or the colours you want and we will update it.`,
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAGE_BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${CARD_BG};border-radius:14px;padding:32px 34px">
<tr><td>
  <span style="font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-.02em;color:${INK}">Key<span style="color:${ACCENT}">Learn</span></span>
  <h1 style="font-family:${FONT};font-size:22px;font-weight:700;color:${INK};margin:20px 0 6px">Your campaign is booked</h1>
  <p style="font-family:${FONT};font-size:14px;color:${MUTED};margin:0 0 20px">Here is what will run, and a private link that shows it exactly as readers see it.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-family:${FONT};font-size:12px;color:${MUTED};padding:9px 0;border-bottom:1px solid ${BORDER};width:150px">Advertiser</td><td style="font-family:${FONT};font-size:14px;color:${INK};padding:9px 0;border-bottom:1px solid ${BORDER}">${esc(campaign.advertiser)}</td></tr>
    <tr><td style="font-family:${FONT};font-size:12px;color:${MUTED};padding:9px 0;border-bottom:1px solid ${BORDER}">Running</td><td style="font-family:${FONT};font-size:14px;color:${INK};padding:9px 0;border-bottom:1px solid ${BORDER}">${esc(from)} to ${esc(to)}</td></tr>
    <tr><td style="font-family:${FONT};font-size:12px;color:${MUTED};padding:9px 0;border-bottom:1px solid ${BORDER}">Screens</td><td style="font-family:${FONT};font-size:14px;color:${INK};padding:9px 0;border-bottom:1px solid ${BORDER}">${campaign.screens.length}, rotating</td></tr>
    <tr><td style="font-family:${FONT};font-size:12px;color:${MUTED};padding:9px 0;border-bottom:1px solid ${BORDER}">Reports</td><td style="font-family:${FONT};font-size:14px;color:${INK};padding:9px 0;border-bottom:1px solid ${BORDER}">every ${esc(DAY_NAMES[campaign.report.day] ?? "Monday")} at ${String(campaign.report.hour).padStart(2, "0")}:00 ${esc(campaign.report.zone)}</td></tr>
  </table>
  <div style="padding-top:22px"><a href="${esc(preview)}" style="display:inline-block;background:${ACCENT};color:#fff;font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:9px">See your campaign</a></div>
  <p style="font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};margin:22px 0 0">Changes before the start date are free. Reply to this email with the wording or the colours you want and we will update it.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return {
    subject: `Your KeyLearn campaign is booked: ${from}`,
    text,
    ...(campaign.report.format === "text" ? {} : { html }),
  };
}
