import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { SupportMessage, SupportTicket } from "@keylearn/database";
import { equal, isNotNull, isNull } from "rich-assert";
import { resetRateLimits } from "../auth/ratelimit.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { QdeskRetrySweep } from "./qdesk-retry.ts";

/**
 * What happens after the desk was unreachable.
 *
 * The first attempt is deliberately fire-and-forget, so the interesting
 * behaviour is entirely in the second: a message the desk never took has
 * to be delivered later, and a message it *did* take must not arrive
 * twice because the acknowledgement was lost on the way back.
 */

const context = new TestContext();

let seq = 0;
function newTicket() {
  const tag = `${process.pid}-${++seq}`;
  return {
    kind: "support",
    name: "A Parent",
    email: `retry-${tag}@example.com`,
    subject: "Certificate will not download",
    message: `The certificate does nothing when I tap download. (${tag})`,
  };
}

type Desk = {
  url: string;
  calls: { path: string; body: any }[];
  up: boolean;
  close: () => Promise<void>;
};

async function fakeDesk(): Promise<Desk> {
  const desk: Desk = {
    url: "",
    calls: [],
    up: true,
    close: async () => {},
  };
  // Remembers what it has been told, so a replay can be answered the way
  // the real desk answers one — as a success, without a second copy.
  const seen = new Set<string>();
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      const path = req.url ?? "";
      const body = raw === "" ? {} : JSON.parse(raw);
      if (!desk.up) {
        res.writeHead(503).end();
        return;
      }
      desk.calls.push({ path, body });
      const key = `${path}:${body.externalMessageId ?? "none"}`;
      const duplicate = seen.has(key);
      seen.add(key);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, duplicate }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  desk.url = `http://127.0.0.1:${port}`;
  desk.close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  return desk;
}

function withBridge(url: string): () => void {
  const oldUrl = process.env["QDESK_URL"];
  const oldKey = process.env["QDESK_APP_KEY"];
  process.env["QDESK_URL"] = url;
  process.env["QDESK_APP_KEY"] = "test-key";
  return () => {
    if (oldUrl == null) {
      delete process.env["QDESK_URL"];
    } else {
      process.env["QDESK_URL"] = oldUrl;
    }
    if (oldKey == null) {
      delete process.env["QDESK_APP_KEY"];
    } else {
      process.env["QDESK_APP_KEY"] = oldKey;
    }
  };
}

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ages a message so the sweep considers it, without waiting minutes. */
async function age(messageId: number, minutes: number): Promise<void> {
  await SupportMessage.query()
    .findById(messageId)
    .patch({ createdAt: new Date(Date.now() - minutes * 60_000) });
}

/**
 * Clears the field before a sweep.
 *
 * The sweep takes the oldest undelivered messages first, and every other
 * test in this suite leaves some behind — so without this, whether the
 * message under test makes the batch depends on what ran before it. That
 * is a real property of the sweep (oldest first, bounded batch), not a
 * bug, but it makes an assertion about *this* message meaningless.
 */
async function onlyPending(messageId: number): Promise<void> {
  await SupportMessage.query()
    .whereNull("deliveredAt")
    .andWhere("id", "!=", messageId)
    .patch({ deliveredAt: new Date() });
}

async function openTicket() {
  resetRateLimits();
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);
  const response = await request.POST("/_/support/tickets").send(newTicket());
  equal(response.status, 200);
  const ticket = await SupportTicket.query().orderBy("id", "desc").first();
  const first = await SupportMessage.query()
    .where("ticketId", ticket!.id!)
    .andWhere("sender", "them")
    .orderBy("id", "desc")
    .first();
  return { request, ticket: ticket!, message: first! };
}

test("a message the desk never took is delivered later", async () => {
  const desk = await fakeDesk();
  const restore = withBridge(desk.url);
  try {
    desk.up = false;
    const { message } = await openTicket();
    await settle(500);
    // The first attempt failed, so it is still on one tick.
    isNull(
      (await SupportMessage.query().findById(message.id!))!.deliveredAt ?? null,
    );

    desk.up = true;
    await age(message.id!, 10);
    await onlyPending(message.id!);
    const attempted = await new QdeskRetrySweep().runOnce();
    equal(attempted, 1);
    await settle(500);

    isNotNull(
      (await SupportMessage.query().findById(message.id!))!.deliveredAt ?? null,
    );
  } finally {
    restore();
    await desk.close();
  }
});

test("a delivery that already landed is not sent twice", async () => {
  // The reason the desk takes an idempotency key at all. Here the first
  // attempt reaches the desk and the answer is lost, so this side still
  // believes it failed — exactly the case that would otherwise put the
  // customer's words in front of staff twice.
  const desk = await fakeDesk();
  const restore = withBridge(desk.url);
  try {
    const { message } = await openTicket();
    await settle(500);
    // Pretend the acknowledgement never made it back.
    await SupportMessage.query()
      .findById(message.id!)
      .patch({ deliveredAt: null });
    const before = desk.calls.length;

    await age(message.id!, 10);
    await onlyPending(message.id!);
    await new QdeskRetrySweep().runOnce();
    await settle(500);

    const replays = desk.calls.slice(before);
    equal(replays.length, 1, "one retry was sent");
    // The desk recognised it, so it is marked delivered and never tried
    // again — and it says "duplicate", meaning nothing was written twice.
    isNotNull(
      (await SupportMessage.query().findById(message.id!))!.deliveredAt ?? null,
    );
  } finally {
    restore();
    await desk.close();
  }
});

test("a message still in its first attempt is left alone", async () => {
  const desk = await fakeDesk();
  const restore = withBridge(desk.url);
  try {
    desk.up = false;
    const { message } = await openTicket();
    await settle(300);
    desk.up = true;
    // Not aged: it is younger than the retry window.
    const attempted = await new QdeskRetrySweep().runOnce();
    equal(attempted, 0);
    isNull(
      (await SupportMessage.query().findById(message.id!))!.deliveredAt ?? null,
    );
  } finally {
    restore();
    await desk.close();
  }
});

test("something too old to matter is given up on, and counted", async () => {
  const desk = await fakeDesk();
  const restore = withBridge(desk.url);
  try {
    desk.up = false;
    const { message } = await openTicket();
    await settle(300);
    desk.up = true;
    // Older than the give-up window.
    await age(message.id!, 60 * 24 * 5);

    const attempted = await new QdeskRetrySweep().runOnce();
    equal(attempted, 0, "not retried");
    // But not silently forgotten: this is the number a person has to see.
    equal((await QdeskRetrySweep.abandoned()) > 0, true);
  } finally {
    restore();
    await desk.close();
  }
});

test("with no bridge configured the sweep does nothing", async () => {
  const attempted = await new QdeskRetrySweep().runOnce();
  equal(attempted, 0);
});
