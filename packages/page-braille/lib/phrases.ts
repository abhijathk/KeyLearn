/**
 * What the page says, expressed as clip ids rather than as sentences.
 *
 * The ids are the stable thing, not the wording: a phrase can be reworded, or
 * translated, without the recordings going stale, because the caller says which
 * sounds it means rather than handing over a sentence to be matched.
 *
 * Deliberately free of the audio assets, so this is testable in node — the
 * player that actually loads the `.m4a` files lives next door in `clips.ts`.
 */

//
// The ids are the stable thing, not the wording: a phrase can be reworded, or
// translated, without the recordings going stale, because the caller says which
// sounds it means rather than handing over a sentence to be matched.

const DIGITS = (n: number): readonly string[] =>
  [...String(Math.max(0, Math.round(n)))].map((d) => `digit-${d}`);

/** A single letter, or the word "space". */
export function clipsForChar(ch: string): readonly string[] {
  if (ch === " ") {
    return ["space"];
  }
  const lower = ch.toLowerCase();
  if (lower >= "a" && lower <= "z") {
    return [`letter-${lower}`];
  }
  if (ch >= "0" && ch <= "9") {
    return [`digit-${ch}`];
  }
  return [];
}

/**
 * A lesson word, spelled out.
 *
 * There is no recording of "children" and there cannot be one — the word list
 * is open. Spelling it is both the only option and, for somebody building the
 * word cell by cell, the reading they actually need.
 */
export function clipsForWord(word: string): readonly string[] {
  const out: string[] = [];
  for (const ch of word) {
    const clips = clipsForChar(ch);
    if (clips.length === 0) {
      return []; // A mark with no recording; let something else say it.
    }
    out.push(...clips);
  }
  return out;
}

/** "dots 1 4. Try again." — or "blank. Try again." */
export function clipsForWrongEntry(dots: readonly number[]): readonly string[] {
  return dots.length === 0
    ? ["blank", "try-again"]
    : ["dots", ...dots.map((d) => `digit-${d}`), "try-again"];
}

/**
 * What each cell past the alphabet is called.
 *
 * Keyed by the spoken name rather than by the character, because that is what
 * `readCell` hands over — and because the character is exactly the thing that
 * cannot be spoken: a full stop reaches an engine as a pause, or as nothing.
 */
const NAMED: Readonly<Record<string, string>> = {
  "full stop": "mark-full-stop",
  "comma": "mark-comma",
  "question mark": "mark-question-mark",
  "apostrophe": "mark-apostrophe",
  "exclamation mark": "mark-exclamation-mark",
  "hyphen": "mark-hyphen",
  "semicolon": "mark-semicolon",
  "colon": "mark-colon",
  "capital sign": "sign-capital",
  "number sign": "sign-number",
  "space": "space",
  "space bar": "space",
};

/** The cell being asked for: its name, then its dots. */
export function clipsForCell(
  name: string,
  dots: readonly number[],
): readonly string[] {
  const head =
    name.length === 1
      ? clipsForChar(name)
      : NAMED[name] != null
        ? [NAMED[name]]
        : [];
  if (head.length === 0) {
    return [];
  }
  return dots.length === 0
    ? head
    : [...head, "dots", ...dots.map((d) => `digit-${d}`)];
}

/** "That is the whole alphabet…" */
export const ALPHABET_DONE: readonly string[] = ["alphabet-done"];

/** "9 minutes of practice today." and its two longer forms. */
export function clipsForGoalSpoken({
  done,
  total,
  left,
  reached,
}: {
  readonly done: number;
  readonly total: number;
  readonly left: number;
  readonly reached: boolean;
}): readonly string[] {
  if (total === 0) {
    return [...DIGITS(done), "minutes-today"];
  }
  if (reached) {
    return [...DIGITS(done), "minutes-today", "goal-passed"];
  }
  return [
    ...DIGITS(done),
    "goal-of",
    ...DIGITS(total),
    "minutes-today",
    ...DIGITS(left),
    "minutes-to-go",
  ];
}

/** "Halfway to today's goal: 6 minutes to go." */
export function clipsForGoalHalf(left: number): readonly string[] {
  return ["goal-halfway", ...DIGITS(left), "minutes-to-go"];
}

/** "15 minutes of practice today. That is your goal passed…" */
export function clipsForGoalReached(total: number): readonly string[] {
  return [...DIGITS(total), "minutes-today", "goal-passed"];
}

/** "Line done. 42 cells a minute, 97 percent accurate." */
export function clipsForSummary(
  cpm: number,
  accuracy: number,
): readonly string[] {
  return [
    "line-done",
    ...DIGITS(cpm),
    "cells-a-minute",
    ...DIGITS(accuracy),
    "percent-accurate",
  ];
}

/** "New line, 8 words." */
export function clipsForNewLine(words: number): readonly string[] {
  return ["new-line", ...DIGITS(words), "words"];
}
