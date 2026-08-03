/**
 * A braille cell, and the Unified English Braille grade 1 tables.
 *
 * This module is deliberately free of UI and of the practice engine. A wrong
 * entry in these tables teaches somebody the wrong character, so the whole
 * thing is pure data and pure functions, and it is tested against the standard
 * rather than against our own rendering.
 */

/**
 * The six dots of a cell, as a bitmask.
 *
 * ```
 *   1 • • 4
 *   2 • • 5
 *   3 • • 6
 * ```
 *
 * Dot n sets bit (n - 1), which is the same ordering Unicode uses for the
 * braille patterns block — so a cell converts to its character by addition
 * alone.
 */
export type Cell = number;

export const DOT_1 = 0b000001;
export const DOT_2 = 0b000010;
export const DOT_3 = 0b000100;
export const DOT_4 = 0b001000;
export const DOT_5 = 0b010000;
export const DOT_6 = 0b100000;

/** The empty cell — braille's space. */
export const BLANK: Cell = 0;

/** U+2800 BRAILLE PATTERN BLANK; the block is laid out by the same bitmask. */
const UNICODE_BASE = 0x2800;

/** Builds a cell from dot numbers, e.g. `dots(1, 2, 5)`. */
export function dots(...list: readonly number[]): Cell {
  let cell = 0;
  for (const dot of list) {
    if (dot < 1 || dot > 6) {
      throw new RangeError(`Not a dot: ${dot}`);
    }
    cell |= 1 << (dot - 1);
  }
  return cell;
}

/** The dot numbers set in a cell, ascending. */
export function dotsOf(cell: Cell): readonly number[] {
  const list: number[] = [];
  for (let dot = 1; dot <= 6; dot++) {
    if ((cell & (1 << (dot - 1))) !== 0) {
      list.push(dot);
    }
  }
  return list;
}

/** The Unicode character that draws this cell. */
export function toUnicode(cell: Cell): string {
  return String.fromCodePoint(UNICODE_BASE + (cell & 0b111111));
}

/**
 * Letters a–z.
 *
 * The first ten follow the "braille decade" — a, b, c… built from dots 1, 2, 4
 * and 5 — then k–t repeat that pattern with dot 3 added, and u–z repeat it
 * again with dots 3 and 6, except w, which is an outlier because Louis Braille
 * was working in French, where w was not in common use.
 */
export const LETTERS: ReadonlyMap<string, Cell> = new Map([
  ["a", dots(1)],
  ["b", dots(1, 2)],
  ["c", dots(1, 4)],
  ["d", dots(1, 4, 5)],
  ["e", dots(1, 5)],
  ["f", dots(1, 2, 4)],
  ["g", dots(1, 2, 4, 5)],
  ["h", dots(1, 2, 5)],
  ["i", dots(2, 4)],
  ["j", dots(2, 4, 5)],
  ["k", dots(1, 3)],
  ["l", dots(1, 2, 3)],
  ["m", dots(1, 3, 4)],
  ["n", dots(1, 3, 4, 5)],
  ["o", dots(1, 3, 5)],
  ["p", dots(1, 2, 3, 4)],
  ["q", dots(1, 2, 3, 4, 5)],
  ["r", dots(1, 2, 3, 5)],
  ["s", dots(2, 3, 4)],
  ["t", dots(2, 3, 4, 5)],
  ["u", dots(1, 3, 6)],
  ["v", dots(1, 2, 3, 6)],
  ["w", dots(2, 4, 5, 6)], // the odd one out
  ["x", dots(1, 3, 4, 6)],
  ["y", dots(1, 3, 4, 5, 6)],
  ["z", dots(1, 3, 5, 6)],
]);

/** Punctuation that appears in ordinary prose. */
export const PUNCTUATION: ReadonlyMap<string, Cell> = new Map([
  [",", dots(2)],
  [";", dots(2, 3)],
  [":", dots(2, 5)],
  [".", dots(2, 5, 6)],
  ["?", dots(2, 3, 6)],
  ["!", dots(2, 3, 5)],
  ["'", dots(3)],
  ["-", dots(3, 6)],
  ["(", dots(2, 3, 5, 6)],
  [")", dots(2, 3, 5, 6)],
]);

/**
 * Digits reuse the letters a–j and are introduced by the number sign, so `1` is
 * written as number-sign + a.
 */
export const NUMBER_SIGN: Cell = dots(3, 4, 5, 6);

/** Marks the next letter as a capital. */
export const CAPITAL_SIGN: Cell = dots(6);

const DIGIT_LETTERS = "jabcdefghi"; // index 0 is '0', which reuses 'j'

/**
 * The cells needed to write one character, in order.
 *
 * A capital letter and a digit each need a prefix cell, so this returns a
 * sequence rather than a single cell — the practice engine treats every cell in
 * the sequence as its own keystroke, which is exactly how it is typed.
 *
 * Returns null for a character with no grade 1 representation here, so the
 * caller can skip it rather than teach something wrong.
 */
export function cellsFor(ch: string): readonly Cell[] | null {
  if (ch === " ") {
    return [BLANK];
  }
  const lower = ch.toLowerCase();
  const letter = LETTERS.get(lower);
  if (letter != null) {
    return ch !== lower ? [CAPITAL_SIGN, letter] : [letter];
  }
  if (ch >= "0" && ch <= "9") {
    return [NUMBER_SIGN, LETTERS.get(DIGIT_LETTERS[Number(ch)])!];
  }
  const punctuation = PUNCTUATION.get(ch);
  if (punctuation != null) {
    return [punctuation];
  }
  return null;
}

/**
 * Every cell needed to write a string, with the character each belongs to.
 *
 * The index lets the display keep the print line and the braille line in step:
 * a capital letter occupies two cells but only one printed character, and the
 * highlight has to follow both.
 */
export type CellStep = {
  readonly cell: Cell;
  /** Index into the source text of the character this cell helps write. */
  readonly at: number;
};

export function cellsForText(text: string): readonly CellStep[] {
  const steps: CellStep[] = [];
  for (let at = 0; at < text.length; at++) {
    const cells = cellsFor(text[at]);
    if (cells == null) {
      continue; // Never present a character we cannot write correctly.
    }
    for (const cell of cells) {
      steps.push({ cell, at });
    }
  }
  return steps;
}
