import { test } from "node:test";
import { Application } from "@fastr/core";
import { Profile, ProfileData } from "@keylearn/database";
import { PublicId } from "@keylearn/publicid";
import { ResultFaker } from "@keylearn/result";
import { formatMessage } from "@keylearn/result-io";
import { deepEqual, equal, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * The handover: everything one learner has set and done, read back by a
 * device that has never seen them.
 *
 * The per-route tests next door each prove one endpoint stores and returns
 * its own thing. That is not the same claim as the one that matters to a
 * learner, which is "I open my account on a new laptop and I am where I
 * left off" — and a claim about the whole of somebody's state cannot be
 * made by testing its parts separately, because the way it fails is that
 * one part was never wired up at all.
 *
 * So this writes every class of learner state through the real routes, as
 * a first device would, then reads all of it back through a second client
 * that carries nothing — no storage, no cookies, only the account. Each
 * class is listed explicitly, and the list is the point: a class of state
 * that is missing from it is a class nobody proved travels.
 */

const context = new TestContext();
const faker = new ResultFaker({
  timeStamp: Date.parse("2026-09-04T09:00:00Z"),
});

/** Everything a signed-in learner carries, by the route that carries it. */
type Handover = {
  readonly accountSettings: unknown;
  readonly profileSettings: unknown;
  readonly a11y: unknown;
  readonly braille: unknown;
  readonly mirror: unknown;
  readonly accountMirror: unknown;
  readonly resultBytes: number;
};

async function readEverything(
  request: ReturnType<typeof startApp>,
  pid: number,
): Promise<Handover> {
  const json = async (path: string) => {
    const res = await request.GET(path).send();
    equal(res.status, 200, `${path} answered ${res.status}`);
    const text = await res.body.text();
    return text === "" ? null : JSON.parse(text);
  };
  const results = await request.GET("/_/sync/data").send();
  equal(results.status, 200);
  return {
    accountSettings: await json("/_/sync/settings"),
    profileSettings: await json(`/_/sync/profile-settings/${pid}`),
    a11y: await json(`/_/sync/a11y/profile/${pid}`),
    braille: await json(`/_/sync/braille/profile/${pid}`),
    mirror: await json(`/_/sync/doc/profile/${pid}/local`),
    accountMirror: await json("/_/sync/doc/local"),
    resultBytes: (await results.body.buffer()).length,
  };
}

test("a learner's whole state follows them to a device that has never seen it", async () => {
  const request = startApp(context.get(Application, kMain));
  const user = (await findUser("user1@keylearn.org"))!;
  await request.become(user.id!);

  const profile = await Profile.query().insert({
    userId: user.id!,
    firstName: "Ada",
    kind: "adult",
  } as any);
  const pid = profile.id!;

  // ── device one: a learner sets things up and practises ──

  // Account-wide settings: the ones that are the household's, not one
  // learner's.
  const accountSettings = { "account.timeZone": "Europe/London" };
  equal(
    (await request.PUT("/_/sync/settings").send(accountSettings)).status,
    204,
  );

  // The learner's own settings: lesson type, target speed, the lot.
  const profileSettings = {
    "lesson.targetSpeed": 285,
    "lesson.dailyGoal": 45,
    "textDisplay.caretShapeStyle": 2,
    "textInput.soundVolume": 0.3,
    "ui.speedUnit": "cpm",
  };
  equal(
    (await request.PUT(`/_/sync/profile-settings/${pid}`).send(profileSettings))
      .status,
    204,
  );

  // Accessibility preferences, which have a route of their own because they
  // are applied before anything else renders.
  const a11y = { motion: "reduce", typeface: "dyslexic", speechRate: 1.4 };
  equal(
    (await request.POST(`/_/sync/a11y/profile/${pid}`).send(a11y)).status,
    204,
  );

  // Braille progress, which merges rather than replaces.
  const braille = { lessons: 12, cells: { a: 4, b: 2 } };
  equal(
    (await request.POST(`/_/sync/braille/profile/${pid}`).send(braille)).status,
    204,
  );

  // The browser-storage mirror: the thirty-odd things written to
  // localStorage — the kids world, custom colours, tours seen, the accent.
  const mirror = {
    keys: {
      "profile-p1.keylearn.accent": { v: "sunset", t: 1_700_000_000_000 },
      // Day or night, the font and the text size. Named here rather than left
      // to the general case because this is the one preference that used to
      // live only in a cookie, and so was the one that never arrived.
      "profile-p1.keylearn.theme": {
        v: "color=keylearn-night&font=serif&textSize=larger",
        t: 1_700_000_000_004,
      },
      "keylearn.mode": { v: "kids", t: 1_700_000_000_001 },
      "profile-p1.keylearn.kids.stars": { v: "37", t: 1_700_000_000_002 },
    },
  };
  equal(
    (await request.POST(`/_/sync/doc/profile/${pid}/local`).send(mirror))
      .status,
    204,
  );
  const accountMirror = {
    keys: { "keylearn.profileOrder": { v: '["p1"]', t: 1_700_000_000_003 } },
  };
  equal(
    (await request.POST("/_/sync/doc/local").send(accountMirror)).status,
    204,
  );

  // And the practice itself.
  // The practice itself. 204: the server has stored it and has nothing to
  // say back, which is also what the client's uploader expects.
  equal(
    (
      await request
        .POST("/_/sync/data")
        .send(formatMessage([faker.nextResult()]))
    ).status,
    204,
  );

  const onDeviceOne = await readEverything(request, pid);
  await request.become(null);

  // ── device two: nothing but the account ──

  const fresh = startApp(context.get(Application, kMain));
  await fresh.become(user.id!);
  const onDeviceTwo = await readEverything(fresh, pid);

  deepEqual(
    onDeviceTwo,
    onDeviceOne,
    "the second device did not receive the same state as the first",
  );

  // And each class arrived with its content, not merely with the same shape
  // as an empty answer — a pair of nulls would satisfy the comparison above.
  deepEqual(
    (onDeviceTwo.accountSettings as any)["account.timeZone"],
    "Europe/London",
  );
  deepEqual((onDeviceTwo.profileSettings as any)["lesson.targetSpeed"], 285);
  deepEqual((onDeviceTwo.profileSettings as any)["ui.speedUnit"], "cpm");
  deepEqual((onDeviceTwo.a11y as any).motion, "reduce");
  deepEqual((onDeviceTwo.a11y as any).typeface, "dyslexic");
  deepEqual((onDeviceTwo.braille as any).lessons, 12);
  deepEqual(
    (onDeviceTwo.mirror as any).keys["profile-p1.keylearn.kids.stars"].v,
    "37",
  );
  deepEqual(
    (onDeviceTwo.mirror as any).keys["profile-p1.keylearn.theme"].v,
    "color=keylearn-night&font=serif&textSize=larger",
    "the theme did not travel; the second device would open in the default one",
  );
  deepEqual(
    (onDeviceTwo.accountMirror as any).keys["keylearn.profileOrder"].v,
    '["p1"]',
  );
  isTrue(onDeviceTwo.resultBytes > 0, "the practice did not travel");
});

test("one learner's state is theirs, and the other profile's is untouched", async () => {
  const request = startApp(context.get(Application, kMain));
  const user = (await findUser("user2@keylearn.org"))!;
  await request.become(user.id!);

  const one = await Profile.query().insert({
    userId: user.id!,
    firstName: "One",
    kind: "adult",
  } as any);
  const two = await Profile.query().insert({
    userId: user.id!,
    firstName: "Two",
    kind: "kid",
  } as any);

  await request
    .PUT(`/_/sync/profile-settings/${one.id}`)
    .send({ "lesson.targetSpeed": 300 });
  await request
    .PUT(`/_/sync/profile-settings/${two.id}`)
    .send({ "lesson.targetSpeed": 120 });
  await request
    .POST(`/_/sync/a11y/profile/${one.id}`)
    .send({ motion: "reduce" });

  const fresh = startApp(context.get(Application, kMain));
  await fresh.become(user.id!);
  const readOne = JSON.parse(
    await (
      await fresh.GET(`/_/sync/profile-settings/${one.id}`).send()
    ).body.text(),
  );
  const readTwo = JSON.parse(
    await (
      await fresh.GET(`/_/sync/profile-settings/${two.id}`).send()
    ).body.text(),
  );
  const a11yTwo = JSON.parse(
    await (
      await fresh.GET(`/_/sync/a11y/profile/${two.id}`).send()
    ).body.text(),
  );

  equal(readOne["lesson.targetSpeed"], 300, "one learner's speed changed");
  equal(
    readTwo["lesson.targetSpeed"],
    120,
    "the other learner's speed changed",
  );
  deepEqual(a11yTwo, {}, "an accessibility choice leaked between learners");
});

test("another account cannot read or write a learner's state", async () => {
  const owner = (await findUser("user1@keylearn.org"))!;
  const stranger = (await findUser("user3@keylearn.org"))!;
  const mine = startApp(context.get(Application, kMain));
  await mine.become(owner.id!);
  const profile = await Profile.query().insert({
    userId: owner.id!,
    firstName: "Private",
    kind: "adult",
  } as any);
  const pid = profile.id!;
  await mine
    .PUT(`/_/sync/profile-settings/${pid}`)
    .send({ "lesson.dailyGoal": 90 });

  const theirs = startApp(context.get(Application, kMain));
  await theirs.become(stranger.id!);
  for (const [method, path] of [
    ["GET", `/_/sync/profile-settings/${pid}`],
    ["GET", `/_/sync/a11y/profile/${pid}`],
    ["GET", `/_/sync/braille/profile/${pid}`],
    ["GET", `/_/sync/doc/profile/${pid}/local`],
  ] as const) {
    const res = await theirs.GET(path).send();
    isTrue(
      res.status === 403 || res.status === 404,
      `${method} ${path} answered ${res.status} to a stranger`,
    );
  }
  const write = await theirs
    .POST(`/_/sync/doc/profile/${pid}/local`)
    .send({ keys: {} });
  isTrue(
    write.status === 403 || write.status === 404,
    `a stranger wrote to another account's learner (${write.status})`,
  );

  // And the owner's value survived the attempt.
  const after = JSON.parse(
    await (
      await mine.GET(`/_/sync/profile-settings/${pid}`).send()
    ).body.text(),
  );
  equal(after["lesson.dailyGoal"], 90);
});

test("a signed-out device is given nothing", async () => {
  const request = startApp(context.get(Application, kMain));
  await request.become(null);
  for (const path of [
    "/_/sync/settings",
    "/_/sync/profile-settings/1",
    "/_/sync/a11y/profile/1",
    "/_/sync/braille/profile/1",
    "/_/sync/doc/profile/1/local",
    "/_/sync/doc/local",
  ]) {
    const res = await request.GET(path).send();
    isTrue(
      res.status === 403,
      `${path} answered ${res.status} when signed out`,
    );
  }
});

test("the newest write wins, so a device that was offline does not undo one that was not", async () => {
  const request = startApp(context.get(Application, kMain));
  const user = (await findUser("user1@keylearn.org"))!;
  await request.become(user.id!);
  const profile = await Profile.query().insert({
    userId: user.id!,
    firstName: "Merge",
    kind: "adult",
  } as any);
  const pid = profile.id!;

  // The laptop writes an accent and a mode.
  await request.POST(`/_/sync/doc/profile/${pid}/local`).send({
    keys: {
      "profile-p1.keylearn.accent": { v: "sunset", t: 2000 },
      "keylearn.mode": { v: "adult", t: 2000 },
    },
  });
  // The tablet, which has been shut, pushes an older accent and a newer mode.
  await request.POST(`/_/sync/doc/profile/${pid}/local`).send({
    keys: {
      "profile-p1.keylearn.accent": { v: "mint", t: 1000 },
      "keylearn.mode": { v: "kids", t: 3000 },
    },
  });

  const merged = JSON.parse(
    await (
      await request.GET(`/_/sync/doc/profile/${pid}/local`).send()
    ).body.text(),
  );
  equal(
    merged.keys["profile-p1.keylearn.accent"].v,
    "sunset",
    "an older write from a stale device overwrote a newer one",
  );
  equal(
    merged.keys["keylearn.mode"].v,
    "kids",
    "a newer write from the second device was lost",
  );
});

test("a learner's documents are in the database as soon as they are written", async () => {
  // The half of "saved" that a read-back cannot prove.
  //
  // Every test above reads state back through the app, and the app reads it
  // from a file on this machine's disk. That proves the state travels between
  // devices; it says nothing about what survives the machine. Practice history
  // is copied to the database on a timer, deliberately — it is appended to on
  // every lesson. Documents are not: they are kilobytes, written when a
  // learner changes a setting, and until 4 Sep 2026 the accessibility ones and
  // the browser-storage mirror had no database copy at all, on any timer.
  //
  // So this asserts the copy exists immediately after the write, with no
  // snapshot pass in between.
  const request = startApp(context.get(Application, kMain));
  const user = (await findUser("user2@keylearn.org"))!;
  await request.become(user.id!);
  const profile = await Profile.query().insert({
    userId: user.id!,
    firstName: "Durable",
    kind: "adult",
  } as any);
  const pid = profile.id!;

  await request
    .POST(`/_/sync/a11y/profile/${pid}`)
    .send({ typeface: "dyslexic", targetSize: "large" });
  await request.POST(`/_/sync/braille/profile/${pid}`).send({ lessons: 3 });
  await request.POST(`/_/sync/doc/profile/${pid}/local`).send({
    keys: { "profile-p1.keylearn.theme": { v: "night", t: 5000 } },
  });
  await request
    .POST("/_/sync/doc/local")
    .send({ keys: { "keylearn.profileOrder": { v: '["p1"]', t: 5000 } } });

  const read = async (profileId: number | null, kind: any) => {
    const row = await ProfileData.query()
      .where("userId", user.id!)
      .where("kind", kind)
      .where((q) =>
        profileId == null
          ? q.whereNull("profileId")
          : q.where("profileId", profileId),
      )
      .first();
    return row?.payload == null ? null : String(row.payload);
  };

  const a11y = await read(pid, "a11y");
  isTrue(
    a11y != null && a11y.includes("dyslexic"),
    "accessibility preferences were not stored in the database",
  );
  const braille = await read(pid, "braille");
  isTrue(braille != null, "braille progress was not stored in the database");
  const mirror = await read(pid, "local");
  isTrue(
    mirror != null && mirror.includes("keylearn.theme"),
    "the learner's storage mirror was not stored in the database",
  );
  const account = await read(null, "local");
  isTrue(
    account != null && account.includes("profileOrder"),
    "the account's storage mirror was not stored in the database",
  );

  // And clearing a document clears its row, so nothing outlives the learner's
  // decision to erase it.
  await request.DELETE(`/_/sync/a11y/profile/${pid}`).send();
  equal(
    await read(pid, "a11y"),
    null,
    "an erased document survived in the database",
  );
});
