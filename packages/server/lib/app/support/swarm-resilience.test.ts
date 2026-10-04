import { createServer, type Server } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { type AddressInfo } from "node:net";
import { afterEach, beforeEach, test } from "node:test";
import { Application } from "@fastr/core";
import { DataDir } from "@keylearn/config";
import {
  SupportAttachment,
  SupportMessage,
  SupportTicket,
} from "@keylearn/database";
import { equal, isFalse, isNotNull, isNull, isTrue } from "rich-assert";
import { resetRateLimits } from "../auth/ratelimit.ts";
import { CaptchaUnavailableError, requireCaptcha } from "../auth/turnstile.ts";
import { checkProductionConfig } from "../config-check.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { sweepStaleUploads } from "./attachment-quota.ts";
import { resetSupportLimits, stripUrlsFromName } from "./limits.ts";
import {
  fetchDeskAttachment,
  parseRetryAfter,
  resetDeskBackoff,
} from "./qdesk-forward.ts";
import {
  attempt,
  backoffMs,
  dueFairly,
  ensureOutbox,
  OUTBOX_TABLE,
  record,
  retryable,
} from "./qdesk-outbox.ts";
import { scanLoad, ScannerDown, scanUpload } from "./virus-scan.ts";

/**
 * The support surface under a swarm: limits that do not care which IP a
 * request came from, mail that cannot be aimed at a stranger, uploads that
 * cannot fill the disk, and desk forwards that survive the desk being down.
 */

const context = new TestContext();

const ENV_KEYS = [
  "SUPPORT_THREAD_REPLIES_PER_HOUR",
  "SUPPORT_ACCOUNT_TICKETS_PER_DAY",
  "SUPPORT_EMAIL_TICKETS_PER_DAY",
  "SUPPORT_MAIL_COOLDOWN_MINUTES",
  "QDESK_URL",
  "QDESK_APP_KEY",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "CLAMAV_HOST",
  "CLAMAV_PORT",
  "CLAMAV_MAX_CONCURRENT",
  "CLAMAV_MAX_QUEUED",
];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  resetRateLimits();
  resetSupportLimits();
  resetDeskBackoff();
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v == null) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});

let seq = 0;
const tag = () => `${process.pid}-${++seq}`;
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── names in mail ──

test("a name loses anything a mail client would make a link of", () => {
  equal(stripUrlsFromName("Ann Smith"), "Ann Smith");
  equal(stripUrlsFromName("J. Smith"), "J. Smith");
  equal(stripUrlsFromName("Win now https://evil.example/x"), "Win now");
  equal(stripUrlsFromName("visit evil.com."), "visit");
  equal(stripUrlsFromName("www.evil.io please"), "please");
  equal(stripUrlsFromName("evil.com/claim"), "Guest");
  equal(stripUrlsFromName("<b>Bob</b>"), "Guest");
});

// ── guest thread replies ──

test("a guest thread takes only so many replies an hour, whatever the IP", async () => {
  process.env["SUPPORT_THREAD_REPLIES_PER_HOUR"] = "3";
  const { ticket, threadToken } = await SupportTicket.create({
    userId: null,
    kind: "support",
    name: "Guest",
    email: `guest-${tag()}@example.com`,
    subject: "Help",
    message: "Opening words",
    status: "open",
    confirmed: true,
  });
  const request = startApp(context.get(Application, kMain));
  for (let i = 0; i < 3; i++) {
    resetRateLimits();
    const ok = await request
      .POST(`/_/support/t/${threadToken}/reply`)
      .send({ message: `reply ${i}` });
    equal(ok.status, 200);
  }
  resetRateLimits(); // a fresh IP, as far as the per-IP buckets know
  const refused = await request
    .POST(`/_/support/t/${threadToken}/reply`)
    .send({ message: "one too many" });
  equal(refused.status, 429);
  equal(
    await SupportMessage.query()
      .where("ticketId", ticket.id!)
      .where("sender", "them")
      .resultSize(),
    3,
  );
});

// ── per-account tickets ──

