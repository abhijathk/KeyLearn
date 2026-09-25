import test from "node:test";
import { equal, isTrue } from "rich-assert";
import {
  fitPassageToRoad,
  MAX_UNITS_PER_KEY,
  RUN_LEN,
  runAlongLesson,
  runLengthFor,
} from "./run-length.ts";

/**
 * A keystroke must move every child the same distance.
 *
 * Ground speed on the trail comes from typing, not from the animation, so
 * a short passage over a fixed-length run makes each keypress cover more
 * ground than the gait can absorb — which is seen as the character
 * skating. The five-year-olds had it worst (2.67 units per keystroke), but
 * it is a passage-length problem rather than an age one: every band runs
 * fast at the start of its own curriculum, because `wordCount` grows as
 * keys unlock.
 */

/** Roughly what each band's passage measures, at both ends of its curriculum. */
const BANDS = [
  { band: "5-6", start: 24, full: 36 },
  { band: "7-8", start: 50, full: 72 },
  { band: "9-10", start: 77, full: 112 },
  { band: "11+", start: 102, full: 153 },
];

test("no band outpaces its own gait, at either end of its curriculum", () => {
  for (const { band, start, full } of BANDS) {
    for (const chars of [start, full]) {
      const perKey = runLengthFor(chars) / chars;
      isTrue(
        perKey <= MAX_UNITS_PER_KEY + 1e-9,
        `${band} at ${chars} chars: ${perKey.toFixed(2)} units per keystroke`,
      );
    }
  }
});

test("a run is only ever shortened, never stretched", () => {
  // The bands that read correctly today must be left exactly as they were;
  // this is a cap on the sliding cases, not a rescale of the game.
  for (const chars of [77, 112, 102, 153, 200, 1000]) {
    equal(runLengthFor(chars), RUN_LEN);
  }
});

test("the short passages are the ones brought down", () => {
  isTrue(runLengthFor(24) < RUN_LEN);
  isTrue(runLengthFor(36) < RUN_LEN);
  // And proportionally, so a passage twice as long travels twice as far.
  equal(runLengthFor(36) / runLengthFor(18), 2);
});

test("a missing or nonsense length falls back to the full run", () => {
  equal(runLengthFor(Number.NaN), RUN_LEN);
  equal(runLengthFor(0), RUN_LEN);
  equal(runLengthFor(-5), RUN_LEN);
});

/**
 * Walk one 64-unit lesson the way KidsPage and world.ts do together: fit
 * each passage to what is left, then move the run that passage earns.
 */
function walkLesson(passage: string): number[] {
  const runs: number[] = [];
  let left = RUN_LEN;
  while (left > 0.01 && runs.length < 20) {
    const text = fitPassageToRoad(passage, left, left < RUN_LEN - 0.5);
    const run = runAlongLesson(text.length, left);
    runs.push(run / text.length);
    left -= run;
  }
  equal(Math.abs(left) < 0.01, true); // landed ON the stone — no jump
  return runs;
}

test("every band's passages land exactly on the milestone", () => {
  const words = ["asdf", "jkl", "fads", "sad", "lads", "flask", "jak", "dash"];
  for (const n of [4, 5, 6, 7, 8, 9, 12, 16]) {
    const passage = Array.from({ length: n }, (_, i) => words[i % 8]).join(" ");
    for (const perKey of walkLesson(passage)) {
      // No slide: never much faster than a key's worth of gait.
      isTrue(perKey <= MAX_UNITS_PER_KEY * 1.15 + 1e-9);
    }
  }
});

test("a passage that covers the lesson alone is left untrimmed", () => {
  const long = "asdf jkl ".repeat(10).trim();
  equal(fitPassageToRoad(long, RUN_LEN, false), long);
});
