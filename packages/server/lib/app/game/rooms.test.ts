import { test } from "node:test";
import { Application } from "@fastr/core";
import { equal, isTrue, like } from "rich-assert";
import { kGame } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

const context = new TestContext();

/**
 * The door has to be answerable before a socket exists — that is the whole
 * reason this one endpoint is plain HTTP while everything else about a race
 * travels over the WebSocket.
 */

test("an empty server offers to open a room", async () => {
  const request = startApp(context.get(Application, kGame));

  const response = await request.GET("/_/game/rooms").send();

  equal(response.status, 200);
  const body = (await response.body.json()) as any;
  like(body, { players: [], fresh: true });
  equal(body.free, body.capacity, "nobody is in it yet");
  isTrue(body.capacity >= 2);
});

test("the roster is cacheable, but only briefly", async () => {
  const request = startApp(context.get(Application, kGame));

  const response = await request.GET("/_/game/rooms").send();

  // Long enough that a dialog left open does not poll at full rate; short
  // enough that the count still feels live.
  equal(response.headers.get("Cache-Control"), "public, max-age=3");
});
