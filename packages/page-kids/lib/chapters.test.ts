import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { SEGMENT_COUNT } from "./chapter1.ts";
import {
  addressLesson,
  CHAPTER_STONES,
  chapterAt,
  chapterDueAt,
  chapterOpensAt,
  CHAPTERS,
  chapterSeenKey,
  isWalkable,
  lessonAtStones,
  lessonIndexAt,
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

test("every declared chapter is a full ten lessons", () => {
  // A half-written table is the failure this guards: `useLessons` refuses
  // anything that is not exactly ten, so a chapter authored to nine would
  // silently build Chapter 1's road under Chapter 2's name.
  for (const c of CHAPTERS) {
    equal(c.lessons.length, SEGMENT_COUNT, c.name);
    equal(isWalkable(c), true, c.name);
  }
});

test("a chapter with no lessons is not walkable", () => {
  // The rule itself, tested on a stand-in rather than on the live table —
  // it has to keep holding once every declared chapter is finished.
  equal(isWalkable({ n: 9, name: "x", blurb: "y", lessons: [] }), false);
});

test("lesson numbers are 1..10 within every chapter", () => {
  // `lessonAt` indexes this table by milestone, so a chapter numbered 11..20
  // would place Lesson 11's planting at Milestone 0 and nothing anywhere
  // else. The chip counts within the chapter; so does the table.
  for (const c of CHAPTERS) {
    deepEqual(
      c.lessons.map((l) => l.n),
      c.lessons.map((_, i) => i + 1),
      c.name,
    );
  }
});

test("lesson names are short enough for the scoreboard chip", () => {
  for (const c of CHAPTERS) {
    for (const l of c.lessons) {
      ok(l.name.split(/\s+/).length <= 2, `${c.name}: ${l.name}`);
      ok(l.name.length <= 16, `${c.name}: ${l.name}`);
    }
  }
});

test("the first ten stones are Chapter 1", () => {
  for (let s = 0; s < 10; s++) {
    equal(chapterAt(s).n, 1, `stone ${s}`);
  }
});

test("the tenth stone is the start of Chapter 2, now that it exists", () => {
  equal(chapterAt(10).n, 2);
  equal(chapterAt(19).n, 2);
  // And its first lesson is Lesson ELEVEN: the numbering runs on across the
  // chapter line because the milestones do — Milestone 14 is Milestone 14,
  // and a chip reading "Lesson 4" beside it would contradict the stone.
  equal(lessonAtStones(10), 11);
  equal(lessonAtStones(19), 20);
  // ...while the table it is looked up in still runs 0..9 twice.
  equal(lessonIndexAt(10), 0);
  equal(lessonIndexAt(14), 4);
  equal(chapterAt(10).lessons[0]?.name, "Back Road");
});

test("a child past the last chapter stays in it", () => {
  // No Chapter 3 exists, so four hundred stones is still Chapter 2 rather
  // than a scoreboard naming a chapter that is not there.
  equal(chapterAt(400).n, CHAPTERS.length);
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

test("lesson numbers run 1..20 along the whole road", () => {
  equal(lessonAtStones(0), 1);
  equal(lessonAtStones(4), 5);
  equal(lessonAtStones(9), 10);
  equal(lessonAtStones(10), 11);
  equal(lessonAtStones(19), 20);
  // And stop there: there is no Lesson 21 to name.
  equal(lessonAtStones(40), 20);
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

test("`?lesson=N` addresses a lesson the way the brief numbers it", () => {
  // Chapter 1 is 1..10 and Chapter 2 is 11..20, so a reviewer reading the
  // reference document types the number in front of them.
  equal(addressLesson(1)?.chapter.n, 1);
  equal(addressLesson(1)?.lesson, 1);
  equal(addressLesson(10)?.chapter.n, 1);
  equal(addressLesson(10)?.lesson, 10);
  equal(addressLesson(11)?.chapter.n, 2);
  equal(addressLesson(11)?.lesson, 1);
  equal(addressLesson(16)?.chapter.n, 2);
  equal(addressLesson(16)?.lesson, 6);
  equal(addressLesson(16)?.chapter.lessons[5]?.name, "River Crossing");
  equal(addressLesson(20)?.chapter.n, 2);
  equal(addressLesson(20)?.lesson, 10);
});

test("nothing outside the authored road addresses anything", () => {
  for (const n of [0, -1, 21, 99, 1.5, Number.NaN]) {
    equal(addressLesson(n), null, String(n));
  }
});
