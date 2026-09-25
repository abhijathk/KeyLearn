import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { equal, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

/**
 * Every internal route answers a caller without the ops key with 403, and
 * says nothing about the body it wanted. The key used to be checked inside
 * each handler, after the body had been validated, so a keyless call with a
 * bad body got a 400 that described the route.
 *
 * The routes are read out of the controllers rather than listed here, so a
 * route added later is covered on the day it is added.
 */

const context = new TestContext();

function internalRoutes(): { method: string; path: string }[] {
  const root = join(import.meta.dirname, "..");
  const found: { method: string; path: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const at = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(at);
      } else if (at.endsWith(".ts") && !at.endsWith(".test.ts")) {
        const source = readFileSync(at, "utf8");
        for (const m of source.matchAll(
          /@http\.([A-Z]+)\("(\/_\/internal\/[^"]*)"\)/g,
        )) {
          found.push({
            method: m[1]!,
            // Any value satisfies the route patterns ({id}, {key}): digits.
            path: m[2]!.replace(/\{[^}]+\}/g, "1"),
          });
        }
      }
    }
  };
  walk(root);
  return found;
}

test("every internal route refuses a keyless caller before reading its body", async () => {
  const routes = internalRoutes();
  isTrue(routes.length > 30, `found only ${routes.length} internal routes`);
  const request = startApp(context.get(Application, kMain));
  for (const { method, path } of routes) {
    for (const key of [null, "wrong"]) {
      const headers: Record<string, string> =
        key == null ? {} : { "x-ops-api-key": key };
      const call = request
        .method(method, path)
        .header("content-type", "application/json");
      for (const [name, value] of Object.entries(headers)) {
        call.header(name, value);
      }
      // Malformed on purpose: were the body read first, this is a 400.
      const response = await call.send("{not json");
      equal(response.status, 403, `${method} ${path} with key ${key}`);
    }
  }
});

test("with the key, the same malformed body reaches the route's own validation", async () => {
  const saved = process.env.OPS_API_KEY;
  process.env.OPS_API_KEY = "test-ops-key";
  try {
    const request = startApp(context.get(Application, kMain));
    const response = await request
      .POST("/_/internal/tickets/1/deliver-reply")
      .header("content-type", "application/json")
      .header("x-ops-api-key", "test-ops-key")
      .send("{not json");
    equal(response.status, 400);
  } finally {
    if (saved == null) {
      delete process.env.OPS_API_KEY;
    } else {
      process.env.OPS_API_KEY = saved;
    }
  }
});