test("an account opens only so many tickets a day", async () => {
  process.env["SUPPORT_ACCOUNT_TICKETS_PER_DAY"] = "2";
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);
  for (let i = 0; i < 2; i++) {
    resetRateLimits();
    const res = await request
      .POST("/_/support/my/tickets")
      .send({ subject: `Q ${i}`, message: `Question ${tag()}` });
    equal(res.status, 200);
  }
  resetRateLimits();
  const refused = await request
    .POST("/_/support/my/tickets")
    .send({ subject: "Q 3", message: `Question ${tag()}` });
  equal(refused.status, 429);
});

// ── mail relay ──

test("a guest address is mailed once per cooldown, however many IPs ask", async () => {
  const email = `victim-${tag()}@example.com`;
  const request = startApp(context.get(Application, kMain));
  context.mailer.dump();
  const first = await request.POST("/_/support/tickets").send({
    kind: "support",
    name: "Victim",
    email,
    subject: "One",
    message: `First ${tag()}`,
  });
  equal(first.status, 200);
  resetRateLimits(); // a different IP
  const second = await request.POST("/_/support/tickets").send({
    kind: "support",
    name: "Victim",
    email,
    subject: "Two",
    message: `Second ${tag()}`,
  });
  equal(second.status, 429);
  await settle(100);
  equal(context.mailer.dump().filter((m) => m.to === email).length, 1);
});

test("a guest address opens only so many tickets a day", async () => {
  process.env["SUPPORT_EMAIL_TICKETS_PER_DAY"] = "1";
  process.env["SUPPORT_MAIL_COOLDOWN_MINUTES"] = "0";
  const email = `guest-${tag()}@example.com`;
  const request = startApp(context.get(Application, kMain));
  const send = () =>
    request.POST("/_/support/tickets").send({
      kind: "support",
      name: "Guest",
      email,
      subject: "Hi",
      message: `Words ${tag()}`,
    });
  equal((await send()).status, 200);
  resetRateLimits();
  equal((await send()).status, 429);
});

test("a guest business enquiry is not written back to until its address is proven", async () => {
  const email = `partner-${tag()}@example.com`;
  context.mailer.dump();
  const res = await startApp(context.get(Application, kMain))
    .POST("/_/support/tickets")
    .send({
      kind: "business",
      name: "Partner https://evil.example",
      email,
      subject: "Licensing",
      message: `We'd like to talk ${tag()}`,
    });
  equal(res.status, 200);
  const ticket = (await SupportTicket.query().orderBy("id", "desc").first())!;
  isTrue(Boolean(ticket.confirmed), "still live on the desk at once");
  isNotNull(ticket.confirmTokenHash ?? null, "but the address is unproven");
  equal(ticket.name, "Partner", "and the link is gone from the name");
  await settle(100);
  const mails = context.mailer.dump().filter((m) => m.to === email);
  equal(mails.length, 1, "the only mail is the confirmation");
  isFalse((mails[0]!.text ?? "").includes("evil.example"));
});

// ── Turnstile ──

