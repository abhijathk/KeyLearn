import { test } from "node:test";
import { Application } from "@fastr/core";
import { HighScoresFactory } from "@keylearn/highscores";
import { ResultFaker } from "@keylearn/result";
import { deepEqual, equal, isTrue, like } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { resetReadinessCache } from "./readiness.ts";

const now = new Date("2001-02-03T04:05:06Z");

const context = new TestContext();

const faker = new ResultFaker({ timeStamp: now.getTime() });

/**
 * The board stays hidden until there is a community big enough for a percentile
 * to mean anything — see `readiness.ts`. These tests set the two thresholds
 * explicitly rather than relying on the production defaults, so that what is
 * being tested is the endpoint and not the size of the fixture.
 */
test.beforeEach(() => {
  resetReadinessCache();
  process.env.LEADERBOARD_MIN_ACCOUNTS = "500";
  process.env.LEADERBOARD_MIN_RANKED = "50";
});

test("withhold the board until there is a community", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  await context.get(HighScoresFactory).append(1, null, [faker.nextResult()]);

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/_/high-scores").send();

  // Assert.

  // Not an empty board — no board. A caller who guesses the endpoint gets the
  // same answer as the page, so the gate cannot be stepped around.
  equal(response.status, 200);
  deepEqual(await response.body.json(), { ready: false });
});

test("serve the board once the thresholds are met", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  process.env.LEADERBOARD_MIN_ACCOUNTS = "0";
  process.env.LEADERBOARD_MIN_RANKED = "0";
  resetReadinessCache();

  await context.get(HighScoresFactory).append(1, null, [faker.nextResult()]);
  await context.get(HighScoresFactory).append(999, null, [faker.nextResult()]);

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/_/high-scores").send();

  // Assert.

  equal(response.status, 200);
  // It carries the viewer's own standing, so it must never be shared cache.
  equal(response.headers.get("Cache-Control"), "private, no-store");

  const body = (await response.body.json()) as any;
  isTrue(body.ready);
  equal(body.range, "week");
  // Nobody is signed in, so there is no "you" row.
  equal(body.you, null);
  like(body.top[0], { layout: "en-us", score: 2400, speed: 120 });
});

test("fall back to the default range when asked for a made-up one", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  process.env.LEADERBOARD_MIN_ACCOUNTS = "0";
  process.env.LEADERBOARD_MIN_RANKED = "0";
  resetReadinessCache();

  await context.get(HighScoresFactory).append(1, null, [faker.nextResult()]);

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/_/high-scores?range=wtf").send();

  // Assert.

  equal(response.status, 200);
  equal(((await response.body.json()) as any).range, "week");
});
