import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  SiteConfig,
  SiteConfigHistory,
  StaffAuditEvent,
  User,
} from "@keylearn/database";
import { setSiteConfigValues } from "@keylearn/site-config";
import {
  deepEqual,
  equal,
  includes,
  isNotNull,
  isNull,
  isTrue,
} from "rich-assert";
import { leaderboardReady } from "../highscores/readiness.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { SiteConfigService } from "./service.ts";
import { maintenanceDeadline, SiteConfigSweep } from "./sweep.ts";

/**
 * Phase 1's KeyLearn side, each row against its acceptance line:
 *  1.3 a page off returns 404 to the public and 200 to an admin;
 *  1.4 closed mode refuses register, existing users sign in;
 *  1.5 the API and the bridge answer during maintenance, admins pass;
 *  1.7 the leaderboard override reverts on time;
 *  1.8 an unticked locale falls back to English;
 *  1.9 the last-login location switch lives in site_config;
 *  1.10 a change emails the other admins, never the changer.
 */

const context = new TestContext();

const OPS_KEY = "Nq8s4Xb2m0PfTz1Lc7RkYw3Ve6Hd9Jg5";
const ENV_KEYS = [
  "MULTIPLAYER_ENABLED",
  "LEADERBOARD_MIN_ACCOUNTS",
  "LEADERBOARD_MIN_RANKED",
  "QDESK_URL",
];

async function fresh() {
  await SiteConfig.query().delete();
  await SiteConfigHistory.query().delete();
  await StaffAuditEvent.query().delete();
  setSiteConfigValues(new Map());
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  process.env.OPS_API_KEY = OPS_KEY;
  process.env.ADMIN_EMAILS = "user1@keylearn.org, user3@keylearn.org";
  context.mailer.dump();
  const admin = (await findUser("user1@keylearn.org"))!.id!;
  const service = context.get(SiteConfigService);
  const request = startApp(context.get(Application, kMain));
  // Every GET as a browser behind the proxy would send it, past the
  // canonical-host redirect.
  const rawGet = request.GET.bind(request);
  (request as any).GET = (path: string) =>
    rawGet(path)
      .header("X-Forwarded-Host", "www.keylearn.org")
      .header("X-Forwarded-Proto", "https");
  return { admin, service, request };
}

const html = { accept: "text/html" };

test("1.3 a page off is 404 to the public, 200 to an admin, and gone from the nav data", async () => {
  const { admin, service, request } = await fresh();
  equal(
    (await request.GET("/kids").header("accept", html.accept).send()).status,
    200,
  );

  await service.set("pages.kids.state", "404", { userId: admin });
  equal(
    (await request.GET("/kids").header("accept", html.accept).send()).status,
    404,
    "plain route",
  );
  equal(
    (await request.GET("/de/kids").header("accept", html.accept).send()).status,
    404,
    "locale twin",
  );

  await request.become("user1@keylearn.org");
  equal(
    (await request.GET("/kids").header("accept", html.accept).send()).status,
    200,
    "an admin previews it",
  );
  const page = await (
    await request.GET("/").header("accept", html.accept).send()
  ).body.text();
  includes(page, '"kids":"404"', "page data carries the state");
  includes(page, '"admin":true');
  await request.become(null);

  // "Coming soon" is announced, not hidden: the link stays on the menu, so
  // the page answers 200 with the panel. An error status would tell somebody
  // who followed a link we are still offering that they made a mistake.
  // `noindex` is what keeps it out of search results (owner, 4 Sep 2026).
  await service.set("pages.kids.state", "soon", { userId: admin });
  const soon = await request.GET("/kids").header("accept", html.accept).send();
  equal(soon.status, 200);
  equal(soon.headers.get("x-robots-tag"), "noindex, nofollow");
  includes(await soon.body.text(), "Coming soon");

  await service.set("pages.publicProfiles.state", "404", { userId: admin });
  equal(
    (
      await request
        .GET("/profile/example1")
        .header("accept", html.accept)
        .send()
    ).status,
    404,
    "public profile",
  );
  equal(
    (await request.GET("/profile").header("accept", html.accept).send()).status,
    200,
    "the owner's own progress page is not a public profile",
  );

  await service.set("pages.highScores.state", "404", { userId: admin });
  const sitemap = await (await request.GET("/sitemap.xml").send()).body.text();
  equal(
    sitemap.includes("/high-scores"),
    false,
    "a page off is not in the sitemap",
  );
});

