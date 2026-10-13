import { test } from "node:test";
import { Application } from "@fastr/core";
import { AdSeen, User, VisitStat } from "@keylearn/database";
import { deepEqual, equal, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { decodeOrigin, DIRECT, encodeOrigin, visitOrigin } from "./origin.ts";

/**
 * Campaign tracking for the desk's traffic widgets: where visits and new
 * accounts come from, counted by day, with nobody recorded.
 */

const context = new TestContext();
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15";

async function fresh() {
  await VisitStat.query().delete();
  await AdSeen.query().delete();
  return startApp(context.get(Application, kMain));
}

test("a campaign link names itself, and its words are cleaned", () => {
  deepEqual(
    visitOrigin(
      {
        source: "Facebook",
        medium: "Social",
        campaign: "Parents Oct!! 2026",
        referrer: "www.google.com",
      },
      "www.keylearn.org",
    ),
    { source: "facebook", medium: "social", campaign: "parents-oct-2026" },
    "the link wins over the referring page",
  );
  deepEqual(visitOrigin({ source: "newsletter" }, "keylearn.org"), {
    source: "newsletter",
    medium: "(none)",
    campaign: "(none)",
  });
});

test("a visit without a campaign is named from the page that sent it", () => {
  const own = "www.keylearn.org";
  deepEqual(visitOrigin({ referrer: "www.google.com" }, own), {
    source: "google.com",
    medium: "search",
    campaign: "(none)",
  });
  deepEqual(visitOrigin({ referrer: "m.facebook.com" }, own), {
    source: "facebook.com",
    medium: "social",
    campaign: "(none)",
  });
  deepEqual(visitOrigin({ referrer: "teachers.example.edu" }, own), {
    source: "teachers.example.edu",
    medium: "referral",
    campaign: "(none)",
  });
  equal(
    visitOrigin({ referrer: "keylearn.org" }, own),
    DIRECT,
    "our own pages",
  );
  equal(visitOrigin({}, own), DIRECT, "nothing at all");
  equal(visitOrigin({ referrer: "not a host" }, own), DIRECT, "junk");
});

test("the cookie only ever carries the three campaign words", () => {
  const origin = { source: "facebook", medium: "social", campaign: "parents" };
  deepEqual(decodeOrigin(encodeOrigin(origin)), origin);
  equal(decodeOrigin(null), DIRECT);
  equal(decodeOrigin("one|two"), DIRECT, "a mangled cookie is direct");
  deepEqual(
    decodeOrigin("Evil<script>|x|y"),
    { source: "evil-script", medium: "x", campaign: "y" },
    "a hand-written cookie is cleaned like a link",
  );
});

test("a browser counts once a day, and bots are not counted", async () => {
  const request = await fresh();
  for (let n = 0; n < 3; n++) {
    const response = await request
      .POST("/_/visit")
      .header("user-agent", BROWSER)
      .send({ source: "facebook", medium: "social", campaign: "parents" });
    equal(response.status, 200);
  }
  await request
    .POST("/_/visit")
    .header("user-agent", "Googlebot/2.1 (+http://www.google.com/bot.html)")
    .send({ referrer: "www.google.com" });
  const rows = await VisitStat.query();
  equal(rows.length, 1, "the bot left no row");
  equal(rows[0]!.source, "facebook");
  equal(rows[0]!.visits, 1, "three page loads are one visit");
});

test("a new account is counted against the campaign that brought it", async () => {
  const request = await fresh();
  await request
    .POST("/_/visit")
    .header("user-agent", BROWSER)
    .send({ source: "facebook", medium: "social", campaign: "parents" });
  const res = await request.POST("/auth/register-password").send({
    email: "parent@example.com",
    password: "a-long-enough-password-12",
    firstName: "Asha",
    lastName: "Menon",
    dateOfBirth: "1988-04-02",
  });
  equal(res.status, 200);
  isTrue((await User.findByEmail("parent@example.com")) != null);
  const rows = await VisitStat.query().where("source", "facebook");
  equal(rows.length, 1);
  equal(rows[0]!.visits, 1);
  equal(rows[0]!.signups, 1, "the signup joined its campaign's row");
});

test("an account with no campaign behind it counts as direct", async () => {
  const request = await fresh();
  const res = await request.POST("/auth/register-password").send({
    email: "walkin@example.com",
    password: "a-long-enough-password-12",
    firstName: "Ravi",
    lastName: "Nair",
    dateOfBirth: "1985-09-12",
  });
  equal(res.status, 200);
  const rows = await VisitStat.query();
  equal(rows.length, 1);
  equal(rows[0]!.source, "direct");
  equal(rows[0]!.signups, 1);
});

test("a flood of invented campaigns is folded into one row", async () => {
  await fresh();
  const day = new Date();
  for (let n = 0; n < VisitStat.maxRowsPerDay + 5; n++) {
    await VisitStat.bump(
      { source: `junk-${n}`, medium: "x", campaign: "y" },
      "visits",
      day,
    );
  }
  equal(await VisitStat.query().resultSize(), VisitStat.maxRowsPerDay + 1);
  const other = await VisitStat.query().findOne({ source: "(other)" });
  equal(other?.visits, 5);
});
