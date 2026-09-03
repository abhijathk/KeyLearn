import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { Application } from "@fastr/core";
import {
  AdCampaign,
  AdSeen,
  AdStat,
  Notice,
  Order,
  SiteConfig,
  SiteConfigHistory,
} from "@keylearn/database";
import { setSiteConfigValues } from "@keylearn/site-config";
import { deepEqual, equal, includes, isFalse, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { resetDeskNoticeCache } from "../support/qdesk-forward.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { isSafeHref } from "./controller.ts";
import { checkAdText } from "./limits.ts";
import { acceptLogo, sanitiseSvg } from "./logo.ts";
import { reportText, weekWindow } from "./report.ts";
import { AdSweep, isReportDue } from "./sweep.ts";

/**
 * The sponsor slot (control centre phase 4).
 *
 * The tests are grouped by the promise each one keeps rather than by the
 * function it calls, because every rule here was sold to somebody: to
 * advertisers in the published pack, to readers on the "why this ad" page,
 * and to the people who run the site in the control centre.
 */

const context = new TestContext();
const OPS_KEY = "Nq8s4Xb2m0PfTz1Lc7RkYw3Ve6Hd9Jg5";

let desk: Server;
let deskUrl = "";
let deskNotices: Record<string, unknown>[] = [];

before(async () => {
  desk = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/_/apps/notices") {
      res.end(JSON.stringify({ notices: deskNotices }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) => desk.listen(0, resolve));
  const address = desk.address();
  deskUrl = `http://127.0.0.1:${typeof address === "object" && address != null ? address.port : 0}`;
});

after(() => {
  desk.close();
});

const DAY_MS = 24 * 60 * 60 * 1000;

function campaignInput(extra: Record<string, unknown> = {}) {
  return {
    advertiser: "Keychron",
    screens: [
      {
        template: "offer",
        headline: "15% off mechanical keyboards",
        button: "Copy code",
        code: "KEYLEARN15",
        href: "https://keychron.com/keylearn",
      },
    ],
    palette: { bar: "#0B2B3F", button: "#F4B53F", buttonInk: "#231A08" },
    startsAt: new Date(Date.now() - DAY_MS).toISOString(),
    endsAt: new Date(Date.now() + 6 * DAY_MS).toISOString(),
    dismissible: true,
    capPerDay: 3,
    pauseForNotices: true,
    soleOccupancy: false,
    weeklyPence: 12_000,
    reportDay: 1,
    reportHour: 9,
    reportZone: "Europe/London",
    reportFormat: "designed",
    reportTo: ["ads@keychron.example"],
    ...extra,
  };
}

async function fresh() {
  await AdCampaign.query().delete();
  await AdStat.query().delete();
  await AdSeen.query().delete();
  await Notice.query().delete();
  await SiteConfig.query().delete();
  await SiteConfigHistory.query().delete();
  await Order.query().delete();
  setSiteConfigValues(new Map([["ads.enabled", true]]));
  process.env.OPS_API_KEY = OPS_KEY;
  process.env.ADMIN_EMAILS = "user1@keylearn.org";
  process.env.QDESK_URL = deskUrl;
  process.env.QDESK_APP_KEY = "stub-app-key";
  deskNotices = [];
  resetDeskNoticeCache();
  context.mailer.dump();
  return startApp(context.get(Application, kMain));
}

type Req = Awaited<ReturnType<typeof fresh>>;

async function createCampaign(
  request: Req,
  extra: Record<string, unknown> = {},
): Promise<any> {
  const response = await request
    .POST("/_/internal/ads")
    .header("x-ops-api-key", OPS_KEY)
    .send(campaignInput(extra));
  const text = await response.body.text();
  equal(response.status, 200, text);
  return JSON.parse(text);
}

async function publish(request: Req, id: number): Promise<any> {
  const response = await request
    .POST(`/_/internal/ads/${id}/status`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ status: "scheduled", approvedBy: "Ada" });
  const text = await response.body.text();
  equal(response.status, 200, text);
  return JSON.parse(text);
}

