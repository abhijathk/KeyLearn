import test from "node:test";
import { equal, isTrue } from "rich-assert";
import { runLengthFor } from "./run-length.ts";
import { MAX_STONE_LEAD, MIN_STONE_GAP, stoneXFor } from "./stone-x.ts";

/**
 * A milestone marks where a lesson ended.
 *
 * It may stand a little way up the road — that is how a marker at a roadside
 * is met — but "a little way" has to stay little. The rule it replaces
 * measured the gap from the last STONE, so a band whose lessons are shorter
 * than the gap paid the shortfall again every lesson and never got it back.
 */

/** Per-band passage lengths, as measured in `run-length.test.ts`. */
const BANDS = [
  { band: "5-6", start: 24, full: 36 },
  { band: "7-8", start: 50, full: 72 },
  { band: "9-10", start: 77, full: 112 },
  { band: "11+", start: 102, full: 153 },
];

/** Walk `lessons` lessons of one length, returning how far each stone led. */
function walk(chars: number, lessons: number): number[] {
  const runLen = runLengthFor(chars);
  const leads: number[] = [];
  let finish = -6;
  let lastStone = -Infinity;
  for (let i = 0; i < lessons; i++) {
    finish += runLen;
    const stone = stoneXFor(finish, lastStone);
    leads.push(stone - finish);
    lastStone = stone;
  }
  return leads;
}

test("no stone ever stands further past the finish than the cap", () => {
  for (const { band, start, full } of BANDS) {
    for (const chars of [start, full, Math.round((start + full) / 2)]) {
      for (const lead of walk(chars, 40)) {
        isTrue(
          lead <= MAX_STONE_LEAD + 1e-9,
          `${band} on a ${chars}-character passage put a stone ` +
            `${lead.toFixed(1)} units past the finish`,
        );
        isTrue(lead >= -1e-9, `${band} put a stone behind the finish`);
      }
    }
  }
});

test("the lead does not grow with the number of lessons walked", () => {
  // The regression itself: at 24 characters the 5-6 band runs 21.6 units
  // against a 26-unit gap, and the old rule carried the 4.4 forward every
  // lesson — ten units out by the third stone and forty by the tenth.
  const leads = walk(24, 30);
  isTrue(leads[29]! <= leads[3]! + 1e-9, "the lead is still growing at 30");
});

test("a band whose lessons clear the gap is placed exactly at the finish", () => {
  // 7-8 and up run 45 units or more, so nothing about them changes: their
  // stone goes in where they stop, as it always did.
  for (const { band, start, full } of BANDS.slice(1)) {
    for (const chars of [start, full]) {
      isTrue(
        runLengthFor(chars) >= MIN_STONE_GAP,
        `${band} was assumed to clear the gap and does not`,
      );
      for (const lead of walk(chars, 20)) {
        equal(lead, 0, `${band} moved a stone off its finish`);
      }
    }
  }
});

test("stones stay in order, and never land on top of one another", () => {
  const runLen = runLengthFor(24);
  let finish = -6;
  let lastStone = -Infinity;
  for (let i = 0; i < 40; i++) {
    finish += runLen;
    const stone = stoneXFor(finish, lastStone);
    if (i > 0) {
      // Far enough apart that `Math.round` cannot collide them, which is what
      // decides whether a stone is planted at all.
      isTrue(
        stone - lastStone >= 1,
        `stone ${i} landed ${(stone - lastStone).toFixed(2)} from the last`,
      );
    }
    lastStone = stone;
  }
});

test("the first stone of a session has no previous stone to keep from", () => {
  equal(stoneXFor(15.6, -Infinity), 15.6);
});
