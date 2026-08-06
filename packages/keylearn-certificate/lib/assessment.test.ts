import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import {
  judge,
  MIN_SITTINGS,
  outcomeMessage,
  planFor,
  scoreSitting,
  type Sitting,
} from "./assessment.ts";

const adult = { audience: "adult", age: null, kind: "typing" } as const;
const kid9 = { audience: "kid", age: 9, kind: "typing" } as const;

const sitting = (at: number, ...speeds: number[]): Sitting => ({
  at,
  kind: "typing",
  runs: speeds.map((speed) => ({ at, speed, accuracy: 0.97, seconds: 60 })),
});

test("grown-ups sit three runs of a minute, without the keyboard", () => {
  const plan = planFor("adult", 34);
  equal(plan.runs, 3);
  equal(plan.seconds, 60);
  isTrue(plan.hideKeyboard);
});

test("children sit one run, and the youngest keep the keyboard", () => {
  // Taking the picture away from a six-year-old tests their nerve, not their
  // typing, and their certificate is about finishing the trail.
  const small = planFor("kid", 6);
  equal(small.runs, 1);
  equal(small.seconds, 30);
  isFalse(small.hideKeyboard);

  const older = planFor("kid", 11);
  equal(older.runs, 1);
  equal(older.seconds, 45);
  isTrue(older.hideKeyboard);
});

test("a sitting scores as the median of its runs, never the best", () => {
  const scored = scoreSitting(sitting(1, 30, 36, 60));
  equal(scored?.speed, 36);
});

test("nothing is awarded before three sittings", () => {
  const v = judge([sitting(1, 60, 60, 60), sitting(2, 60, 60, 60)], adult);
  isFalse(v.passed);
  equal(v.speed, null);
  equal(v.remaining, 1);
  equal(v.sittings, 2);
});

test("one lucky sitting cannot carry somebody who is not there", () => {
  // The whole point of the median rule: unlimited attempts stay harmless.
  const v = judge(
    [sitting(1, 31, 31, 31), sitting(2, 32, 32, 32), sitting(3, 55, 55, 55)],
    adult,
  );
  isFalse(v.passed);
  equal(v.speed, 32);
});

test("one bad sitting cannot sink somebody who is", () => {
  const v = judge(
    [sitting(1, 40, 40, 40), sitting(2, 12, 12, 12), sitting(3, 41, 41, 41)],
    adult,
  );
  isTrue(v.passed);
  equal(v.speed, 40);
});

test("only the last three sittings count", () => {
  const early = Array.from({ length: 6 }, (_, i) => sitting(i + 1, 10, 10, 10));
  const later = [4, 5, 6].map((at) => sitting(at + 10, 40, 40, 40));
  const v = judge([...early, ...later], adult);
  isTrue(v.passed, `speed was ${v.speed}`);
  equal(v.sittings, 9);
});

test("accuracy has to hold too", () => {
  const poor: readonly Sitting[] = [1, 2, 3].map((at) => ({
    at,
    kind: "typing",
    runs: [{ at, speed: 60, accuracy: 0.8, seconds: 60 }],
  }));
  isFalse(judge(poor, adult).passed);
});

test("children are awarded a level, adults are not", () => {
  const at = (speed: number): readonly Sitting[] =>
    [1, 2, 3].map((n) => ({
      at: n,
      kind: "typing",
      runs: [{ at: n, speed, accuracy: 0.95, seconds: 45 }],
    }));
  equal(judge(at(19), kid9).level, "bronze");
  equal(judge(at(25), kid9).level, "silver");
  equal(judge(at(31), kid9).level, "gold");
  equal(judge(at(80), adult).level, "completion");
});

test("empty sittings are ignored rather than counted as failures", () => {
  const abandoned: Sitting = { at: 9, kind: "typing", runs: [] };
  const v = judge([sitting(1, 40), sitting(2, 40), abandoned], adult);
  equal(v.sittings, 2);
  equal(v.remaining, 1);
});

test("a child is never told they failed", () => {
  const failing = judge([sitting(1, 5), sitting(2, 5), sitting(3, 5)], kid9);
  const kidWords = outcomeMessage(failing, "kid");
  equal(kidWords.tone, "again");
  for (const bad of ["fail", "wrong", "not good", "%"]) {
    isFalse(kidWords.text.toLowerCase().includes(bad), kidWords.text);
  }
  // An adult is told the figure, because that is what lets them decide.
  const adultWords = outcomeMessage(
    judge([sitting(1, 5), sitting(2, 5), sitting(3, 5)], adult),
    "adult",
  );
  isTrue(adultWords.text.includes("35"));
});

test("the minimum is a stated constant, not a magic number", () => {
  equal(MIN_SITTINGS, 3);
});