async function feed(request: Req): Promise<any> {
  const response = await request.GET("/_/ads").send();
  equal(response.status, 200);
  return await response.body.json();
}

test("a campaign is a draft until somebody publishes it, and publishing books it", async () => {
  const request = await fresh();
  const draft = await createCampaign(request);
  equal(draft.status, "draft");
  isTrue(
    draft.previewToken.length >= 16,
    "the preview link is long enough not to be guessed",
  );

  deepEqual((await feed(request)).ads, [], "a draft never reaches a reader");

  const live = await publish(request, draft.id);
  equal(live.status, "scheduled");
  equal(live.approvedBy, "Ada", "the approver's name is recorded");

  const shown = await feed(request);
  equal(shown.ads.length, 1);
  equal(shown.ads[0].advertiser, "Keychron");
  equal(shown.dwellSeconds, 8, "the rotation timing comes from the registry");
  isFalse(
    "weeklyPence" in shown.ads[0],
    "what a reader receives carries no money",
  );
  isFalse(
    "previewToken" in shown.ads[0],
    "what a reader receives carries no preview token",
  );

  const mail = context.mailer.dump();
  equal(mail.length, 1, "publishing sends the booking confirmation");
  equal(mail[0].to, "ads@keychron.example");
  includes(mail[0].text ?? "", draft.previewToken);
});

test("the site-wide switch stops every campaign, whatever its dates say", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  await publish(request, campaign.id);
  equal((await feed(request)).ads.length, 1);

  setSiteConfigValues(new Map([["ads.enabled", false]]));
  deepEqual(
    (await feed(request)).ads,
    [],
    "off means off, without touching a single campaign",
  );
});

test("a paying household and a signed-out visitor are treated differently", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  await publish(request, campaign.id);

  equal((await feed(request)).ads.length, 1, "a visitor sees it by default");

  setSiteConfigValues(
    new Map<string, unknown>([
      ["ads.enabled", true],
      ["ads.showToGuests", false],
    ]),
  );
  deepEqual(
    (await feed(request)).ads,
    [],
    "and stops seeing it when guests are switched off",
  );

  setSiteConfigValues(new Map([["ads.enabled", true]]));
  const user = (await findUser("user1@keylearn.org"))!;
  await request.become(user.id!);
  equal((await feed(request)).ads.length, 1, "a free account still sees it");

  await Order.query().insert({
    id: "txn-ads-1",
    provider: "paddle",
    userId: user.id!,
    name: "Premium",
  } as any);
  deepEqual(
    (await feed(request)).ads,
    [],
    "premium is ad-free, which is what was bought",
  );
  await request.become(null);
});

test("a site notice takes the strip, and the campaign is credited the time", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  await publish(request, campaign.id);

  deskNotices = [
    {
      id: 9,
      message: "Sign-in is slow this morning.",
      kind: "incident",
      display: "banner",
      audience: "everyone",
      dismissible: false,
      createdAt: new Date().toISOString(),
    },
  ];
  resetDeskNoticeCache();
  deepEqual(
    (await feed(request)).ads,
    [],
    "a campaign that stands aside for a notice is not served while one is up",
  );

  const sweep = context.get(AdSweep);
  const credited = await sweep.creditForNotices(30, Date.now());
  equal(credited, 1);
  const after = await AdCampaign.query().findById(campaign.id);
  equal(after!.creditedMinutes, 30, "the minutes come back as run time");
  equal(
    after!.finishesAt.getTime() - new Date(after!.endsAt!).getTime(),
    30 * 60_000,
    "and the finish moves by exactly that much",
  );

  deskNotices = [];
  resetDeskNoticeCache();
  equal(
    (await feed(request)).ads.length,
    1,
    "and it returns when the notice goes",
  );
});

