import {
  type AdCampaignDetails,
  type AdPalette,
  type AdScreen,
} from "@keylearn/database";

/**
 * The two standalone pages the sponsor slot needs, rendered as plain HTML
 * by the server.
 *
 * Neither belongs in the application bundle. One is read by advertisers who
 * have no account and arrive from an email, the other by a reader who has
 * just clicked "Why this ad?" and wants an answer rather than a
 * single-page app. Both are one document with no script beyond a theme
 * toggle, which is also what makes them safe to hand to somebody outside.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A colour is only ever a hex literal; anything else falls back. */
function colour(value: string | undefined, fallback: string): string {
  return value != null && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function barBackground(palette: AdPalette, dark: boolean): string {
  const base = colour(
    dark ? (palette.barDark ?? palette.bar) : palette.bar,
    dark ? "#16202b" : "#0b2b3f",
  );
  const accent = colour(palette.accent, base);
  switch (palette.treatment) {
    case "gradient":
      return `linear-gradient(90deg, ${base}, ${accent})`;
    case "flag":
      return `linear-gradient(90deg, ${base} 0 60%, ${accent} 60% 100%)`;
    default:
      return base;
  }
}

/**
 * One screen of a campaign, as the bar renders it.
 *
 * The markup mirrors the React component in pages-shared so the preview an
 * advertiser is sent is the thing readers get, not an artist's impression
 * of it.
 */
export function renderBar(
  campaign: AdCampaignDetails,
  screen: AdScreen,
  index: number,
  dark: boolean,
): string {
  const palette = campaign.palette;
  const ink = colour(palette.text, dark ? "#e9f2f8" : "#eaf4fa");
  const button = colour(palette.button, "#f4b53f");
  const buttonInk = colour(palette.buttonInk, "#231a08");
  const logo = campaign.hasLogo
    ? `<img class="adLogo" src="/_/ads/logo/${campaign.id}" alt="${escapeHtml(campaign.advertiser)}" />`
    : "";
  const support =
    screen.support != null && screen.support !== ""
      ? ` <span class="adSupport">${escapeHtml(screen.support)}</span>`
      : "";
  const cta =
    screen.button != null && screen.button !== ""
      ? `<span class="adCta" style="background:${button};color:${buttonInk}">${escapeHtml(screen.button)}</span>`
      : "";
  const code =
    screen.code != null && screen.code !== ""
      ? `<span class="adCode">${escapeHtml(screen.code)}</span>`
      : "";
  const meter =
    screen.template === "cause" && screen.goal != null && screen.goal > 0
      ? `<span class="adMeter"><i style="inline-size:${Math.min(100, Math.round(((screen.raised ?? 0) / screen.goal) * 100))}%;background:${button}"></i></span>`
      : "";
  return `<div class="adBar" data-screen="${index}" style="background:${barBackground(palette, dark)};color:${ink}">
  <span class="adTag">Ad</span>
  ${logo}
  <span class="adText"><b>${escapeHtml(campaign.advertiser)}</b>${support === "" ? "" : " ·"} ${escapeHtml(screen.headline)}${support}</span>
  ${meter}
  ${code}
  ${cta}
  <span class="adWhy">Why this ad?</span>
</div>`;
}

const SHARED_CSS = `
:root {
  color-scheme: light;
  --canvas: #f6f7f9;
  --surface: #ffffff;
  --sunken: #eef1f4;
  --border: #e4e8ed;
  --divider: #eef1f4;
  --ink: #1c2430;
  --ink-2: #5b6675;
  --ink-3: #7d8794;
  --kl: #2f8a5d;
  --kl-deep: #1e6a43;
  --kl-tint: #e4f1ea;
  --kl-ink: #ffffff;
  --mono: ui-monospace, "SF Mono", "Roboto Mono", Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --canvas: #151a21;
    --surface: #1a2029;
    --sunken: #0f1319;
    --border: #2a313b;
    --divider: #232a34;
    --ink: #e2e7ee;
    --ink-2: #98a2b0;
    --ink-3: #828d9b;
    --kl: #8fd9b6;
    --kl-deep: #b0e6cb;
    --kl-tint: #1b2f27;
    --kl-ink: #10241a;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --canvas: #151a21;
  --surface: #1a2029;
  --sunken: #0f1319;
  --border: #2a313b;
  --divider: #232a34;
  --ink: #e2e7ee;
  --ink-2: #98a2b0;
  --ink-3: #828d9b;
  --kl: #8fd9b6;
  --kl-deep: #b0e6cb;
  --kl-tint: #1b2f27;
  --kl-ink: #10241a;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--canvas); color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
.page { max-width: 46rem; margin: 0 auto; padding: 1.2rem 1.1rem 4rem; }
.top { display: flex; align-items: center; gap: .5rem; padding-block: .55rem; border-block-end: 1px solid var(--border); }
.word { display: flex; gap: .16rem; align-items: center; }
.word i { inline-size: 1.05rem; block-size: 1.05rem; border-radius: .26rem; background: var(--kl-tint); color: var(--kl-deep); display: grid; place-items: center; font-size: .62rem; font-weight: 800; font-style: normal; }
.word b { margin-inline-start: .2rem; font-size: .88rem; font-weight: 600; }
h1 { margin: 1.8rem 0 .5rem; font-size: 1.7rem; font-weight: 700; letter-spacing: -.02em; text-wrap: balance; }
h2 { margin: 2rem 0 .5rem; font-size: 1.02rem; font-weight: 700; letter-spacing: -.01em; }
.lede { margin: 0 0 1.4rem; color: var(--ink-2); font-size: .98rem; }
p { font-size: .92rem; color: var(--ink-2); }
p b { color: var(--ink); font-weight: 600; }
dl.facts { display: grid; gap: 0; margin: 0 0 1.6rem; border-block: 1px solid var(--border); }
dl.facts > div { display: grid; grid-template-columns: 10.5rem minmax(0, 1fr); gap: .15rem 1rem; padding: .6rem 0; border-block-end: 1px solid var(--divider); }
dl.facts > div:last-child { border-block-end: 0; }
dl.facts dt { color: var(--ink-3); font-size: .8rem; }
dl.facts dd { margin: 0; font-size: .9rem; }
ul.plain { display: grid; gap: .45rem; margin: .7rem 0 0; padding: 0; list-style: none; }
ul.plain li { position: relative; padding-inline-start: 1.3rem; font-size: .9rem; color: var(--ink-2); }
ul.plain li::before { content: "\\2014"; position: absolute; inset-inline-start: 0; color: var(--ink-3); }
ul.plain b { color: var(--ink); font-weight: 600; }
.panel { border: 1px solid var(--border); border-radius: .6rem; background: var(--surface); padding: .9rem 1rem 1rem; margin-block: 1.2rem; }
.panel h2 { margin-block-start: 0; }
.actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-block-start: .8rem; }
.btn { border: 1px solid var(--kl); border-radius: .5rem; padding: .45rem .95rem; background: var(--kl); color: var(--kl-ink); font: inherit; font-size: .85rem; font-weight: 600; text-decoration: none; cursor: pointer; display: inline-block; }
.btnQuiet { border: 1px solid var(--border); background: transparent; color: var(--ink); }
.btn:focus-visible { outline: 2px solid var(--kl); outline-offset: 2px; }
footer { margin-block-start: 2.4rem; padding-block-start: 1.1rem; border-block-start: 1px solid var(--border); color: var(--ink-3); font-size: .82rem; }
footer a { color: var(--kl-deep); }
.quoted { border: 1px solid var(--border); border-radius: .6rem; overflow: hidden; margin-block: 1rem 1.4rem; }
.quotedLabel { padding: .4rem .8rem; background: var(--sunken); border-block-end: 1px solid var(--border); font-family: var(--mono); font-size: .58rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); display: flex; justify-content: space-between; gap: 1rem; }
.adBar { display: flex; align-items: center; gap: .7rem; min-block-size: 2.4rem; padding: .32rem 1rem; font-size: .85rem; }
.adTag { flex: none; border: 1px solid currentColor; border-radius: .3rem; padding: .03rem .3rem; font-family: var(--mono); font-size: .54rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; opacity: .85; }
.adLogo { flex: none; inline-size: 1.4rem; block-size: 1.4rem; object-fit: contain; border-radius: .3rem; }
.adText { flex: 1 1 auto; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adSupport { opacity: .8; }
.adCode { flex: none; border: 1px dashed currentColor; border-radius: .3rem; padding: .04rem .4rem; font-family: var(--mono); font-size: .72rem; letter-spacing: .06em; }
.adCta { flex: none; border-radius: .4rem; padding: .22rem .7rem; font-size: .76rem; font-weight: 700; }
.adMeter { flex: none; inline-size: 5rem; block-size: .34rem; border-radius: .2rem; background: rgba(255,255,255,.28); overflow: hidden; }
.adMeter i { display: block; block-size: 100%; }
.adWhy { flex: none; font-size: .68rem; opacity: .7; text-decoration: underline; }
@media (max-width: 40rem) { .adWhy, .adCode { display: none; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

function shell(title: string, bodyHtml: string, extraCss = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${SHARED_CSS}${extraCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * "Why am I seeing this?", written for a reader who suspects they have
 * been profiled and deserves a straight answer that they have not been.
 */
export function whyThisAdPage(live: readonly AdCampaignDetails[]): string {
  const quoted =
    live.length === 0
      ? `<p class="lede">Nothing is running at the moment, so there is no advertisement on the page right now.</p>`
      : live
          .map(
            (campaign) => `<div class="quoted">
  <div class="quotedLabel"><span>Running now</span><span>${escapeHtml(campaign.advertiser)}</span></div>
  ${renderBar(campaign, campaign.screens[0] ?? { template: "sponsor", headline: "", href: "" }, 0, false)}
</div>`,
          )
          .join("\n");
  const facts =
    live.length === 0
      ? ""
      : `<dl class="facts">
  <div><dt>Paid for by</dt><dd>${live.map((c) => escapeHtml(c.advertiser)).join(", ")}</dd></div>
  <div><dt>Shown to</dt><dd>Everyone reading an adult page this week</dd></div>
  <div><dt>Chosen because</dt><dd>They booked this week. Nothing else.</dd></div>
</dl>`;
  return shell(
    "Why this ad",
    `<div class="page">
  <div class="top">
    <span class="word" aria-hidden="true"><i>K</i><i>E</i><i>Y</i><b>learn</b></span>
  </div>
  <h1>Why am I seeing this?</h1>
  <p class="lede">Because somebody paid for that line at the top of the page, and for no other reason. Nothing about you decided it.</p>
  ${quoted}
  ${facts}
  <h2>What we did not do</h2>
  <p>Advertising usually means a profile of you being sold to somebody. That is not what this is, and the difference is worth setting out plainly.</p>
  <ul class="plain">
    <li><b>We did not target you.</b> Every adult reader sees the same line this week. There is no audience, no segment and no interest category.</li>
    <li><b>We did not use your practice data.</b> Your speed, your lessons, your mistakes and your certificates play no part in what appears.</li>
    <li><b>The advertiser learns nothing about you.</b> They receive a weekly count of views and clicks. Not who, not where, not when you practise.</li>
    <li><b>Nothing of theirs runs on this page.</b> No script, no tracking pixel, no embedded frame. We build the line ourselves from words and colours they send us.</li>
    <li><b>Clicking is counted, not followed.</b> A click adds one to a number on our own server. It carries nothing about you to them.</li>
    <li><b>Children never see advertising here.</b> Not on a child's profile, not in the kids world, not on a school account. That has no exception.</li>
  </ul>
  <div class="panel">
    <h2>If you would rather not see it</h2>
    <ul class="plain">
      <li><b>Close it.</b> The cross on the right hides it until you next load a page.</li>
      <li><b>Go premium.</b> A subscription removes advertising completely, along with more learner places and printable certificates.</li>
    </ul>
    <div class="actions">
      <a class="btn" href="/account">See premium</a>
      <a class="btn btnQuiet" href="/">Back to practice</a>
    </div>
  </div>
  <h2>What we will not accept from an advertiser</h2>
  <p>Every line is approved by a person here before it runs, against rules we publish. Nothing discriminatory, nothing abusive, nothing with a second meaning, no gambling, alcohol, vaping or weight loss, nothing aimed at children, and nothing dressed up to look like a message from us.</p>
  <footer>KeyLearn shows one paid line at the top of adult pages, sold by the week, and marked "Ad" every time.</footer>
</div>`,
  );
}

/**
 * The advertiser's preview: their campaign in both themes, with the facts
 * of the booking under it, from a link they can forward to a colleague.
 */
export function previewPage(campaign: AdCampaignDetails): string {
  const screens = campaign.screens;
  const rows = (dark: boolean) =>
    screens
      .map(
        (screen, index) => `<div class="quoted">
  <div class="quotedLabel"><span>Screen ${index + 1} of ${screens.length}</span><span>${escapeHtml(screen.template)}</span></div>
  ${renderBar(campaign, screen, index, dark)}
</div>`,
      )
      .join("\n");
  const money = (campaign.weeklyPence / 100).toFixed(2);
  const dates = `${new Date(campaign.startsAt).toUTCString().slice(5, 16)} to ${new Date(campaign.finishesAt).toUTCString().slice(5, 16)}`;
  return shell(
    `${campaign.advertiser} preview`,
    `<div class="page">
  <div class="top">
    <span class="word" aria-hidden="true"><i>K</i><i>E</i><i>Y</i><b>learn</b></span>
    <span style="margin-inline-start:auto;font-size:.78rem;color:var(--ink-3)">Advertiser preview</span>
  </div>
  <h1>${escapeHtml(campaign.advertiser)}</h1>
  <p class="lede">This is your campaign exactly as readers see it, in both themes. Nothing here is live traffic, and the link is private to you.</p>

  <h2>Light</h2>
  ${rows(false)}
  <h2>Dark</h2>
  ${rows(true)}

  <h2>Your booking</h2>
  <dl class="facts">
    <div><dt>Running</dt><dd>${escapeHtml(dates)}</dd></div>
    <div><dt>Screens</dt><dd>${screens.length}, rotating</dd></div>
    <div><dt>Weekly rental</dt><dd>&pound;${escapeHtml(money)}</dd></div>
    <div><dt>Dismissible</dt><dd>${campaign.dismissible ? "Yes, a reader can close it for their visit" : "No"}</dd></div>
    <div><dt>Weekly report</dt><dd>${DAYS[campaign.report.day]}s at ${String(campaign.report.hour).padStart(2, "0")}:00 ${escapeHtml(campaign.report.zone)}</dd></div>
    <div><dt>Status</dt><dd>${escapeHtml(campaign.status)}</dd></div>
  </dl>

  <div class="panel">
    <h2>Something to change?</h2>
    <p style="margin-block-start:.2rem">Reply to the booking email with the wording or the colours you want and we will update it. Changes before the start date are free.</p>
  </div>

  <footer>Shown above the header on adult pages only. Children never see advertising on KeyLearn, and nothing on this page tracks the people who read it.</footer>
</div>`,
  );
}
