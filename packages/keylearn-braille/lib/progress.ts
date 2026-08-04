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
import {
  CAPITAL_SIGN,
  type Cell,
  LETTERS,
  NUMBER_SIGN,
  PUNCTUATION,
} from "./cell.ts";

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
  /**
   * The last few attempts, newest last: true for a hit, false for a miss.
   *
   * Kept separately from the lifetime counts because accuracy has to be able
   * to recover. Judged on the lifetime ratio, a single miss in the first
   * minute is carried for ever — see `confidence`.
   */
  readonly recent: readonly boolean[];
};

const EMPTY: CellStat = {
  hits: 0,
  misses: 0,
  bestMs: null,
  recentMs: [],
  recent: [],
};

/** How many recent samples the working estimate is drawn from. */
const WINDOW = 8;

/**
 * How many recent attempts accuracy is judged over.
 *
 * Longer than the timing window: a single miss inside eight attempts is 87.5%,
 * which is a hair under the threshold and would make one slip cost two or three
 * lines. Twenty is enough that one mistake does not stall the learner and few
 * enough that a cell they have genuinely stopped knowing shows it.
 */
const ACCURACY_WINDOW = 20;

/**
 * The order cells are introduced.
 *
 * Braille is taught in its decades and this follows that: a–j is the base
 * pattern, k–t repeats it with dot 3, u–z with dots 3 and 6. A learner who
 * already reads braille recognises the structure immediately, and it means the
 * hardest chords are not the first thing anyone meets.
 *
 * Past the alphabet it carries on, because braille does. Everything after `w`
 * was already in the tables and tested and had never once appeared in a lesson,
 * so a learner who finished the alphabet found the curriculum simply stop.
 *
 * The order after the letters is by usefulness rather than by dot pattern: a
 * full stop and a comma appear in the first sentence anybody writes, and the
 * capital sign is needed the moment a sentence has a beginning. Digits come
 * last of the signs because the number sign changes how the following cells are
 * read, which is a genuinely new idea rather than another chord.
 */
export const LETTER_CELLS: readonly string[] = [
  ..."abcdefghij",
  ..."klmnopqrst",
  ..."uvxyzw",
];

/**
 * Punctuation, the capital sign and the digits, in the order they are taught.
 *
 * Written as the characters a lesson contains rather than as cells: `A` stands
 * for the capital sign, since the only way to practise it is to write a capital
 * letter, and `1` stands for the number sign for the same reason.
 */
const BEYOND_LETTERS: readonly string[] = [
  ".",
  ",",
  "A", // the capital sign, met by writing a capital
  "?",
  "'",
  "!",
  "-",
  ";",
  ":",
  "1", // the number sign, met by writing a digit
];

export const TEACHING_ORDER: readonly string[] = [
  ...LETTER_CELLS,
  ...BEYOND_LETTERS,
];

/** Every key the engine will accept a statistic for. */
const TEACHABLE: ReadonlySet<string> = new Set(TEACHING_ORDER);

/** True once every letter of the alphabet is in play. */
export function isAlphabetComplete(unlocked: readonly string[]): boolean {
  return unlocked.length >= LETTER_CELLS.length;
}

/** Cells in play before anything has been recorded. */
export const STARTING_CELLS = 5;

export type Target = {
  /** The pace a cell must reach before another is added, in milliseconds. */
  readonly msPerCell: number;
};

export const defaultTarget: Target = { msPerCell: 1500 };

/**
 * How accurate a cell has to be, lately, to count as learned.
 *
 * Nine in ten rather than ten in ten. Perfection is not a standard a person
 * typing with six fingers can hold, and demanding it is what made the gate
 * impassable; nine in ten is comfortably above guessing and still leaves room
 * to have a bad line.
 */
const SETTLE_ACCURACY = 0.9;

/** Clean entries before a cell can settle: fewer is luck, not learning. */
const MIN_HITS = 3;

export class Progress {
  readonly #stats = new Map<string, CellStat>();
  /**
   * How many cells have ever been in play.
   *
   * Cells are never taken away once given. `unlocked()` is derived from how the
   * cells are going right now, and "right now" moves in both directions — so
   * without this, a bad line shrinks the alphabet mid-session and letters the
   * learner was taught last week vanish from their practice lines. The rule is
   * meant to decide when to *add*, not to confiscate.
   */
  #reached = 0;