test("a campaign that shares the strip with a notice is not credited", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request, { pauseForNotices: false });
  await publish(request, campaign.id);
  deskNotices = [
    {
      id: 9,
      message: "Planned maintenance tonight.",
      kind: "maintenance",
      display: "banner",
      audience: "everyone",
      dismissible: true,
      createdAt: new Date().toISOString(),
    },
  ];
  resetDeskNoticeCache();
  equal((await feed(request)).ads.length, 1, "it keeps running");
  equal(await context.get(AdSweep).creditForNotices(30, Date.now()), 0);
});

test("a view counts once a day per reader, and a click leaves by our own door", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  await publish(request, campaign.id);

  for (let n = 0; n < 3; n++) {
    const response = await request
      .POST("/_/ads/view")
      .send({ id: campaign.id, screen: 0 });
    equal(response.status, 200, "a repeat is never an error");
  }
  const week = weekWindow(new Date(Date.now() + DAY_MS));
  const stats = await AdStat.forCampaign(campaign.id, week.fromDay, week.toDay);
  equal(stats.length, 1);
  equal(stats[0]!.views, 1, "three renders are one reader");

  const click = await request.GET(`/go/ad/${campaign.id}/0`).send();
  equal(click.status, 302);
  equal(click.headers.get("location"), "https://keychron.com/keylearn");
  equal(click.headers.get("referrer-policy"), "no-referrer");
  const after = await AdStat.forCampaign(campaign.id, week.fromDay, week.toDay);
  equal(after[0]!.clicks, 1);

  equal(
    (await request.GET(`/go/ad/${campaign.id}/2`).send()).status,
    404,
    "a screen the campaign does not have goes nowhere",
  );
  equal((await request.GET("/go/ad/99999/0").send()).status, 404);
});

test("the redirect only ever accepts a destination the campaign itself stored", () => {
  isTrue(isSafeHref("https://example.com/x"));
  isFalse(isSafeHref("http://example.com"), "plain http is refused");
  isFalse(isSafeHref("javascript:alert(1)"));
  isFalse(isSafeHref("data:text/html,<script>"));
  isFalse(isSafeHref("/somewhere"));
});

test("copy that breaks a published rule is refused with the reason", async () => {
  const request = await fresh();
  const refused = await request
    .POST("/_/internal/ads")
    .header("x-ops-api-key", OPS_KEY)
    .send(
      campaignInput({
        screens: [
          {
            template: "offer",
            headline: "Best casino bonus of the year",
            href: "https://example.com",
          },
        ],
      }),
    );
  equal(refused.status, 400);
  includes(await refused.body.text(), "casino");

  const http = await request
    .POST("/_/internal/ads")
    .header("x-ops-api-key", OPS_KEY)
    .send(
      campaignInput({
        screens: [
          {
            template: "offer",
            headline: "A perfectly ordinary line",
            href: "http://example.com",
          },
        ],
      }),
    );
  equal(http.status, 400, "an http destination is refused");

  const zone = await request
    .POST("/_/internal/ads")
    .header("x-ops-api-key", OPS_KEY)
    .send(campaignInput({ reportZone: "+05:30" }));
  equal(zone.status, 400, "an offset is not a time zone");
});

test("the word and shouting checks catch what a person would catch", () => {
  equal(checkAdText("headline", "A quiet, ordinary line"), null);
  includes(
    checkAdText("headline", "Try our vaping range")?.reason ?? "",
    "vaping",
  );
  includes(checkAdText("headline", "BUY NOW TODAY")?.reason ?? "", "capitals");
});

