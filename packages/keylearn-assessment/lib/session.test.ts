import { test } from "node:test";
import { equal, isFalse, isNull, isTrue } from "rich-assert";
import {
  combine,
  measurable,
  type Segment,
  withRemainder,
} from "./session.tsx";

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

test("a run where no line was finished still scores", () => {
  // The whole point of the remainder: sixty seconds of typing that happened to
  // fall inside one long line used to be worth nothing at all.
  const run = combine(withRemainder([], segment(38, 58_000, 0.96)), 60)!;
  equal(run.speed, 38);
  equal(run.accuracy, 0.96);
});

test("the part-line joins the finished ones, weighted by its own time", () => {
  // Forty for ten seconds, then a part-line at sixty for thirty: the same
  // arithmetic as any other pair of segments, which is the point.
  const merged = withRemainder([segment(40, 10_000)], segment(60, 30_000));
  equal(merged.length, 2);
  equal(Math.round(combine(merged, 60)!.speed * 100) / 100, 55);
});

test("nothing half-typed is nothing to add", () => {
  const finished = [segment(40, 10_000)];
  equal(withRemainder(finished, null), finished);
});

test("a part-line too short to time is left out, not counted as zero", () => {
  // Counting it as a zero would be worse than dropping it: three keystrokes
  // would pull the whole run's speed down.
  const finished = [segment(40, 10_000)];
  equal(withRemainder(finished, segment(0, 900)).length, 1);
  equal(withRemainder(finished, segment(40, 0)).length, 1);
  equal(combine(withRemainder(finished, segment(0, 900)), 60)!.speed, 40);
});

test("the bar for a part-line is the bar for a finished one", () => {
  isTrue(measurable(segment(40, 10_000)));
  isFalse(measurable(segment(0, 10_000)));
  isFalse(measurable(segment(40, 0)));
});
