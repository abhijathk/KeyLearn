import { test } from "node:test";
import { type Step } from "@keybr/textinput";
import { equal, isNull } from "rich-assert";
import { BigramTracker } from "./bigram-tracker.ts";

const A = 0x61;
const B = 0x62;
const C = 0x63;

function step(codePoint: number, timeToType: number, typo = false): Step {
  return { timeStamp: 0, codePoint, timeToType, typo };
}

test("finds the slowest well-sampled transition", () => {
  const tracker = new BigramTracker();
  // Feed several rounds. A→B is consistently slow (300ms), B→C is fast (80ms).
  for (let i = 0; i < 5; i++) {
    tracker.append([
      step(A, 100), // treated as a transition into A from nothing meaningful
      step(B, 300), // A→B slow
      step(C, 80), // B→C fast
    ]);
  }

  const worst = tracker.worst(new Set([A, B, C]));
  equal(worst?.from, A);
  equal(worst?.to, B);
});

test("ignores transitions outside the given key set", () => {
  const tracker = new BigramTracker();
  for (let i = 0; i < 5; i++) {
    tracker.append([step(A, 100), step(B, 300), step(C, 80)]);
  }
  // Only B and C are in play; the slow A→B must be excluded.
  const worst = tracker.worst(new Set([B, C]));
  equal(worst?.from, B);
  equal(worst?.to, C);
});

test("needs enough samples before reporting", () => {
  const tracker = new BigramTracker();
  tracker.append([step(A, 100), step(B, 300)]); // one sample of A→B
  isNull(tracker.worst(new Set([A, B])));
});

test("skips mistyped keys and outlier gaps", () => {
  const tracker = new BigramTracker();
  for (let i = 0; i < 6; i++) {
    tracker.append([
      step(A, 100),
      step(B, 300, true), // typo — excluded
      step(C, 5000), // outlier gap (> MAX) — excluded
    ]);
  }
  isNull(tracker.worst(new Set([A, B, C])));
});
