import { createServer, type Server } from "node:net";
import { test } from "node:test";
import { equal, match, ok } from "rich-assert";
import {
  scanBuffer,
  scannerAddress,
  ScannerDown,
  scanningRequired,
} from "./virus-scan.ts";

/**
 * These hold one property, from several directions: a file is accepted
 * only when a scanner actively said it was clean.
 *
 * Every other outcome — a refused connection, a silence, a reply this
 * code has never seen — has to reach the caller as a failure. The bug
 * worth testing for is not "an infected file was called clean"; clamd
 * does not do that. It is the ordinary one where a scanner nobody
 * noticed was down turns the whole check into a no-op.
 */

/** A stand-in clamd that answers however the test needs it to. */
async function fakeClamd(
  reply: string | null,
  onData?: (chunks: Buffer[]) => void,
): Promise<{ port: number; close: () => Promise<void>; server: Server }> {
  const server = createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      // The end-of-stream sentinel is four zero bytes.
      const all = Buffer.concat(chunks);
      if (all.length >= 4 && all.readUInt32BE(all.length - 4) === 0) {
        onData?.(chunks);
        if (reply != null) {
          socket.write(`${reply}\0`);
        }
        socket.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port =
    typeof address === "object" && address != null ? address.port : 0;
  return {
    port,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

const at = (port: number) => ({
  host: "127.0.0.1",
  port,
  timeoutMs: 2000,
});

test("a clean file comes back clean, and every byte was sent", async () => {
  let received: Buffer[] = [];
  const clamd = await fakeClamd("stream: OK", (chunks) => {
    received = chunks;
  });
  try {
    const data = Buffer.alloc(200 * 1024, 7);
    const verdict = await scanBuffer(data, at(clamd.port));
    ok(verdict.clean);
    const wire = Buffer.concat(received);
    match(wire.subarray(0, 10).toString("utf8"), /^zINSTREAM/);
    // Header, chunks and the terminator: 10 for the command, then 4
    // bytes of length per 64 KB chunk, then 4 zero bytes.
    const chunkCount = Math.ceil(data.length / (64 * 1024));
    ok(chunkCount > 1, "a 200 KB file spans more than one chunk");
    equal(wire.length, 10 + data.length + 4 * chunkCount + 4);
  } finally {
    await clamd.close();
  }
});

test("an infected file is refused, and the threat is named", async () => {
  const clamd = await fakeClamd("stream: Eicar-Test-Signature FOUND");
  try {
    const verdict = await scanBuffer(Buffer.from("x"), at(clamd.port));
    equal(verdict.clean, false);
    ok(!verdict.clean && verdict.threat === "Eicar-Test-Signature");
  } finally {
    await clamd.close();
  }
});

test("a reply this code cannot read is never a pass", async () => {
  for (const said of [
    "INSTREAM size limit exceeded. ERROR",
    "UNKNOWN COMMAND",
    "stream: something nobody has written yet",
  ]) {
    const clamd = await fakeClamd(said);
    try {
      let threw: unknown = null;
      try {
        await scanBuffer(Buffer.from("x"), at(clamd.port));
      } catch (err) {
        threw = err;
      }
      ok(threw instanceof ScannerDown, `${said} must not resolve`);
    } finally {
      await clamd.close();
    }
  }
});

test("a scanner that hangs up without answering is an outage", async () => {
  const clamd = await fakeClamd(null);
  try {
    let threw: unknown = null;
    try {
      await scanBuffer(Buffer.from("x"), at(clamd.port));
    } catch (err) {
      threw = err;
    }
    ok(threw instanceof ScannerDown);
  } finally {
    await clamd.close();
  }
});

test("a scanner that is not listening is an outage, not a pass", async () => {
  // Bound and immediately released, so the port is almost certainly free.
  const clamd = await fakeClamd("stream: OK");
  const port = clamd.port;
  await clamd.close();
  let threw: unknown = null;
  try {
    await scanBuffer(Buffer.from("x"), at(port));
  } catch (err) {
    threw = err;
  }
  ok(threw instanceof ScannerDown);
});

test("scanning is required unless somebody deliberately turned it off", () => {
  const was = process.env["ATTACHMENT_SCAN"];
  try {
    delete process.env["ATTACHMENT_SCAN"];
    ok(scanningRequired(), "the default is on");
    process.env["ATTACHMENT_SCAN"] = "required";
    ok(scanningRequired());
    // A typo is not an off switch.
    process.env["ATTACHMENT_SCAN"] = "no";
    ok(scanningRequired());
    process.env["ATTACHMENT_SCAN"] = "off";
    ok(!scanningRequired());
    process.env["ATTACHMENT_SCAN"] = "OFF";
    ok(!scanningRequired(), "the switch is not case sensitive");
  } finally {
    if (was == null) {
      delete process.env["ATTACHMENT_SCAN"];
    } else {
      process.env["ATTACHMENT_SCAN"] = was;
    }
  }
});

test("an unconfigured host means no scanner, which the caller refuses", () => {
  const was = process.env["CLAMAV_HOST"];
  try {
    delete process.env["CLAMAV_HOST"];
    equal(scannerAddress(), null);
    process.env["CLAMAV_HOST"] = "";
    equal(scannerAddress(), null, "empty is unset, not localhost");
    process.env["CLAMAV_HOST"] = "clamd.internal";
    const where = scannerAddress();
    equal(where?.host, "clamd.internal");
    equal(where?.port, 3310, "the documented clamd port is the default");
  } finally {
    if (was == null) {
      delete process.env["CLAMAV_HOST"];
    } else {
      process.env["CLAMAV_HOST"] = was;
    }
  }
});
