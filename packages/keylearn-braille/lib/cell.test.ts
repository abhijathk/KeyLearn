import { test } from "node:test";
import { deepEqual, equal, isNull } from "rich-assert";
import {
  BLANK,
  CAPITAL_SIGN,
  cellsFor,
  cellsForText,
  dots,
  dotsOf,
  LETTERS,
  NUMBER_SIGN,
  toUnicode,
} from "./cell.ts";

test("dots round-trip", () => {
  deepEqual(dotsOf(dots(1, 2, 5)), [1, 2, 5]);
  deepEqual(dotsOf(BLANK), []);
  deepEqual(dotsOf(dots(1, 2, 3, 4, 5, 6)), [1, 2, 3, 4, 5, 6]);
});

test("unicode matches the braille patterns block", () => {
  // Verified against the Unicode chart rather than against our own encoder.
  equal(toUnicode(BLANK), "⠀");
  equal(toUnicode(dots(1)), "⠁"); // a
  equal(toUnicode(dots(1, 2)), "⠃"); // b
  equal(toUnicode(dots(1, 4)), "⠉"); // c
  equal(toUnicode(dots(1, 2, 3, 4, 5, 6)), "⠿");
});

test("the alphabet follows the braille decades", () => {
  // k-t is a-j plus dot 3; u-z (bar w) is a-e plus dots 3 and 6.
  const decade = "abcdefghij";
  for (let i = 0; i < decade.length; i++) {
    const base = LETTERS.get(decade[i])!;
    const second = LETTERS.get("klmnopqrst"[i])!;
    equal(
      second,
      base | dots(3),
      `${"klmnopqrst"[i]} should be ${decade[i]} + dot 3`,
    );
  }
  for (let i = 0; i < 5; i++) {
    const base = LETTERS.get(decade[i])!;
    const third = LETTERS.get("uvxyz"[i])!;
    equal(
      third,
      base | dots(3, 6),
      `${"uvxyz"[i]} should be ${decade[i]} + dots 3,6`,
    );
  }
  // w breaks the pattern; it was not in Louis Braille's French.
  equal(LETTERS.get("w"), dots(2, 4, 5, 6));
});

test("every letter is distinct", () => {
  equal(new Set(LETTERS.values()).size, LETTERS.size);
});

test("capitals and digits take a prefix cell", () => {
  deepEqual(cellsFor("a"), [dots(1)]);
  deepEqual(cellsFor("A"), [CAPITAL_SIGN, dots(1)]);
  deepEqual(cellsFor("1"), [NUMBER_SIGN, LETTERS.get("a")]);
  deepEqual(cellsFor("0"), [NUMBER_SIGN, LETTERS.get("j")]);
  deepEqual(cellsFor(" "), [BLANK]);
});

test("unwritable characters are refused, not guessed", () => {
  isNull(cellsFor("€"));
  isNull(cellsFor("\t"));
});

test("text maps to cells that stay in step with the print", () => {
  const steps = cellsForText("Hi 1");
  deepEqual(
    steps.map((s) => s.at),
    [0, 0, 1, 2, 3, 3],
  );
  deepEqual(steps[0].cell, CAPITAL_SIGN);
  deepEqual(steps[1].cell, LETTERS.get("h"));
  deepEqual(steps[2].cell, LETTERS.get("i"));
  deepEqual(steps[3].cell, BLANK);
  deepEqual(steps[4].cell, NUMBER_SIGN);
  deepEqual(steps[5].cell, LETTERS.get("a"));
});

test("a character with no braille never reaches the learner", () => {
  deepEqual(
    cellsForText("a€b").map((s) => s.at),
    [0, 2],
  );
});
