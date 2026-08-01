/**
 * The adaptive layer: which cells a learner is working on, and which one is
 * holding them up.
 *
 * Same shape as the typing engine, with the atoms changed. A cell is what a
 * letter is there — something you can be measurably fast or slow at — and the
 * difficulty lives in the joins, so the pair of cells is what the bigram is
 * there. Cells arrive one at a time, and a new one only once the ones already
 * in play are quick enough that adding to the load is fair.
 */
import { type Cell, LETTERS } from "./cell.ts";

/** What has been recorded about one cell. */
export type CellStat = {
  /** How many times it has been entered correctly. */
  readonly hits: number;
  /** How many times a different cell was entered instead. */
  readonly misses: number;
  /** Best time from the previous cell to this one, in milliseconds. */
  readonly bestMs: number | null;
  /** Recent times, newest last, used for the working estimate. */
  readonly recentMs: readonly number[];
};

const EMPTY: CellStat = { hits: 0, misses: 0, bestMs: null, recentMs: [] };

/** How many recent samples the working estimate is drawn from. */
const WINDOW = 8;

/**
 * The order cells are introduced.
 *
 * Braille is taught in its decades and this follows that: a–j is the base
 * pattern, k–t repeats it with dot 3, u–z with dots 3 and 6. A learner who
 * already reads braille recognises the structure immediately, and it means the
 * hardest chords are not the first thing anyone meets.
 */
export const TEACHING_ORDER: readonly string[] = [
  ..."abcdefghij",
  ..."klmnopqrst",
  ..."uvxyzw",
];

/** Cells in play before anything has been recorded. */
export const STARTING_CELLS = 5;

export type Target = {
  /** The pace a cell must reach before another is added, in milliseconds. */
  readonly msPerCell: number;
};

export const defaultTarget: Target = { msPerCell: 1500 };

export class Progress {
  readonly #stats = new Map<string, CellStat>();

  /** Everything recorded so far, for persistence. */
  toJSON(): Record<string, CellStat> {
    return Object.fromEntries(this.#stats);
  }

  static fromJSON(data: unknown): Progress {
    const p = new Progress();
    if (data != null && typeof data === "object") {
      for (const [letter, stat] of Object.entries(
        data as Record<string, CellStat>,
      )) {
        if (LETTERS.has(letter) && stat != null) {
          p.#stats.set(letter, {
            hits: Number(stat.hits) || 0,
            misses: Number(stat.misses) || 0,
            bestMs: stat.bestMs == null ? null : Number(stat.bestMs),
            recentMs: Array.isArray(stat.recentMs)
              ? stat.recentMs.slice(-WINDOW).map(Number)
              : [],
          });
        }
      }
    }
    return p;
  }

  statOf(letter: string): CellStat {
    return this.#stats.get(letter) ?? EMPTY;
  }

  /** Records a correct entry and how long it took from the previous cell. */
  hit(letter: string, ms: number): void {
    const s = this.statOf(letter);
    this.#stats.set(letter, {
      hits: s.hits + 1,
      misses: s.misses,
      bestMs: s.bestMs == null ? ms : Math.min(s.bestMs, ms),
      recentMs: [...s.recentMs, ms].slice(-WINDOW),
    });
  }

  /** Records a wrong cell entered where this one was wanted. */
  miss(letter: string): void {
    const s = this.statOf(letter);
    this.#stats.set(letter, { ...s, misses: s.misses + 1 });
  }

  /**
   * How this cell is going, from 0 to 1.
   *
   * Speed against the target, scaled by accuracy — a cell entered fast but
   * wrongly half the time is not learned, and treating it as learned would
   * hand the learner a new one while they are still guessing at this.
   */
  confidence(letter: string, target: Target = defaultTarget): number {
    const s = this.statOf(letter);
    if (s.recentMs.length === 0) {
      return 0;
    }
    const mean = s.recentMs.reduce((a, b) => a + b, 0) / s.recentMs.length;
    const speed = Math.min(1, target.msPerCell / Math.max(1, mean));
    const total = s.hits + s.misses;
    const accuracy = total === 0 ? 0 : s.hits / total;
    return Math.max(0, Math.min(1, speed * accuracy));
  }

  /** True once a cell has enough evidence behind it to count as settled. */
  isSettled(letter: string, target: Target = defaultTarget): boolean {
    // Three clean entries is the least that distinguishes learning from luck.
    return (
      this.statOf(letter).hits >= 3 && this.confidence(letter, target) >= 1
    );
  }

  /**
   * The cells currently in play.
   *
   * Starts with a handful and grows by one whenever every cell already in play
   * has settled — the same rule the typing engine uses, and for the same
   * reason: a new element is a cost, and it should only be paid once the
   * existing ones have stopped costing anything.
   */
  unlocked(target: Target = defaultTarget): readonly string[] {
    let size = STARTING_CELLS;
    while (size < TEACHING_ORDER.length) {
      const inPlay = TEACHING_ORDER.slice(0, size);
      if (!inPlay.every((letter) => this.isSettled(letter, target))) {
        break;
      }
      size += 1;
    }
    return TEACHING_ORDER.slice(0, size);
  }

  /**
   * The cell in play that is going worst, or null when nothing is known yet.
   *
   * A cell never attempted outranks a slow one: the unknown is where the next
   * useful information is, and practising something already measured tells the
   * engine nothing it does not have.
   */
  weakest(target: Target = defaultTarget): string | null {
    const inPlay = this.unlocked(target);
    if (inPlay.length === 0) {
      return null;
    }
    let worst: string | null = null;
    let worstScore = Infinity;
    for (const letter of inPlay) {
      const s = this.statOf(letter);
      const score = s.hits === 0 ? -1 : this.confidence(letter, target);
      if (score < worstScore) {
        worstScore = score;
        worst = letter;
      }
    }
    return worst;
  }
}

/** Convenience for callers that hold cells rather than letters. */
export function letterOfCell(cell: Cell): string | null {
  for (const [letter, value] of LETTERS) {
    if (value === cell) {
      return letter;
    }
  }
  return null;
}
