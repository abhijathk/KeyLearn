import { test } from "node:test";
import { Application } from "@fastr/core";
import { Profile } from "@keylearn/database";
import { PublicId } from "@keylearn/publicid";
import { ResultFaker } from "@keylearn/result";
import { formatMessage } from "@keylearn/result-io";
import { UserDataFactory } from "@keylearn/result-userdata";
import { deepEqual, equal, isFalse, isTrue, match } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

const now = new Date("2001-02-03T04:05:06Z");

const faker = new ResultFaker({ timeStamp: now.getTime() });
const invalidBody = formatMessage([faker.nextResult({ length: 0, time: 0 })]);
const validBody = formatMessage([faker.nextResult()]);
const garbageBody = Buffer.from("garbage");

const context = new TestContext();

test("handle unauthenticated user", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const request = startApp(context.get(Application, kMain));

  // Assert.

  equal((await request.GET("/_/sync/data").send()).status, 403);
  equal((await request.POST("/_/sync/data").send(validBody)).status, 403);
  equal((await request.DELETE("/_/sync/data").send()).status, 403);
});

test("get public user data", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const id = new PublicId(user.id!);
  const userData = factory.load(id);
  await userData.append([faker.nextResult()]);

  // A profile is private unless its owner has published it, so the fixture has
  // to opt in the way a real account does.
  await user.$query().patch({ publicProfile: true });

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/_/sync/data/" + id).send();

  // Assert.

  equal(response.status, 200);
  equal(response.headers.get("Content-Type"), "application/octet-stream");
  match(response.headers.get("Content-Length")!, /\d+/);
  equal(response.headers.get("Content-Encoding"), null);
  equal(response.headers.get("Cache-Control"), "private, no-cache");
  match(response.headers.get("ETag")!, /"[a-z0-9]+"/);
  isTrue((await response.body.buffer()).length > 0);
});

test("do not serve the data of a private profile", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const id = new PublicId(user.id!);
  await factory.load(id).append([faker.nextResult()]);

  // Not published — which is the default for every account.

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request.GET("/_/sync/data/" + id).send();

  // Assert.

  // Somebody else's typing history is not readable just because their public id
  // can be guessed, and the 404 does not confirm the account exists either.
  equal(response.status, 404);
});

test("get empty user data", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const userData = factory.load(new PublicId(user.id!));
  await userData.delete();

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act.

  const response = await request.GET("/_/sync/data").send();

  // Assert.

  equal(response.status, 200);
  equal(response.headers.get("Content-Type"), "application/octet-stream");
  equal(response.headers.get("Content-Length"), "0");
  equal(response.headers.get("Content-Encoding"), null);
  equal(response.headers.get("Cache-Control"), "private, no-cache");
  match(response.headers.get("ETag")!, /"[a-z0-9]+"/);
  equal((await response.body.buffer()).length, 0);
});

test("get existing user data", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const userData = factory.load(new PublicId(user.id!));
  await userData.append([faker.nextResult()]);

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act.

  const response = await request.GET("/_/sync/data").send();

  // Assert.

  equal(response.status, 200);
  equal(response.headers.get("Content-Type"), "application/octet-stream");
  equal(response.headers.get("Content-Length"), "70");
  equal(response.headers.get("Content-Encoding"), null);
  equal(response.headers.get("Cache-Control"), "private, no-cache");
  match(response.headers.get("ETag")!, /"[a-z0-9]+"/);
  equal((await response.body.buffer()).length, 70);
});

test("validate content type on post", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const request = startApp(context.get(Application, kMain));

  await request.become("user1@keylearn.org");

  // Act.

  const response = await request
    .POST("/_/sync/data")
    .type("text/plain")
    .send(validBody);

  // Assert.

  equal(response.status, 415);
});

test("validate format on post", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const request = startApp(context.get(Application, kMain));

  await request.become("user1@keylearn.org");

  // Act.

  const response = await request.POST("/_/sync/data").send(garbageBody);

  // Assert.

  equal(response.status, 400);
});

