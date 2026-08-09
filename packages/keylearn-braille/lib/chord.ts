/**
 * Six-key (Perkins-style) chord entry on an ordinary keyboard.
 *
 * The home keys stand in for the six dots, mirrored around the gap between the
 * hands so the layout matches the cell:
 *
 * ```
 *   F D S   J K L
 *   1 2 3   4 5 6
 * ```
 *
 * A cell is entered by pressing its dots together and letting go. Order does
 * not matter and cannot matter — the dots of a cell are simultaneous by
 * definition — so the chord accumulates while any key is held and commits when
 * the last one is released.
 */
import { type Cell, DOT_1, DOT_2, DOT_3, DOT_4, DOT_5, DOT_6 } from "./cell.ts";

/** Keyboard codes to dots. `code` is used, not `key`, so the mapping holds on
 * every layout — a Dvorak user's physical home keys are still the six dots. */
export const KEY_TO_DOT: ReadonlyMap<string, number> = new Map([
  ["KeyF", DOT_1],
  ["KeyD", DOT_2],
  ["KeyS", DOT_3],
  ["KeyJ", DOT_4],
  ["KeyK", DOT_5],
  ["KeyL", DOT_6],
]);

/** The space bar writes the blank cell, and is not part of a chord. */
export const SPACE_CODE = "Space";

export type ChordEvent =
  /** A cell was completed and should be scored. */
  | { readonly type: "commit"; readonly cell: Cell }
  /** The held dots changed; useful for showing the cell forming. */
  | { readonly type: "update"; readonly held: Cell };

/**
 * Accumulates key presses into cells.
 *
 * Deliberately a plain object rather than a hook or a component: the timing
 * rules are the fiddly part and they are much easier to reason about — and to
 * test — without a render loop in the way.
 */
export class ChordReader {
  /** Dots currently held down. */
  #held: Cell = 0;
  /** Dots seen at any point during the current chord. */
  #accumulated: Cell = 0;
  /** How many of the six keys are physically down. */
  #down = 0;

  get held(): Cell {
    return this.#held;
  }

  get pending(): Cell {
    return this.#accumulated;
  }

  /** Returns an event when the press changes something, otherwise null. */
  keyDown(code: string): ChordEvent | null {
    if (code === SPACE_CODE) {
      // Space is its own cell and never joins a chord in progress.
      if (this.#down === 0) {
        return { type: "commit", cell: 0 };
      }
      return null;
    }
    const dot = KEY_TO_DOT.get(code);
    if (dot == null) {
      return null;
    }
    if ((this.#held & dot) !== 0) {
      return null; // auto-repeat
    }
    this.#held |= dot;
    this.#accumulated |= dot;
    this.#down += 1;
    return { type: "update", held: this.#held };
  }

  /**
   * Returns a commit once the last dot of the chord is released.
   *
   * Waiting for full release is what makes order irrelevant, and it is also
   * what lets a slow learner build a cell one finger at a time without the
   * system guessing early and marking them wrong.
   */
  keyUp(code: string): ChordEvent | null {
    const dot = KEY_TO_DOT.get(code);
    if (dot == null || (this.#held & dot) === 0) {
      return null;
    }
    this.#held &= ~dot;
    this.#down -= 1;
    if (this.#down > 0) {
      return { type: "update", held: this.#held };
    }
    const cell = this.#accumulated;
    this.#accumulated = 0;
    return cell !== 0 ? { type: "commit", cell } : null;
  }

  /** Drops any chord in progress, e.g. when the window loses focus. */
  reset(): void {
    this.#held = 0;
    this.#accumulated = 0;
    this.#down = 0;
  }
}

/**
 * The largest number of the six dot keys the keyboard registered at once.
 *
 * Many laptop and membrane keyboards cannot report six simultaneous keys —
 * they ghost past two or three. Somebody whose keyboard cannot do it will
 * conclude they are chording wrongly, when in fact the hardware never sent the
 * keys, so this is measured up front and reported plainly.
 */
export class RolloverProbe {
  #held = new Set<string>();
  #best = 0;

  get best(): number {
    return this.#best;
  }

  /** How many of the six keys are down right now. */
  get down(): number {
    return this.#held.size;
  }

  keyDown(code: string): void {
    if (KEY_TO_DOT.has(code)) {
      this.#held.add(code);
      this.#best = Math.max(this.#best, this.#held.size);
    }
  }

  keyUp(code: string): void {
    this.#held.delete(code);
  }

  reset(): void {
    this.#held.clear();
    this.#best = 0;
  }
}

/** Six dots is what braille needs; anything less rules some cells out. */
export const REQUIRED_ROLLOVER = 6;
