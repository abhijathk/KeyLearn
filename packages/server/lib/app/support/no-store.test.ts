import { test } from "node:test";
import { Application } from "@fastr/core";
import { equal } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * The gate's answer must never come from a cache.
 *
 * Without this the browser stored `GET /_/support/gate` heuristically —
 * it carried no cache headers at all — so closing the account window and
 * reopening it got the old `proved: true` back and never asked for the
 * PIN. Only a full refresh showed the truth.
 */

const context = new TestContext();

test("the gate is never stored", async () => {
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const response = await request.GET("/_/support/gate").send();

  equal(response.headers.get("Cache-Control"), "no-store");
});

test("the customer's own support responses are never stored", async () => {
  // Not only the lock: these carry the account's address and everything
  // written into a ticket, and a shared tablet's disk cache outlives the
  // session.
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  for (const path of [
    "/_/support/my/tickets",
    "/_/support/my/me",
    "/_/support/my/draft",
    "/_/support/my/attachments",
  ]) {
    const response = await request.GET(path).send();
    equal(response.headers.get("Cache-Control"), "no-store", path);
  }
});

test("the staff desk is left alone", async () => {
  // Narrow on purpose: this middleware is about the customer's half.
  const request = startApp(context.get(Application, kMain));

  const response = await request.GET("/_/support/help/articles").send();

  equal(response.headers.get("Cache-Control"), null);
});