test("the always-on gate fails closed when siteverify cannot be reached", async () => {
  process.env["TURNSTILE_SITE_KEY"] = "site";
  process.env["TURNSTILE_SECRET_KEY"] = "secret";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  try {
    const ctx = {
      request: {
        req: { headers: {}, socket: { remoteAddress: "203.0.113.9" } },
      },
    } as any;
    let thrown: unknown = null;
    try {
      await requireCaptcha(ctx, "some-token");
    } catch (err) {
      thrown = err;
    }
    isTrue(thrown instanceof CaptchaUnavailableError);
    equal((thrown as CaptchaUnavailableError).status, 503);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("production refuses to boot without Turnstile keys", () => {
  const before = { ...process.env };
  try {
    process.env["NODE_ENV"] = "production";
    process.env["TURNSTILE_SITE_KEY"] = "";
    process.env["TURNSTILE_SECRET_KEY"] = "";
    const { fatal } = checkProductionConfig();
    isTrue(fatal.some((m) => m.includes("TURNSTILE_SECRET_KEY")));
    isTrue(fatal.some((m) => m.includes("TURNSTILE_SITE_KEY")));
  } finally {
    for (const k of Object.keys(process.env)) {
      if (!(k in before)) {
        delete process.env[k];
      }
    }
    Object.assign(process.env, before);
  }
});

// ── attachments ──

test("an upload never sent is swept after its window, file and row", async () => {
  const dataDir = context.get(DataDir);
  const row = await SupportAttachment.query().insertAndFetch({
    ticketId: null,
    messageId: null,
    userId: (await findUser("user1@keylearn.org")).id!,
    fileName: "x.png",
    mimeType: "image/png",
    size: 10,
    scannedAt: null,
    scanner: null,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
  } as any);
  const fresh = await SupportAttachment.query().insertAndFetch({
    ticketId: null,
    messageId: null,
    userId: (await findUser("user1@keylearn.org")).id!,
    fileName: "y.png",
    mimeType: "image/png",
    size: 10,
    scannedAt: null,
    scanner: null,
  } as any);
  equal(await sweepStaleUploads(dataDir), 1);
  isNull((await SupportAttachment.query().findById(row.id!)) ?? null);
  isNotNull((await SupportAttachment.query().findById(fresh.id!)) ?? null);
});

test("an account past its attachment quota is refused before the scan", async () => {
  process.env["CLAMAV_HOST"] = ""; // would 503 if the scan were reached
  const user = await findUser("user1@keylearn.org");
  await SupportAttachment.query().insert({
    ticketId: null,
    messageId: 1,
    userId: user.id!,
    fileName: "big.pdf",
    mimeType: "application/pdf",
    size: 200 * 1024 * 1024,
    scannedAt: null,
    scanner: null,
  } as any);
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);
  const res = await request.POST("/_/support/my/attachments").send({
    fileName: "a.png",
    mimeType: "image/png",
    data: Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]).toString("base64"),
  });
  equal(res.status, 403);
});

test("scans beyond the concurrency and queue bounds are refused as scanner-busy", async () => {
  // A clamd that never answers, so the first scan holds its slot.
  const server = createTcpServer(() => {});
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env["CLAMAV_HOST"] = "127.0.0.1";
  process.env["CLAMAV_PORT"] = String((server.address() as AddressInfo).port);
  process.env["CLAMAV_MAX_CONCURRENT"] = "1";
  process.env["CLAMAV_MAX_QUEUED"] = "0";
  process.env["CLAMAV_TIMEOUT_MS"] = "300";
  try {
    const first = scanUpload(Buffer.from("hello")).catch((e) => e);
    await settle(20);
    equal(scanLoad().running, 1);
    const second = await scanUpload(Buffer.from("world")).catch((e) => e);
    isTrue(second instanceof ScannerDown);
    isTrue(String((second as Error).message).includes("busy"));
    await first;
    equal(scanLoad().running, 0);
  } finally {
    delete process.env["CLAMAV_TIMEOUT_MS"];
    server.close();
  }
});

// ── the desk ──

type Desk = {
  url: string;
  calls: { path: string; headers: any; body: any }[];
  respond: (path: string) => { status: number; headers?: any; body?: string };
  close: () => Promise<void>;
};

