import { test } from "node:test";
import { Application } from "@fastr/core";
import { deepEqual, equal } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

const context = new TestContext();

test("get a published profile", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");
  await user.$query().patch({ publicProfile: true });

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET(`/_/profile/55vdtk1`).send();

  // Assert.

  equal(response.status, 200);
  deepEqual(await response.body.json(), {
    id: "55vdtk1",
    imageUrl: "imageUrl1",
    name: "externalName1",
    premium: false,
  });
});

test("do not disclose an unpublished profile", async () => {
  // Arrange.

  // The seed account, untouched: publishing is opt-in, so this is the state
  // every account starts in.

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET(`/_/profile/55vdtk1`).send();

  // Assert.

  // A name and photo are personal data; a guessable public id is not consent to
  // hand them out. 404 rather than 403, so the reply does not confirm that an
  // account with that id exists.
  equal(response.status, 404);
});