test("validate data on post", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const userData = factory.load(new PublicId(user.id!));
  await userData.delete();

  const request = startApp(context.get(Application, kMain));

  await request.become("user1@keylearn.org");

  // Act.

  const response = await request.POST("/_/sync/data").send(invalidBody);

  // Assert.

  equal(response.status, 204);

  isFalse(await userData.exists());
});

test("post to user data", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const userData = factory.load(new PublicId(user.id!));
  await userData.delete();

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act.

  const response = await request.POST("/_/sync/data").send(validBody);

  // Assert.

  equal(response.status, 204);

  isTrue(await userData.exists());
});

test("delete empty user data", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const userData = factory.load(new PublicId(user.id!));
  await userData.delete();

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act, Assert.

  isFalse(await userData.exists());

  equal(
    (
      await request //
        .DELETE("/_/sync/data")
        .send()
    ).status,
    204,
  );

  isFalse(await userData.exists());
});

test("delete existing user data", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const factory = context.get(UserDataFactory);
  const user = await findUser("user1@keylearn.org");
  const userData = factory.load(new PublicId(user.id!));
  await userData.append([faker.nextResult()]);

  const request = startApp(context.get(Application, kMain));

  await request.become(user.id!);

  // Act, Assert.

  isTrue(await userData.exists());

  equal(
    (
      await request //
        .DELETE("/_/sync/data")
        .send()
    ).status,
    204,
  );

  isFalse(await userData.exists());
});

// ---- accessibility preferences ---------------------------------------------

test("accessibility preferences are stored and returned per learner", async (ctx) => {
  // These decide whether the app is usable at all for the person reading it —
  // typeface, target size, motion, spacing, speech rate and voice. They lived
  // in one browser's local storage, so the learners most dependent on them
  // rebuilt every one on every device.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await findUser("user1@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  // Nothing set yet is an ordinary answer, not a 404 — and it is what tells
  // the client to offer this device's own copy up rather than take defaults
  // from an empty server, which would wipe the settings of every learner who
  // had them before this shipped.
  const empty = await request.GET(`/_/sync/a11y/profile/${profile.id!}`).send();
  equal(empty.status, 200);
  deepEqual(await empty.body.json(), {});

  const prefs = {
    typeface: "dyslexic",
    targets: "large",
    motion: "reduce",
    letterSpacing: 0.12,
    lineHeight: 1.8,
    speechRate: 1.4,
    speechVoice: "alba",
  };
  equal(
    (
      await request
        .POST(`/_/sync/a11y/profile/${profile.id!}`)
        .type("application/json")
        .send(JSON.stringify(prefs))
    ).status,
    204,
  );

  // The point of the whole exercise: another device asks, and gets what the
  // learner set on the first one.
  deepEqual(
    await (
      await request.GET(`/_/sync/a11y/profile/${profile.id!}`).send()
    ).body.json(),
    prefs,
  );

  equal(
    (await request.DELETE(`/_/sync/a11y/profile/${profile.id!}`).send()).status,
    204,
  );
  deepEqual(
    await (
      await request.GET(`/_/sync/a11y/profile/${profile.id!}`).send()
    ).body.json(),
    {},
  );
});

