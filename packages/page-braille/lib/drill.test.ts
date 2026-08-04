import { test } from "node:test";
import { cellsForText, keyOfCell, LETTERS } from "@keylearn/braille";
import { equal, isFalse, isNotNull, isNull, isTrue } from "rich-assert";
import {
  emptyTally,
  goalAnnouncement,
  goalProgress,
  lineResult,
  shouldScore,
  showHint,
  wordToAnnounce,
} from "./drill.ts";
import { makeLesson } from "./lesson.ts";

/** A lesson built straight from text, bypassing the generator. */
function lessonOf(text: string) {
  const steps = cellsForText(text);
  const words: { text: string; from: number; to: number }[] = [];
  let from = 0;
  let current = "";
  for (let i = 0; i < steps.length; i++) {
    const ch = text[steps[i].at];
    if (ch === " ") {
      if (current !== "") words.push({ text: current, from, to: i });
      from = i + 1;
      current = "";
    } else {
      current += ch;
    }
  }
  if (current !== "") words.push({ text: current, from, to: steps.length });
  return { text, steps, words };
}

// ---- announcing ------------------------------------------------------------

test("short words are announced, which read-ahead alone could never do", () => {
  // Read-ahead only fires with two cells left in the current word, so a
  // one- or two-cell word can never trigger it — and "a", "be", "if", "is",
  // "it" are most of the early vocabulary. A learner in listening mode heard
  // the chime, then the space cue, then silence, in front of a word they had
  // no way to see.
  const lesson = lessonOf("a be it cab");
  for (const word of lesson.words) {
    const announced = wordToAnnounce(lesson, word.from, -1);
    isNotNull(announced, `"${word.text}" is never announced`);
    equal(announced!.text, word.text);
  }
});

test("nothing is announced part-way through a word", () => {
  const lesson = lessonOf("cab dad");
  isNull(wordToAnnounce(lesson, 1, -1), "mid-word");
  isNull(wordToAnnounce(lesson, 2, -1), "mid-word");
});

test("a word the read-ahead already spoke is not said twice", () => {
  const lesson = lessonOf("cab dad");
  const second = lesson.words[1];
  isNull(wordToAnnounce(lesson, second.from, second.from));
  isNotNull(wordToAnnounce(lesson, second.from, -1));
});

test("the space between words announces nothing of its own", () => {
  const lesson = lessonOf("cab dad");
  // The step at index 3 is the blank cell; it belongs to no word.
  isNull(wordToAnnounce(lesson, lesson.words[0].to, -1));
});

// ---- the line summary ------------------------------------------------------

test("the summary describes the line, not the session", () => {
  // It used to be built from the session totals, so the tenth line of a
  // session reported the accuracy of all ten — and a learner who had just
  // typed a clean line was told they were at eighty percent.
  const clean = lineResult(
    { hits: 30, misses: 0, startedAt: 1_000_000 },
    1_000_000 + 60_000,
  );
  equal(clean.accuracy, 100);
  equal(clean.cpm, 30);
});

test("accuracy and pace are rounded, not invented", () => {
  const r = lineResult({ hits: 9, misses: 1, startedAt: 1000 }, 1000 + 30_000);
  equal(r.accuracy, 90);
  equal(r.cpm, 18, "nine cells in half a minute");
});

test("a line too short to time reports no pace rather than a fantasy", () => {
  const r = lineResult({ hits: 3, misses: 0, startedAt: 1000 }, 1100);
  equal(r.cpm, 0, "a tenth of a second is not evidence of a rate");
  equal(r.accuracy, 100);
});

test("a line with nothing in it does not divide by zero", () => {
  const r = lineResult(emptyTally, 5000);
  equal(r.cpm, 0);
  equal(r.accuracy, 100);
});

// ---- backspace -------------------------------------------------------------

