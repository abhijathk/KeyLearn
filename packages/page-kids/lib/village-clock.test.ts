import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  activityAt,
  childrenOut,
  folkOut,
  LESSONS,
  SHOPS_OPEN,
  tiredWalkAt,
  villageDay,
} from "./chapter1.ts";
import { daylightWindow, stagedHours } from "./world.ts";

/**
 * THE CLOCK, CHECKED AGAINST THE PUBLISHED RULES.
 *
 * `The Village Clock` states every timing window in one place, and a
 * reference that has drifted from the code is worse than no reference at
 * all — it is a thing people stop checking. So each interval it prints is
 * asserted here, and asserted by SWEEPING the day rather than by poking the
 * two or three hours that happen to be interesting: an off-by-one at a
 * boundary is exactly the bug a spot check walks past.
 *
 * The sweep is every six minutes, which is fine enough to catch a boundary
 * moved by a tenth of an hour and coarse enough to read.
 */

/** Every hour of the day at six-minute resolution. */
function sweep(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 240; i++) out.push(i / 10);
  return out;
}

/** Assert a predicate is true exactly on the union of the given windows. */
function holdsOn(
  what: string,
  pred: (h: number) => boolean,
  windows: readonly (readonly [number, number])[],
) {
  const inside = (h: number) =>
    windows.some(([from, to]) => h >= from && h < to);
  for (const h of sweep()) {
    equal(pred(h), inside(h), `${what} at ${h.toFixed(1)}`);
  }
}

test("the four activity bands are where the reference says", () => {
  holdsOn("deep", (h) => activityAt(h) === "deep", [
    [0, 4],
    [22, 24],
  ]);
  holdsOn("dawn", (h) => activityAt(h) === "dawn", [[4, 7]]);
  holdsOn("day", (h) => activityAt(h) === "day", [[7, 19]]);
  holdsOn("evening", (h) => activityAt(h) === "evening", [[19, 22]]);
});

test("children are out 07:00 to 18:00", () => {
  holdsOn("childrenOut", childrenOut, [[7, 18]]);
});

test("the tired gait starts at 18:00 and ends at 04:00", () => {
  holdsOn("tiredWalkAt", tiredWalkAt, [
    [0, 4],
    [18, 24],
  ]);
});

test("a field is worked 08:00 to 18:00 and no other hour", () => {
  // The reference prints one bar for all field folk, so the rule has to be
  // the same in every lesson that has any — a lesson keeping its people an
  // hour longer would make that single bar a lie.
  for (const l of LESSONS) {
    if (l.folk.length === 0) continue;
    holdsOn(
      `folk in lesson ${l.n}`,
      (h) => folkOut(l, activityAt(h), h) === l.folk.length,
      [[8, 18]],
    );
  }
});

test("only Lessons 5 and 7 keep one person into the evening", () => {
  for (const l of LESSONS) {
    if (l.folk.length === 0) continue;
    const exempt = l.n === 5 || l.n === 7;
    holdsOn(
      `evening stayer in lesson ${l.n}`,
      (h) => folkOut(l, activityAt(h), h) === 1 && h >= 18,
      exempt ? [[19, 22]] : [],
    );
    // And nobody at all once the evening is over.
    for (const h of [22, 23, 23.9, 0, 3]) {
      equal(folkOut(l, activityAt(h), h), 0, `lesson ${l.n} at ${h}`);
    }
  }
});

test("a shop trades from six until its own closing hour", () => {
  equal(SHOPS_OPEN, 6);
  const { rise, set } = daylightWindow(new Date());
  for (const closes of [19, 20, 21]) {
    holdsOn(
      `trading until ${closes}`,
      (h) => villageDay(h, rise, set).trading(closes),
      [[SHOPS_OPEN, closes]],
    );
  }
});

test("a lamp needs the hour AND the dark, never one of the two", () => {
  // This is the rule the reference leads with, and the one that burned a
  // shop lamp at ten in the morning when it was written as the hour alone.
  const { rise, set } = daylightWindow(new Date());
  for (const h of sweep()) {
    const today = villageDay(h, rise, set);
    for (const closes of [19, 20, 21]) {
      equal(
        today.lampLit(closes),
        today.trading(closes) && today.dark,
        `lamp until ${closes} at ${h.toFixed(1)}`,
      );
    }
    // Specifically: never lit in broad daylight, however open the shop is.
    if (!today.dark) {
      for (const closes of [19, 20, 21]) {
        equal(today.lampLit(closes), false, `daylight lamp at ${h.toFixed(1)}`);
      }
    }
  }
});

test("dark begins before sunset and ends after sunrise, not at them", () => {
  const { rise, set } = daylightWindow(new Date());
  const dark = (h: number) => villageDay(h, rise, set).dark;
  // Half an hour of dusk before the sun is down, and the light lingers
  // twelve minutes past the sunrise figure.
  equal(dark(set - 0.6), false);
  equal(dark(set - 0.4), true);
  equal(dark(rise + 0.1), true);
  equal(dark(rise + 0.3), false);
  // And the reference's "roughly six to six" has to stay roughly true, or
  // the whole chart is drawn against the wrong axis.
  ok(rise > 5.5 && rise < 6.75, `sunrise ${rise}`);
  ok(set > 17.25 && set < 18.5, `sunset ${set}`);
});

test("the staged clock folds the wall clock onto a twelve-hour face", () => {
  const at = (h: number, m = 0) => {
    const d = new Date(2026, 8, 17, h, m);
    return stagedHours(d);
  };
  // Three in the afternoon and three in the morning land on the SAME PAIR —
  // the fold cannot tell them apart, and does not try to. Which of the two
  // the world is standing in is the toggle's business, not the clock's.
  const pm = at(15);
  const am = at(3);
  equal(pm.day, am.day);
  equal(pm.night, am.night);
  // Three o'clock is outside the daylight window, so the face's "3" is the
  // night half and the day half is the one twelve hours off it.
  equal(pm.day, 15);
  equal(pm.night, 3);
  // Ten in the morning is inside it, so it stands as itself.
  equal(at(10).day, 10);
  equal(at(10).night, 22);
  // The two halves are always twelve hours apart, whatever the hour.
  for (let h = 0; h < 24; h++) {
    const s = at(h);
    equal(Math.abs(s.day - s.night), 12, `hour ${h}`);
  }
});

test("every time-of-day preset has a mirror twelve hours away", () => {
  // The pills in Settings pin the day hour; the night hour is derived, and
  // the reference prints both columns.
  const PRESETS = [
    [7, 19],
    [9, 21],
    [12, 0],
    [15, 3],
    [17, 5],
  ] as const;
  for (const [day, night] of PRESETS) {
    equal((day + 12) % 24, night, `preset ${day}`);
  }
});