test("1.4 registration: closed refuses, invite needs a code and uses it up, existing users always sign in", async () => {
  const { admin, service, request } = await fresh();
  const register = (body: Record<string, unknown>) =>
    request.POST("/auth/register-password").send({
      email: "new.person@example.com",
      password: "a-long-enough-password-8",
      firstName: "New",
      lastName: "Person",
      dateOfBirth: "1990-01-01",
      ...body,
    });

  await service.set("registration.mode", "closed", { userId: admin });
  const closed = await register({});
  equal(closed.status, 403);
  equal(
    (await closed.body.json<{ error: { code: string } }>()).error.code,
    "registration-closed",
  );
  isNull(await User.findByEmail("new.person@example.com"));

  // A sign-in link for an unknown address would create the account: refused.
  const link = await request
    .POST("/auth/login/register-email")
    .send({ email: "another@example.com" });
  equal(link.status, 403);
  // …but a known address always gets its link.
  const known = await request
    .POST("/auth/login/register-email")
    .send({ email: "user2@keylearn.org" });
  equal(known.status, 200);

  await service.set("registration.mode", "invite", { userId: admin });
  await service.set("registration.inviteCodes", ["ALPHA-1", "BETA-2"], {
    userId: admin,
  });
  const noCode = await register({});
  equal(noCode.status, 403);
  equal(
    (await noCode.body.json<{ error: { code: string } }>()).error.code,
    "invite-required",
  );
  const wrongCode = await register({ inviteCode: "NOPE" });
  equal(
    (await wrongCode.body.json<{ error: { code: string } }>()).error.code,
    "invite-invalid",
  );
  const withCode = await register({
    inviteCode: " alpha-1 ".toUpperCase().trim(),
  });
  equal(withCode.status, 200, await withCode.body.text());
  isNotNull(await User.findByEmail("new.person@example.com"));
  const entry = await service.entry("registration.inviteCodes");
  deepEqual(entry.value, ["BETA-2"], "the code is used up");
  const history = await service.history(3, "registration.inviteCodes");
  isNull(history[0].actorUserId, "consumed as a system change");
  includes(history[0].reason ?? "", "invite code used");

  await service.set("registration.mode", "open", { userId: admin });
  const open = await register({ email: "third@example.com" });
  equal(open.status, 200);
});

test("1.5 maintenance: visitors get the message, the API and admins keep working, and it reverts itself", async () => {
  const { admin, service, request } = await fresh();
  await service.set("maintenance.message", "Back in ten minutes.", {
    userId: admin,
  });
  await service.set("maintenance.revertAfter", "1h", { userId: admin });
  await service.set("maintenance.enabled", true, { userId: admin });

  const home = await request.GET("/").header("accept", "text/html").send();
  equal(home.status, 503);
  equal(home.headers.get("Retry-After"), "600");
  includes(await home.body.text(), "Back in ten minutes.");
  equal(
    (await request.GET("/de/kids").header("accept", "text/html").send()).status,
    503,
    "locale twins too",
  );

  // The rights and the way in stay open.
  for (const path of [
    "/privacy-policy",
    "/terms-of-service",
    "/accessibility",
    "/login",
  ]) {
    equal(
      (await request.GET(path).header("accept", "text/html").send()).status,
      200,
      path,
    );
  }
  // The API and the bridge keep answering.
  equal(
    (
      await request
        .GET("/_/internal/site-config")
        .header("x-ops-api-key", OPS_KEY)
        .send()
    ).status,
    200,
  );
  equal(
    (await request.GET("/sitemap.xml").send()).status,
    200,
    "not an HTML page",
  );
  equal((await request.GET("/robots.txt").send()).status, 200);

  await request.become("user1@keylearn.org");
  equal(
    (await request.GET("/").header("accept", "text/html").send()).status,
    200,
    "an admin passes",
  );
  await request.become(null);

  // Auto-revert: not before the window, then exactly after it.
  const sweep = context.get(SiteConfigSweep);
  const switchedOn = (await service.history(1, "maintenance.enabled"))[0];
  const since = new Date(switchedOn.createdAt).getTime();
  equal(
    (await sweep.runOnce(since + 30 * 60 * 1000)).maintenanceReverted,
    false,
  );
  equal(
    (await sweep.runOnce(since + 61 * 60 * 1000)).maintenanceReverted,
    true,
  );
  equal(
    (await request.GET("/").header("accept", "text/html").send()).status,
    200,
    "the site is back",
  );
  const reverted = (await service.history(1, "maintenance.enabled"))[0];
  isNull(reverted.actorUserId);
  equal(reverted.newValue, false);

  equal(
    maintenanceDeadline(Date.UTC(2026, 8, 3, 23, 0), "1h"),
    Date.UTC(2026, 8, 3, 23, 0) + 3600_000,
  );
  const tomorrow = new Date(
    maintenanceDeadline(new Date(2026, 8, 3, 23, 0).getTime(), "tomorrow06"),
  );
  equal(tomorrow.getHours(), 6);
  equal(tomorrow.getDate(), 4);
});

