import { type CellStep } from "@keylearn/braille";
import { type Lesson, type Word, wordAt } from "./lesson.ts";
import { type Prefs } from "./prefs.ts";

/**
 * The rules of the drill, apart from the component that runs it.
 *
 * Every one of these was a couple of lines buried in a keydown handler, which
 * is why every one of them was wrong: a word that never got announced, a
 * summary quoting the wrong session, a cell that could be scored twice. They
 * are small enough to state exactly and awkward enough to get wrong, which is
 * the definition of something that should be tested rather than read.
 */

/**
 * The word to announce on arriving at a step, or null when there is nothing to
 * say.
 *
 * `spokenAhead` is the word the read-ahead has already spoken, so it is not
 * said twice. Read-ahead alone was never enough: it can only fire from three
 * cells out, and "a", "be", "if", "is" and "it" — most of the early
 * vocabulary — are shorter than that. A learner in listening mode heard the
 * chime, the space cue, and then nothing at all.
 */
export function wordToAnnounce(
  lesson: Lesson,
  step: number,
  spokenAhead: number,
): Word | null {
  const word = wordAt(lesson, step);
  if (word == null || step !== word.from || spokenAhead === word.from) {
    return null;
  }
  return word;
}

/** What the end-of-line summary reports. */
export type LineTally = {
  readonly hits: number;
  readonly misses: number;
  /** When the first cell of this line was entered; 0 before that. */
  readonly startedAt: number;
};

export const emptyTally: LineTally = { hits: 0, misses: 0, startedAt: 0 };

/**
 * The figures for one line.
 *
 * The line's own, not the session's. The summary used to be built from the
 * session totals, so the tenth line of a session reported the accuracy of all
 * ten — a learner who had just typed a clean line was told they were at eighty
 * percent, by a page whose whole job is telling them how they are doing.
 */
export function lineResult(
  tally: LineTally,
  now: number,
): { readonly cpm: number; readonly accuracy: number } {
  const attempts = tally.hits + tally.misses;
  const minutes = tally.startedAt > 0 ? (now - tally.startedAt) / 60000 : 0;
  return {
    // Below a couple of seconds the rate is arithmetic on noise; a line that
    // fast reports nothing rather than a four-figure fantasy.
    cpm: minutes > 0.02 ? Math.round(tally.hits / minutes) : 0,
    accuracy: attempts === 0 ? 100 : Math.round((tally.hits / attempts) * 100),
  };
}

/**
 * Whether this attempt at a step should count.
 *
 * Backspace steps back over a cell whose result is already in the engine, so
 * without this a learner could enter a cell, delete it and enter it again —
 * and the quickest way to settle a cell was to do exactly that, on repeat.
 */
export function shouldScore(
  scored: ReadonlySet<number>,
  step: number,
): boolean {
  return !scored.has(step);
}

/**
 * Whether the page should still be showing which dots this cell needs.
 *
 * On "auto" the help withdraws cell by cell as each one settles — the same
 * evidence the engine uses to decide the learner is ready for another. Without
 * it the board answered its own question on every cell for ever, so the drill
 * tested copying rather than recall and somebody could reach the end of the
 * curriculum without having memorised a single chord.
 */
export function showHint(
  hints: Prefs["hints"],
  step: CellStep | null,
  isSettled: (key: string) => boolean,
  keyOf: (cell: number) => string | null,
): boolean {
  if (hints !== "auto") {
    return hints === "on";
  }
  if (step == null) {
    return true;
  }
  const key = keyOf(step.cell);
  // A cell with no key of its own has no evidence to fade on, so it keeps its
  // help rather than silently becoming the hardest thing on the page.
  return key == null || !isSettled(key);
}

// ── the daily goal ──────────────────────────────────────────────────────────

export type Goal = {
  /** Minutes practised today, rounded down. */
  readonly done: number;
  /** Minutes being aimed for; 0 when there is no goal. */
  readonly total: number;
  /** Minutes still to go, never below zero. */
  readonly left: number;
  readonly reached: boolean;
};

/**
 * How today is going against the goal.
 *
 * `practisedMs` is time spent *practising* — the sum of the gaps between cells
 * that the engine actually counted — not time with the page open. That
 * distinction is the whole value of the number: a tab left open on a desk is
 * not practice, and a goal measured that way rewards forgetting to close it.
 */
export function goalProgress(practisedMs: number, goalMinutes: number): Goal {
  const done = Math.floor(Math.max(0, practisedMs) / 60000);
  const total = Math.max(0, Math.round(goalMinutes));
  return {
    done,
    total,
    left: Math.max(0, total - done),
    reached: total > 0 && done >= total,
  };
}

/**
 * What, if anything, to say about the goal at the end of a line.
 *
 * Only at a crossing. A line is around half a minute, so remarking on the time
 * after every one is a voice interrupting every thirty seconds with a number
 * that has barely moved — on a page where the voice is the only channel, that
 * is not encouragement, it is nagging. Halfway and arrival are the two moments
 * that mean anything, and each is said once.
 */
export function goalAnnouncement(
  beforeMs: number,
  afterMs: number,
  goalMinutes: number,
): "half" | "done" | null {
  if (goalMinutes <= 0) {
    return null;
  }
  const goalMs = goalMinutes * 60000;
  if (beforeMs < goalMs && afterMs >= goalMs) {
    return "done";
  }
  if (beforeMs < goalMs / 2 && afterMs >= goalMs / 2) {
    return "half";
  }
  return null;
}
