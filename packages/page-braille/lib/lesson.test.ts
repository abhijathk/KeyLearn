import { test } from "node:test";
import { cellsForText } from "@keylearn/braille";
import { deepEqual, equal } from "rich-assert";
import { describeCell, readCell, wordAt } from "./lesson.ts";

const stepsOf = (text: string) => cellsForText(text);

test("a letter is named as itself", () => {
  const text = "cab";
  equal(readCell(text, stepsOf(text)[0]).name, "c");
  deepEqual([...readCell(text, stepsOf(text)[0]).dots], [1, 4]);
});

test("punctuation is named, not pronounced", () => {
  // The mark itself is no use to a speech engine — a full stop is rendered as
  // a pause or as nothing — and no use printed beside a braille cell either.
  for (const [text, name] of [
    [".", "full stop"],
    [",", "comma"],
    ["?", "question mark"],
    ["'", "apostrophe"],
    ["-", "hyphen"],
    [";", "semicolon"],
    [":", "colon"],
    ["!", "exclamation mark"],
  ] as const) {
    equal(readCell(text, stepsOf(text)[0]).name, name);
  }
});

test("a digit's two cells are not both called the number sign", () => {
  // They were: the name came from the character being written, and both cells
  // of "5" point at the same "5" — so the learner was told to press the same
  // thing twice, for two entirely different chords.
  const steps = stepsOf("5");
  equal(steps.length, 2);
  equal(readCell("5", steps[0]).name, "number sign");
  equal(readCell("5", steps[1]).name, "e", "the digit's own cell");
  deepEqual(
    [...readCell("5", steps[0]).dots],
    [3, 4, 5, 6],
    "and they are different dots",
  );
});

test("a capital is the sign, then the letter in the case being written", () => {
  const steps = stepsOf("Cab");
  equal(readCell("Cab", steps[0]).name, "capital sign");
  equal(readCell("Cab", steps[1]).name, "C", "not 'c' — that is the point");
});

test("a space is a space", () => {
  const steps = stepsOf("a b");
  equal(readCell("a b", steps[1]).name, "space");
});

test("the spoken description gives the name and then the dots", () => {
  equal(describeCell("cab", stepsOf("cab")[0]), "c, dots 1 4");
  equal(describeCell(".", stepsOf(".")[0]), "full stop, dots 2 5 6");
});

test("a word is found from any step inside it, and not from the space", () => {
  const text = "cab dad";
  const steps = stepsOf(text);
  const lesson = {
    text,
    steps,
    words: [
      { text: "cab", from: 0, to: 3 },
      { text: "dad", from: 4, to: 7 },
    ],
  };
  equal(wordAt(lesson, 0)?.text, "cab");
  equal(wordAt(lesson, 2)?.text, "cab");
  equal(wordAt(lesson, 3), null, "the space belongs to no word");
  equal(wordAt(lesson, 4)?.text, "dad");
});
