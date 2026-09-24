/**
 * THE CHAPTERS OF THE VILLAGE ROAD, AND WHICH ONE A CHILD IS ON.
 *
 * `chapter1.ts` is one chapter's CONTENT — ten authored lessons, their
 * species, props, herds and folk. This is the index above it: what chapters
 * exist, what each one is called, what to tell a child who is about to walk
 * into one, and the arithmetic that turns a count of milestones into a
 * chapter and a lesson number.
 *
 * KEPT APART FROM THE CONTENT ON PURPOSE. Everything here is read by the
 * page — the card, the scoreboard chip — and none of it should drag ten
 * lessons' worth of placement tables into a bundle that only wants a name.
 *
 * THE COUNTER IS ALREADY GLOBAL. `prefs.roadStones` counts every milestone a
 * child has ever passed, and always has: 0 through 9 is Chapter 1, 10 through
 * 19 is Chapter 2. So a second chapter needs no migration, no second counter
 * and no rewriting of anybody's save — the number already means the right
 * thing, and only ever needed dividing.
 */

import { type Lesson, LESSONS, SEGMENT_COUNT } from "./chapter1.ts";
import { LESSONS_2 } from "./chapter2.ts";
import { LESSONS_3 } from "./chapter3.ts";
import { LESSONS_4 } from "./chapter4.ts";

export type Chapter = {
  /** 1-based, and the same number the card shows. */
  readonly n: number;
  /** Two or three words. Shown as the card's title and in the scoreboard. */
  readonly name: string;
  /**
   * What a child is about to walk into, in one sentence.
   *
   * Written for a six-year-old being read to, not as a blurb: concrete
   * nouns they will actually see on the road, in the order they meet them.
   * No numbers, no "lessons", nothing about typing. The road is the promise.
   *
   * AND NO PLACE NAMES. The world is unmistakably where it is — the paddy,
   * the banyan, the laterite, the palms all say so — and naming the region
   * on top of that tells a child a fact instead of showing them a road. It
   * is the same rule the guide's lines follow: the English word for the
   * thing, and let the scene be the rest.
   */
  readonly blurb: string;
  /** Its lessons, in order. Empty until the chapter is authored. */
  readonly lessons: readonly Lesson[];
  /**
   * WHICH AUTHORED ROAD IT IS BUILT FROM, 1-based — the scenery.
   *
   * The same as `n` for the chapters that are written; a later chapter that
   * walks an earlier road again (see `chapterNo`) carries the number of the
   * road it borrows. The world is built from THIS, and never from `n`: every
   * "is this the river chapter" test in world.ts is a question about the
   * scenery, and Chapter 8 is the river chapter as surely as Chapter 4 is.
   */
  readonly scenery: number;
  /**
   * Names for the later times this road comes round, in order: the first
   * entry is the second time through, and so on. See `chapterNo`.
   */
  readonly again?: readonly { readonly name: string; readonly blurb: string }[];
};

/**
 * THE CHAPTER IS ONLY REAL WHEN IT HAS LESSONS.
 *
 * Derived rather than declared, because a hand-kept `ready: true` is a flag
 * that can disagree with the truth — and the failure it buys is a child
 * pressing Enter on a card that promises a road nobody has built. The table
 * below cannot lie about this: a chapter is walkable exactly when there is
 * something authored to walk through.
 */
export function isWalkable(c: Chapter): boolean {
  return c.lessons.length > 0;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    n: 1,
    name: "The Village",
    blurb:
      "A road through a village, long ago — past the paddy fields and the" +
      " old banyan tree, through the market, and out the other side.",
    lessons: LESSONS,
    scenery: 1,
    again: [
      {
        name: "The Paddy Village",
        blurb:
          "Another village along the road — green paddy, tall palms and a" +
          " great banyan, a busy market, and the way out beyond it.",
      },
      {
        name: "The Palm Village",
        blurb:
          "The road runs into a village again — fields of rice, a banyan" +
          " with a stone seat round it, the market, and on past the houses.",
      },
    ],
  },
  {
    n: 2,
    name: "The Outer Fields",
    blurb:
      "Past the last house lies the land that feeds the village — orchards" +
      " and field walls, a little shrine under a great tree, a river to" +
      " cross, and open grazing beyond it.",
    lessons: LESSONS_2,
    scenery: 2,
    again: [
      {
        name: "The Orchard Road",
        blurb:
          "Out past the houses again, through orchards and field walls — a" +
          " small shrine under a big tree, a river to cross, and cows beyond.",
      },
      {
        name: "The Far Fields",
        blurb:
          "The fields open up once more — fruit trees, stone walls, a quiet" +
          " shrine, a bridge over the river and wide grass for the herd.",
      },
    ],
  },
  {
    n: 3,
    name: "Village of Whispers",
    blurb:
      "Beyond the fields, a bigger village waits — houses, a great market" +
      " and a temple street, where somebody plays among the trees before" +
      " the road grows quiet again.",
    lessons: LESSONS_3,
    scenery: 3,
    again: [
      {
        name: "The Temple Town",
        blurb:
          "A big village again, full of houses — a crowded market and a" +
          " temple street, and someone hiding in the trees who likes to play.",
      },
      {
        name: "The Market Town",
        blurb:
          "Houses close in on both sides, then a great market and the temple" +
          " road — and somebody playful following, until the road goes quiet.",
      },
    ],
  },
  {
    n: 4,
    name: "The Wild Crossing",
    blurb:
      "Beyond the village, the road winds through trees and grassy hills" +
      " to a wide river — over a wooden bridge to a little island, then" +
      " another bridge into the woods and the open green land beyond.",
    lessons: LESSONS_4,
    scenery: 4,
    again: [
      {
        name: "The River Journey",
        blurb:
          "Into the trees again and over the hills, down to a wide river —" +
          " a bridge to an island with a great banyan, and woods beyond.",
      },
      {
        name: "The Long Crossing",
        blurb:
          "Through a shady forest and up over grassy hills, then the big" +
          " river again — across the island and on into the green land.",
      },
    ],
  },
];