test("1.7 the leaderboard override shows the board and expires by itself", async () => {
  const { admin, service } = await fresh();
  equal(await leaderboardReady(0), false, "below the rule");
  const until = new Date(Date.now() + 24 * 3600_000).toISOString();
  await service.set("leaderboard.override.until", until, { userId: admin });
  equal(await leaderboardReady(0), true, "override wins");
  const sweep = context.get(SiteConfigSweep);
  equal((await sweep.runOnce()).overrideExpired, false);
  equal(
    (await sweep.runOnce(Date.now() + 25 * 3600_000)).overrideExpired,
    true,
  );
  equal(
    (await service.entry("leaderboard.override.until")).value,
    null,
    "back to the default",
  );
  equal(await leaderboardReady(0), false);
});

test("1.8 an unticked locale falls back to English and leaves the sitemap; the lists reach the page", async () => {
  const { admin, service, request } = await fresh();
  const before = await (
    await request.GET("/de").header("accept", "text/html").send()
  ).body.text();
  includes(before, 'lang="de"');
  await service.set("languages.site", ["en", "hi"], { userId: admin });
  const after = await request.GET("/de").header("accept", "text/html").send();
  equal(after.status, 200, "the URL still answers");
  const body = await after.body.text();
  includes(body, 'lang="en"', "in English");
  includes(body, '"siteLocales":["en","hi"]');
  const sitemap = await (await request.GET("/sitemap.xml").send()).body.text();
  equal(sitemap.includes("/de"), false);
  isTrue(sitemap.includes("/hi/"));

  await service.set("languages.typing", ["en", "de"], { userId: admin });
  const page = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  const typing = (await service.entry("languages.typing")).value as string[];
  deepEqual([...typing].sort(), ["de", "en"]);
  includes(page, `"typingLanguages":${JSON.stringify(typing)}`);
  const refused = await service
    .set("languages.site", ["hi"], { userId: admin })
    .catch((err) => err);
  equal(
    refused.body?.error?.code,
    "immovable",
    "English cannot be switched off",
  );
});

test("1.9 the last-login location switch lives in site_config and gates the account detail", async () => {
  const { admin, service, request } = await fresh();
  const ops = (path: string) =>
    request.GET(path).header("x-ops-api-key", OPS_KEY).send();
  const target = (await findUser("user2@keylearn.org"))!.id!;
  await StaffAuditEvent.query().delete();
  const { SecurityEvent } = await import("@keylearn/database");
  await SecurityEvent.record({
    userId: target,
    type: "login",
    ip: "203.0.113.9",
  });

  const shown = await (
    await ops(`/_/internal/accounts/${target}`)
  ).body.json<{ lastLogin: { ip: string | null } }>();
  equal(shown.lastLogin.ip, "203.0.113.9");

  const put = await request
    .PUT("/_/internal/site-settings")
    .header("x-ops-api-key", OPS_KEY)
    .send({ showLastLoginLocation: false, actingStaffUserId: admin });
  equal(put.status, 200);
  deepEqual(await put.body.json(), { showLastLoginLocation: false });
  equal(
    (await service.entry("privacy.showLastLoginLocation")).value,
    false,
    "stored in site_config",
  );

  const hidden = await (
    await ops(`/_/internal/accounts/${target}`)
  ).body.json<{ lastLogin: { ip: string | null } }>();
  isNull(hidden.lastLogin.ip);
  deepEqual(await (await ops("/_/internal/site-settings")).body.json(), {
    showLastLoginLocation: false,
  });
});

test("1.10 every change emails the other admins with a revert link, never the changer", async () => {
  const { admin, service } = await fresh();
  process.env.QDESK_URL = "https://desk.example.org";
  const { history } = await service.set("leaderboard.minRanked", 60, {
    userId: admin,
    reason: "trial",
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const sent = context.mailer.dump();
  equal(sent.length, 1, "one other admin");
  equal(sent[0].to, "user3@keylearn.org");
  includes(sent[0].subject, "Leaderboard: ranked learners needed");
  includes(sent[0].text ?? "", "From: the shipped default");
  includes(sent[0].text ?? "", "To: 60");
  includes(
    sent[0].text ?? "",
    `https://desk.example.org/control-centre?revert=${history!.id}`,
  );
  includes(sent[0].text ?? "", "Reason: trial");

  // A system change reaches every admin.
  await service.set("leaderboard.minRanked", undefined, {
    userId: null,
    reason: "expired",
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const system = context.mailer.dump();
  deepEqual(system.map((m) => m.to).sort(), [
    "user1@keylearn.org",
    "user3@keylearn.org",
  ]);
  includes(system[0].text ?? "", "KeyLearn (automatic)");
});
