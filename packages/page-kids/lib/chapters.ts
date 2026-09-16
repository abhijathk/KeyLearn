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
  },
  {
    n: 2,
    name: "The Outer Fields",
    blurb:
      "Past the last house lies the land that feeds the village — orchards" +
      " and field walls, a little shrine under a great tree, a river to" +
      " cross, and open grazing beyond it.",
    lessons: LESSONS_2,
  },
];

/** How many milestones make up one chapter. Ten, for all of them. */
export const CHAPTER_STONES = SEGMENT_COUNT;

/**
 * WHICH CHAPTER A CHILD IS STANDING IN — as opposed to which one is next.
 *
 * Those are two different questions and conflating them put "Lesson 1" and a
 * blank name on the scoreboard the moment a child reached the tenth stone:
 * the arithmetic said Chapter 2, Chapter 2 has no lessons to name, and the
 * road under their feet was still Chapter 1's. A child is in the last
 * chapter that has actually been BUILT, because that is the road they are
 * walking; what comes next is `chapterDueAt`, and it is the card's business
 * rather than the scoreboard's.
 *
 * So this clamps to the last WALKABLE chapter, not the last declared one. The
 * day Chapter 2 is authored the clamp moves on its own, because the thing it
 * clamps to is whether there is anything to walk through.
 */
export function chapterAt(stones: number): Chapter {
  const i = Math.floor(Math.max(0, stones) / CHAPTER_STONES);
  const here = CHAPTERS[i];
  if (here != null && isWalkable(here)) {
    return here;
  }
  const walkable = CHAPTERS.filter(isWalkable);
  return walkable[walkable.length - 1] ?? CHAPTERS[0]!;
}

/**
 * The chapter whose opening card falls on exactly this stone, if any.
 *
 * Deliberately NOT clamped to what is walkable: this is the announcement, and
 * a chapter has to be announceable before it is finished — the card at the
 * tenth stone is how a child learns there is more road, whether or not it has
 * been built yet. `isWalkable` decides what happens when they press Enter.
 */
export function chapterDueAt(stones: number): Chapter | null {
  return (
    CHAPTERS.find((c) => chapterOpensAt(c) === Math.max(0, stones)) ?? null
  );
}

/**
 * WHICH LESSON, COUNTED ALONG THE WHOLE ROAD.
 *
 * Lesson n starts at Milestone n-1, so a child with four stones is on Lesson
 * 5 — and one with fourteen is on Lesson 15. The numbering is CONTINUOUS
 * across chapters: Chapter 1 is Lessons 1 to 10 and Chapter 2 is Lessons 11
 * to 20, which is how the reference documents are written, how the
 * milestones are carved, and how it is talked about.
 *
 * I had this counting within the chapter, on the reasoning that a child
 * counts from the start of the thing they are in. That was wrong about this
 * road: the milestones do not reset at the chapter line — Milestone 14 is
 * Milestone 14 — so a chip reading "Lesson 4" beside a stone reading 14
 * disagrees with the thing the child is standing next to.
 */
export function lessonAtStones(stones: number): number {
  const total = CHAPTERS.reduce((n, c) => n + c.lessons.length, 0);
  return Math.min(Math.max(1, total), Math.max(0, stones) + 1);
}

/**
 * Where that lesson sits in its own chapter's table, 0-based.
 *
 * The number a child reads runs 1..20; the table it is looked up in runs
 * 0..9 twice. This is the one place that conversion happens.
 */
export function lessonIndexAt(stones: number): number {
  const c = chapterAt(stones);
  const within = Math.max(0, stones) - (c.n - 1) * CHAPTER_STONES;
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
 * `?lesson=14` → Chapter 2, Lesson 4.
 *
 * THE FLAG COUNTS ALONG THE WHOLE ROAD, because that is how the reference
 * documents talk: Chapter 2 is "Lesson 11 through Lesson 20", and a reviewer
 * reading the brief and wanting to look at the river types the number in
 * front of them. The scoreboard still counts within the chapter — those are
 * different audiences and it is worth them disagreeing.
 *
 * Null for anything that is not a real lesson of a real chapter.
 */
export function addressLesson(
  n: number,
): { readonly chapter: Chapter; readonly lesson: number } | null {
  if (!Number.isInteger(n) || n < 1 || n > CHAPTER_STONES * CHAPTERS.length) {
    return null;
  }
  const chapter = CHAPTERS[Math.floor((n - 1) / CHAPTER_STONES)];
  if (chapter == null || !isWalkable(chapter)) {
    return null;
  }
  return { chapter, lesson: ((n - 1) % CHAPTER_STONES) + 1 };
}

/** The key under which "this child has been shown that card" is remembered. */
export function chapterSeenKey(c: Chapter): string {
  return `chapter:${c.n}`;
}
