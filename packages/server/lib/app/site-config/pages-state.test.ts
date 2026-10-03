import { afterEach, test } from "node:test";
import { Application } from "@fastr/core";
import { setSiteConfigValues } from "@keylearn/site-config";
import { equal } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

/**
 * Tabs that are already open ask the server which pages are on, because page
 * data is read once at load and a page switched off in the control centre
 * kept working in every open tab until somebody refreshed it. The answer is
 * the table the router itself enforces, and it must never be cached.
 */

const context = new TestContext();
const html = { accept: "text/html" };
const json = { accept: "application/json" };

/** A browser behind the proxy, past the canonical-host redirect. */
function get(
  request: ReturnType<typeof startApp>,
  path: string,
  accept: string,
) {
  return request
    .GET(path)
    .header("X-Forwarded-Host", "www.keylearn.org")
    .header("X-Forwarded-Proto", "https")
    .header("accept", accept);
}

afterEach(() => setSiteConfigValues(new Map()));

test("the page-state endpoint reports what the control centre set, uncached", async () => {
  setSiteConfigValues(
    new Map<string, unknown>([
      ["pages.kids.state", "404"],
      ["pages.about.state", "soon"],
    ]),
  );
  const request = startApp(context.get(Application, kMain));

  const response = await get(request, "/_/pages/state", json.accept).send();

  equal(response.status, 200);
  equal(response.headers.get("cache-control"), "no-store");
  const body = (await response.body.json()) as {
    pages: Record<string, string>;
  };
  equal(body.pages.kids, "404");
  equal(body.pages.about, "soon");
  equal(body.pages.practice, "live");
});

test("a page that is off answers 404 to a visitor and the endpoint agrees", async () => {
  setSiteConfigValues(new Map<string, unknown>([["pages.kids.state", "404"]]));
  const request = startApp(context.get(Application, kMain));

  const page = await get(request, "/kids", html.accept).send();
  equal(page.status, 404);
  const state = (await (
    await get(request, "/_/pages/state", json.accept).send()
  ).body.json()) as {
    pages: Record<string, string>;
  };
  equal(state.pages.kids, "404");
});
