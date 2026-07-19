import { type KeySample } from "@keybr/result";
import { sampleSuccess } from "./bkt.ts";

/**
 * Spaced-repetition skill decay via Half-Life Regression (HLR).
 *
 * The existing engine has no notion of forgetting: a key mastered three weeks
 * ago is still believed to be at full speed. This models the natural decay of a
 * memory trace over real elapsed time:
 *
 *   P(recall) = 2 ^ (-Δt / halfLife)
 *
 * where Δt is the time since the key was last practised and the half-life grows
 * with successful streaks and shrinks with errors. Multiplying a key's current
 * confidence by P(recall) makes long-unpractised keys quietly fade, and the
 * per-key recall probabilities double as a review-priority signal.
 *
 * This is a pure, dependency-free port of the HLR idea (no storage, no per-user
 * state) that reads a key's existing lesson samples on demand.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DecayParams = {
  /** Half-life (ms) of a freshly-seen key. */
  readonly baseHalfLife: number;
  /** Lower bound on half-life (ms). */
  readonly minHalfLife: number;
  /** Upper bound on half-life (ms). */
  readonly maxHalfLife: number;
  /** Growth strength applied per step of a success streak. */
  readonly growth: number;
  /** Multiplicative shrink applied on a failure. */
  readonly shrink: number;
};

export const defaultDecayParams: DecayParams = {
  baseHalfLife: 3 * MS_PER_DAY,
  minHalfLife: 0.25 * MS_PER_DAY,
  maxHalfLife: 60 * MS_PER_DAY,
  growth: 0.15,
  shrink: 0.5,
};

/**
 * Estimate a key's memory half-life (ms) by replaying its samples: successful
 * reps lengthen it (with diminishing returns as the streak grows), failures
 * shorten it and reset the streak.
 */
export function halfLifeOf(
  samples: readonly KeySample[],
  targetSpeed: number,
  params: DecayParams = defaultDecayParams,
): number {
  let halfLife = params.baseHalfLife;
  let streak = 0;
  for (const sample of samples) {
    if (sampleSuccess(sample, targetSpeed)) {
      streak += 1;
      halfLife = Math.min(
        params.maxHalfLife,
        halfLife * (1 + params.growth * Math.min(streak, 6)),
      );
    } else {
      streak = 0;
      halfLife = Math.max(params.minHalfLife, halfLife * params.shrink);
    }
  }
  return halfLife;
}

/**
 * Probability that a key is still "sharp" right now, in (0, 1]. Returns 1 when
 * the key was never practised or was just practised.
 */
export function recallProbability(
  samples: readonly KeySample[],
  targetSpeed: number,
  now: number,
  params: DecayParams = defaultDecayParams,
): number {
  if (samples.length === 0) {
    return 1;
  }
  const last = samples[samples.length - 1];
  const dt = Math.max(0, now - last.timeStamp);
  if (dt === 0) {
    return 1;
  }
  const halfLife = halfLifeOf(samples, targetSpeed, params);
  return Math.pow(2, -dt / halfLife);
}
