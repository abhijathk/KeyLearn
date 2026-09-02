import { test } from "node:test";
import { Application } from "@fastr/core";
import { Cookie } from "@fastr/headers";
import { load } from "cheerio";
import { deepEqual, equal } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

const context = new TestContext();

for (const path of [
  "/",
  "/account",
  "/assessment",
  "/design",
  "/verify",
  "/help",
  "/high-scores",
  "/layouts",
  "/profile",
  "/profile/example1",
  "/profile/example2",
  "/profile/example3",
  "/profile/example4",
  "/profile/example5",
  "/typing-test",
  "/terms-of-service",
  "/privacy-policy",
]) {
  test(`load page "${path}"`, async () => {
    // Arrange.

    const request = startApp(context.get(Application, kMain));

    // Act.

    const response = await request
      .GET(path)
      .header("X-Forwarded-Host", "www.keylearn.org")
      .header("X-Forwarded-Proto", "https")
      .send();

    // Assert.

    equal(response.status, 200);
    equal(response.headers.get("Content-Type"), "text/html; charset=UTF-8");

    const $ = load(await response.body.text());
    equal($("script#page-data").length, 1);
    equal($("#root").length, 1);
  });
}

/**
 * Multiplayer is the one page a flag can remove. Off (the shipped default)
 * must mean the URL is gone on both the plain and the locale route, not
 * merely unlisted; on must mean it renders like any other page. Read live,
 * so the same app answers differently as the flag changes.
 */
test("multiplayer answers 404 while MULTIPLAYER_ENABLED is off", async () => {
  const request = startApp(context.get(Application, kMain));
  const saved = process.env.MULTIPLAYER_ENABLED;
  delete process.env.MULTIPLAYER_ENABLED;
  try {
    for (const path of ["/multiplayer", "/de/multiplayer"]) {
      const response = await request
        .GET(path)
        .header("X-Forwarded-Host", "www.keylearn.org")
        .header("X-Forwarded-Proto", "https")
        .send();
      equal(response.status, 404, path);
      equal(response.headers.get("Content-Type"), "text/html; charset=UTF-8");
    }
  } finally {
    if (saved != null) {
      process.env.MULTIPLAYER_ENABLED = saved;
    }
  }
});

test("multiplayer renders while MULTIPLAYER_ENABLED is on", async () => {
  const request = startApp(context.get(Application, kMain));
  const saved = process.env.MULTIPLAYER_ENABLED;
  process.env.MULTIPLAYER_ENABLED = "true";
  try {
    for (const path of ["/multiplayer", "/de/multiplayer"]) {
      const response = await request
        .GET(path)
        .header("X-Forwarded-Host", "www.keylearn.org")
        .header("X-Forwarded-Proto", "https")
        .send();
      equal(response.status, 200, path);
      const $ = load(await response.body.text());
      equal($("script#page-data").length, 1);
    }
  } finally {
    if (saved == null) {
      delete process.env.MULTIPLAYER_ENABLED;
    } else {
      process.env.MULTIPLAYER_ENABLED = saved;
    }
  }
});

test(`load custom theme from cookie`, async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request
    .GET("/")
    .header("X-Forwarded-Host", "www.keylearn.org")
    .header("X-Forwarded-Proto", "https")
    .header(
      "Cookie",
      new Cookie([["prefs", '{"color":"keylearn","font":"roboto"}']]),
    )
    .send();

  // Assert.

  equal(response.status, 200);
  equal(response.headers.get("Content-Type"), "text/html; charset=UTF-8");
  deepEqual(response.headers.getAll("Set-Cookie"), []);

  const $ = load(await response.body.text());
  equal($("html").attr("data-color"), "keylearn");
  equal($("html").attr("data-font"), "roboto");
});

test(`ignore invalid theme cookie`, async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request
    .GET("/")
    .header("X-Forwarded-Host", "www.keylearn.org")
    .header("X-Forwarded-Proto", "https")
    .header("Cookie", new Cookie([["prefs", "%%%garbage%%%"]]))
    .send();

  // Assert.

  equal(response.status, 200);
  equal(response.headers.get("Content-Type"), "text/html; charset=UTF-8");
  deepEqual(response.headers.getAll("Set-Cookie"), []);

  const $ = load(await response.body.text());
  equal($("html").attr("data-color"), "auto");
  equal($("html").attr("data-font"), "roboto");
});