test("accessibility preferences are refused for somebody else's learner", async (ctx) => {
  // One account must not read or overwrite another's child — the same rule
  // the braille file follows, through the same resolver.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const owner = await findUser("user2@keylearn.org");
  await Profile.ensureDefault(owner);
  const [theirs] = await Profile.listForUser(owner.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become((await findUser("user1@keylearn.org")).id!);

  equal(
    (await request.GET(`/_/sync/a11y/profile/${theirs.id!}`).send()).status,
    403,
  );
  equal(
    (
      await request
        .POST(`/_/sync/a11y/profile/${theirs.id!}`)
        .type("application/json")
        .send(JSON.stringify({ typeface: "dyslexic" }))
    ).status,
    403,
  );
});

// ---- the storage mirror ----------------------------------------------------

test("a learner's browser storage is stored and returned, per scope", async (ctx) => {
  // The customer's report, at the layer that fixes it: everything the app
  // writes to localStorage — the kids world, the theme, every preference —
  // carried by one document per learner and one per account.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await findUser("user1@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  // Nothing stored is an ordinary answer, not a 404. It is what tells the
  // client to send this device's copy up rather than take an empty account as
  // proof the learner has chosen nothing — which would wipe the settings of
  // every user who had any before this shipped.
  const empty = await request
    .GET(`/_/sync/doc/profile/${profile.id!}/local`)
    .send();
  equal(empty.status, 200);
  deepEqual(await empty.body.json(), {});

  const mine = {
    keys: {
      [`profile-${profile.id!}.kids.prefs`]: {
        v: '{"world":"reef","name":"Ada"}',
        t: 1700,
      },
    },
  };
  equal(
    (
      await request
        .POST(`/_/sync/doc/profile/${profile.id!}/local`)
        .type("application/json")
        .send(JSON.stringify(mine))
    ).status,
    204,
  );
  deepEqual(
    await (
      await request.GET(`/_/sync/doc/profile/${profile.id!}/local`).send()
    ).body.json(),
    mine,
  );

  // The account scope is a different document, not the same one under another
  // name: a theme belongs to whoever set it, not to one child.
  const ours = {
    keys: { "keylearn.theme[background]": { v: "#101820", t: 9 } },
  };
  equal(
    (
      await request
        .POST("/_/sync/doc/local")
        .type("application/json")
        .send(JSON.stringify(ours))
    ).status,
    204,
  );
  deepEqual(
    await (await request.GET("/_/sync/doc/local").send()).body.json(),
    ours,
  );
  // Still the learner's, untouched by the account-level write.
  deepEqual(
    await (
      await request.GET(`/_/sync/doc/profile/${profile.id!}/local`).send()
    ).body.json(),
    mine,
  );

  equal(
    (await request.DELETE(`/_/sync/doc/profile/${profile.id!}/local`).send())
      .status,
    204,
  );
  deepEqual(
    await (
      await request.GET(`/_/sync/doc/profile/${profile.id!}/local`).send()
    ).body.json(),
    {},
  );
});

test("a device that knows nothing cannot delete what the account knows", async (ctx) => {
  // The destructive one, found by running the app rather than by reasoning
  // about it — and it destroyed a real account in the process.
  //
  // A device that has just been signed into holds nothing, so its first push
  // is nearly empty. When the route replaced the stored document with whatever
  // arrived, that push deleted every setting the account had: eleven keys down
  // to one, the learner's whole kids world gone. The endpoint built to stop
  // settings being lost was the thing losing them.
  //
  // So the store merges per key. Being empty says nothing at all, and a client
  // can only ever change keys it actually names.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await findUser("user1@keylearn.org");
  await Profile.ensureDefault(user);

  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const post = async (keys: unknown) =>
    (
      await request
        .POST("/_/sync/doc/local")
        .type("application/json")
        .send(JSON.stringify({ keys }))
    ).status;

  equal(
    await post({
      "kids.prefs": { v: '{"world":"hero"}', t: 0 },
      "keylearn.mode": { v: "grown-ups", t: 0 },
    }),
    204,
  );

  // The new device, with nothing to say.
  equal(await post({}), 204);

  const kept = (await (
    await request.GET("/_/sync/doc/local").send()
  ).body.json()) as any;
  equal(kept.keys["kids.prefs"].v, '{"world":"hero"}');
  equal(kept.keys["keylearn.mode"].v, "grown-ups");

  // A device with an older copy does not win either — the account keeps the
  // newer value rather than accepting whatever arrived last.
  equal(await post({ "keylearn.mode": { v: "kids", t: 0 } }), 204);
  equal(await post({ "kids.prefs": { v: '{"world":"reef"}', t: 50 } }), 204);
  const after = (await (
    await request.GET("/_/sync/doc/local").send()
  ).body.json()) as any;
  equal(after.keys["kids.prefs"].v, '{"world":"reef"}'); // newer, adopted
  equal(after.keys["keylearn.mode"].v, "kids"); // equal stamp, last writer

  // Deleting has to be said out loud, with a stamp that beats the value.
  equal(await post({ "kids.prefs": { v: null, t: 900 } }), 204);
  const gone = (await (
    await request.GET("/_/sync/doc/local").send()
  ).body.json()) as any;
  equal(gone.keys["kids.prefs"].v, null);
  equal(gone.keys["keylearn.mode"].v, "kids"); // untouched by that deletion
});

test("only the named documents exist", async (ctx) => {
  // The allow-list is what keeps this a place for a learner's settings rather
  // than a key-value store anyone signed in may park anything in, at our
  // expense and under someone else's account.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await findUser("user1@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  equal(
    (await request.GET(`/_/sync/doc/profile/${profile.id!}/whatever`).send())
      .status,
    400,
  );
  equal(
    (
      await request
        .POST(`/_/sync/doc/profile/${profile.id!}/whatever`)
        .type("application/json")
        .send(JSON.stringify({ keys: {} }))
    ).status,
    400,
  );
  equal((await request.GET("/_/sync/doc/whatever").send()).status, 400);
});

