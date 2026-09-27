import { test } from "node:test";
import { Application } from "@fastr/core";
import { isTrue } from "rich-assert";
import { resetRateLimits } from "../auth/ratelimit.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * The desk's staff check must not say, by how long it takes, whether an
 * email has an account.
 *
 * The bodies already matched ("invalid" either way), but an unknown address
 * returned before any password hashing — about 3 ms against about 370 ms
 * for a real account with a wrong password — so the clock answered the
 * question the body was careful not to. Both now pay for one hash.
 */

const context = new TestContext();

async function timed(send: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await send();
  return performance.now() - start;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

test("an unknown email takes about as long as a wrong password", async () => {
  const saved = process.env.OPS_API_KEY;
  process.env.OPS_API_KEY = "test-ops-key";
  try {
    const user = await findUser("user1@keylearn.org");
    await user.setPassword("correct horse battery staple");
    const request = startApp(context.get(Application, kMain));
    const verify = (email: string) =>
      request
        .POST("/_/internal/staff-auth/verify")
        .header("content-type", "application/json")
        .header("x-ops-api-key", "test-ops-key")
        .send({ email, password: "not the password" });
    const unknown: number[] = [];
    const wrong: number[] = [];
    for (let i = 0; i < 3; i++) {
      resetRateLimits();
      unknown.push(await timed(() => verify(`nobody${i}@example.com`)));
      wrong.push(await timed(() => verify("user1@keylearn.org")));
    }
    // Generous on purpose: this is about a hash being skipped (a ~100×
    // gap), not about shaving milliseconds.
    isTrue(
      median(unknown) > median(wrong) * 0.4,
      `unknown ${median(unknown).toFixed(0)} ms vs wrong password ${median(wrong).toFixed(0)} ms`,
    );
  } finally {
    if (saved == null) {
      delete process.env.OPS_API_KEY;
    } else {
      process.env.OPS_API_KEY = saved;
    }
  }
});
