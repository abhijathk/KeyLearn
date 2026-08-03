import {
  cellsForText,
  type CellStep,
  dotsOf,
  generateLine,
  LETTERS,
  type Progress,
} from "@keylearn/braille";

/**
 * A line of practice, described in the units each mode needs.
 *
 * The visual board wants cells and printed characters. Dictation wants words —
 * the word is how a person thinks about typing, it is a manageable amount to
 * hold in mind, and it is the unit braille transcription practice actually
 * uses. Neither a whole line (too much to remember) nor a single letter
 * (nobody types that way) works as the thing you are told to write.
 */
export type Word = {
  readonly text: string;
  /** First step of this word, inclusive. */
  readonly from: number;
  /** Last step of this word, exclusive. */
  readonly to: number;
};

export type Lesson = {
  readonly text: string;
  readonly steps: readonly CellStep[];
  readonly words: readonly Word[];
};

export function makeLesson(progress: Progress, count = 8): Lesson {
  const text = generateLine(progress, { words: count });
  const steps = cellsForText(text);
  const words: Word[] = [];
  let from = 0;
  let current = "";
  for (let i = 0; i < steps.length; i++) {
    const ch = text[steps[i].at];
    if (ch === " ") {
      if (current !== "") {
        words.push({ text: current, from, to: i });
      }
      // The space is its own step and belongs to no word; the next word starts
      // after it.
      from = i + 1;
      current = "";
    } else {
      current += ch;
    }
  }
  if (current !== "") {
    words.push({ text: current, from, to: steps.length });
  }
  return { text, steps, words };
}

/** The word containing this step, or null when the step is a space. */
export function wordAt(lesson: Lesson, step: number): Word | null {
  return lesson.words.find((w) => step >= w.from && step < w.to) ?? null;
}

/**
 * How a cell is described aloud.
 *
 * Someone who already reads braille knows the letter, so the letter leads and
 * the dots follow — enough for a learner still building the chord, ignorable
 * for everyone else.
 */
export function describeCell(text: string, step: CellStep): string {
  const { name, dots } = readCell(text, step);
  return dots.length === 0 ? name : `${name}, dots ${dots.join(" ")}`;
}

/**
 * The same description, before it is flattened into a sentence.
 *
 * Speech needs the sentence; the on-screen prompt needs the parts, so it can
 * set the letter and its dot numbers as separate things rather than printing
 * the phrase written for a voice.
 */
export type CellDescription = {
  /** What to call this cell: a letter, or the name of a signal cell. */
  readonly name: string;
  /** Which dots it is made of; empty for a cell that is not typed as dots. */
  readonly dots: readonly number[];
};

export function readCell(text: string, step: CellStep): CellDescription {
  const ch = text[step.at];
  const dots = dotsOf(step.cell);
  if (ch === " ") {
    return { name: "space", dots: [] };
  }
  if (dots.length === 0) {
    return { name: "space bar", dots: [] };
  }
  const name =
    LETTERS.get(ch.toLowerCase()) === step.cell
      ? ch
      : ch >= "0" && ch <= "9"
        ? "number sign"
        : ch !== ch.toLowerCase()
          ? "capital sign"
          : ch;
  return { name, dots };
}

/** Spells a word for the "say it letter by letter" help level. */
export function spellOut(word: string): string {
  return [...word].join(", ");
}
