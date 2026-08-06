import { type Step } from "@keylearn/textinput";

// Only count transitions whose flight time is plausibly a real keystroke gap.
const MIN_TIME = 40;
const MAX_TIME = 2000;
// Exponential moving average: recent runs weigh more, so the picture tracks
// your *current* weak spots and improves as you do, rather than being dragged
// down forever by early fumbles.
const EMA_ALPHA = 0.3;
// A pair/triple needs this many clean, timed samples before we trust it.
const MIN_SAMPLES = 4;
// Cap stored n-grams per order so the persisted blob stays small.
const CAP = 300;
// How strongly error-proneness (vs. raw slowness) counts toward "weakness".
const ERROR_MS = 320;

type Cell = { time: number; count: number; errors: number };

/** A weakness-ranked key sequence (unigram, bigram or trigram). */
export type Ngram = {
  /** The 1–3 code points of the sequence, in order. */
  readonly seq: readonly number[];
  /** Smoothed execution time to type the sequence, in ms. */
  readonly time: number;
  /** Clean, timed samples behind {@link time}. */
  readonly count: number;
  /** Mistyped occurrences of the sequence. */
  readonly errors: number;
  /** How much slower this is than the constituent keys' own baselines, in ms. */
  readonly penalty: number;
  /** Combined slowness + error-rate weakness score (higher = worse). */
  readonly score: number;
};

/** A slow key transition, in the shape the bottleneck drill consumes. */
export type Bigram = {
  readonly from: number;
  readonly to: number;
  readonly time: number;
};

type NgramStatsJSON = {
  /** [codePoint, time, count, errors] */
  readonly uni?: readonly (readonly number[])[];
  /** [from, to, time, count, errors] */
  readonly bi?: readonly (readonly number[])[];
  /** [a, b, c, time, count, errors] */
  readonly tri?: readonly (readonly number[])[];
};

function record(
  map: Map<string, Cell>,
  key: string,
  time: number | null,
  error: boolean,
): void {
  let cell = map.get(key);
  if (cell == null) {
    cell = { time: 0, count: 0, errors: 0 };
    map.set(key, cell);
  }
  if (error) {
    cell.errors += 1;
    return;
  }
  if (time != null) {
    cell.time =
      cell.count === 0 ? time : cell.time + EMA_ALPHA * (time - cell.time);
    cell.count += 1;
  }
}

const inRange = (t: number) => t >= MIN_TIME && t <= MAX_TIME;

/**
 * Durable, weakness-aware statistics over the key sequences you type.
 *
 * Two keys can each be quick alone yet slow *as a pair* — awkward rolls,
 * same-finger jumps, hand alternations that don't flow. This tracks the flight
 * time of every bigram and trigram (plus a per-key baseline), so we can surface
 * the transitions that are genuinely holding you back — the ones slower or more
 * error-prone than your own ability on those keys warrants — and drill them in
 * real words. It is designed to be persisted per profile and to keep improving
 * across sessions rather than resetting each time.
 */
export class NgramStats {
  readonly #uni = new Map<string, Cell>();
  readonly #bi = new Map<string, Cell>();
  readonly #tri = new Map<string, Cell>();

