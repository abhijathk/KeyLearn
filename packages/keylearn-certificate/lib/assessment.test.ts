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
import { ADULT_TYPING, assess, PRACTICE_MARGIN } from "./criteria.ts";
import { type CertificateEvidence } from "./types.ts";

const adult = { audience: "adult", age: null, kind: "typing" } as const;
const kid9 = { audience: "kid", age: 9, kind: "typing" } as const;

const adultEv = (): CertificateEvidence => ({
  kind: "typing",
  audience: "adult",
  age: null,
  learned: 26,
  total: 26,
  settled: 26,
  volume: 200,
  daysPractised: 20,
  elapsedDays: 21,
  speed: 38,
  accuracy: 0.95,
});

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

// ── the retention rule ─────────────────────────────────────────────────────

const three = (speed: number): readonly Sitting[] =>
  [1, 2, 3].map((n) => ({
    at: n,
    kind: "typing" as const,
    runs: [{ at: n, speed, accuracy: 0.97, seconds: 60 }],
  }));

test("holding your own practice pace is part of passing", () => {
  // 40 in practice, 38 in the test: a small drop, which is what touch typing
  // looks like when the keyboard picture goes away.
  isTrue(judge(three(38), adult, 40).passed);
});

test("a collapse against your own pace fails, however fast the number", () => {
  // 60 in practice and 38 in the test clears the standard easily, and is
  // exactly the shape of somebody who had been reading the keyboard.
  const v = judge(three(38), adult, 60);
  isFalse(v.passed);
  isTrue(v.speed! > v.required.speed, "the absolute figure was fine");
  equal(Math.round(v.retained! * 100), 63);
});

test("the standard still has to be met, retention or not", () => {
  // Perfect retention of a slow pace is still slow.
  const v = judge(three(20), adult, 20);
  isFalse(v.passed);
  equal(v.retained, 1);
});

test("children are judged more gently than grown-ups", () => {
  // The same 82% passes a child and fails an adult: a tired seven-year-old is
  // the wrong person to be strict with.
  isTrue(judge(three(82), { ...kid9, age: 9 }, 100).retained! > 0.8);
  isTrue(judge(three(24.6), kid9, 30).passed);
  isFalse(judge(three(38), adult, 46).passed);
});

test("an unknown practice pace does not block anybody", () => {
  // Passing nothing means the ratio is unknown, and unknown must not fail.
  const v = judge(three(40), adult);
  isTrue(v.passed);
  equal(v.retained, null);
});

test("the wording says which of the two was missed", () => {
  const collapsed = outcomeMessage(judge(three(38), adult, 60), "adult");
  isTrue(collapsed.text.includes("keyboard"), collapsed.text);
  const tooSlow = outcomeMessage(judge(three(20), adult, 20), "adult");
  isFalse(tooSlow.text.includes("keyboard"), tooSlow.text);
});

test("practice must sit above the standard, not on it", () => {
  // Otherwise eligibility and the assessment are the same bar and the
  // assessment is a rubber stamp on work the gate already did.
  const at = (speed: number) => assess({ ...adultEv(), speed });
  isFalse(at(ADULT_TYPING.speed).eligible, "35 in practice should not qualify");
  isTrue(at(ADULT_TYPING.speed + PRACTICE_MARGIN.typing).eligible);
});
