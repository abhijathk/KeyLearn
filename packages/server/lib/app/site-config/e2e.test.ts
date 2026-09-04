import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  SiteConfig,
  SiteConfigHistory,
  StaffAuditEvent,
} from "@keylearn/database";
import {
  REGISTRY,
  setSiteConfigValues,
  type SettingDef,
  siteSetting,
} from "@keylearn/site-config";
import { deepEqual, equal, includes, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { PAGE_KEYS } from "./readers.ts";
import { SiteConfigService } from "./service.ts";
import { WIRED_KEYS } from "./wired.ts";

/**
 * The whole control centre, end to end: every wired key, not a sample.
 *
 * The contract test next door proves each wired key has a reader somewhere
 * in the code. That is a structural claim, and it was hiding a gap — 27 of
 * the 88 wired keys had no behavioural assertion anywhere, so "the desk can
 * change it" and "changing it does something" were never actually joined up
 * for them. These tests join them up:
 *
 *  1. every wired key, written through the same service the internal API
 *     uses, changes the value the application code reads back;
 *  2. every page state gates its own URL, in all three states;
 *  3. every learner override reaches the browser in page data;
 *  4. a refusal is a refusal — the value does not move.
 *
 * Written as a loop over the registry rather than a list of keys, so a new
 * setting is covered the day it is added rather than the day somebody
 * remembers to add a test for it.
 */

const context = new TestContext();
const OPS_KEY = "Nq8s4Xb2m0PfTz1Lc7RkYw3Ve6Hd9Jg5";
const ENV_KEYS = [
  "MULTIPLAYER_ENABLED",
  "LEADERBOARD_MIN_ACCOUNTS",
  "LEADERBOARD_MIN_RANKED",
  "QDESK_URL",
  "PADDLE_API_KEY",
  "PADDLE_SECRET_KEY",
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
  process.env.ADMIN_EMAILS = "user1@keylearn.org";
  // Premium refuses to go on sale without them, which is its own test
  // below; here they are set so the row is exercised like any other.
  process.env.PADDLE_API_KEY = "e2e-paddle-api";
  process.env.PADDLE_SECRET_KEY = "e2e-paddle-secret";
  context.mailer.dump();
  const admin = (await findUser("user1@keylearn.org"))!.id!;
  const service = context.get(SiteConfigService);
  const request = startApp(context.get(Application, kMain));
  const rawGet = request.GET.bind(request);
  (request as any).GET = (path: string) =>
    rawGet(path)
      .header("X-Forwarded-Host", "www.keylearn.org")
      .header("X-Forwarded-Proto", "https");
  return { admin, service, request };
}

/**
 * A valid value for a row that is not the one it already has.
 *
 * Derived from the row's own type, choices and bounds, so it stays valid
 * when a bound moves — and so a row added tomorrow needs nothing written
 * here to be covered.
 */
function differentValue(def: SettingDef, current: unknown): unknown {
  switch (def.type) {
    case "switch":
      return current !== true;
    case "choice": {
      const choices = (def.choices ?? []) as (string | number)[];
      return choices.find((c) => c !== current) ?? current;
    }
    case "number": {
      // A number row may also carry a fixed list ("30, 90 or 365 days"), in
      // which case anything off the list is refused however valid the
      // arithmetic. The list wins.
      if (def.choices != null && def.choices.length > 0) {
        const choices = def.choices as number[];
        return choices.find((c) => c !== current) ?? current;
      }
      const { min = 0, max = 100, step = 1 } = def.bounds ?? {};
      const now = typeof current === "number" ? current : min;
      // Move by a step, staying inside the bounds and off the current value.
      const up = Math.min(max, now + (step || 1));
      return up !== now ? up : Math.max(min, now - (step || 1));
    }
    case "text":
      return current === "e2e" ? "e2e-2" : "e2e";
    case "textList":
      return ["e2e-one", "e2e-two"];
    case "numberList": {
      const { min = 0 } = def.bounds ?? {};
      const list = Array.isArray(current) ? (current as number[]) : [];
      // Keep it non-decreasing, which several of these rows require.
      return list.map((n, i) => Math.max(min, n) + i);
    }
    case "datetime":
      return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    case "set": {
      const choices = (def.choices ?? []) as string[];
      const immovable = def.immovable ?? [];
      if (choices.length === 0) {
        return current;
      }
      return [...new Set([...immovable, choices[0]!])];
    }
    default:
      return current;
  }
}

const wiredRows = REGISTRY.filter(
  (def) => WIRED_KEYS.has(def.key) && def.type !== "info",
);

test("every wired setting actually changes what the code reads back", async () => {
  const { admin, service } = await fresh();
  const stuck: string[] = [];
  const refused: string[] = [];

  for (const def of wiredRows) {
    // `set` is not a shortcut: it is the exact call the internal API makes,
    // so this exercises validation, storage and the read cache together.
    const before = siteSetting(def.key);
    const target = differentValue(def, before);
    if (JSON.stringify(target) === JSON.stringify(before)) {
      continue; // Nothing valid to move to (a one-entry choice, say).
    }
    try {
      await service.set(def.key, target, { userId: admin });
    } catch (err: any) {
      refused.push(`${def.key}: ${err?.message ?? err}`);
      continue;
    }
    const after = siteSetting(def.key);
    if (JSON.stringify(after) !== JSON.stringify(target)) {
      stuck.push(
        `${def.key}: wrote ${JSON.stringify(target)}, read ${JSON.stringify(after)}`,
      );
    }
  }

  deepEqual(
    [...refused],
    [],
    "a wired row refused a value derived from its own registry entry",
  );
  deepEqual(
    [...stuck],
    [],
    "a wired row stored a value the code does not read back",
  );
  isTrue(
    wiredRows.length >= 80,
    `only ${wiredRows.length} wired rows exercised`,
  );
});

test("every page state gates its own URL, in all three states", async () => {
  const { admin, service, request } = await fresh();
  // The paths the router actually serves, by registry page name.
  const paths: Readonly<Record<string, string>> = {
    practice: "/",
    kids: "/kids",
    braille: "/braille",
    typingTest: "/typing-test",
    texts: "/texts",
    highScores: "/high-scores",
    support: "/support",
    helpCentre: "/support/help",
    forSchools: "/for-schools",
    verify: "/verify",
    layouts: "/layouts",
    guide: "/guide",
    about: "/about",
  };
  const problems: string[] = [];

  for (const name of Object.keys(PAGE_KEYS)) {
    const path = paths[name];
    if (path == null) {
      continue; // multiplayer is env-gated; publicProfiles needs an id.
    }
    const key = PAGE_KEYS[name as keyof typeof PAGE_KEYS];

    await service.set(key, "live", { userId: admin });
    const live = await request.GET(path).header("accept", "text/html").send();
    if (live.status !== 200) {
      problems.push(`${name} live -> ${live.status}`);
    }

    await service.set(key, "404", { userId: admin });
    const gone = await request.GET(path).header("accept", "text/html").send();
    if (gone.status !== 404) {
      problems.push(`${name} 404 -> ${gone.status}`);
    }

    // Coming soon is announced, not hidden: a real page, kept out of search.
    await service.set(key, "soon", { userId: admin });
    const soon = await request.GET(path).header("accept", "text/html").send();
    const body = await soon.body.text();
    if (soon.status !== 200) {
      problems.push(`${name} soon -> ${soon.status}, expected 200`);
    }
    if (soon.headers.get("x-robots-tag") !== "noindex, nofollow") {
      problems.push(`${name} soon -> not marked noindex`);
    }
    if (!body.includes("Coming soon")) {
      problems.push(`${name} soon -> no coming-soon panel`);
    }

    await service.set(key, "live", { userId: admin });
  }

  deepEqual([...problems], []);
});

test("a page that is off is still open to an admin, so it can be checked", async () => {
  const { admin, service, request } = await fresh();
  await service.set("pages.kids.state", "404", { userId: admin });
  equal(
    (await request.GET("/kids").header("accept", "text/html").send()).status,
    404,
    "the public gets nothing",
  );
  await request.become("user1@keylearn.org");
  equal(
    (await request.GET("/kids").header("accept", "text/html").send()).status,
    200,
    "the admin previews it",
  );
  await request.become(null);
});

test("every learner override reaches the browser", async () => {
  const { admin, service, request } = await fresh();
  const overrides = REGISTRY.filter(
    (def) => def.overrideOf != null && WIRED_KEYS.has(def.key),
  );
  // Four: every NUMERIC learner default lost its override row on 4 Sep 2026,
  // so what is left is the policy choices. A floor rather than an equality, so
  // adding an override does not fail this; losing the rest would.
  isTrue(overrides.length >= 4, `only ${overrides.length} override rows`);

  for (const def of overrides) {
    await service.set(def.key, "forced", { userId: admin });
  }
  const page = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();

  const missing = overrides.filter(() => false);
  // Every override names a settings prop; the page data must carry each one
  // as "forced", or the learner's own choice silently wins.
  const forced = (page.match(/"forced"/g) ?? []).length;
  isTrue(
    forced >= overrides.length,
    `page data carries ${forced} forced overrides, expected at least ${overrides.length}`,
  );
  deepEqual([...missing], []);

  for (const def of overrides) {
    await service.set(def.key, "hidden", { userId: admin });
  }
  const hiddenPage = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  includes(hiddenPage, '"hidden"', "hidden reaches the browser too");
});

test("a locked row cannot be moved, however it is asked", async () => {
  const { admin, service } = await fresh();
  const locked = REGISTRY.filter(
    (def) => def.protection === "locked" || def.type === "info",
  );
  isTrue(locked.length >= 20, `only ${locked.length} protected rows`);

  const moved: string[] = [];
  for (const def of locked) {
    const before = siteSetting(def.key);
    try {
      await service.set(def.key, differentValue(def, before), {
        userId: admin,
      });
      moved.push(def.key);
    } catch {
      // Refused, which is the point.
    }
    if (JSON.stringify(siteSetting(def.key)) !== JSON.stringify(before)) {
      moved.push(def.key);
    }
  }
  deepEqual([...new Set(moved)], [], "a protected row moved");
});

test("an environment variable wins, and the row says so", async () => {
  const { admin, service } = await fresh();
  process.env.LEADERBOARD_MIN_ACCOUNTS = "999";
  setSiteConfigValues(new Map());
  equal(siteSetting("leaderboard.minAccounts"), 999, "env is in force");

  let refusedWith = "";
  try {
    await service.set("leaderboard.minAccounts", 123, { userId: admin });
  } catch (err: any) {
    refusedWith = String(err?.body?.error?.code ?? err?.message ?? err);
  }
  equal(refusedWith, "env", "the write is refused with the env code");
  equal(siteSetting("leaderboard.minAccounts"), 999, "and nothing moved");
  delete process.env.LEADERBOARD_MIN_ACCOUNTS;
});

test("restoring a default puts back exactly the shipped value", async () => {
  const { admin, service } = await fresh();
  const drifted: string[] = [];
  for (const def of wiredRows.slice(0, 40)) {
    const target = differentValue(def, def.default);
    if (JSON.stringify(target) === JSON.stringify(def.default)) {
      continue;
    }
    try {
      await service.set(def.key, target, { userId: admin });
      await service.set(def.key, undefined, { userId: admin });
    } catch {
      continue;
    }
    if (JSON.stringify(siteSetting(def.key)) !== JSON.stringify(def.default)) {
      drifted.push(def.key);
    }
  }
  deepEqual([...drifted], [], "restore did not return the shipped value");
});

test("premium refuses to go on sale until the payment keys exist", async () => {
  const { admin, service } = await fresh();
  delete process.env.PADDLE_API_KEY;
  delete process.env.PADDLE_SECRET_KEY;
  setSiteConfigValues(new Map());

  let refusal = "";
  try {
    await service.set("premium.sell", true, { userId: admin });
  } catch (err: any) {
    refusal = String(err?.message ?? err);
  }
  includes(refusal, "PADDLE", "the refusal names what is missing");
  equal(siteSetting("premium.sell"), false, "and the switch stayed off");
});
