import { type Step } from "@keybr/textinput";
import { type CodePoint } from "@keybr/unicode";

// Only count transitions whose flight time is plausibly a real keystroke gap.
const MIN_TIME = 40;
const MAX_TIME = 2000;
const EMA_ALPHA = 0.3;
const MIN_SAMPLES = 4;

export type Bigram = {
  readonly from: CodePoint;
  readonly to: CodePoint;
  /** Smoothed flight time from the first key to the second, in ms. */
  readonly time: number;
};

/**
 * Tracks the flight time between consecutive keys across a session — the gap
 * from one keystroke to the next. Two keys can each be quick alone yet slow as
 * a pair (awkward rolls, same-finger jumps); this surfaces those "bottleneck"
 * transitions so practice can target them.
 */
export class BigramTracker {
  readonly #stats = new Map<string, { time: number; count: number }>();

  append(steps: readonly Step[]): void {
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const cur = steps[i];
      const { timeToType, typo, codePoint } = cur;
      if (
        typo ||
        prev.typo ||
        timeToType < MIN_TIME ||
        timeToType > MAX_TIME
      ) {
        continue;
      }
      const id = `${prev.codePoint}>${codePoint}`;
      const stat = this.#stats.get(id);
      if (stat == null) {
        this.#stats.set(id, { time: timeToType, count: 1 });
      } else {
        stat.time = stat.time + EMA_ALPHA * (timeToType - stat.time);
        stat.count += 1;
      }
    }
  }

  /**
   * The slowest well-sampled transition whose both keys are in the given set,
   * or null when there isn't enough data yet.
   */
  worst(among: ReadonlySet<CodePoint>): Bigram | null {
    let best: Bigram | null = null;
    for (const [id, { time, count }] of this.#stats) {
      if (count < MIN_SAMPLES) {
        continue;
      }
      const sep = id.indexOf(">");
      const from = Number(id.slice(0, sep));
      const to = Number(id.slice(sep + 1));
      if (!among.has(from) || !among.has(to)) {
        continue;
      }
      if (best == null || time > best.time) {
        best = { from, to, time };
      }
    }
    return best;
  }
}
