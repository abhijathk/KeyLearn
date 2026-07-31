import { test } from "node:test";
import { FakePhoneticModel } from "@keybr/phonetic-model";
import { type KeyStatsMap } from "@keybr/result";
import { equal, isNotNull, isNull } from "rich-assert";
import { LessonKey } from "./key.ts";
import { findDueKey, isUrgent } from "./srs.ts";

const { letter1 } = FakePhoneticModel;

function key(bestConfidence: number | null): LessonKey {
  return new LessonKey({
    letter: letter1,
    samples: [],
    timeToType: null,
    bestTimeToType: null,
    confidence: bestConfidence,
    bestConfidence,
    isIncluded: true,
    isFocused: false,
    isForced: false,
  });
}

function statsMap(totalRounds: number, lastIndex: number | null): KeyStatsMap {
  return {
    results: { length: totalRounds },
    get: () => ({ samples: lastIndex == null ? [] : [{ index: lastIndex }] }),
  } as unknown as KeyStatsMap;
}

test("no due key when recently practiced", () => {
  // halfLife = 5 * (0.5 + 1.5) = 10; recency = 10 - 9 = 1; dueScore = 0.1
  isNull(findDueKey(statsMap(10, 9), [key(1.5)]));
});

test("finds an overdue learned key and flags it urgent", () => {
  // halfLife = 5 * (0.5 + 1) = 7.5; recency = 20 - 0 = 20; dueScore ≈ 2.67
  const due = findDueKey(statsMap(20, 0), [key(1)]);
  isNotNull(due);
  equal(due!.key.letter, letter1);
  equal(isUrgent(due!), true);
});

test("ignores keys that were never learned", () => {
  isNull(findDueKey(statsMap(50, 0), [key(0.5)]));
});

test("ignores keys with no samples", () => {
  isNull(findDueKey(statsMap(50, null), [key(2)]));
});
