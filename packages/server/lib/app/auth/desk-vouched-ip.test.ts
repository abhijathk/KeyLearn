import { equal } from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { clientIp } from "./ratelimit.ts";

const ctxWith = (headers: Record<string, string>, peer = "10.0.0.9") =>
  ({ request: { req: { headers, socket: { remoteAddress: peer } } } }) as never;
const sign = (key: string, ip: string, ts: number) =>
  createHmac("sha256", key).update(`${ip}|${ts}`, "utf8").digest("hex");

test("a signed client address from the desk is honoured; anything else is the socket", () => {
  const saved = process.env.OPS_API_KEY;
  process.env.OPS_API_KEY = "k".repeat(40);
  try {
    const now = Math.floor(Date.now() / 1000);
    const good = {
      "x-qdesk-client-ip": "203.0.113.7",
      "x-qdesk-client-ip-ts": String(now),
      "x-qdesk-client-ip-sig": sign("k".repeat(40), "203.0.113.7", now),
    };
    equal(clientIp(ctxWith(good)), "203.0.113.7");
    // forged signature, stale timestamp, wrong key, altered address
    equal(
      clientIp(ctxWith({ ...good, "x-qdesk-client-ip-sig": "0".repeat(64) })),
      "10.0.0.9",
    );
    equal(
      clientIp(
        ctxWith({
          ...good,
          "x-qdesk-client-ip-ts": String(now - 120),
          "x-qdesk-client-ip-sig": sign(
            "k".repeat(40),
            "203.0.113.7",
            now - 120,
          ),
        }),
      ),
      "10.0.0.9",
    );
    equal(
      clientIp(
        ctxWith({
          ...good,
          "x-qdesk-client-ip-sig": sign("other", "203.0.113.7", now),
        }),
      ),
      "10.0.0.9",
    );
    equal(
      clientIp(ctxWith({ ...good, "x-qdesk-client-ip": "198.51.100.1" })),
      "10.0.0.9",
    );
    delete process.env.OPS_API_KEY;
    equal(clientIp(ctxWith(good)), "10.0.0.9");
  } finally {
    if (saved == null) delete process.env.OPS_API_KEY;
    else process.env.OPS_API_KEY = saved;
  }
});
