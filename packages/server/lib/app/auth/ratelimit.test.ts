import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import {
  clientFromForwarded,
  rateLimit,
  resetTrustedProxies,
} from "./ratelimit.ts";

/** Runs a case with a given TRUSTED_PROXIES, then puts the world back. */
function withTrusted(value: string, run: () => void): void {
  const had = process.env["TRUSTED_PROXIES"];
  process.env["TRUSTED_PROXIES"] = value;
  resetTrustedProxies();
  try {
    run();
  } finally {
    if (had === undefined) {
      delete process.env["TRUSTED_PROXIES"];
    } else {
      process.env["TRUSTED_PROXIES"] = had;
    }
    resetTrustedProxies();
  }
}

test("the client is read from the right, not the left", () => {
  // The bug this replaces: taking the left-most entry is only correct if every
  // proxy REPLACED the header. Most append, and then the left-most value is
  // whatever the caller sent — so a request arriving with a forged header got
  // a fresh counter for every value the attacker invented, and every rate
  // limit fell at once.
  withTrusted("10.0.0.1", () => {
    equal(
      clientFromForwarded("203.0.113.9, 10.0.0.1"),
      "203.0.113.9",
      "the address our trusted proxy actually observed",
    );
  });
});

test("a forged left-most entry is ignored", () => {
  withTrusted("10.0.0.1", () => {
    // The attacker sent "1.2.3.4"; our proxy appended what it saw.
    equal(clientFromForwarded("1.2.3.4, 203.0.113.9, 10.0.0.1"), "203.0.113.9");
  });
});

test("a replaced chain still works", () => {
  // A proxy that overwrites the header leaves exactly one entry, and reading
  // from either end finds it.
  withTrusted("10.0.0.1", () => {
    equal(clientFromForwarded("203.0.113.9"), "203.0.113.9");
  });
});

test("several trusted hops are all skipped", () => {
  withTrusted("private", () => {
    equal(
      clientFromForwarded("203.0.113.9, 10.0.0.5, 172.16.3.2, 192.168.1.1"),
      "203.0.113.9",
    );
  });
});

test("a chain of nothing but our own proxies yields no client", () => {
  // The client's address never made it in, so there is nothing here to key a
  // counter on and the caller falls back to the socket address.
  withTrusted("private", () => {
    equal(clientFromForwarded("10.0.0.5, 192.168.1.1"), "");
  });
});

test("IPv6-mapped IPv4 is one address, not two", () => {
  withTrusted("10.0.0.1", () => {
    equal(clientFromForwarded("::ffff:203.0.113.9, 10.0.0.1"), "203.0.113.9");
  });
});

test("whitespace and brackets do not make a second counter", () => {
  withTrusted("10.0.0.1", () => {
    equal(clientFromForwarded("  [203.0.113.9] ,  10.0.0.1 "), "203.0.113.9");
  });
});

test("trusting nothing means no forwarded entry is believed", () => {
  // The default. Every entry is untrusted, so the right-most one wins — and
  // clientIp() never consults this in the first place unless the peer itself
  // is a trusted proxy.
  withTrusted("", () => {
    equal(clientFromForwarded("1.2.3.4, 10.0.0.1"), "10.0.0.1");
  });
});

test("an empty or junk header yields nothing", () => {
  withTrusted("10.0.0.1", () => {
    equal(clientFromForwarded(""), "");
    equal(clientFromForwarded(" , , "), "");
  });
});

test("a prefix entry matches by prefix", () => {
  withTrusted("10.8.", () => {
    equal(clientFromForwarded("203.0.113.9, 10.8.4.4"), "203.0.113.9");
    equal(clientFromForwarded("203.0.113.9, 10.9.4.4"), "10.9.4.4", "not ours");
  });
});

/** A context carrying just the socket address the limiter keys on. */
function fakeCtx(ip: string): any {
  return { request: { req: { socket: { remoteAddress: ip }, headers: {} } } };
}

test("the limit is a limit", () => {
  // Nothing covered this before, and the counting was just rewritten to be
  // cluster-wide — so the plainest property gets an assertion of its own.
  const ctx = fakeCtx("203.0.113.50");
  for (let i = 0; i < 3; i++) {
    rateLimit(ctx, "unit-a", 3, 60_000);
  }
  let refused = false;
  try {
    rateLimit(ctx, "unit-a", 3, 60_000);
  } catch (err: any) {
    refused = true;
    equal(err.status, 429);
  }
  isTrue(refused, "a fourth attempt against a limit of three was allowed");
});

test("each address is counted on its own", () => {
  // Otherwise one busy household would lock out everybody else.
  rateLimit(fakeCtx("203.0.113.60"), "unit-b", 1, 60_000);
  let refused = false;
  try {
    rateLimit(fakeCtx("203.0.113.61"), "unit-b", 1, 60_000);
  } catch {
    refused = true;
  }
  isFalse(refused, "a different address was charged for the first one's hit");
});

test("each bucket is counted on its own", () => {
  // Spending a login budget must not spend the password-reset one.
  const ctx = fakeCtx("203.0.113.70");
  rateLimit(ctx, "unit-c", 1, 60_000);
  let refused = false;
  try {
    rateLimit(ctx, "unit-d", 1, 60_000);
  } catch {
    refused = true;
  }
  isFalse(refused, "one bucket's hit was charged to another");
});

test("the window closes and the budget comes back", (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"] });
  const c = fakeCtx("203.0.113.80");
  rateLimit(c, "unit-e", 1, 60_000);
  ctx.mock.timers.tick(60_001);
  let refused = false;
  try {
    rateLimit(c, "unit-e", 1, 60_000);
  } catch {
    refused = true;
  }
  isFalse(refused, "the window never reopened");
});
