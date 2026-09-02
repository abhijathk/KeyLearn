import { after, before, test } from "node:test";
import { Application } from "@fastr/core";
import { equal } from "rich-assert";
import { kGame } from "../index.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";

const context = new TestContext();

// The socket exists only while multiplayer is on; the upgrade behaviour
// below is tested with the flag on, and the flag-off case last.
let savedFlag: string | undefined;
before(() => {
  savedFlag = process.env.MULTIPLAYER_ENABLED;
  process.env.MULTIPLAYER_ENABLED = "true";
});
after(() => {
  if (savedFlag == null) {
    delete process.env.MULTIPLAYER_ENABLED;
  } else {
    process.env.MULTIPLAYER_ENABLED = savedFlag;
  }
});

test("every game endpoint answers 404 while MULTIPLAYER_ENABLED is off", async () => {
  const request = startApp(context.get(Application, kGame));
  delete process.env.MULTIPLAYER_ENABLED;
  try {
    for (const path of ["/_/game/server", "/_/game/rooms", "/_/game/stats"]) {
      const response = await request.GET(path).send();
      equal(response.status, 404, path);
    }
  } finally {
    process.env.MULTIPLAYER_ENABLED = "true";
  }
});

test("only handle websocket connection", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kGame));

  // Act.

  const response = await request.GET("/_/game/server").send();

  // Assert.

  const { status, statusText, headers } = response;
  equal(status, 426);
  equal(statusText, "Upgrade Required");
  equal(headers.get("Connection"), "close");
  equal(headers.get("Upgrade"), "websocket");
  equal(headers.get("Content-Type"), "text/plain; charset=UTF-8");
  equal(await response.body.text(), "Upgrade to websocket required");
});