test("the mirror is refused for somebody else's learner", async (ctx) => {
  // One account must not read another's child. A learner's browser storage
  // holds their name, their world and their progress, so this is the same rule
  // as everywhere else through the same resolver — not a lesser one because
  // the payload happens to be settings.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const owner = await findUser("user2@keylearn.org");
  await Profile.ensureDefault(owner);
  const [theirs] = await Profile.listForUser(owner.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become((await findUser("user1@keylearn.org")).id!);

  equal(
    (await request.GET(`/_/sync/doc/profile/${theirs.id!}/local`).send())
      .status,
    403,
  );
  equal(
    (
      await request
        .POST(`/_/sync/doc/profile/${theirs.id!}/local`)
        .type("application/json")
        .send(JSON.stringify({ keys: {} }))
    ).status,
    403,
  );
});

// ---- braille progress ------------------------------------------------------

test("braille progress is stored and returned per learner", async (ctx) => {
  // Arrange.

  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await findUser("user1@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  // Act, Assert.

  // A learner who has done none is not an error — it is the ordinary answer
  // on the first visit, and the client would have to special-case a 404.
  const empty = await request
    .GET(`/_/sync/braille/profile/${profile.id!}`)
    .send();
  equal(empty.status, 200);
  deepEqual(await empty.body.json(), {});

  const snapshot = {
    progress: { a: { hits: 12, misses: 1, bestMs: 480, recentMs: [500] } },
    days: ["2026-08-02"],
    daily: {},
    savedAt: 1,
  };
  equal(
    (
      await request
        .POST(`/_/sync/braille/profile/${profile.id!}`)
        .type("application/json")
        .send(JSON.stringify(snapshot))
    ).status,
    204,
  );

  deepEqual(
    await (
      await request.GET(`/_/sync/braille/profile/${profile.id!}`).send()
    ).body.json(),
    snapshot,
  );

  // And it can be taken away again, which is what "clear my statistics" needs.
  equal(
    (await request.DELETE(`/_/sync/braille/profile/${profile.id!}`).send())
      .status,
    204,
  );
  deepEqual(
    await (
      await request.GET(`/_/sync/braille/profile/${profile.id!}`).send()
    ).body.json(),
    {},
  );
});

test("braille progress is refused for somebody else's learner", async (ctx) => {
  // One account must not be able to read or overwrite another's child.
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const owner = await findUser("user2@keylearn.org");
  await Profile.ensureDefault(owner);
  const [theirs] = await Profile.listForUser(owner.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become((await findUser("user1@keylearn.org")).id!);

  equal(
    (await request.GET(`/_/sync/braille/profile/${theirs.id!}`).send()).status,
    403,
  );
  equal(
    (
      await request
        .POST(`/_/sync/braille/profile/${theirs.id!}`)
        .type("application/json")
        .send("{}")
    ).status,
    403,
  );
});

test("braille progress that is not JSON is refused", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await findUser("user1@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  equal(
    (
      await request
        .POST(`/_/sync/braille/profile/${profile.id!}`)
        .type("application/json")
        .send("garbage")
    ).status,
    400,
  );
});