test("an SVG logo is rewritten into a drawing before it is stored", () => {
  const hostile = `<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('https://evil.example')">
    <script>fetch('https://evil.example')</script>
    <image href="https://evil.example/pixel.png" />
    <a xlink:href="javascript:alert(1)"><rect width="10" height="10" fill="#f00"/></a>
  </svg>`;
  const clean = sanitiseSvg(hostile);
  isFalse(clean.includes("<script"), "no script survives");
  isFalse(clean.includes("onload"), "no event handler survives");
  isFalse(clean.includes("evil.example"), "no external reference survives");
  isTrue(clean.includes("<rect"), "the drawing does survive");

  const accepted = acceptLogo(
    `data:image/svg+xml;base64,${Buffer.from(hostile, "utf8").toString("base64")}`,
  );
  isTrue(accepted.ok);
  const refusedType = acceptLogo("data:text/html;base64,PGh0bWw+");
  isFalse(refusedType.ok);
  const refusedSize = acceptLogo(
    `data:image/png;base64,${Buffer.alloc(60 * 1024).toString("base64")}`,
  );
  isFalse(refusedSize.ok);
  includes(refusedSize.ok ? "" : refusedSize.reason, "KB");
});

test("the advertiser's preview link works without an account and is not indexed", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  const page = await request.GET(`/ad-preview/${campaign.previewToken}`).send();
  equal(page.status, 200);
  const html = await page.body.text();
  includes(html, "Keychron");
  includes(html, "15% off mechanical keyboards");
  includes(html, "Light");
  includes(html, "Dark");
  equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
  equal((await request.GET("/ad-preview/not-a-real-token").send()).status, 404);
});

test("the reader's page says who paid and what was not done", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  await publish(request, campaign.id);
  const page = await request.GET("/why-this-ad").send();
  equal(page.status, 200);
  const html = await page.body.text();
  includes(html, "Keychron");
  includes(html, "We did not target you.");
  includes(html, "Children never see advertising here.");
});

test("a report goes out on the advertiser's own day and hour, in their own zone", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request, {
    reportZone: "Australia/Sydney",
    reportDay: 1,
    reportHour: 9,
  });
  await publish(request, campaign.id);
  context.mailer.dump();
  const row = (await AdCampaign.query().findById(campaign.id))!;

  // 09:00 Monday in Sydney is 23:00 the Sunday before, in UTC.
  const due = Date.parse("2026-09-06T23:00:00Z");
  isTrue(isReportDue(row, due), "the hour is read where the advertiser is");
  isFalse(
    isReportDue(row, Date.parse("2026-09-06T09:00:00Z")),
    "and not where the server is",
  );

  const sweep = context.get(AdSweep);
  equal(await sweep.sendDueReports(due), 1);
  const mail = context.mailer.dump();
  equal(mail.length, 1);
  includes(mail[0].subject, "Keychron");
  isTrue(mail[0].html != null, "the designed format was chosen");

  equal(
    await sweep.sendDueReports(due + 5 * 60_000),
    0,
    "the same hour does not send twelve times as the sweep passes through it",
  );
});

test("an advertiser who asked for plain text gets plain text", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request, { reportFormat: "text" });
  await publish(request, campaign.id);
  const mail = context.mailer.dump();
  equal(mail.length, 1);
  equal(mail[0].html, undefined, "no designed body for a text booking");

  const details = (await AdCampaign.query().findById(campaign.id))!.toDetails();
  const text = reportText(
    details,
    [{ screen: 0, views: 400, clicks: 12 }],
    "2026-08-31",
    "2026-09-06",
  );
  includes(text, "Views    400");
  includes(text, "3.00%");
  includes(text, "no audience breakdown");
});

