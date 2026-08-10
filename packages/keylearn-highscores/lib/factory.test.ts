import { test } from "node:test";
import { DataDir } from "@keylearn/config";
import { Layout } from "@keylearn/keyboard";
import { ResultFaker } from "@keylearn/result";
import { removeDir } from "@sosimple/fsx";
import { deepEqual } from "rich-assert";
import { HighScoresFactory } from "./factory.ts";
import { type HighScores, type HighScoresRow } from "./highscores.ts";

// The table is no longer iterable: a ranking only means something for a
// given window, so ask for one explicitly.
const toRows = (t: HighScores) => t.ranking("overall");

const tmp = process.env.DATA_DIR ?? "/tmp/keylearn";

test.beforeEach(async () => {
  await removeDir(tmp);
});

test.afterEach(async () => {
  await removeDir(tmp);
});

test("append table", async (ctx) => {
  const now = new Date("2001-02-03T04:05:06Z");
  ctx.mock.timers.enable({ apis: ["Date"], now });
  const faker = new ResultFaker();
  const timeStamp = now.getTime();
  const result1 = faker.nextResult({ layout: Layout.EN_US, timeStamp });
  const result2 = faker.nextResult({ layout: Layout.EN_DVORAK, timeStamp });
  const row1 = {
    user: 1,
    profile: null,
    layout: Layout.EN_US,
    timeStamp: new Date(result1.timeStamp),
    time: result1.time,
    length: result1.length,
    errors: result1.errors,
    complexity: result1.complexity,
    speed: result1.speed,
    score: result1.score,
  } satisfies HighScoresRow;
  const row2 = {
    user: 2,
    profile: null,
    layout: Layout.EN_DVORAK,
    timeStamp: new Date(result2.timeStamp),
    time: result2.time,
    length: result2.length,
    errors: result2.errors,
    complexity: result2.complexity,
    speed: result2.speed,
    score: result2.score,
  } satisfies HighScoresRow;

  const factory = new HighScoresFactory(new DataDir(tmp));

  // Initial state.

  deepEqual(toRows(await factory.load()), []);

  // Add a result of user 1.

  await factory.append(1, null, [result1]);
  deepEqual(toRows(await factory.load()), [row1]);

  // Add a result of user 2. Both learners are ranked; which of the two faked
  // results scores higher is not the point of this test, so compare by learner
  // rather than by position.
  await factory.append(2, null, [result2]);
  deepEqual(
    toRows(await factory.load()).sort((a, b) => a.user - b.user),
    [row1, row2],
  );
});

// The board is one shared file and the server runs several worker processes.
// When the lock covered only the write, both callers read the same table, each
// added its own score, and whichever wrote second discarded the other's entry —
// a learner's place on the board simply absent, with nothing logged.
test("keep both scores when two appends overlap", async (ctx) => {
  const now = new Date("2001-02-03T04:05:06Z");
  ctx.mock.timers.enable({ apis: ["Date"], now });
  const faker = new ResultFaker();
  const timeStamp = now.getTime();
  const factory = new HighScoresFactory(new DataDir(tmp));

  await Promise.all([
    factory.append(1, null, [
      faker.nextResult({ layout: Layout.EN_US, timeStamp }),
    ]),
    factory.append(2, null, [
      faker.nextResult({ layout: Layout.EN_DVORAK, timeStamp }),
    ]),
  ]);

  const users = toRows(await factory.load())
    .map((row: HighScoresRow) => row.user)
    .sort();
  deepEqual(users, [1, 2]);
});
