import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { Application } from "@fastr/core";
import {
  SupportAttachment,
  SupportMessage,
  SupportTicket,
} from "@keylearn/database";
import { equal, isTrue } from "rich-assert";
import { resetRateLimits } from "../auth/ratelimit.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

/**
 * The desk's reply leg as KeyLearn receives it: a retried delivery is
 * recognised rather than shown twice, and the files a staffer attached are
 * fetched back from the desk and stored against the reply that carried them.
 */

const OPS_KEY = "Dk7s2Qm9Lx4Pb8Zr1Tw6Vn3Hc5Jf0Ya";
// A 1×1 PNG — the bytes have to agree with the type they claim.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

const context = new TestContext();
let desk: Server;
const fetched: string[] = [];

before(async () => {
  desk = createServer((req, res) => {
    fetched.push(req.url ?? "");
    if (req.method === "POST" && req.url === "/_/apps/tickets") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ticketId: 4242, duplicate: false }));
      return;
    }
    if (/\/attachments\/77$/.test(req.url ?? "")) {
      res.setHeader("content-type", "image/png");
      res.end(PNG);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => desk.listen(0, "127.0.0.1", resolve));
  const address = desk.address();
  process.env["QDESK_URL"] =
    `http://127.0.0.1:${typeof address === "object" && address != null ? address.port : 0}`;
  process.env["QDESK_APP_KEY"] = "test-key";
  process.env["OPS_API_KEY"] = OPS_KEY;
});

// Scanning is fail-closed by default; each test states the mode it needs.
const scanMode = (mode: string | undefined) => {
  if (mode == null) {
    delete process.env["ATTACHMENT_SCAN"];
  } else {
    process.env["ATTACHMENT_SCAN"] = mode;
  }
};

after(() => {
  desk.close();
  delete process.env["QDESK_URL"];
  delete process.env["QDESK_APP_KEY"];
  scanMode(undefined);
});

async function guestTicket(): Promise<number> {
  const { ticket } = await SupportTicket.create({
    kind: "support",
    name: "A Guest",
    email: `guest-${process.pid}-${Date.now()}@example.com`,
    subject: "Receipt please",
    message: "Could you send the receipt?",
    status: "open",
    confirmed: true,
  });
  return ticket.id!;
}

function deliver(id: number, body: Record<string, unknown>) {
  return startApp(context.get(Application, kMain))
    .POST(`/_/internal/tickets/${id}/deliver-reply`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ body: "Here it is.", sender: "us", ...body });
}

test("a retried delivery with the same desk id is recognised, not repeated", async () => {
  const id = await guestTicket();
  const first = await deliver(id, { qdeskMessageId: 501 });
  equal(first.status, 200);
  const again = await deliver(id, { qdeskMessageId: 501 });
  equal(again.status, 200);
  isTrue(
    ((await again.body.json()) as { duplicate?: boolean }).duplicate === true,
  );
  const copies = await SupportMessage.query()
    .where("ticketId", id)
    .where("qdeskMessageId", 501);
  equal(copies.length, 1);
});

test("a file the staffer attached is fetched from the desk and bound to the reply", async () => {
  scanMode("off");
  const id = await guestTicket();
  const response = await deliver(id, {
    qdeskMessageId: 502,
    attachments: [
      {
        id: 77,
        fileName: "receipt.png",
        mimeType: "image/png",
        size: PNG.length,
      },
      // Refused by type before any fetch: the desk's list is not this app's.
      { id: 78, fileName: "page.svg", mimeType: "image/svg+xml", size: 10 },
    ],
  });
  equal(response.status, 200);
  equal(
    ((await response.body.json()) as { attachmentsStored?: number })
      .attachmentsStored,
    1,
  );
  isTrue(
    fetched.some((u) => u.endsWith(`/_/apps/tickets/${id}/attachments/77`)),
  );
  isTrue(!fetched.some((u) => u.endsWith("/attachments/78")));
  const reply = await SupportMessage.query()
    .where("ticketId", id)
    .where("qdeskMessageId", 502)
    .first();
  const files = await SupportAttachment.query().where("messageId", reply!.id!);
  equal(files.length, 1);
  equal(files[0]!.fileName, "receipt.png");
});

test("with no scanner reachable the file is refused, and the reply still lands", async () => {
  scanMode("required");
  delete process.env["CLAMAV_HOST"];
  const id = await guestTicket();
  const response = await deliver(id, {
    qdeskMessageId: 503,
    attachments: [
      {
        id: 77,
        fileName: "receipt.png",
        mimeType: "image/png",
        size: PNG.length,
      },
    ],
  });
  equal(response.status, 200);
  equal(
    ((await response.body.json()) as { attachmentsStored?: number })
      .attachmentsStored,
    0,
  );
  const reply = await SupportMessage.query()
    .where("ticketId", id)
    .where("qdeskMessageId", 503)
    .first();
  isTrue(reply != null);
  equal(
    (await SupportAttachment.query().where("messageId", reply!.id!)).length,
    0,
  );
});

test("the business-enquiry email opens the ticket on the desk, not a KeyLearn /desk page", async () => {
  resetRateLimits();
  process.env["SUPPORT_INBOX_EMAIL"] = "inbox@example.com";
  try {
    context.mailer.dump();
    const response = await startApp(context.get(Application, kMain))
      .POST("/_/support/tickets")
      .send({
        kind: "business",
        name: "A Partner",
        email: `partner-${process.pid}@example.com`,
        subject: "Licensing",
        message: "We'd like to license KeyLearn for our centres.",
      });
    equal(response.status, 200);
    let mail;
    for (let i = 0; i < 50 && mail == null; i++) {
      await new Promise((r) => setTimeout(r, 50));
      mail = context.mailer.dump().find((m) => m.to === "inbox@example.com");
    }
    isTrue(mail != null, "the staff email went");
    isTrue(
      mail!.text!.includes(`${process.env["QDESK_URL"]}/thread/4242`),
      mail!.text!,
    );
    isTrue(!mail!.text!.includes("/desk/t/"));
  } finally {
    delete process.env["SUPPORT_INBOX_EMAIL"];
  }
});
