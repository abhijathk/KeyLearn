import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { SupportMessage, SupportTicket } from "@keylearn/database";
import { equal, isNotNull, isNull } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * The second tick.
 *
 * One tick means the message is stored here; two mean the desk took it.
 * The distinction is only worth drawing if it is true, so these tests are
 * about the two halves that can silently stop being true: the mark not
 * being written when the desk answers, and — the bug this suite was
 * written after — the mark being written and then dropped on the way out,
 * because the customer's thread endpoint builds its own message shape by
 * hand instead of using `SupportMessage.toDetails()`.
 */

const context = new TestContext();

/**
 * A submission nothing else can collide with.
 *
 * The endpoint folds a repeat of the same email and words into the
 * existing ticket, which is right for "I hit submit twice" and quietly
 * fatal for a test: a fixed fixture reuses another test's ticket, takes
 * the dedup branch, and forwards nothing. Every assertion here then fails
 * for a reason that has nothing to do with delivery.
 */
let seq = 0;
function newTicket() {
  const tag = `${process.pid}-${++seq}`;
  return {
    kind: "support",
    name: "A Parent",
    email: `parent-${tag}@example.com`,
    subject: "Certificate will not download",
    message: `The completion certificate does nothing when I tap download. (${tag})`,
  };
}

/** A stand-in desk that answers however a test needs it to. */
async function fakeDesk(
  handler: (path: string) => { status: number; body?: unknown },
): Promise<{ url: string; calls: string[]; close: () => Promise<void> }> {
  const calls: string[] = [];
  const server: Server = createServer((req, res) => {
    calls.push(req.url ?? "");
    // The body has to be drained, or the client's request never settles.
    req.resume();
    req.on("end", () => {
      const { status, body } = handler(req.url ?? "");
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body == null ? "" : JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/**
 * Forwarding is deliberately fire-and-forget — the desk being slow must
 * never hold up a customer's send — so the mark lands a moment after the
 * response. Polled rather than slept on: a fixed wait is either flaky or
 * slow, and usually both.
 */
async function deliveredWithin(
  messageId: number,
  ms = 3000,
): Promise<Date | null> {
  const until = Date.now() + ms;
  for (;;) {
    const row = await SupportMessage.query().findById(messageId);
    if (row?.deliveredAt != null) {
      return new Date(row.deliveredAt);
    }
    if (Date.now() > until) {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function withBridge<T>(url: string, body: () => Promise<T>): Promise<T> {
  const oldUrl = process.env["QDESK_URL"];
  const oldKey = process.env["QDESK_APP_KEY"];
  process.env["QDESK_URL"] = url;
  process.env["QDESK_APP_KEY"] = "test-key";
  try {
    return await body();
  } finally {
    // Restored rather than deleted: another test may have set them.
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
  }
}

/** The opening message of a ticket this user just logged. */
async function openTicket(
  request: ReturnType<typeof startApp>,
): Promise<{ ticketId: number; messageId: number }> {
  const response = await request.POST("/_/support/tickets").send(newTicket());
  equal(response.status, 200);
  // Signed in, so it is confirmed on arrival and forwarded straight away
  // — the holding queue is only for a signed-out submission.
  equal(
    ((await response.body.json()) as { holding?: boolean }).holding ?? false,
    false,
  );
  const created = await SupportTicket.query().orderBy("id", "desc").first();
  const first = await SupportMessage.query()
    .where("ticketId", created!.id!)
    .andWhere("sender", "them")
    .orderBy("id", "desc")
    .first();
  return { ticketId: created!.id!, messageId: first!.id! };
}

test("the desk taking a message marks it delivered", async () => {
  const desk = await fakeDesk(() => ({ status: 200, body: { ok: true } }));
  try {
    const user = await findUser("user1@keylearn.org");
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);

    const { messageId } = await withBridge(desk.url, () => openTicket(request));

    isNotNull(await deliveredWithin(messageId));
  } finally {
    await desk.close();
  }
});

test("a reply gets its own mark, not the ticket's", async () => {
  const desk = await fakeDesk(() => ({ status: 200, body: { ok: true } }));
  try {
    const user = await findUser("user1@keylearn.org");
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);

    const { ticketId, messageId } = await withBridge(desk.url, () =>
      openTicket(request),
    );
    isNotNull(await deliveredWithin(messageId));

    const replied = await withBridge(desk.url, async () => {
      const response = await request
        .POST(`/_/support/my/tickets/${ticketId}/reply`)
        .send({
          message: "Still happening on the second try.",
          // Eight characters minimum — the outbox's idempotency key.
          clientId: `reply-${process.pid}`,
        });
      equal(response.status, 200);
      return ((await response.body.json()) as { id: number }).id;
    });

    isNotNull(await deliveredWithin(replied));
  } finally {
    await desk.close();
  }
});

test("a desk that refuses leaves the message on one tick", async () => {
  // The state the whole feature exists to distinguish: stored here, not
  // handed over. A tick that appears anyway would be a lie about where
  // somebody's message got to.
  const desk = await fakeDesk(() => ({ status: 500 }));
  try {
    const user = await findUser("user1@keylearn.org");
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);

    const { messageId } = await withBridge(desk.url, () => openTicket(request));

    isNull(await deliveredWithin(messageId, 500));
    // It was genuinely attempted — otherwise this test would also pass
    // with the bridge switched off, and prove nothing.
    equal(desk.calls.length > 0, true);
  } finally {
    await desk.close();
  }
});

test("with no bridge configured nothing is marked", async () => {
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const { messageId } = await openTicket(request);

  isNull(await deliveredWithin(messageId, 500));
});

test("the customer's thread carries the mark to the browser", async () => {
  // The regression this suite was written for. Every assertion above
  // passed while the ticks stayed stubbornly single, because the mark was
  // written to the database and then left out of the response.
  const desk = await fakeDesk(() => ({ status: 200, body: { ok: true } }));
  try {
    const user = await findUser("user1@keylearn.org");
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);

    const { ticketId, messageId } = await withBridge(desk.url, () =>
      openTicket(request),
    );
    isNotNull(await deliveredWithin(messageId));

    const response = await request
      .GET(`/_/support/my/tickets/${ticketId}`)
      .send();
    equal(response.status, 200);
    const body = (await response.body.json()) as {
      messages: { id: number; sender: string; deliveredAt: string | null }[];
    };

    const mine = body.messages.find((m) => m.id === messageId);
    isNotNull(mine);
    isNotNull(mine!.deliveredAt);
    // Anything written *to* them never gets a tick — a mark on someone
    // else's message would be reporting on them, not on you.
    for (const m of body.messages.filter((m) => m.sender !== "them")) {
      isNull(m.deliveredAt);
    }
  } finally {
    await desk.close();
  }
});
