import { test } from "node:test";
import { equal } from "rich-assert";
import { speedTrend } from "./trend.ts";

/** A deterministic stand-in for lesson-to-lesson noise. */
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const noisy = (
  base: (i: number) => number,
  n: number,
  swing: number,
  seed = 7,
) => {
  const rnd = rng(seed);
  return Array.from({ length: n }, (_, i) => base(i) + (rnd() - 0.5) * swing);
};

test("a real climb is called a climb", () => {
  equal(speedTrend(noisy((i) => 200 + i * 4, 20, 6)), "improving");
});

test("a real slide is called a slide", () => {
  equal(speedTrend(noisy((i) => 300 - i * 4, 20, 6)), "dip");
});

test("noise around a flat line is not a direction", () => {
  // The old rule was last minus first with a half-unit threshold, so one loud
  // round at either end decided it — and the label flapped between
  // "improving" and "slight dip" while nothing about the learner changed.
  for (let seed = 1; seed <= 12; seed++) {
    equal(
      speedTrend(noisy(() => 250, 20, 25, seed)),
      "steady",
      `seed ${seed} read a direction into pure noise`,
    );
  }
});

test("one loud lesson at the end does not flip the verdict", () => {
  const flat = Array.from({ length: 20 }, () => 250);
  equal(speedTrend([...flat.slice(0, 19), 290]), "steady", "a lucky round");
  equal(speedTrend([...flat.slice(0, 19), 210]), "steady", "a bad round");
});

test("nothing is claimed from a handful of lessons", () => {
  // Two points fit a line perfectly; a slope from five rounds says nothing
  // about whether it is real.
  equal(speedTrend([100, 200, 300, 400, 500]), "steady");
  equal(speedTrend([]), "steady");
  equal(speedTrend([250]), "steady");
});

test("a flawless climb needs no statistics", () => {
  // No residual at all, so there is no uncertainty for the slope to clear.
  equal(speedTrend([10, 20, 30, 40, 50, 60, 70]), "improving");
  equal(speedTrend([70, 60, 50, 40, 30, 20, 10]), "dip");
  equal(speedTrend([50, 50, 50, 50, 50, 50, 50]), "steady");
});

test("a gentle climb buried in loud noise waits for evidence", () => {
  // Correct behaviour, not a miss: with this much scatter the climb genuinely
  // is not yet distinguishable, and claiming it would be guessing.
  equal(speedTrend(noisy((i) => 250 + i * 0.2, 20, 40)), "steady");
});
