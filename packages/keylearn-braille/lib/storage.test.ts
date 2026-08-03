import { beforeEach, test } from "node:test";
import { equal, isTrue } from "rich-assert";
import {
  clearProgress,
  dailyStats,
  dayStats,
  practiceDays,
  recordCell,
} from "./storage.ts";

/**
 * The day tallies, and the keys they are filed under.
 *
 * These keys are read back by the practice calendar with
 * `String(new LocalDate(ms))`, which is built from getFullYear/getMonth/
 * getDate — local. They were being written with toISOString(), which is UTC,
 * so for everybody outside UTC the calendar looked up a day that had never
 * been written: a session at nine in the morning in Sydney is the previous
 * date in UTC.
 */

// A localStorage good enough for the store, since these tests run in node.
class MemoryStorage {
  readonly #map = new Map<string, string>();
  getItem(key: string) {
    return this.#map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.#map.set(key, String(value));
  }
  removeItem(key: string) {
    this.#map.delete(key);
  }
}

beforeEach(() => {
  (globalThis as any).window = { localStorage: new MemoryStorage() };
});

/** Today the way LocalDate spells it. */
function localToday(at: Date = new Date()): string {
  return [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ].join("-");
}

test("files a day under the local date, not the UTC one", () => {
  recordCell("p1", { correct: true, ms: 500 });
  const days = [...dailyStats("p1").keys()];
  equal(days.length, 1);
  equal(days[0], localToday());
});

test("counts hits and misses separately", () => {
  recordCell("p1", { correct: true, ms: 500 });
  recordCell("p1", { correct: true, ms: 700 });
  recordCell("p1", { correct: false });
  const today = dayStats("p1");
  equal(today.hits, 2);
  equal(today.misses, 1);
});

test("only the joins that were timed contribute to the time", () => {
  // The first cell of a session has nothing to be timed from, and the practice
  // page passes null for a pause it has rejected. Both still count as cells.
  recordCell("p1", { correct: true, ms: null });
  recordCell("p1", { correct: true, ms: 600 });
  const today = dayStats("p1");
  equal(today.hits, 2, "both cells counted");
  equal(today.timed, 1, "only one contributed a time");
  equal(today.totalMs, 600);
  // Dividing by hits rather than by timed would report 300ms a cell, which is
  // twice the pace the learner actually typed at.
  equal(today.totalMs / today.timed, 600);
});

test("keeps the quickest join of the day", () => {
  recordCell("p1", { correct: true, ms: 900 });
  recordCell("p1", { correct: true, ms: 400 });
  recordCell("p1", { correct: true, ms: 700 });
  equal(dayStats("p1").bestMs, 400);
});

test("a miss does not disturb the quickest join", () => {
  recordCell("p1", { correct: true, ms: 400 });
  recordCell("p1", { correct: false });
  equal(dayStats("p1").bestMs, 400);
});

test("an untouched day reads as zero rather than throwing", () => {
  const empty = dayStats("nobody");
  equal(empty.hits, 0);
  equal(empty.misses, 0);
  equal(empty.timed, 0);
  equal(empty.bestMs, null);
});

test("learners do not see each other's days", () => {
  recordCell("p1", { correct: true, ms: 500 });
  equal(dayStats("p1").hits, 1);
  equal(dayStats("p2").hits, 0);
});

test("clearing wipes the cells, the days and the tallies together", () => {
  recordCell("p1", { correct: true, ms: 500 });
  isTrue(dailyStats("p1").size > 0);
  clearProgress("p1");
  equal(dailyStats("p1").size, 0);
  equal(dayStats("p1").hits, 0);
  equal(practiceDays("p1").length, 0);
});

test("a corrupted day does not reach the page as NaN", () => {
  window.localStorage.setItem(
    "keylearn.braille.daily.p1",
    JSON.stringify({
      "2026-08-02": "not an object",
      "2026-08-03": { hits: "x" },
    }),
  );
  const stats = dailyStats("p1");
  equal(stats.get("2026-08-02"), undefined, "the junk entry is dropped");
  equal(stats.get("2026-08-03")?.hits, 0, "a non-numeric count reads as zero");
});
