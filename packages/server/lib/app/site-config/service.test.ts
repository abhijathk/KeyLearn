import { test } from "node:test";
import {
  SiteConfig,
  SiteConfigHistory,
  StaffAuditEvent,
} from "@keylearn/database";
import { setSiteConfigValues } from "@keylearn/site-config";
import { deepEqual, equal, isNotNull, isNull, isTrue } from "rich-assert";
import { minAccounts } from "../highscores/readiness.ts";
import { multiplayerEnabled } from "../multiplayer.ts";
import { staffAuditRetentionDays } from "../support/sweep.ts";
import { TestContext } from "../test/context.ts";
import { findUser } from "../test/sql.ts";
import {
  refreshSiteConfigCache,
  startSiteConfigCache,
  stopSiteConfigCache,
} from "./cache.ts";
import { SiteConfigRefused, SiteConfigService } from "./service.ts";

/**
 * Phase 0.6 acceptance: a write lands on every worker within the window;
 * an env-set key reports locked. Phase 0.7's audit and history rules are
 * proved here at the service level; the HTTP door has its own test.
 */

const context = new TestContext();

const ENV_KEYS = [
  "LEADERBOARD_MIN_ACCOUNTS",
  "LEADERBOARD_MIN_RANKED",
  "MULTIPLAYER_ENABLED",
  "STAFF_AUDIT_RETENTION_DAYS",
  "SITE_CONFIG_REFRESH_SECONDS",
];

async function fresh(): Promise<{
  service: SiteConfigService;
  userId: number;
}> {
  // Not on the shared clear list, and the developer's own .env is already in
  // process.env, so both are reset here.
  await SiteConfig.query().delete();
  await SiteConfigHistory.query().delete();
  await StaffAuditEvent.query().delete();
  setSiteConfigValues(new Map());
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  const user = await findUser("user1@keylearn.org");
  return { service: context.get(SiteConfigService), userId: user!.id! };
}

async function refusal(
  run: () => Promise<unknown>,
): Promise<{ status: number; code: string }> {
  try {
    await run();
  } catch (err) {
    if (err instanceof SiteConfigRefused) {
      return { status: err.status, code: String(err.body.error["code"]) };
    }
    throw err;
  }
  throw new Error("expected a refusal");
}