async function fakeDesk(): Promise<Desk> {
  const desk: Desk = {
    url: "",
    calls: [],
    respond: () => ({ status: 200, body: "{}" }),
    close: async () => {},
  };
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const path = req.url ?? "";
      desk.calls.push({
        path,
        headers: req.headers,
        body: raw === "" ? null : JSON.parse(raw),
      });
      const r = desk.respond(path);
      res.writeHead(r.status, {
        "content-type": "application/json",
        ...(r.headers ?? {}),
      });
      res.end(r.body ?? "{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  desk.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  desk.close = () => new Promise<void>((r) => server.close(() => r()));
  process.env["QDESK_URL"] = desk.url;
  process.env["QDESK_APP_KEY"] = "test-key";
  return desk;
}

test("a desk redirect is not followed, so the app key never leaves for another host", async () => {
  const other = await fakeDesk();
  const desk = await fakeDesk();
  desk.respond = () => ({
    status: 302,
    headers: { location: `${other.url}/steal` },
  });
  try {
    isNull(await fetchDeskAttachment(1, 2));
    equal(other.calls.length, 0);
  } finally {
    await desk.close();
    await other.close();
  }
});

test("a desk attachment over the cap is abandoned, declared or not", async () => {
  const desk = await fakeDesk();
  desk.respond = () => ({ status: 200, body: "x".repeat(5000) });
  try {
    isNull(await fetchDeskAttachment(1, 2, 1000));
    const ok = await fetchDeskAttachment(1, 2, 10_000);
    equal(ok?.length, 5000);
  } finally {
    await desk.close();
  }
});

test("retry rules: transient statuses retry, refusals do not, Retry-After is honoured", () => {
  for (const s of [0, 404, 408, 425, 429, 500, 503]) {
    isTrue(retryable(s), String(s));
  }
  for (const s of [400, 401, 403, 409, 422]) {
    isFalse(retryable(s), String(s));
  }
  equal(parseRetryAfter("120"), 120_000);
  isNull(parseRetryAfter(null));
  isTrue(backoffMs(1, 90_000) >= 90_000);
});

test("a rating the desk could not take is kept and delivered on a later attempt", async () => {
  const desk = await fakeDesk();
  try {
    await ensureOutbox();
    let up = false;
    desk.respond = () => (up ? { status: 200 } : { status: 503 });
    const id = await record({
      kind: "csat",
      ticketId: 9,
      path: "/_/apps/tickets/9/csat",
      body: { rating: 5, note: null },
      dedupeKey: "csat:9",
    });
    isFalse(await attempt(id));
    const k = SupportMessage.knex();
    let row = await k(OUTBOX_TABLE).where("id", id).first();
    isNull(row.delivered_at);
    equal(Number(row.attempts), 1);
    up = true;
    isTrue(await attempt(id));
    row = await k(OUTBOX_TABLE).where("id", id).first();
    isNotNull(row.delivered_at);
    // The same key travelled both times, so the desk can tell a replay.
    equal(
      desk.calls[0]!.headers["idempotency-key"],
      desk.calls[1]!.headers["idempotency-key"],
    );
  } finally {
    await desk.close();
  }
});

test("a refusal is recorded once and not retried", async () => {
  const desk = await fakeDesk();
  desk.respond = () => ({ status: 400 });
  try {
    const id = await record({
      kind: "resolution",
      ticketId: 10,
      path: "/_/apps/tickets/10/resolution",
      body: { resolved: true },
      dedupeKey: "resolution:10",
    });
    isFalse(await attempt(id));
    const row = await SupportMessage.knex()(OUTBOX_TABLE)
      .where("id", id)
      .first();
    isNotNull(row.failed_at);
  } finally {
    await desk.close();
  }
});

test("the drain is fair: one row per account before any account's second", async () => {
  const desk = await fakeDesk();
  try {
    await ensureOutbox();
    const k = SupportMessage.knex();
    await k(OUTBOX_TABLE).delete();
    const now = Date.now();
    const rows = [];
    // A swarm's backlog, oldest first, then one real customer.
    for (let i = 0; i < 10; i++) {
      rows.push({ account_key: "u:swarm", dedupe_key: `s${i}` });
    }
    rows.push({ account_key: "u:real", dedupe_key: "r0" });
    for (const [i, r] of rows.entries()) {
      await k(OUTBOX_TABLE).insert({
        kind: "csat",
        ticket_id: 1,
        path: "/x",
        body: "{}",
        idem_key: `idem-${tag()}-${i}`,
        dedupe_key: r.dedupe_key,
        account_key: r.account_key,
        attempts: 0,
        next_attempt_at: now - 1000,
        created_at: now - 1000,
      });
    }
    const ids = await dueFairly(2, now);
    const picked = await k(OUTBOX_TABLE)
      .whereIn("id", ids)
      .select("account_key");
    const keys = picked.map((r: any) => r.account_key).sort();
    equal(JSON.stringify(keys), JSON.stringify(["u:real", "u:swarm"]));
  } finally {
    await desk.close();
  }
});
