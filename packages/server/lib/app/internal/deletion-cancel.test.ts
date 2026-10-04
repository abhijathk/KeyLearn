import { afterEach, beforeEach, test } from "node:test";
import { Application } from "@fastr/core";
import { resetStaffEmails } from "@keylearn/config";
import {
  Notification,
  SupportMessage,
  SupportQdeskOutbox,
} from "@keylearn/database";
import { equal, isTrue } from "rich-assert";
import { resetRateLimits } from "../auth/ratelimit.ts";
import { Mailer } from "../mail/index.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { type FakeMailer } from "../test/mail.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * Cancelling a scheduled deletion is the safe direction, but the person is
 * always told — by email and on the bell — so a deletion they asked for
 * cannot be quietly undone.
 */

const context = new TestContext();
const KEY = "test-ops-key";
const ENV = ["OPS_API_KEY", "STAFF_EMAILS", "STAFF_STEP_UP"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env.OPS_API_KEY = KEY;
  process.env.STAFF_EMAILS = "user1@keylearn.org";
  // Step-up has its own tests; here it would only be noise.
  process.env.STAFF_STEP_UP = "off";
  resetStaffEmails();
  resetRateLimits();
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] == null) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
  resetStaffEmails();
});

function app() {
  return startApp(context.get(Application, kMain));
}

async function post(path: string, body: unknown) {
  return await app()
    .POST(path)
    .header("content-type", "application/json")
    .header("x-ops-api-key", KEY)
    .send(body);
}

test("a cancelled deletion is told to the account by email and on the bell", async () => {
  const staff = await findUser("user1@keylearn.org");
  const target = await findUser("user2@keylearn.org");
  const mailer = context.get(Mailer) as FakeMailer;

  equal(
    (
      await post(`/_/internal/accounts/${target.id}/request-deletion`, {
        reason: "asked on ticket 4",
        actingStaffUserId: staff.id,
      })
    ).status,
    200,
  );
  mailer.dump();

  equal(
    (
      await post(`/_/internal/accounts/${target.id}/cancel-deletion`, {
        reason: "changed their mind",
        actingStaffUserId: staff.id,
      })
    ).status,
    200,
  );
  const sent = mailer.dump();
  equal(sent.length, 1);
  equal(sent[0]!.to, "user2@keylearn.org");
  equal(
    sent[0]!.subject,
    "The deletion of your KeyLearn account was cancelled",
  );

  const bell = await Notification.query()
    .where("userId", target.id!)
    .where("kind", "account-deletion-cancelled");
  equal(bell.length, 1);

  // Nothing pending: a second cancel is a 404, and sends nothing.
  equal(
    (
      await post(`/_/internal/accounts/${target.id}/cancel-deletion`, {
        reason: "again",
        actingStaffUserId: staff.id,
      })
    ).status,
    404,
  );
  equal(mailer.dump().length, 0);
});

test("the QDesk outbox table exists from schema bootstrap alone", async () => {
  isTrue(
    await SupportMessage.knex().schema.hasTable(SupportQdeskOutbox.tableName),
  );
});
