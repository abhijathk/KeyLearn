import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { brailleCells, mirrorCells } from "./braille.ts";
import {
  ADULT_BRAILLE,
  ADULT_TYPING,
  assess,
  bandFor,
  certificateTemplate,
} from "./criteria.ts";
import { type CertificateEvidence } from "./types.ts";

const adult = (
  over: Partial<CertificateEvidence> = {},
): CertificateEvidence => ({
  kind: "typing",
  audience: "adult",
  age: null,
  learned: 26,
  total: 26,
  settled: 26,
  volume: 200,
  daysPractised: 20,
  elapsedDays: 21,
  // The practice gate is the standard plus its margin, so clearing it means
  // being comfortably at the standard rather than exactly on it.
  speed: 38,
  accuracy: 0.95,
  ...over,
});

const kid = (over: Partial<CertificateEvidence> = {}): CertificateEvidence =>
  adult({
    audience: "kid",
    age: 9,
    volume: 60,
    daysPractised: 15,
    elapsedDays: 14,
    speed: 21,
    accuracy: 0.9,
    ...over,
  });

test("passes evidence that exactly meets every bar", () => {
  const v = assess(adult());
  isTrue(v.eligible, JSON.stringify(v.outstanding));
  equal(v.level, "completion");
  equal(v.outstanding.length, 0);
});

test("one missing letter is enough to fail", () => {
  // The point of the coverage rule: fast on twelve letters is not the same
  // achievement as fast on all of them.
  const v = assess(adult({ learned: 25 }));
  isFalse(v.eligible);
  equal(v.outstanding[0].id, "coverage");
  equal(v.level, null);
});

test("a letter introduced but not reliable is enough to fail", () => {
  const v = assess(adult({ settled: 25 }));
  isFalse(v.eligible);
  equal(v.outstanding[0].id, "settled");
});

test("the cram is refused", () => {
  // Twenty days inside a fortnight is not a course, however many lessons it
  // contains. Days and elapsed span are separate checks for this reason.
  const v = assess(adult({ daysPractised: 20, elapsedDays: 13 }));
  isFalse(v.eligible);
  equal(v.outstanding[0].id, "elapsed");
});

test("adults are never banded", () => {
  for (const speed of [38, 60, 120]) {
    equal(assess(adult({ speed })).level, "completion");
  }
});

test("children are banded by age", () => {
  // A nine-year-old at 18 wpm has done well; the same speed at twelve has not
  // yet reached bronze.
  equal(assess(kid({ age: 9, speed: 21 })).level, "bronze");
  equal(assess(kid({ age: 9, speed: 24 })).level, "silver");
  equal(assess(kid({ age: 9, speed: 30 })).level, "gold");
  isFalse(assess(kid({ age: 12, speed: 21 })).eligible);
});

test("gold at the top of childhood equals the adult bar", () => {
  equal(bandFor(12, "typing")[2], ADULT_TYPING.speed);
  equal(bandFor(12, "braille")[2], ADULT_BRAILLE.speed);
});

test("an unknown age gets the neutral band, not the easiest", () => {
  const neutral = bandFor(null, "typing");
  const youngest = bandFor(5, "typing");
  isTrue(neutral[0] > youngest[0], "must not be easier than a five-year-old's");
});

test("braille is judged on its own metric and its own curriculum", () => {
  const braille = adult({
    kind: "braille",
    learned: 36,
    total: 36,
    settled: 36,
    volume: 2500,
    speed: 55,
  });
  isTrue(assess(braille).eligible);
  // 40 cells per minute is the pace the app already demands to unlock the
  // next cell, so it cannot also be the certificate standard.
  isFalse(assess({ ...braille, speed: 40 }).eligible);
  // And the standard itself is not the gate: practice has to be above it.
  isFalse(assess({ ...braille, speed: ADULT_BRAILLE.speed }).eligible);
});

test("children's braille is as hard as children's typing, not harder", () => {
  const at = (age: number) =>
    bandFor(age, "braille")[0] / bandFor(age, "typing")[0];
  const ratios = [6, 8, 10, 12].map(at);
  for (const r of ratios) {
    isTrue(r > 1.2 && r < 1.7, `unexpected ratio ${r}`);
  }
});

test("every check is reported, met or not", () => {
  const v = assess(adult({ speed: 10, accuracy: 0.5, volume: 1 }));
  equal(v.checks.length, 7);
  equal(v.outstanding.length, 3);
  isTrue(v.checks.every((c) => c.label.length > 0));
});

// ── braille cells ──────────────────────────────────────────────────────────

test("writes grade 1 braille", () => {
  equal(JSON.stringify(brailleCells("a")), JSON.stringify([[1]]));
  // A capital is the capital sign then the letter.
  equal(JSON.stringify(brailleCells("A")), JSON.stringify([[6], [1]]));
  equal(
    JSON.stringify(brailleCells("Meera")),
    JSON.stringify([[6], [1, 3, 4], [1, 5], [1, 5], [1, 2, 3, 5], [1]]),
  );
});

test("writes digits with the number sign, once", () => {
  const cells = brailleCells("42");
  equal(
    JSON.stringify(cells),
    JSON.stringify([
      [3, 4, 5, 6],
      [1, 4, 5],
      [1, 2],
    ]),
  );
  // The sign is not repeated inside a run, but does not survive a letter.
  equal(brailleCells("4a4").length, 5);
});

test("mirrors for a slate, swapping columns as well as order", () => {
  // Punching from the back reverses both the run of cells and, within each
  // cell, the left and right columns.
  equal(
    JSON.stringify(mirrorCells([[1], [2, 4]])),
    JSON.stringify([[1, 5], [4]]),
  );
});

test("the paper is chosen by age, the standard by audience", () => {
  // A twelve-year-old handed the same sheet as a six-year-old notices.
  equal(certificateTemplate(6, "kid"), "child");
  equal(certificateTemplate(8, "kid"), "child");
  equal(certificateTemplate(9, "kid"), "young");
  equal(certificateTemplate(13, "kid"), "young");
  equal(certificateTemplate(14, "kid"), "adult");
  equal(certificateTemplate(34, "adult"), "adult");
});

test("braille is no exception — the age decides the sheet", () => {
  for (const [age, want] of [
    [7, "child"],
    [11, "young"],
    [40, "adult"],
  ] as const) {
    equal(certificateTemplate(age, age > 13 ? "adult" : "kid"), want);
  }
});

test("an unknown age falls to the middle sheet for a child", () => {
  // Neither babyish for a twelve-year-old nor over-formal for an eight-year-old.
  equal(certificateTemplate(null, "kid"), "young");
  equal(certificateTemplate(null, "adult"), "adult");
});
