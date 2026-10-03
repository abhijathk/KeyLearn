import { afterEach, test } from "node:test";
import { Application } from "@fastr/core";
import { setSiteConfigValues } from "@keylearn/site-config";
import { deepEqual, equal, isNull } from "rich-assert";
import { kMain } from "../module.ts";
import { supportAccountClosure } from "../site-config/readers.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * Closing Support in the account window from the control centre.
 *
 * Three promises, each tested where it is kept: the reader says what the
 * admin wrote (and does not promise a date that has passed), the gate the
 * account window already asks tells it support is shut and why, and the two
 * routes that write refuse, so a stale tab or a script cannot get past a
 * banner.
 */

const context = new TestContext();

afterEach(() => setSiteConfigValues(new Map()));

const close = (values: Record<string, unknown>) =>
  setSiteConfigValues(
    new Map<string, unknown>([
      ["support.account.open", false],
      ...Object.entries(values),
    ]),
  );

test("the reader is null while open, and carries the admin's words when closed", () => {
  isNull(supportAccountClosure());

  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
  close({
    "support.account.closedReason": "backOn",
    "support.account.note": "  We are moving servers.  ",
    "support.account.backOn": soon,
  });
  deepEqual(supportAccountClosure(), {
    reason: "backOn",
    note: "We are moving servers.",
    backOn: soon,
  });
});

test("a back-on date that has passed is not shown as a promise", () => {
  close({
    "support.account.backOn": new Date(Date.now() - 86_400_000).toISOString(),
  });
  const closure = supportAccountClosure();
  equal(closure?.backOn, null);
  equal(closure?.reason, "down");
});

test("the gate reports the closure to the account window", async () => {
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const open = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(open.closed ?? null, null);

  close({
    "support.account.closedReason": "maintenance",
    "support.account.note": "Back this evening.",
  });
  const shut = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(shut.closed.reason, "maintenance");
  equal(shut.closed.note, "Back this evening.");
});

test("new requests and replies are refused while closed, and allowed again after", async () => {
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);
  const ticket = {
    subject: "Certificate will not download",
    message: "The completion certificate does nothing when I tap download.",
  };

  close({ "support.account.note": "Support is being upgraded." });
  const refused = await request.POST("/_/support/my/tickets").send(ticket);
  equal(refused.status, 423);
  const reply = await request
    .POST("/_/support/my/tickets/1/reply")
    .send({ message: "Hello?" });
  equal(reply.status, 423);

  setSiteConfigValues(new Map());
  const allowed = await request.POST("/_/support/my/tickets").send(ticket);
  equal(allowed.status, 200);
});