test("a cell is scored once, however many times it is redone", () => {
  // Backspace steps back over a cell whose result is already in the engine.
  // Without this the quickest way to settle a cell was to enter it, delete it
  // and enter it again, on repeat.
  const scored = new Set<number>();
  isTrue(shouldScore(scored, 4));
  scored.add(4);
  isFalse(shouldScore(scored, 4), "the redo must not count again");
  isTrue(shouldScore(scored, 5), "but the next cell still does");
});

// ---- fading hints ----------------------------------------------------------

const stepFor = (letter: string) => cellsForText(letter)[0];
const never = () => false;
const always = () => true;

test("help withdraws from a cell once it has settled", () => {
  // Otherwise the board answers its own question on every cell for ever, and
  // somebody can finish the whole curriculum by copying lit keys without
  // recalling a single chord.
  const c = stepFor("c");
  isTrue(showHint("auto", c, never, keyOfCell), "still learning it");
  isFalse(showHint("auto", c, always, keyOfCell), "knows it now");
});

test("the two manual settings override the fading", () => {
  const c = stepFor("c");
  isTrue(showHint("on", c, always, keyOfCell));
  isFalse(showHint("off", c, never, keyOfCell));
});

test("a cell with no key of its own keeps its help", () => {
  // It has no evidence to fade on, so fading it would silently make it the
  // hardest thing on the page.
  isTrue(showHint("auto", { cell: 0b111111, at: 0 }, always, () => null));
});

test("the very end of a line asks for nothing", () => {
  isTrue(showHint("auto", null, always, keyOfCell));
});

test("every letter of the alphabet can fade", () => {
  for (const [letter] of LETTERS) {
    const step = stepFor(letter);
    isFalse(
      showHint("auto", step, always, keyOfCell),
      `${letter} never stops being hinted`,
    );
  }
});

test("a generated lesson announces its first word", () => {
  // The end-to-end version of the first test, through the real generator.
  const lesson = makeLesson(
    { unlocked: () => [..."abcde"], weakest: () => null } as never,
    4,
  );
  isNotNull(wordToAnnounce(lesson, 0, -1));
});

// ---- the daily goal --------------------------------------------------------

test("the goal measures practising, not the tab being open", () => {
  // Eleven minutes of counted joins is eleven minutes. A page left open on a
  // desk contributes nothing, which is the entire point of taking the figure
  // from the engine's own timings rather than from a wall clock.
  const g = goalProgress(11 * 60_000, 15);
  equal(g.done, 11);
  equal(g.total, 15);
  equal(g.left, 4);
  isFalse(g.reached);
});

test("passing the goal is not the end of anything", () => {
  const g = goalProgress(40 * 60_000, 15);
  isTrue(g.reached);
  equal(g.left, 0, "never negative, and never a reason to stop");
  equal(g.done, 40, "the extra still counts");
});

test("no goal set asks for nothing", () => {
  const g = goalProgress(9 * 60_000, 0);
  equal(g.total, 0);
  isFalse(g.reached);
  equal(goalAnnouncement(0, 60 * 60_000, 0), null, "and never speaks");
});

test("the goal is remarked on at a crossing and nowhere else", () => {
  // A line is around half a minute. Saying the time after every one is a voice
  // interrupting every thirty seconds with a number that has barely moved —
  // on a page where the voice is the only channel, that is nagging.
  const goal = 20;
  const min = (n: number) => n * 60_000;
  equal(goalAnnouncement(min(2), min(3), goal), null, "an ordinary line");
  equal(goalAnnouncement(min(9), min(11), goal), "half");
  equal(goalAnnouncement(min(11), min(13), goal), null, "already said");
  equal(goalAnnouncement(min(19), min(21), goal), "done");
  equal(goalAnnouncement(min(21), min(30), goal), null, "and said once");
});

test("a long line that jumps both thresholds reports arriving", () => {
  // Reaching the goal is the better thing to say of the two.
  equal(goalAnnouncement(0, 20 * 60_000, 20), "done");
});

test("time that somehow runs backwards does not report anything", () => {
  equal(goalAnnouncement(20 * 60_000, 0, 20), null);
  equal(goalProgress(-5000, 15).done, 0);
});