  /** Fold a finished run's keystroke stream into the statistics. */
  append(steps: readonly Step[]): void {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      // Unigram: the key's own solo-ish baseline.
      record(
        this.#uni,
        `${s.codePoint}`,
        !s.typo && inRange(s.timeToType) ? s.timeToType : null,
        s.typo,
      );
      // Bigram: the flight time from the previous key to this one.
      if (i >= 1) {
        const p = steps[i - 1];
        const err = s.typo || p.typo;
        record(
          this.#bi,
          `${p.codePoint}>${s.codePoint}`,
          !err && inRange(s.timeToType) ? s.timeToType : null,
          err,
        );
      }
      // Trigram: the time to execute the three-key run (its two flights).
      if (i >= 2) {
        const a = steps[i - 2];
        const b = steps[i - 1];
        const err = a.typo || b.typo || s.typo;
        const time = b.timeToType + s.timeToType;
        record(
          this.#tri,
          `${a.codePoint}>${b.codePoint}>${s.codePoint}`,
          !err && inRange(b.timeToType) && inRange(s.timeToType) ? time : null,
          err,
        );
      }
    }
  }

  #baseline(codePoint: number): number {
    const cell = this.#uni.get(`${codePoint}`);
    return cell != null && cell.count > 0 ? cell.time : 0;
  }

  #toNgram(seq: readonly number[], cell: Cell): Ngram {
    // Expected time = the baselines of every key *after* the first (the first
    // key isn't "reached" within the sequence). A positive penalty means the
    // sequence is slower than typing those keys in isolation would predict.
    let expected = 0;
    for (let i = 1; i < seq.length; i++) {
      expected += this.#baseline(seq[i]);
    }
    const penalty = expected > 0 ? cell.time - expected : 0;
    const errorRate = cell.errors / (cell.count + cell.errors || 1);
    const score = Math.max(0, penalty) + errorRate * ERROR_MS;
    return {
      seq,
      time: Math.round(cell.time),
      count: cell.count,
      errors: cell.errors,
      penalty: Math.round(penalty),
      score,
    };
  }

  /**
   * The single weakest bigram whose both keys are in the given set — ranked by
   * transition penalty and error-proneness, not raw slowness — or null when
   * there isn't enough data. This is what the bottleneck drill focuses.
   */
  worst(among: ReadonlySet<number>): Bigram | null {
    let best: { ngram: Ngram; from: number; to: number } | null = null;
    for (const [id, cell] of this.#bi) {
      if (cell.count < MIN_SAMPLES) {
        continue;
      }
      const sep = id.indexOf(">");
      const from = Number(id.slice(0, sep));
      const to = Number(id.slice(sep + 1));
      if (!among.has(from) || !among.has(to)) {
        continue;
      }
      const ngram = this.#toNgram([from, to], cell);
      if (ngram.score <= 0) {
        continue;
      }
      if (best == null || ngram.score > best.ngram.score) {
        best = { ngram, from, to };
      }
    }
    return best != null
      ? { from: best.from, to: best.to, time: best.ngram.time }
      : null;
  }

  /**
   * The weakest sequences of a given order, ranked worst-first — for the
   * profile's "slowest transitions" chart. Pass `among` to restrict to keys the
   * learner has already unlocked.
   */
  topWeak(
    order: 2 | 3,
    limit = 12,
    among: ReadonlySet<number> | null = null,
  ): Ngram[] {
    const map = order === 2 ? this.#bi : this.#tri;
    const out: Ngram[] = [];
    for (const [id, cell] of map) {
      if (cell.count < MIN_SAMPLES) {
        continue;
      }
      const seq = id.split(">").map(Number);
      if (among != null && !seq.every((cp) => among.has(cp))) {
        continue;
      }
      const ngram = this.#toNgram(seq, cell);
      if (ngram.score > 0) {
        out.push(ngram);
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }

  /**
   * The typical time for a well-sampled sequence of this order — the middle
   * of the learner's own distribution, not an average, so a handful of very
   * slow pairs cannot drag it.
   *
   * The profile's transitions chart measures against this rather than against
   * the slowest pair: "300 ms" means nothing on its own, where "twice as long
   * as you usually take" is a thing a learner can act on, and it tightens as
   * they improve.
   */
  medianTime(order: 2 | 3): number | null {
    const map = order === 2 ? this.#bi : this.#tri;
    const times: number[] = [];
    for (const [id, cell] of map) {
      if (cell.count >= MIN_SAMPLES) {
        const ngram = this.#toNgram(id.split(">").map(Number), cell);
        if (ngram.time > 0) {
          times.push(ngram.time);
        }
      }
    }
    if (times.length === 0) {
      return null;
    }
    times.sort((a, b) => a - b);
    const mid = times.length >> 1;
    return times.length % 2 === 1
      ? times[mid]
      : Math.round((times[mid - 1] + times[mid]) / 2);
  }

  /** Whether there is any usable, well-sampled data yet. */
  get hasData(): boolean {
    for (const cell of this.#bi.values()) {
      if (cell.count >= MIN_SAMPLES) {
        return true;
      }
    }
    return false;
  }

  toJSON(): NgramStatsJSON {
    const dump = (map: Map<string, Cell>, arity: number) =>
      [...map.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, CAP)
        .map(([id, { time, count, errors }]) => [
          ...id.split(">").map(Number).slice(0, arity),
          Math.round(time),
          count,
          errors,
        ]);
    return {
      uni: dump(this.#uni, 1),
      bi: dump(this.#bi, 2),
      tri: dump(this.#tri, 3),
    };
  }

  static fromJSON(json: NgramStatsJSON | null | undefined): NgramStats {
    const stats = new NgramStats();
    if (json == null) {
      return stats;
    }
    const load = (
      rows: readonly (readonly number[])[] | undefined,
      map: Map<string, Cell>,
      arity: number,
    ) => {
      for (const row of rows ?? []) {
        if (row.length !== arity + 3) {
          continue;
        }
        const id = row.slice(0, arity).join(">");
        map.set(id, {
          time: row[arity],
          count: row[arity + 1],
          errors: row[arity + 2],
        });
      }
    };
    load(json.uni, stats.#uni, 1);
    load(json.bi, stats.#bi, 2);
    load(json.tri, stats.#tri, 3);
    return stats;
  }
}