test("a campaign can be filed away and brought back exactly as it was", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  await publish(request, campaign.id);

  const running = await request
    .POST(`/_/internal/ads/${campaign.id}/archive`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ archived: true });
  equal(
    running.status,
    400,
    "a running campaign is stopped before it is filed",
  );

  await request
    .POST(`/_/internal/ads/${campaign.id}/status`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ status: "paused" });
  const filed = await request
    .POST(`/_/internal/ads/${campaign.id}/archive`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ archived: true });
  equal(filed.status, 200);
  isTrue((await filed.body.json<any>()).archived);

  const current = await request
    .GET("/_/internal/ads")
    .header("x-ops-api-key", OPS_KEY)
    .send();
  equal(
    (await current.body.json<any>()).campaigns.length,
    0,
    "out of the list",
  );
  const archive = await request
    .GET("/_/internal/ads?archived=1")
    .header("x-ops-api-key", OPS_KEY)
    .send();
  const filedRows = (await archive.body.json<any>()).campaigns;
  equal(filedRows.length, 1, "and on the archive shelf");
  equal(filedRows[0].status, "paused", "keeping whatever it ended as");
  equal(filedRows[0].weeklyPence, 12_000, "and its figures");

  const restored = await request
    .POST(`/_/internal/ads/${campaign.id}/archive`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ archived: false });
  equal(restored.status, 200);
  const back = await restored.body.json<any>();
  isFalse(back.archived);
  equal(
    back.status,
    "paused",
    "restored as it was filed, not as something new",
  );
});

test("an archived campaign never runs and never reports", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request);
  await publish(request, campaign.id);
  await AdCampaign.setArchived(campaign.id, true);
  context.mailer.dump();

  deepEqual((await feed(request)).ads, [], "nothing is served");
  const row = (await AdCampaign.query().findById(campaign.id))!;
  isFalse(row.live(), "and it does not count as live");
  await AdStat.bump(campaign.id, 0, "views");
  equal(
    await context
      .get(AdSweep)
      .sendDueReports(Date.parse("2026-09-07T08:00:00Z")),
    0,
    "filing it away stops the mail too",
  );
});

test("sole occupancy means the bar, and the rotation cap holds", async () => {
  const request = await fresh();
  const first = await createCampaign(request, { advertiser: "Keychron" });
  const second = await createCampaign(request, { advertiser: "Logitech" });
  await publish(request, first.id);
  await publish(request, second.id);
  equal((await feed(request)).ads.length, 2, "two campaigns share the strip");

  await AdCampaign.query().findById(second.id).patch({ soleOccupancy: true });
  const alone = await feed(request);
  equal(alone.ads.length, 1);
  equal(
    alone.ads[0].advertiser,
    "Logitech",
    "the one that bought the bar has it",
  );

  await AdCampaign.query().findById(second.id).patch({ soleOccupancy: false });
  setSiteConfigValues(
    new Map<string, unknown>([
      ["ads.enabled", true],
      ["ads.maxRotation", 1],
    ]),
  );
  equal((await feed(request)).ads.length, 1, "the rotation cap is respected");
});

test("a finished campaign is closed by the sweep, credited time included", async () => {
  const request = await fresh();
  const campaign = await createCampaign(request, {
    startsAt: new Date(Date.now() - 8 * DAY_MS).toISOString(),
    endsAt: new Date(Date.now() - DAY_MS).toISOString(),
  });
  await publish(request, campaign.id);
  const sweep = context.get(AdSweep);
  equal(await sweep.closeFinished(Date.now()), 1);
  equal((await AdCampaign.query().findById(campaign.id))!.status, "finished");

  await AdCampaign.query()
    .findById(campaign.id)
    .patch({ status: "scheduled", creditedMinutes: 3 * 24 * 60 });
  equal(
    await sweep.closeFinished(Date.now()),
    0,
    "credited time keeps a campaign running past its own end date",
  );
});

test("the deduplication hashes expire, and nothing about a reader is kept", async () => {
  await fresh();
  isTrue(await AdSeen.first("a".repeat(48), 1000));
  isFalse(
    await AdSeen.first("a".repeat(48), 1000),
    "the second time is a repeat",
  );
  const row = await AdSeen.query().findOne({ hash: "a".repeat(48) });
  deepEqual(
    Object.keys(row!).sort(),
    ["expiresAt", "hash", "id"],
    "a row holds a digest, an expiry and nothing else",
  );
  equal(await AdSeen.sweep(Date.now() + 2000), 1, "and it is swept away");
});