/** How many milestones make up one chapter. Ten, for all of them. */
export const CHAPTER_STONES = SEGMENT_COUNT;

/**
 * CHAPTER n, FOR ANY n — THE ROAD NEVER RUNS OUT.
 *
 * Four chapters are authored, and a child who finishes the fourth walks on
 * into Chapter 5: Lessons 41 to 50, Milestones 40 to 50. The count never
 * starts again — a stone reading 41 follows the one reading 40, because the
 * road did not end and neither did the child's progress — but the SCENERY
 * comes round again: Chapter 5 is built on Chapter 1's road, 6 on 2's, and
 * so on for as long as the child keeps walking.
 *
 * A repeat is a new chapter to the child, not a replay: it gets its own
 * number, its own name and its own card. The names come from each road's
 * `again` list and cycle once that runs out, so the fifth time through the
 * village is called what the second time was — by then it has been a long
 * while.
 *
 * WHEN MORE CHAPTERS ARE WRITTEN they simply join `CHAPTERS`, and the cycle
 * widens to include them on its own: nothing below counts to four.
 */
export function chapterNo(n: number): Chapter {
  const k = Math.max(1, Math.floor(n));
  const roads = CHAPTERS.filter(isWalkable);
  if (roads.length === 0) {
    return CHAPTERS[0]!;
  }
  const authored = CHAPTERS[k - 1];
  if (authored != null && isWalkable(authored)) {
    return authored;
  }
  // Past the written chapters: which road, and which time round it.
  const road = roads[(k - 1) % roads.length]!;
  const lap = Math.floor((k - 1) / roads.length); // 1 = second time through
  const names = road.again ?? [];
  const alias = names.length > 0 ? names[(lap - 1) % names.length]! : null;
  return {
    ...road,
    n: k,
    name: alias?.name ?? road.name,
    blurb: alias?.blurb ?? road.blurb,
  };
}

/**
 * WHICH CHAPTER A CHILD IS STANDING IN.
 *
 * Milestones 0 to 9 are Chapter 1, 40 to 49 are Chapter 5, and so on without
 * end — see `chapterNo`. There is no longer a last chapter to clamp to: the
 * road comes round again instead of stopping.
 */
export function chapterAt(stones: number): Chapter {
  return chapterNo(Math.floor(Math.max(0, stones) / CHAPTER_STONES) + 1);
}

/**
 * The chapter whose opening card falls on exactly this stone, if any.
 *
 * Every tenth stone opens one, repeats included: the child who reaches
 * Milestone 40 is shown Chapter 5's card, with its own name, before walking
 * on into it.
 */
export function chapterDueAt(stones: number): Chapter | null {
  const s = Math.max(0, Math.floor(stones));
  return s % CHAPTER_STONES === 0 ? chapterNo(s / CHAPTER_STONES + 1) : null;
}

/**
 * WHICH LESSON, COUNTED ALONG THE WHOLE ROAD.
 *
 * Lesson n starts at Milestone n-1, so a child with four stones is on Lesson
 * 5 — and one with forty-four is on Lesson 45. Continuous across chapters
 * and never capped: the milestones do not reset at a chapter line, so the
 * chip beside Milestone 44 has to say Lesson 45.
 */
export function lessonAtStones(stones: number): number {
  return Math.max(0, Math.floor(stones)) + 1;
}

/**
 * Where that lesson sits in its own chapter's table, 0-based.
 *
 * The number a child reads runs on for ever; the table it is looked up in
 * runs 0..9. This is the one place that conversion happens.
 */
export function lessonIndexAt(stones: number): number {
  const c = chapterAt(stones);
  const within = Math.max(0, stones) - chapterOpensAt(c);
  return Math.max(0, Math.min(c.lessons.length - 1, within));
}

/**
 * The stone at which a chapter's opening card is due.
 *
 * Chapter 1's is zero — before a child has walked anywhere — and every later
 * chapter's is the stone that ends the one before it. This is the ONE place
 * that number is worked out, because the card and the world rebuild have to
 * agree about it to the stone or a child sees the card twice.
 */
export function chapterOpensAt(c: Chapter): number {
  return (c.n - 1) * CHAPTER_STONES;
}

/**
 * `?lesson=14` → Chapter 2, Lesson 4; `?lesson=47` → Chapter 5, Lesson 7.
 *
 * THE FLAG COUNTS ALONG THE WHOLE ROAD, because that is how the reference
 * documents talk, and it runs on past the written chapters the way the road
 * does: `?lesson=47` is the island on the second time round.
 *
 * Null for anything that is not a positive whole lesson number.
 */
export function addressLesson(
  n: number,
): { readonly chapter: Chapter; readonly lesson: number } | null {
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  const chapter = chapterNo(Math.floor((n - 1) / CHAPTER_STONES) + 1);
  if (!isWalkable(chapter)) {
    return null;
  }
  return { chapter, lesson: ((n - 1) % CHAPTER_STONES) + 1 };
}

/** The key under which "this child has been shown that card" is remembered. */
export function chapterSeenKey(c: Chapter): string {
  return `chapter:${c.n}`;
}
