import { createHmac } from "node:crypto";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { User } from "@keylearn/database";
import { isPremiumUser } from "@keylearn/pages-shared";
import { equal, isFalse, isTrue, like } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

const now = new Date("2001-02-03T04:05:06Z");

const context = new TestContext();

test("ignore invalid http method", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // Assert.

  equal((await request.GET("/_/checkout").send()).status, 405);
  equal((await request.PUT("/_/checkout").send({})).status, 405);
  equal((await request.DELETE("/_/checkout").send({})).status, 405);
});

test("ignore invalid signature", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });
  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request //
    .POST("/_/checkout")
    .header("Paddle-Signature", "xyz")
    .send(makeEvent(null));

  // Assert.

  equal(response.status, 400);
  equal(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  equal(await response.body.text(), "Invalid notification");

  isFalse(isPremiumUser(User.toPublicUser(await User.findById(1), "")));
});

test("ignore invalid user id", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });
  const request = startApp(context.get(Application, kMain));
  const body = makeEvent({ id: "z1qfg4b" });

  // Act.

  const response = await request //
    .POST("/_/checkout")
    .header("Paddle-Signature", signBody(body))
    .send(body);

  // Assert.

  equal(response.status, 500);
  equal(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  equal(await response.body.text(), "Error: Unknown user id");

  isFalse(isPremiumUser(User.toPublicUser(await User.findById(1), "")));
});

test("create order", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });
  const request = startApp(context.get(Application, kMain));
  const body = makeEvent({ id: "55vdtk1" });

  // Act.

  const response = await request //
    .POST("/_/checkout")
    .header("Paddle-Signature", signBody(body))
    .send(body);

  // Assert.

  equal(response.status, 200);
  equal(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  equal(await response.body.text(), "OK");

  const user = (await User.findById(1))!;
  isTrue(isPremiumUser(User.toPublicUser(user, "")));
  like(user.toJSON(), {
    id: 1,
    order: {
      provider: "paddle",
      id: "txn_123",
      name: null,
      email: null,
      userId: 1,
    },
  });
});

test("re-create order", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  await (await User.findById(1))!.$relatedQuery("order").insert({
    provider: "paddle",
    id: "xyz",
    createdAt: new Date(),
    name: null,
    email: null,
  });

  const request = startApp(context.get(Application, kMain));
  const body = makeEvent({ id: "55vdtk1" });

  // Act.

  const response = await request //
    .POST("/_/checkout")
    .header("Paddle-Signature", signBody(body))
    .send(body);

  // Assert.

  equal(response.status, 200);
  equal(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  equal(await response.body.text(), "OK");

  const user = (await User.findById(1))!;
  isTrue(isPremiumUser(User.toPublicUser(user, "")));
  like(user.toJSON(), {
    id: 1,
    order: {
      provider: "paddle",
      id: "txn_123",
      name: null,
      email: null,
      userId: 1,
    },
  });
});

test("a cancelled subscription loses premium", async (ctx) => {
  // The defect this covers: only transaction.completed was ever handled, so a
  // cancellation, a refund or an expiry left the order row in place and the
  // account premium for good.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  await (await User.findById(1))!.$relatedQuery("order").insert({
    provider: "paddle",
    id: "txn_123",
    createdAt: new Date(),
    name: null,
    email: null,
  });
  isTrue(isPremiumUser(User.toPublicUser((await User.findById(1))!, "")));

  const request = startApp(context.get(Application, kMain));
  const body = makeSubscriptionEvent(
    { id: "55vdtk1" },
    "subscription.canceled",
  );

  const response = await request
    .POST("/_/checkout")
    .header("Paddle-Signature", signBody(body))
    .send(body);

  equal(response.status, 200);
  isFalse(isPremiumUser(User.toPublicUser((await User.findById(1))!, "")));
});

test("a paused subscription loses premium too", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  await (await User.findById(1))!.$relatedQuery("order").insert({
    provider: "paddle",
    id: "txn_123",
    createdAt: new Date(),
    name: null,
    email: null,
  });

  const request = startApp(context.get(Application, kMain));
  const body = makeSubscriptionEvent({ id: "55vdtk1" }, "subscription.paused");

  equal(
    (
      await request
        .POST("/_/checkout")
        .header("Paddle-Signature", signBody(body))
        .send(body)
    ).status,
    200,
  );
  isFalse(isPremiumUser(User.toPublicUser((await User.findById(1))!, "")));
});

test("a resumed subscription gets premium back", async (ctx) => {
  // Nothing about the account was touched on the way out, so coming back is
  // just the grant again — the learner keeps their profiles and history.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const request = startApp(context.get(Application, kMain));
  const body = makeSubscriptionEvent(
    { id: "55vdtk1" },
    "subscription.resumed",
    "sub_777",
  );

  equal(
    (
      await request
        .POST("/_/checkout")
        .header("Paddle-Signature", signBody(body))
        .send(body)
    ).status,
    200,
  );
  const user = (await User.findById(1))!;
  isTrue(isPremiumUser(User.toPublicUser(user, "")));
  like(user.toJSON(), { order: { id: "sub_777", provider: "paddle" } });
});

test("cancelling twice is not an error", async (ctx) => {
  // Paddle retries, so every handler has to survive seeing the same event
  // again.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const request = startApp(context.get(Application, kMain));
  const body = makeSubscriptionEvent(
    { id: "55vdtk1" },
    "subscription.canceled",
  );
  const send = () =>
    request
      .POST("/_/checkout")
      .header("Paddle-Signature", signBody(body))
      .send(body);

  equal((await send()).status, 200);
  equal((await send()).status, 200);
  isFalse(isPremiumUser(User.toPublicUser((await User.findById(1))!, "")));
});

function makeEvent(extra: Record<string, unknown> | null) {
  return {
    event_id: "evt_123",
    notification_id: "ntf_123",
    event_type: "transaction.completed",
    occurred_at: "2001-02-03T04:05:06.000Z",
    data: {
      id: "txn_123",
      status: "completed",
      customData: null,
      items: [],
      payments: [],
      created_at: "2001-02-03T04:05:06.000Z",
      updated_at: "2001-02-03T04:05:06.000Z",
      billed_at: "2001-02-03T04:05:06.000Z",
      custom_data: extra,
    },
  };
}

/**
 * A subscription-lifecycle notification, which carries a different body from
 * a transaction — the SDK validates the shape, so it has to be a real one.
 */
function makeSubscriptionEvent(
  extra: Record<string, unknown> | null,
  eventType: string,
  id = "sub_123",
) {
  return {
    event_id: "evt_123",
    notification_id: "ntf_123",
    event_type: eventType,
    occurred_at: "2001-02-03T04:05:06.000Z",
    data: {
      id,
      status: eventType === "subscription.canceled" ? "canceled" : "active",
      customer_id: "ctm_1",
      address_id: "add_1",
      currency_code: "USD",
      created_at: "2001-02-03T04:05:06.000Z",
      updated_at: "2001-02-03T04:05:06.000Z",
      items: [],
      custom_data: extra,
      billing_cycle: { interval: "month", frequency: 1 },
      collection_mode: "automatic",
      scheduled_change: null,
    },
  };
}

function signBody(event: Record<string, unknown>) {
  const ts = now.getTime();
  const hmac = createHmac("sha256", "secretKey");
  hmac.update(`${ts}:${JSON.stringify(event)}`);
  const h1 = hmac.digest("hex");
  return `ts=${ts};h1=${h1}`;
}
