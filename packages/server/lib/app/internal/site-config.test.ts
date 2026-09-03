import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  SiteConfig,
  SiteConfigHistory,
  StaffAuditEvent,
} from "@keylearn/database";
import { REGISTRY, setSiteConfigValues } from "@keylearn/site-config";
import { deepEqual, equal, isNotNull, isNull, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp, type TestRequest } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * Phase 0.7 acceptance at the HTTP door: 403 for anything but the ops key
 * (Tab's key included), 403 for a non-admin actor, audit rows on every
 * write, and the four routes doing what the spec says.
 */

const context = new TestContext();

const OPS_KEY = "Nq8s4Xb2m0PfTz1Lc7RkYw3Ve6Hd9Jg5";

const ENV_KEYS = [
  "LEADERBOARD_MIN_ACCOUNTS",
  "LEADERBOARD_MIN_RANKED",
  "MULTIPLAYER_ENABLED",
];

async function fresh(): Promise<{
  request: TestRequest;
  admin: number;
  staff: number;
}> {
  await SiteConfig.query().delete();
  await SiteConfigHistory.query().delete();
  await StaffAuditEvent.query().delete();
  setSiteConfigValues(new Map());
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  process.env.OPS_API_KEY = OPS_KEY;
  // Admin identity is env-only; user1 is an admin here, user2 is not.
  process.env.ADMIN_EMAILS = "user1@keylearn.org";
  const admin = (await findUser("user1@keylearn.org"))!.id!;
  const staff = (await findUser("user2@keylearn.org"))!.id!;
  return { request: startApp(context.get(Application, kMain)), admin, staff };
}

async function auditActions(): Promise<string[]> {
  const rows = await StaffAuditEvent.query().orderBy("id");
  return rows.map((row) => `${row.action}:${row.detail ?? ""}`);
}

test("only the ops key opens the door: no key, Tab's key and a wrong key all get 403", async () => {
  const { request } = await fresh();

  const bare = await request.GET("/_/internal/site-config").send();
  equal(bare.status, 403);

  // Tab authenticates to the desk with its own header; it has no key to
  // KeyLearn at all, and presenting the desk-side one here is refused.
  const tab = await request
    .GET("/_/internal/site-config")
    .header("x-qdesk-agent-key", "tabs-own-desk-key")
    .send();
  equal(tab.status, 403);

  const wrong = await request
    .GET("/_/internal/site-config")
    .header("x-ops-api-key", OPS_KEY.slice(1))
    .send();
  equal(wrong.status, 403);

  const put = await request
    .PUT("/_/internal/site-config/leaderboard.minAccounts")
    .header("x-qdesk-agent-key", "tabs-own-desk-key")
    .send({ value: 800, actingStaffUserId: 1 });
  equal(put.status, 403);
  isNull(await SiteConfig.find("leaderboard.minAccounts"));

  const denied = (await auditActions()).filter((line) =>
    line.startsWith("agent-access-denied"),
  );
  equal(denied.length, 4, "every refused knock is audited");
});

test("GET describes every registry row with the propagation window", async () => {
  const { request } = await fresh();
  const response = await request
    .GET("/_/internal/site-config")
    .header("x-ops-api-key", OPS_KEY)
    .send();
  equal(response.status, 200);
  const body = await response.body.json<{
    refreshSeconds: number;
    envOverrides: number;
    settings: { key: string; value: unknown; locked: unknown }[];
  }>();
  equal(body.refreshSeconds, 30);
  equal(body.settings.length, REGISTRY.length);
  const row = body.settings.find((s) => s.key === "leaderboard.minAccounts")!;
  equal(row.value, 500);
  isNull(row.locked);
});

test("PUT by a staff member who is not an admin is refused and audited; nothing is written", async () => {
  const { request, staff } = await fresh();
  const response = await request
    .PUT("/_/internal/site-config/leaderboard.minAccounts")
    .header("x-ops-api-key", OPS_KEY)
    .header("accept", "application/json")
    .send({ value: 800, actingStaffUserId: staff });
  equal(response.status, 403);
  const body = await response.body.json<{ error: { message: string } }>();
  isTrue(body.error.message.includes("admin"));
  isNull(await SiteConfig.find("leaderboard.minAccounts"));
  deepEqual(await auditActions(), [
    `site-config-refused:leaderboard.minAccounts: not an admin (via ops app)`,
  ]);
});

test("PUT by an admin validates, writes, audits and answers with the entry and the history row", async () => {
  const { request, admin } = await fresh();
  const response = await request
    .PUT("/_/internal/site-config/leaderboard.minAccounts")
    .header("x-ops-api-key", OPS_KEY)
    .send({ value: 800, reason: "small launch", actingStaffUserId: admin });
  equal(response.status, 200);
  const body = await response.body.json<{
    entry: { value: unknown; source: string; updatedBy: number };
    history: {
      id: number;
      oldValue: unknown;
      newValue: unknown;
      actorUserId: number;
      reason: string;
    };
  }>();
  equal(body.entry.value, 800);
  equal(body.entry.source, "stored");
  equal(body.entry.updatedBy, admin);
  isNull(body.history.oldValue);
  equal(body.history.newValue, 800);
  equal(body.history.actorUserId, admin);
  equal(body.history.reason, "small launch");
  deepEqual(await auditActions(), [
    "site-config-changed:leaderboard.minAccounts (via ops app)",
  ]);

  // The registry's refusals arrive with their code and the status it implies.
  const bounds = await request
    .PUT("/_/internal/site-config/leaderboard.minAccounts")
    .header("x-ops-api-key", OPS_KEY)
    .send({ value: 7, actingStaffUserId: admin });
  equal(bounds.status, 400);
  const refused = await bounds.body.json<{
    error: { code: string; key: string; message: string };
  }>();
  equal(refused.error.code, "bounds");
  equal(refused.error.key, "leaderboard.minAccounts");

  const unknown = await request
    .PUT("/_/internal/site-config/no.such.key")
    .header("x-ops-api-key", OPS_KEY)
    .send({ value: 1, actingStaffUserId: admin });
  equal(unknown.status, 404);

  process.env.LEADERBOARD_MIN_ACCOUNTS = "1200";
  const env = await request
    .PUT("/_/internal/site-config/leaderboard.minAccounts")
    .header("x-ops-api-key", OPS_KEY)
    .send({ value: 700, actingStaffUserId: admin });
  equal(env.status, 403);
  equal((await env.body.json<{ error: { code: string } }>()).error.code, "env");
  delete process.env.LEADERBOARD_MIN_ACCOUNTS;

  // Every registry key is wired today (smart practice was the last, 3 Sep
  // 2026), so this route's unwired path is proved by a key that does not
  // exist rather than by one that would stop being an example once it was
  // connected. The refusal itself is tested against the validator in
  // site-config/service.test.ts.
  const noSuchKey = await request
    .PUT("/_/internal/site-config/practice.notAThing")
    .header("x-ops-api-key", OPS_KEY)
    .send({ value: false, actingStaffUserId: admin });
  equal(noSuchKey.status, 404);
  equal(
    (await noSuchKey.body.json<{ error: { code: string } }>()).error.code,
    "unknown-key",
  );

  const malformed = await request
    .PUT("/_/internal/site-config/leaderboard.minAccounts")
    .header("x-ops-api-key", OPS_KEY)
    .send({ value: 800 });
  equal(malformed.status, 400, "actingStaffUserId is required");
});

test("history lists newest first with the actor's name; revert writes a new row; restore drops the row", async () => {
  const { request, admin } = await fresh();
  const send = (value: unknown) =>
    request
      .PUT("/_/internal/site-config/leaderboard.minRanked")
      .header("x-ops-api-key", OPS_KEY)
      .send({ value, actingStaffUserId: admin });
  await send(60);
  const second = await send(80);
  const secondId = (await second.body.json<{ history: { id: number } }>())
    .history.id;

  const listed = await request
    .GET("/_/internal/site-config/history?limit=10&key=leaderboard.minRanked")
    .header("x-ops-api-key", OPS_KEY)
    .send();
  equal(listed.status, 200);
  const { history } = await listed.body.json<{
    history: {
      id: number;
      key: string;
      oldValue: unknown;
      newValue: unknown;
      actorName: string | null;
      createdAt: string;
    }[];
  }>();
  equal(history.length, 2);
  equal(history[0].id, secondId);
  equal(history[0].oldValue, 60);
  equal(history[0].newValue, 80);
  isNotNull(history[0].actorName);
  isTrue(!Number.isNaN(Date.parse(history[0].createdAt)));

  const reverted = await request
    .POST("/_/internal/site-config/revert")
    .header("x-ops-api-key", OPS_KEY)
    .send({ historyId: secondId, actingStaffUserId: admin });
  equal(reverted.status, 200);
  const body = await reverted.body.json<{
    entry: { value: unknown };
    history: { revertOf: number; newValue: unknown };
  }>();
  equal(body.entry.value, 60);
  equal(body.history.revertOf, secondId);
  equal(body.history.newValue, 60);

  const restored = await request
    .PUT("/_/internal/site-config/leaderboard.minRanked")
    .header("x-ops-api-key", OPS_KEY)
    .send({ restore: true, actingStaffUserId: admin });
  equal(restored.status, 200);
  const after = await restored.body.json<{
    entry: { value: unknown; source: string };
  }>();
  equal(after.entry.source, "default");
  equal(after.entry.value, 50);
  isNull(await SiteConfig.find("leaderboard.minRanked"));

  const missing = await request
    .POST("/_/internal/site-config/revert")
    .header("x-ops-api-key", OPS_KEY)
    .send({ historyId: 999999, actingStaffUserId: admin });
  equal(missing.status, 404);

  deepEqual(await auditActions(), [
    "site-config-changed:leaderboard.minRanked (via ops app)",
    "site-config-changed:leaderboard.minRanked (via ops app)",
    "site-config-reverted:leaderboard.minRanked (via ops app)",
    "site-config-changed:leaderboard.minRanked → default (via ops app)",
  ]);
});
