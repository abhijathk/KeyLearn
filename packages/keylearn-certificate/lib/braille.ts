// Text as braille cells, for printing on a braille learner's certificate.
//
// Unified English Braille grade 1 — uncontracted, which is the code this app
// actually teaches. A grade 2 contraction the learner has never met would be
// unreadable to the one person the braille is for.

/** Dots are numbered 1–3 down the left column and 4–6 down the right. */
export type BrailleCell = readonly number[];

const CELLS: Readonly<Record<string, readonly number[]>> = {
  "a": [1],
  "b": [1, 2],
  "c": [1, 4],
  "d": [1, 4, 5],
  "e": [1, 5],
  "f": [1, 2, 4],
  "g": [1, 2, 4, 5],
  "h": [1, 2, 5],
  "i": [2, 4],
  "j": [2, 4, 5],
  "k": [1, 3],
  "l": [1, 2, 3],
  "m": [1, 3, 4],
  "n": [1, 3, 4, 5],
  "o": [1, 3, 5],
  "p": [1, 2, 3, 4],
  "q": [1, 2, 3, 4, 5],
  "r": [1, 2, 3, 5],
  "s": [2, 3, 4],
  "t": [2, 3, 4, 5],
  "u": [1, 3, 6],
  "v": [1, 2, 3, 6],
  "w": [2, 4, 5, 6],
  "x": [1, 3, 4, 6],
  "y": [1, 3, 4, 5, 6],
  "z": [1, 3, 5, 6],
  ".": [2, 5, 6],
  ",": [2],
  "?": [2, 3, 6],
  "'": [3],
  "!": [2, 3, 5],
  "-": [3, 6],
  ";": [2, 3],
  ":": [2, 5],
  " ": [],
};

/** Dot 6 before a letter, which is how a capital is written. */
export const CAPITAL_SIGN: readonly number[] = [6];

/** Dots 3-4-5-6 before a digit, which is how a number is written. */
export const NUMBER_SIGN: readonly number[] = [3, 4, 5, 6];

const DIGITS = "jabcdefghi"; // 0 is j, 1 is a, and so on

/**
 * The cells for a string.
 *
 * Digits carry the number sign, capitals the capital sign, and anything the
 * curriculum does not teach is dropped rather than guessed at — a cell nobody
 * was taught is noise under the fingers.
 */
export function brailleCells(text: string): readonly BrailleCell[] {
  const out: BrailleCell[] = [];
  let inNumber = false;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      if (!inNumber) {
        out.push(NUMBER_SIGN);
        inNumber = true;
      }
      out.push(CELLS[DIGITS[Number(ch)]]);
      continue;
    }
    // The number sign runs until a space or any non-digit, so it has to be
    // cleared here rather than only on a space.
    inNumber = false;
    if (ch >= "A" && ch <= "Z") {
      out.push(CAPITAL_SIGN);
    }
    const cell = CELLS[ch.toLowerCase()];
    if (cell != null) {
      out.push(cell);
    }
  }
  return out;
}

/**
 * Physical geometry, in millimetres.
 *
 * These are the figures an embosser expects. They are the reason a certificate
 * carrying braille has to be a fixed-size PDF printed at 100% — "fit to page"
 * rescales the sheet and the dot pitch with it, and braille at 94% of size is
 * not braille, it is a pattern of bumps.
 */
export const BRAILLE_MM = {
  /** Between dot centres within a cell, both directions. */
  dotPitch: 2.5,
  /** Between the left edges of adjacent cells. */
  cellPitch: 6.2,
  /** Between the top dots of adjacent lines. */
  linePitch: 10,
  dotDiameter: 1.5,
} as const;

/**
 * Mirrored right-to-left, for embossing from the back with a slate and stylus.
 *
 * Whoever punches from the back writes in reverse, so a front-view guide comes
 * out backwards. This is the classic way a well-meant braille feature produces
 * gibberish, and it is why the download offers both.
 */
export function mirrorCells(
  cells: readonly BrailleCell[],
): readonly BrailleCell[] {
  // Within a cell, the columns swap too: dots 1-2-3 become 4-5-6.
  const swap = (n: number) => (n <= 3 ? n + 3 : n - 3);
  return [...cells]
    .reverse()
    .map((cell) => cell.map(swap).sort((a, b) => a - b));
}
