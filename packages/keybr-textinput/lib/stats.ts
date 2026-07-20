import { Histogram } from "./histogram.ts";
import { type Step } from "./textinput.ts";

export type Stats = {
  readonly time: number;
  readonly speed: number;
  readonly length: number;
  readonly errors: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly histogram: Histogram;
};

export function makeStats(steps: readonly Step[]): Stats {
  if (steps.length >= 2) {
    const { timeStamp: startedAt } = steps.at(0)!;
    const { timeStamp: endedAt } = steps.at(-1)!;
    const { length } = steps;
    const time = Math.round(endedAt - startedAt);
    const speed = computeSpeed(length, time);
    const errors = countErrors(steps);
    const accuracy = (length - errors) / length;
    const rest = steps.slice(1); // The trigger step is ignored.
    return {
      time,
      speed,
      length,
      errors,
      accuracy,
      consistency: computeConsistency(rest),
      histogram: Histogram.from(rest),
    };
  } else {
    return {
      time: 0,
      speed: 0,
      length: 0,
      errors: 0,
      accuracy: 0,
      consistency: 0,
      histogram: Histogram.empty,
    };
  }
}

/**
 * Typing rhythm: how even the gaps between keystrokes are. Returns a value in
 * [0, 1] where 1 is perfectly steady. Computed as 1 minus the coefficient of
 * variation of the inter-key intervals — smooth, chunked typing scores high;
 * hunt-and-peck with pauses scores low.
 */
export function computeConsistency(steps: readonly Step[]): number {
  const intervals: number[] = [];
  for (const { timeToType, typo } of steps) {
    if (!typo && timeToType > 0) {
      intervals.push(timeToType);
    }
  }
  const { length } = intervals;
  if (length < 2) {
    return 0;
  }
  let sum = 0;
  for (const v of intervals) {
    sum += v;
  }
  const mean = sum / length;
  if (mean <= 0) {
    return 0;
  }
  let variance = 0;
  for (const v of intervals) {
    variance += (v - mean) ** 2;
  }
  variance /= length;
  const cv = Math.sqrt(variance) / mean;
  const consistency = Math.max(0, Math.min(1, 1 - cv));
  return Math.round(consistency * 10000) / 10000;
}

export function countErrors(steps: readonly Step[]): number {
  let errors = 0;
  for (const item of steps) {
    if (item.typo) {
      errors += 1;
    }
  }
  return errors;
}

export function computeSpeed(length: number, time: number): number {
  return time > 0 ? (length / (time / 1000)) * 60 : 0;
}
