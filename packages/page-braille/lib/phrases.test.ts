import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { deepEqual, equal, isTrue } from "rich-assert";
import {
  ALPHABET_DONE,
  clipsForCell,
  clipsForChar,
  clipsForGoalHalf,
  clipsForGoalReached,
  clipsForGoalSpoken,
  clipsForNewLine,
  clipsForSummary,
  clipsForWord,
  clipsForWrongEntry,
} from "./phrases.ts";

/**
 * The recordings as they exist on disk.
 *
 * Read from the directory rather than from the generated `VOICE_CLIPS` map,
 * for two reasons: that map imports `.m4a` files, which only the bundler
 * understands, and going to the files directly also catches the map and the
 * committed audio drifting apart.
 */
const RECORDED = new Set(
  readdirSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "voice"),
  )
    .filter((name) => name.endsWith(".m4a"))
    .map((name) => name.slice(0, -".m4a".length)),
);

/**
 * Every id a phrase asks for has to have been recorded. A missing one is
 * silence on a page where the voice is the interface, and it would not show up
 * until a learner hit that exact phrase with a dead browser engine.
 */
const recorded = (ids: readonly string[]) =>
  ids.every((id) => RECORDED.has(id));

test("a wrong entry names the dots that were pressed", () => {
  deepEqual(clipsForWrongEntry([1, 4]), [
    "dots",
    "digit-1",
    "digit-4",
    "try-again",
  ]);
  deepEqual(clipsForWrongEntry([]), ["blank", "try-again"]);
});

test("a lesson word is spelled from the letter clips", () => {
  // There is no recording of "children" and there cannot be one — the word
  // list is open. Spelling it is the only option, and for somebody building
  // the word cell by cell it is the more useful reading anyway.
  deepEqual(clipsForWord("cab"), ["letter-c", "letter-a", "letter-b"]);
  isTrue(recorded(clipsForWord("children")));
});

test("a word carrying a mark falls back rather than half-speaking", () => {
  // "don't" has no recording for the apostrophe. Half a word is worse than
  // letting the server or the browser say the whole thing.
  deepEqual(clipsForWord("don't"), []);
});

test("the cell prompt gives the name and then its dots", () => {
  deepEqual(clipsForCell("c", [1, 4]), [
    "letter-c",
    "dots",
    "digit-1",
    "digit-4",
  ]);
  // The signs are named, not spelled: there is a recording of the words
  // "capital sign", and none of the character it introduces.
  deepEqual(clipsForCell("capital sign", [6]), [
    "sign-capital",
    "dots",
    "digit-6",
  ]);
});

test("something with no recording at all still defers", () => {
  deepEqual(clipsForCell("æsc", [1, 2]), [], "let the server try");
});

test("numbers are read digit by digit", () => {
  deepEqual(clipsForNewLine(8), ["new-line", "digit-8", "words"]);
  deepEqual(clipsForSummary(42, 97), [
    "line-done",
    "digit-4",
    "digit-2",
    "cells-a-minute",
    "digit-9",
    "digit-7",
    "percent-accurate",
  ]);
});

test("every phrase the page composes has been recorded", () => {
  isTrue(recorded(["ready", "controls"]), "the fixed sentences");
  isTrue(recorded(clipsForWrongEntry([1, 2, 3, 4, 5, 6])));
  isTrue(recorded(clipsForWrongEntry([])));
  isTrue(recorded(clipsForSummary(123, 100)));
  isTrue(recorded(clipsForNewLine(12)));
  for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789 ") {
    isTrue(recorded(clipsForChar(ch)), `nothing recorded for "${ch}"`);
  }
});

test("a character with no recording asks for nothing", () => {
  equal(clipsForChar(";").length, 0);
  equal(clipsForChar("!").length, 0);
});

test("every cell in the curriculum can be named by the recorded voice", () => {
  // Punctuation used to fall through to the server, because the mark itself is
  // all there was to say it with — and a full stop handed to a speech engine is
  // a pause, or nothing.
  for (const [name, dots] of [
    ["full stop", [2, 5, 6]],
    ["comma", [2]],
    ["question mark", [2, 3, 6]],
    ["apostrophe", [3]],
    ["exclamation mark", [2, 3, 5]],
    ["hyphen", [3, 6]],
    ["semicolon", [2, 3]],
    ["colon", [2, 5]],
    ["capital sign", [6]],
    ["number sign", [3, 4, 5, 6]],
  ] as const) {
    const clips = clipsForCell(name, [...dots]);
    isTrue(clips.length > 0, `${name} has no recording`);
    isTrue(recorded(clips), `${name} composes an id that was never recorded`);
  }
});

test("the goal can be spoken offline in each of its three shapes", () => {
  for (const g of [
    { done: 9, total: 0, left: 0, reached: false },
    { done: 15, total: 15, left: 0, reached: true },
    { done: 9, total: 15, left: 6, reached: false },
  ]) {
    isTrue(recorded(clipsForGoalSpoken(g)), JSON.stringify(g));
  }
  isTrue(recorded(clipsForGoalHalf(6)));
  isTrue(recorded(clipsForGoalReached(15)));
  isTrue(recorded(ALPHABET_DONE));
});
