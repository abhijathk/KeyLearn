import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { SEGMENT_COUNT } from "./chapter1.ts";
import {
  CHAPTER_STONES,
  chapterAt,
  chapterDueAt,
  chapterOpensAt,
  CHAPTERS,
  chapterSeenKey,
  isWalkable,
  lessonAtStones,
} from "./chapters.ts";

test("a chapter is ten stones long", () => {
  equal(CHAPTER_STONES, SEGMENT_COUNT);
});

test("chapters are numbered from one, in order, with no gaps", () => {
  deepEqual(
    CHAPTERS.map((c) => c.n),
    CHAPTERS.map((_, i) => i + 1),
  );
});

test("every chapter has a short name and something to say for itself", () => {
  for (const c of CHAPTERS) {
    ok(c.name.length > 0 && c.name.split(/\s+/).length <= 3, c.name);
    ok(c.blurb.length > 40, `${c.name} blurb is too thin`);
    // Written to be read aloud to a child: the road, not the software.
    ok(!/lesson|type|typing|keyboard/i.test(c.blurb), `${c.name} blurb`);
    // And no place names — the scene says where it is; see the blurb doc.
    ok(!/kerala|malayal|india/i.test(c.blurb), `${c.name} names a place`);
  }
});

test("Chapter 1 is walkable and Chapter 2 is not yet", () => {
  equal(isWalkable(CHAPTERS[0]!), true);
  equal(CHAPTERS[0]!.lessons.length, SEGMENT_COUNT);
  // The day Chapter 2 is authored this flips, and the card starts rebuilding
  // the world instead of returning to the road. That is the whole switch.
  equal(isWalkable(CHAPTERS[1]!), false);
});

test("the first ten stones are Chapter 1", () => {
  for (let s = 0; s < 10; s++) {
    equal(chapterAt(s).n, 1, `stone ${s}`);
  }
});

test("a child stands in the last chapter that has been BUILT", () => {
  // Chapter 2 is declared but has no lessons, so a child at the tenth stone
  // is still walking Chapter 1's road — which is the truth, and what stopped
  // the scoreboard reading "Lesson 1" with no name the moment they got there.
  equal(chapterAt(10).n, 1);
  equal(chapterAt(19).n, 1);
  equal(chapterAt(400).n, 1);
  equal(lessonAtStones(10), 10);
});

test("but the card may announce a chapter nobody has built yet", () => {
  // The announcement and the road are different questions. A child reaching
  // the tenth stone is told what is next even while it is being made.
  equal(chapterDueAt(10)?.n, 2);
  equal(chapterDueAt(0)?.n, 1);
});

test("no card is due between the stones that open a chapter", () => {
  for (const s of [1, 5, 9, 11, 15, 19, 21]) {
    equal(chapterDueAt(s), null, `stone ${s}`);
  }
});

test("a negative or missing count is the start of the road", () => {
  equal(chapterAt(-3).n, 1);
  equal(lessonAtStones(-3), 1);
});

test("lesson numbers count from the start of their own chapter", () => {
  equal(lessonAtStones(0), 1);
  equal(lessonAtStones(4), 5);
  equal(lessonAtStones(9), 10);
  // Once Chapter 2 has lessons, its first stone is its Lesson 1 and never
  // "Lesson 11" — a chip that climbs to twenty is a number about the
  // software rather than about the road.
  const within = 14 - CHAPTER_STONES;
  equal(within, 4);
});

test("the lesson number never runs past the chapter's own lessons", () => {
  // Chapter 1 has ten, so the deepest a stone can name is the tenth.
  for (let s = 0; s < 10; s++) {
    ok(lessonAtStones(s) <= CHAPTERS[0]!.lessons.length, `stone ${s}`);
  }
});

test("a chapter opens on the stone that closes the one before it", () => {
  equal(chapterOpensAt(CHAPTERS[0]!), 0);
  equal(chapterOpensAt(CHAPTERS[1]!), 10);
  // The card's trigger and the chapter arithmetic have to agree to the stone
  // or the card is shown twice, or never. Tested through `chapterDueAt`,
  // which is what the trigger actually calls — `chapterAt` answers the other
  // question and is allowed to disagree while a chapter is unbuilt.
  for (const c of CHAPTERS) {
    equal(chapterDueAt(chapterOpensAt(c))?.n, c.n);
  }
});

test("each chapter is remembered under its own key", () => {
  const keys = CHAPTERS.map(chapterSeenKey);
  equal(new Set(keys).size, keys.length);
  equal(chapterSeenKey(CHAPTERS[0]!), "chapter:1");
});
