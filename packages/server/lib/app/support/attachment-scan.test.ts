import { createServer, type Server } from "node:net";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { SupportAttachment } from "@keylearn/database";
import { equal, isTrue, ok } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * The upload route, from the customer's side of it.
 *
 * `virus-scan.test.ts` holds the protocol; this holds the promise made to
 * the person uploading — that a file which does not pass is not kept.
 * "Refused" and "refused, and nothing was written" are different claims,
 * and only the second one is worth anything: a row pointing at bytes that
 * were quarantined later is still a row somebody can fetch.
 */

const context = new TestContext();

const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** A stand-in clamd that decides from the bytes, not from the test. */
async function clamd(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server: Server = createServer((socket) => {
    const parts: Buffer[] = [];
    socket.on("error", () => {});
    socket.on("data", (chunk: Buffer) => {
      parts.push(chunk);
      const all = Buffer.concat(parts);
      if (all.length >= 4 && all.readUInt32BE(all.length - 4) === 0) {
        const infected = all.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
        socket.write(
          infected ? "stream: Eicar-Test-Signature FOUND\0" : "stream: OK\0",
        );
        socket.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    port: typeof address === "object" && address != null ? address.port : 0,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

async function withScanner<T>(
  port: number | null,
  fn: () => Promise<T>,
): Promise<T> {
  const wasHost = process.env["CLAMAV_HOST"];
  const wasPort = process.env["CLAMAV_PORT"];
  const wasMode = process.env["ATTACHMENT_SCAN"];
  process.env["ATTACHMENT_SCAN"] = "required";
  if (port == null) {
    delete process.env["CLAMAV_HOST"];
  } else {
    process.env["CLAMAV_HOST"] = "127.0.0.1";
    process.env["CLAMAV_PORT"] = String(port);
  }
  try {
    return await fn();
  } finally {
    const put = (key: string, value: string | undefined) => {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    put("CLAMAV_HOST", wasHost);
    put("CLAMAV_PORT", wasPort);
    put("ATTACHMENT_SCAN", wasMode);
  }
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function upload(userId: number, name: string, bytes: Buffer) {
  const request = startApp(context.get(Application, kMain));
  await request.become(userId);
  return await request.POST("/_/support/my/attachments").send({
    fileName: name,
    mimeType: "image/png",
    data: bytes.toString("base64"),
  });
}

test("a clean file is stored, and the row says what vouched for it", async () => {
  const user = await findUser("user1@keylearn.org");
  const scanner = await clamd();
  try {
    const response = await withScanner(scanner.port, () =>
      upload(user.id!, "screenshot.png", png),
    );
    equal(response.status, 200);
    const { id } = (await response.body.json()) as { id: number };
    const row = await SupportAttachment.query().findById(id);
    ok(row != null);
    equal(row.scanner, "clamav");
    ok(row.scannedAt != null, "the row records when, not just whether");
    await row.$query().delete();
  } finally {
    await scanner.stop();
  }
});

test("an infected file is refused, and nothing is written", async () => {
  const user = await findUser("user1@keylearn.org");
  const before = await SupportAttachment.query().resultSize();
  const scanner = await clamd();
  try {
    const response = await withScanner(scanner.port, () =>
      upload(user.id!, "invoice.png", Buffer.from(EICAR)),
    );
    equal(response.status, 403);
    const said = await response.body.text();
    isTrue(
      said.includes("Eicar-Test-Signature"),
      "the customer is told what was found, not just that it failed",
    );
    equal(
      await SupportAttachment.query().resultSize(),
      before,
      "a refused file leaves no row behind",
    );
  } finally {
    await scanner.stop();
  }
});

test("no scanner means refused, not accepted unchecked", async () => {
  const user = await findUser("user1@keylearn.org");
  const before = await SupportAttachment.query().resultSize();

  const response = await withScanner(null, () =>
    upload(user.id!, "screenshot.png", png),
  );

  // 503 rather than 403: the file is fine as far as anyone knows, and the
  // person uploading it did nothing wrong.
  equal(response.status, 503);
  const said = await response.body.text();
  isTrue(
    !said.toLowerCase().includes("clamav"),
    "the reason is for the log, not for whoever is uploading",
  );
  equal(await SupportAttachment.query().resultSize(), before);
});

test("with scanning switched off a file is stored, and says so", async () => {
  const user = await findUser("user1@keylearn.org");
  const was = process.env["ATTACHMENT_SCAN"];
  process.env["ATTACHMENT_SCAN"] = "off";
  try {
    const response = await upload(user.id!, "screenshot.png", png);
    equal(response.status, 200);
    const { id } = (await response.body.json()) as { id: number };
    const row = await SupportAttachment.query().findById(id);
    ok(row != null);
    // Null rather than a reassuring default. Nothing looked at this file,
    // and the row is the only place that fact survives.
    equal(row.scanner, null);
    equal(row.scannedAt, null);
    await row.$query().delete();
  } finally {
    if (was == null) {
      delete process.env["ATTACHMENT_SCAN"];
    } else {
      process.env["ATTACHMENT_SCAN"] = was;
    }
  }
});
