import { test } from "node:test";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { speedToTime } from "@keylearn/result";
import { equal, isNotNull, isNull } from "rich-assert";
import { LessonKey } from "./key.ts";
import { suggestTarget } from "./suggest.ts";

const BOUNDS = { min: 75, max: 750 };

/** A key in play, typed at the given speed. */
const keyAt = (speed: number | null, letter = FakePhoneticModel.letter1) =>
  new LessonKey({
    letter,
    samples: [],
    timeToType: speed == null ? null : speedToTime(speed),
    bestTimeToType: speed == null ? null : speedToTime(speed),
    confidence: null,
    bestConfidence: null,
    isIncluded: true,
    isFocused: false,
    isForced: false,
  });

test("a target far above the slowest key is named as the problem", () => {
  // The measured case: eight of ten keys below target, no new letter for days,
  // and nothing on the page connecting the two.
  const keys = [keyAt(300), keyAt(280), keyAt(170)];
  const s = suggestTarget(keys, 250, 40, BOUNDS);
  isNotNull(s);
  equal(s!.target, 170, "the bar the gate is actually applying");
  equal(s!.blocker.letter, FakePhoneticModel.letter1);
});

test("a target within reach is left alone", () => {
  // The slowest key is close enough that the next unlock is a session or two
  // of practice away. The practice is the thing in the way, not the goal.
  isNull(suggestTarget([keyAt(300), keyAt(230)], 250, 40, BOUNDS));
});

test("nothing is suggested before there is evidence", () => {
  const keys = [keyAt(300), keyAt(120)];
  isNull(suggestTarget(keys, 250, 5, BOUNDS), "five lessons is not evidence");
  isNotNull(suggestTarget(keys, 250, 40, BOUNDS));
});

test("a key never typed is not treated as infinitely slow", () => {
  // It has no speed to be slow at, and a suggestion drawn from it would be
  // invented rather than measured.
  const s = suggestTarget([keyAt(300), keyAt(null)], 250, 40, BOUNDS);
  isNull(s, "no evidence among the keys that have any");
});

test("the suggestion stays inside the settable range", () => {
  const s = suggestTarget([keyAt(20)], 250, 40, BOUNDS);
  isNotNull(s);
  equal(s!.target, BOUNDS.min, "clamped, not a target nobody could set");
});

test("a suggestion that is not lower is not offered", () => {
  // Below the floor already; there is nothing useful left to say.
  isNull(suggestTarget([keyAt(30)], BOUNDS.min, 40, BOUNDS));
});

test("no keys in play means nothing to suggest", () => {
  isNull(suggestTarget([], 250, 40, BOUNDS));
});