  /** Everything recorded so far, for persistence. */
  toJSON(): Record<string, unknown> {
    // Under a key no letter can collide with.
    return { ...Object.fromEntries(this.#stats), "#reached": this.#reached };
  }

  static fromJSON(data: unknown): Progress {
    const p = new Progress();
    if (data != null && typeof data === "object") {
      const reached = (data as Record<string, unknown>)["#reached"];
      p.#reached =
        typeof reached === "number" && Number.isFinite(reached) && reached > 0
          ? Math.min(TEACHING_ORDER.length, Math.floor(reached))
          : 0;
      for (const [letter, stat] of Object.entries(
        data as Record<string, CellStat>,
      )) {
        if (TEACHABLE.has(letter) && stat != null) {
          p.#stats.set(letter, {
            hits: Number(stat.hits) || 0,
            misses: Number(stat.misses) || 0,
            bestMs: stat.bestMs == null ? null : Number(stat.bestMs),
            recentMs: Array.isArray(stat.recentMs)
              ? stat.recentMs.slice(-WINDOW).map(Number)
              : [],
            // Absent in progress saved before accuracy was windowed. Left
            // empty rather than invented from the lifetime ratio: this is a
            // measure of how the cell is going *now*, and a few real entries
            // answer that better than a reconstruction. Those entries arrive
            // within seconds of the learner starting.
            recent: Array.isArray(stat.recent)
              ? stat.recent.slice(-ACCURACY_WINDOW).map(Boolean)
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
      recent: [...s.recent, true].slice(-ACCURACY_WINDOW),
    });
  }

  /** Records a wrong cell entered where this one was wanted. */
  miss(letter: string): void {
    const s = this.statOf(letter);
    this.#stats.set(letter, {
      ...s,
      misses: s.misses + 1,
      recent: [...s.recent, false].slice(-ACCURACY_WINDOW),
    });
  }

  /**
   * How accurate this cell has been lately, from 0 to 1.
   *
   * Over a window, not over the learner's whole life with the cell. The
   * lifetime ratio can only ever fall: a miss in the first minute is carried
   * for ever, and since `isSettled` wanted perfection, one wrong chord used to
   * bar that cell permanently — and with it every cell behind it, because a
   * single unsettled cell holds the whole curriculum. Missing is what
   * practising is, so the measure has to be one a learner can climb back out
   * of.
   */
  accuracy(letter: string): number {
    const { recent } = this.statOf(letter);
    if (recent.length === 0) {
      return 0;
    }
    return recent.filter(Boolean).length / recent.length;
  }

  /**
   * How this cell is going, from 0 to 1.
   *
   * Speed against the target, scaled by recent accuracy — a cell entered fast
   * but wrongly half the time is not learned, and treating it as learned would
   * hand the learner a new one while they are still guessing at this.
   */
  confidence(letter: string, target: Target = defaultTarget): number {
    const s = this.statOf(letter);
    if (s.recentMs.length === 0) {
      return 0;
    }
    const mean = s.recentMs.reduce((a, b) => a + b, 0) / s.recentMs.length;
    const speed = Math.min(1, target.msPerCell / Math.max(1, mean));
    return Math.max(0, Math.min(1, speed * this.accuracy(letter)));
  }

  /**
   * True once a cell has enough evidence behind it to count as settled.
   *
   * Speed and accuracy are checked separately rather than through their
   * product. Multiplied together they demanded that both be *exactly* perfect —
   * confidence caps at 1, so `>= 1` meant a flawless recent record AND a pace
   * at or under the target, with no trade between them. Nobody reaches that,
   * and a learner four hundred correct cells in was still on the starting five.
   */
  isSettled(letter: string, target: Target = defaultTarget): boolean {
    const s = this.statOf(letter);
    if (s.hits < MIN_HITS || s.recentMs.length === 0) {
      return false;
    }
    const mean = s.recentMs.reduce((a, b) => a + b, 0) / s.recentMs.length;
    return mean <= target.msPerCell && this.accuracy(letter) >= SETTLE_ACCURACY;
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
    let size = Math.max(STARTING_CELLS, this.#reached);
    while (size < TEACHING_ORDER.length) {
      const inPlay = TEACHING_ORDER.slice(0, size);
      if (!inPlay.every((letter) => this.isSettled(letter, target))) {
        break;
      }
      size += 1;
    }
    // Monotone: the high-water mark only ever rises, so a cell already taught
    // stays in the lessons even on a day when it is going badly.
    this.#reached = size;
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

/**
 * The teaching-order key a cell is scored against.
 *
 * Not only letters: the capital sign and the number sign are cells a learner
 * has to chord like any other, and punctuation is most of what separates
 * writing braille from reciting the alphabet. They were previously unscorable —
 * this returned null for every one of them — so practising them taught the
 * engine nothing and they could never settle.
 *
 * The capital and number signs are keyed by an example of what they introduce
 * ("A", "1"), because that is the only way either is ever typed.
 */
export function keyOfCell(cell: Cell): string | null {
  for (const [letter, value] of LETTERS) {
    if (value === cell) {
      return letter;
    }
  }
  if (cell === CAPITAL_SIGN) {
    return "A";
  }
  if (cell === NUMBER_SIGN) {
    return "1";
  }
  for (const [mark, value] of PUNCTUATION) {
    if (value === cell) {
      return mark;
    }
  }
  return null;
}

/**
 * What a teaching-order key is, for anything that shows one to a person.
 *
 * The keys past the alphabet are not letters and must not be printed as though
 * they were: a bare "." in a list of cells is a full stop pretending to be a
 * character, and "A" and "1" are stand-ins for the capital and number signs
 * rather than for themselves.
 */
export type KeyKind = "letter" | "punctuation" | "capital" | "number";

export type KeyInfo = {
  readonly key: string;
  readonly kind: KeyKind;
  /** What to print. */
  readonly glyph: string;
  /** What to say, and what a screen reader reads. */
  readonly name: string;
  /** The cell it is typed as. */
  readonly cell: Cell;
};

const KEY_NAMES: ReadonlyMap<string, string> = new Map([
  [".", "full stop"],
  [",", "comma"],
  ["?", "question mark"],
  ["'", "apostrophe"],
  ["!", "exclamation mark"],
  ["-", "hyphen"],
  [";", "semicolon"],
  [":", "colon"],
]);

export function describeKey(key: string): KeyInfo {
  if (key === "A") {
    return {
      key,
      kind: "capital",
      glyph: "Aa",
      name: "capital sign",
      cell: CAPITAL_SIGN,
    };
  }
  if (key === "1") {
    return {
      key,
      kind: "number",
      glyph: "123",
      name: "number sign",
      cell: NUMBER_SIGN,
    };
  }
  const mark = PUNCTUATION.get(key);
  if (mark != null) {
    return {
      key,
      kind: "punctuation",
      glyph: key,
      name: KEY_NAMES.get(key) ?? key,
      cell: mark,
    };
  }
  return {
    key,
    kind: "letter",
    glyph: key,
    name: key,
    cell: LETTERS.get(key) ?? 0,
  };
}
