import { test } from "node:test";
import { Application } from "@fastr/core";
import { User } from "@keybr/database";
import { PublicId } from "@keybr/publicid";
import { ResultFaker } from "@keybr/result";
import { UserDataFactory } from "@keybr/result-userdata";
import { equal, isNotNull, isNull, like } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

const context = new TestContext();

test("logout", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act.

  const response = await request.POST("/auth/logout").send({});

  // Assert.

  equal(response.status, 200);
  isNull(await request.who());
});

test("do not log out on a GET", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act.

  // `SameSite=Lax` sends the session cookie on a top-level GET navigation, so a
  // GET logout can be fired by any page that embeds a link or an image pointing
  // at it. Annoying rather than dangerous, but it is not the visitor's choice.
  const response = await request.GET("/auth/logout").send();

  // Assert.

  equal(response.status, 405);
  equal(await request.who(), "user1@keybr.com");
});

test("patch account", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  {
    // Act.

    const response = await request.PATCH("/_/account").send({
      anonymized: true,
    });

    // Assert.

    equal(response.status, 200);
    like(await response.body.json(), {
      user: {
        id: "55vdtk1",
        anonymized: true,
      },
      publicUser: {
        id: "55vdtk1",
        // Derived from the account id, so it is the same pseudonym every time
        // rather than a new one per request. Pinned here: if it ever moves, the
        // high-score board has silently renamed everybody who opted out.
        name: "Sage Pegasus",
        imageUrl: null,
      },
    });
    like((await User.findById(user.id!))!.toJSON(), {
      anonymized: 1,
    });
  }

  {
    // Act.

    const response = await request.PATCH("/_/account").send({
      anonymized: false,
    });

    // Assert.

    equal(response.status, 200);
    like(await response.body.json(), {
      user: {
        id: "55vdtk1",
        anonymized: false,
      },
      publicUser: {
        id: "55vdtk1",
        name: "externalName1",
        imageUrl: "imageUrl1",
      },
    });
    like((await User.findById(user.id!))!.toJSON(), {
      anonymized: 0,
    });
  }
});

test("delete account", async () => {
  // Arrange.

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keybr.com");
  const userData = factory.load(new PublicId(user.id!));
  const faker = new ResultFaker();
  await userData.append([faker.nextResult()]);

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act. Deleting an account takes two steps: a code is mailed to the
  // registered address, and only that code authorises the erasure. A hijacked
  // session on its own can no longer destroy somebody's account.

  {
    const response = await request.POST("/_/account/delete-code").send({});
    equal(response.status, 200);
  }

  const [message] = context.mailer.dump();
  equal(message.to, "user1@keybr.com");
  const code = /\b(\d{6})\b/.exec(message.text!)![1];

  const response = await request.POST("/_/account/delete").send({ code });

  // Assert.

  equal(response.status, 200);
  isNull(await request.who());
  isNull(await User.findById(user.id!));
});

test("do not delete an account without the emailed code", async () => {
  // Arrange.

  const user = await findUser("user1@keybr.com");

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act.

  const response = await request
    .POST("/_/account/delete")
    .send({ code: "000000" });

  // Assert.

  equal(response.status, 403);
  isNotNull(await User.findById(user.id!));
  equal(await request.who(), "user1@keybr.com");
});
