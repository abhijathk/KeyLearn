import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { Notification } from "./notification.ts";
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

/**
 * The bell half. Which events alert is a judgement about what is worth
 * interrupting somebody for, and getting it wrong in either direction is
 * costly — a missed alert is an account taken over quietly, and an alert on
 * every sign-in trains people to ignore the bell, which produces the first
 * outcome by another route.
 */
test("a sensitive change alerts; an ordinary sign-in does not", async () => {
  await SecurityEvent.record({ userId: 7, type: "login" });
  await SecurityEvent.record({ userId: 7, type: "login-failed" });
  equal((await Notification.query().where("userId", 7)).length, 0);

  await SecurityEvent.record({ userId: 7, type: "two-factor-disabled" });
  await SecurityEvent.record({ userId: 7, type: "password-changed" });

  const notes = await Notification.query().where("userId", 7).orderBy("id");
  equal(notes.length, 2);
  equal(notes[0].kind, "security-alert");
  isTrue(notes[0].body!.includes("Two-step verification was turned off"));
  isTrue(notes[1].body!.includes("Your password was changed"));
  // Every act is recorded whether or not it alerts.
  equal((await SecurityEvent.query().where("userId", 7)).length, 4);
});

test("a signed-out act has nobody to tell and must not throw", async () => {
  await SecurityEvent.record({ userId: null, type: "password-reset" });
  equal((await Notification.query().whereNull("userId")).length, 0);
});
