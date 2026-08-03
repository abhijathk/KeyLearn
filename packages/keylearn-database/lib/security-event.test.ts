import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { SecurityEvent } from "./security-event.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

test("keeps only the last 30 days", async () => {
  await SecurityEvent.record({ userId: 1, type: "login", ip: "::1" });
  await SecurityEvent.record({ userId: 1, type: "password-changed" });

  // Age one entry past the window.
  const rows = await SecurityEvent.query().where("userId", 1).orderBy("id");
  await rows[0].$query().patch({
    createdAt: new Date(Date.now() - SecurityEvent.retentionMs - 60_000),
  });

  // A reader never sees it, even before the sweep runs.
  equal((await SecurityEvent.listForUser(1)).length, 1);

  // And the sweep removes it for good.
  await SecurityEvent.deleteExpired();
  equal((await SecurityEvent.query().where("userId", 1)).length, 1);
});

test("an account only sees its own entries", async () => {
  await SecurityEvent.record({ userId: 101, type: "login" });
  await SecurityEvent.record({ userId: 102, type: "login" });
  equal((await SecurityEvent.listForUser(101)).length, 1);
  equal((await SecurityEvent.listForUser(102)).length, 1);
});

test("recording never throws, whatever it is handed", async () => {
  await SecurityEvent.record({ userId: null, type: "login-failed" });
  await SecurityEvent.record({
    userId: 1,
    type: "login",
    ip: "x".repeat(500),
    userAgent: "y".repeat(2000),
    detail: "z".repeat(2000),
  });
  const rows = await SecurityEvent.listForUser(1);
  isTrue(rows.every((r) => (r.userAgent ?? "").length <= 256));
});

test("newest first", async () => {
  await SecurityEvent.record({ userId: 1, type: "login" });
  await SecurityEvent.record({ userId: 1, type: "password-changed" });
  const rows = await SecurityEvent.listForUser(1);
  equal(rows[0].type, "password-changed");
});
