import { test } from "node:test";
import { Layout } from "@keylearn/keyboard";
import { type Result } from "@keylearn/result";
import { equal, isTrue } from "rich-assert";
import { BUFFER_MS, HighScores } from "./highscores.ts";

const DAY = 24 * 3600 * 1000;
const NOW = new Date("2026-06-15T12:00:00Z").getTime();

// A result that clears the plausibility filter: long enough, complex enough,
// and a speed consistent with its own length and duration.
function result(speed: number, daysAgo = 0, base = NOW): Result {
  const length = 200;
  return {
    layout: Layout.EN_US,
    timeStamp: base - daysAgo * DAY,
    length,
    time: (length / speed) * 60_000,
    errors: 2,
    complexity: 20,
    speed,
    score: speed * 84,
  } as unknown as Result;
}

test("ranks a learner by their best in the window", () => {
  const t = new HighScores();
  t.append(1, 10, [result(60, 1), result(80, 2), result(70, 3)], NOW);

  const rows = t.ranking("week", NOW);
  equal(rows.length, 1, "one row per learner, not one per result");
  equal(rows[0].speed, 80);
});

test("each learner in a household ranks separately", () => {
  const t = new HighScores();
  t.append(1, 10, [result(60, 1)], NOW);
  t.append(1, 11, [result(90, 1)], NOW);

  const rows = t.ranking("week", NOW);
  equal(rows.length, 2, "two grown-ups on one account are two entries");
  equal(rows[0].profile, 11);
  equal(rows[1].profile, 10);
});

test("the windows are genuinely different rankings", () => {
  const t = new HighScores();
  t.append(1, 10, [result(120, 21)], NOW); // three weeks ago
  t.append(2, 20, [result(80, 1)], NOW); // yesterday

  equal(
    t
      .ranking("week", NOW)
      .map((r) => r.user)
      .join(),
    "2",
  );
  equal(
    t
      .ranking("month", NOW)
      .map((r) => r.user)
      .join(),
    "1,2",
  );
  equal(
    t
      .ranking("overall", NOW)
      .map((r) => r.user)
      .join(),
    "1,2",
  );
});

test("an all-time best outlives the buffer", () => {
  const t = new HighScores();
  t.append(1, 10, [result(120, 0)], NOW);

  // Long after the raw result has aged out of the 30-day buffer.
  const later = NOW + BUFFER_MS + 5 * DAY;
  t.append(2, 20, [result(50, 0, later)], later);

  equal(t.ranking("week", later).length, 1, "the old result left the window");
  const overall = t.ranking("overall", later);
  equal(overall.length, 2, "but the all-time best is still ranked");
  equal(overall[0].speed, 120);
});

test("the buffer drops results past 30 days", () => {
  const t = new HighScores();
  t.append(1, 10, [result(60, 0)], NOW);
  equal(t.toJSON().recent.length, 1);

  t.append(2, 20, [result(60, 0)], NOW + BUFFER_MS + DAY);
  isTrue(
    t.toJSON().recent.every((r) => r.user === 2),
    "only the still-recent result stays buffered",
  );
});

test("implausible results never reach the board", () => {
  const t = new HighScores();
  // Faster than any human; a lesson too short to count; more errors than
  // characters. Each is rejected on its own terms.
  t.append(1, 10, [result(2000)], NOW);
  t.append(2, 20, [{ ...result(60), length: 10 } as Result], NOW);
  t.append(3, 30, [{ ...result(60), errors: 999 } as Result], NOW);
  equal(t.ranking("overall", NOW).length, 0);
});

test("a future timestamp cannot camp at the top", () => {
  const t = new HighScores();
  t.append(1, 10, [result(90, -30)], NOW);
  equal(t.ranking("overall", NOW).length, 0);
});

test("survives the pre-split on-disk format", () => {
  // Older files held a plain array of rows; those are read as all-time bests
  // rather than discarded.
  const legacy = [
    {
      user: 7,
      profile: null,
      layout: Layout.EN_US,
      timeStamp: new Date(NOW),
      time: 60_000,
      length: 200,
      errors: 1,
      complexity: 20,
      speed: 75,
      score: 6300,
    },
  ];
  const t = new HighScores(legacy as never);
  const rows = t.ranking("overall", NOW);
  equal(rows.length, 1);
  equal(rows[0].user, 7);
});

test("one unrecognised layout does not empty the board", () => {
  // A row whose layout no longer exists arrives with `layout: null` from the
  // reviver. It is dropped on its own; everyone else still ranks.
  const good = {
    user: 1,
    profile: 10,
    layout: Layout.EN_US,
    timeStamp: new Date(NOW),
    time: 60_000,
    length: 200,
    errors: 1,
    complexity: 20,
    speed: 80,
    score: 6720,
  };
  const broken = { ...good, user: 2, profile: 20, layout: null };
  const t = new HighScores({ best: [good, broken] as never, recent: [] });
  const rows = t.ranking("overall", NOW);
  equal(rows.length, 1);
  equal(rows[0].user, 1);
});
