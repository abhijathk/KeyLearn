import { test } from "node:test";
import { equal, isNull, isTrue } from "rich-assert";
import { combine, type Segment } from "./session.tsx";

const segment = (speed: number, time: number, accuracy = 1): Segment => ({
  speed,
  accuracy,
  time,
});

test("a run with nothing measurable in it has no score", () => {
  isNull(combine([], 60));
  isNull(combine([segment(40, 0)], 60));
});

test("speed is total distance over total time, not the mean of the lines", () => {
  // Forty words a minute for ten seconds, then sixty for thirty. The plain
  // average is 50; the honest figure is 55, because most of the run was spent
  // at the faster pace.
  const run = combine([segment(40, 10_000), segment(60, 30_000)], 60)!;
  equal(Math.round(run.speed * 100) / 100, 55);
});

test("one line's speed carries through untouched", () => {
  const run = combine([segment(43.5, 45_000, 0.97)], 60)!;
  equal(run.speed, 43.5);
  equal(run.accuracy, 0.97);
  equal(run.seconds, 60);
});

test("a long careless line outweighs a short careful one", () => {
  const run = combine([segment(30, 5_000, 1), segment(30, 55_000, 0.9)], 60)!;
  isTrue(run.accuracy < 0.92, `accuracy was ${run.accuracy}`);
  isTrue(run.accuracy > 0.9);
});