async function auditActions(): Promise<string[]> {
  const rows = await StaffAuditEvent.query().orderBy("id");
  return rows.map((row) => row.action!);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("default → stored: a write is applied by this worker at once", async () => {
  const { service, userId } = await fresh();
  equal(minAccounts(), 500, "the shipped default before any write");

  const { entry, history } = await service.set("leaderboard.minAccounts", 800, {
    userId,
  });

  equal(entry.value, 800);
  equal(entry.source, "stored");
  isNull(entry.locked);
  equal(entry.updatedBy, userId);
  isNotNull(history);
  isNull(history!.oldValue, "old value null means the default");
  equal(history!.newValue, 800);
  equal(minAccounts(), 800, "the reader sees it without a restart");
  deepEqual(await auditActions(), ["site-config-changed"]);
});

test("a write lands on every worker within the refresh window", async () => {
  const { service, userId } = await fresh();
  await service.set("leaderboard.minAccounts", 800, { userId });

  // Another worker: its own memory, a cold store.
  setSiteConfigValues(new Map());
  equal(minAccounts(), 500, "cold store answers the default until a load");
  await refreshSiteConfigCache();
  equal(minAccounts(), 800, "one load and the worker agrees");

  // Now the timer itself: a write that bypasses this worker entirely
  // (as another worker's write would) arrives on the next tick.
  process.env.SITE_CONFIG_REFRESH_SECONDS = "0.05";
  startSiteConfigCache();
  try {
    await sleep(20);
    await SiteConfig.put("leaderboard.minAccounts", 900, userId);
    await sleep(200);
    equal(
      minAccounts(),
      900,
      "the tick picked up a write this process never saw",
    );
  } finally {
    stopSiteConfigCache();
  }
});

test("an env-set key wins, reports locked, and refuses a write", async () => {
  const { service, userId } = await fresh();
  await service.set("leaderboard.minAccounts", 800, { userId });
  process.env.LEADERBOARD_MIN_ACCOUNTS = "1200";

  equal(minAccounts(), 1200, "env wins over the stored value");
  const entry = (await service.describe()).find(
    (row) => row.key === "leaderboard.minAccounts",
  )!;
  equal(entry.value, 1200);
  equal(entry.source, "env");
  equal(entry.protection, "env");
  equal(entry.env, "LEADERBOARD_MIN_ACCOUNTS");
  equal(entry.locked?.code, "env");
  isTrue(entry.locked!.message.includes("LEADERBOARD_MIN_ACCOUNTS"));

  const refused = await refusal(() =>
    service.set("leaderboard.minAccounts", 700, { userId }),
  );
  deepEqual(refused, { status: 403, code: "env" });
  deepEqual(await auditActions(), [
    "site-config-changed",
    "site-config-refused",
  ]);

  delete process.env.LEADERBOARD_MIN_ACCOUNTS;
  equal(minAccounts(), 800, "the stored value returns when the variable goes");
});

test("locked, reference, new and unwired rows refuse with their own reason", async () => {
  const { service, userId } = await fresh();
  deepEqual(
    await refusal(() => service.set("security.headers", "off", { userId })),
    { status: 403, code: "read-only" },
  );
  deepEqual(
    await refusal(() =>
      service.set("certificates.bands", "anything", { userId }),
    ),
    { status: 403, code: "read-only" },
  );
  // Every registry key is wired today, so the unwired path is proved
  // against the validator directly rather than against a key that would
  // stop being an example the moment it was connected.
  {
    const { settingDef, writability } = await import("@keylearn/site-config");
    const def = settingDef("practice.smartPractice")!;
    const verdict = writability(def, {
      envSet: () => false,
      wired: () => false,
    });
    equal(verdict.ok, false);
    equal(verdict.ok === false && verdict.code, "unwired");
  }
  deepEqual(await refusal(() => service.set("no.such.key", 1, { userId })), {
    status: 404,
    code: "unknown-key",
  });
  deepEqual(
    await refusal(() => service.set("leaderboard.minAccounts", 7, { userId })),
    { status: 400, code: "bounds" },
  );
  deepEqual(
    await refusal(() =>
      service.set("leaderboard.minAccounts", "800", { userId }),
    ),
    { status: 400, code: "type" },
  );
  equal(
    (await SiteConfigHistory.query()).length,
    0,
    "a refusal writes no history",
  );
});

test("history records who, what, from and to; revert is a new row; restore removes the row", async () => {
  const { service, userId } = await fresh();
  const first = await service.set("leaderboard.minAccounts", 800, {
    userId,
    reason: "trial",
  });
  const second = await service.set("leaderboard.minAccounts", 600, { userId });
  equal(second.history!.oldValue, 800);
  equal(second.history!.newValue, 600);

  const history = await service.history();
  equal(history.length, 2);
  equal(history[0].id, second.history!.id, "newest first");
  equal(history[1].reason, "trial");
  equal(history[1].actorUserId, userId);
  isNotNull(history[1].actorName);

  const reverted = await service.revert(second.history!.id, { userId });
  equal(reverted.entry.value, 800);
  equal(reverted.history!.revertOf, second.history!.id);
  equal(reverted.history!.oldValue, 600);
  equal(reverted.history!.newValue, 800);
  equal(minAccounts(), 800);

  // Reverting the first change means "back to the default": the row goes.
  const restored = await service.revert(first.history!.id, { userId });
  equal(restored.entry.source, "default");
  equal(restored.entry.value, 500);
  isNull(restored.history!.newValue);
  isNull(await SiteConfig.find("leaderboard.minAccounts"));
  equal(minAccounts(), 500);
  equal((await service.history()).length, 4);
  deepEqual(await auditActions(), [
    "site-config-changed",
    "site-config-changed",
    "site-config-reverted",
    "site-config-reverted",
  ]);
});

test("writing the value already in force is not a change", async () => {
  const { service, userId } = await fresh();
  await service.set("leaderboard.minAccounts", 800, { userId });
  const again = await service.set("leaderboard.minAccounts", 800, { userId });
  isNull(again.history);
  equal((await service.history()).length, 1);
  const restoreDefault = await service.set("leaderboard.minRanked", undefined, {
    userId,
  });
  isNull(
    restoreDefault.history,
    "restoring a key already at its default is not a change",
  );
});

test("the multiplayer flag flows through the registry with env precedence", async () => {
  const { service, userId } = await fresh();
  equal(multiplayerEnabled(), false, "shipped off");
  await service.set("pages.multiplayer.state", "live", { userId });
  equal(multiplayerEnabled(), true);
  process.env.MULTIPLAYER_ENABLED = "false";
  equal(multiplayerEnabled(), false, "env wins");
  const entry = await service.entry("pages.multiplayer.state");
  equal(entry.value, "404");
  equal(entry.locked?.code, "env");
  delete process.env.MULTIPLAYER_ENABLED;
  equal(multiplayerEnabled(), true);
  await service.set("pages.multiplayer.state", undefined, { userId });
  equal(multiplayerEnabled(), false, "restored to the shipped default");
});

test("staff audit retention is chosen from its list", async () => {
  const { service, userId } = await fresh();
  equal(staffAuditRetentionDays(), 0);
  deepEqual(
    await refusal(() =>
      service.set("retention.staffAuditDays", 100, { userId }),
    ),
    { status: 400, code: "choice" },
  );
  await service.set("retention.staffAuditDays", 365, { userId });
  equal(staffAuditRetentionDays(), 365);
});

test("describe lists every registry row with a live value and the window", async () => {
  const { service } = await fresh();
  const rows = await service.describe();
  isTrue(rows.length > 80);
  for (const row of rows) {
    isTrue(typeof row.key === "string" && row.key.length > 0);
    isTrue(["env", "stored", "default"].includes(row.source), row.key);
    if (row.protection === "locked" || row.type === "info") {
      isNotNull(row.locked, row.key);
    }
  }
  const site = rows.find((row) => row.key === "languages.site")!;
  isTrue(
    Array.isArray(site.choices) && site.choices.length > 40,
    "site locales resolved",
  );
  isTrue(
    Array.isArray(site.value) && (site.value as string[]).includes("en"),
    "'all' is expanded",
  );
  const typing = rows.find((row) => row.key === "languages.typing")!;
  isTrue(
    Array.isArray(typing.choices) && typing.choices.length > 30,
    "typing languages resolved",
  );
  equal(service.refreshSeconds(), 30);
});
