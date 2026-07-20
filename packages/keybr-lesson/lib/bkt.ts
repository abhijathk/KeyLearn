import { type KeySample, speedToTime } from "@keybr/result";

/**
 * Bayesian Knowledge Tracing (BKT) for per-key mastery.
 *
 * A rigorous alternative to the pure speed ratio used by {@link Target.confidence}.
 * Instead of a smoothed time ratio, BKT maintains a posterior probability that a
 * key is genuinely mastered, explicitly modelling:
 *
 *   - guessing: a fast/accurate rep that happened without real mastery, and
 *   - slipping: a bad rep despite real mastery.
 *
 * The skill being traced is a single code point (a bigram later); an observation
 * is "correct" when a lesson typed that key fast enough and accurately enough
 * (see {@link sampleSuccess}).
 *
 * The algorithm is standard BKT; this is a pure, dependency-free port (no storage,
 * no per-user state) that replays a key's existing lesson samples on demand.
 */

export type BktParams = {
  /** P(L0): prior probability the key is already mastered. */
  readonly pL0: number;
  /** P(T): probability of learning the key on any given rep. */
  readonly pT: number;
  /** P(G): probability of a correct rep without mastery (a guess). */
  readonly pG: number;
  /** P(S): probability of an incorrect rep despite mastery (a slip). */
  readonly pS: number;
};

export const defaultBktParams: BktParams = {
  pL0: 0.1,
  pT: 0.15,
  pG: 0.2,
  pS: 0.1,
};

/** Posterior at or above which a key is considered mastered. */
export const bktMasteryThreshold = 0.95;

/**
 * A single Bayesian update: given the current mastery probability and one
 * correct/incorrect observation, return the updated mastery probability.
 */
export function bktUpdate(
  pL: number,
  correct: boolean,
  params: BktParams = defaultBktParams,
): number {
  const { pT, pG, pS } = params;
  // Posterior mastery given the observation.
  let posterior: number;
  if (correct) {
    // P(correct|L) = 1 - P(S), P(correct|¬L) = P(G).
    const num = pL * (1 - pS);
    const den = num + (1 - pL) * pG;
    posterior = den > 0 ? num / den : pL;
  } else {
    // P(wrong|L) = P(S), P(wrong|¬L) = 1 - P(G).
    const num = pL * pS;
    const den = num + (1 - pL) * (1 - pG);
    posterior = den > 0 ? num / den : pL;
  }
  // Learning transition: even an unmastered key may be learned this rep.
  const next = posterior + (1 - posterior) * pT;
  // Clamp to avoid degenerate 0/1 states.
  return Math.max(0.001, Math.min(0.999, next));
}

/**
 * Replay a stream of observations to a final posterior mastery probability,
 * also tracking the highest posterior reached (the peak "was once mastered"
 * signal, used for unlock gating).
 */
export function bktTrace(
  observations: Iterable<boolean>,
  params: BktParams = defaultBktParams,
): { readonly pL: number; readonly pLMax: number } {
  let pL = params.pL0;
  let pLMax = pL;
  for (const correct of observations) {
    pL = bktUpdate(pL, correct, params);
    if (pL > pLMax) {
      pLMax = pL;
    }
  }
  return { pL, pLMax };
}

/**
 * Whether a per-lesson key sample counts as a "correct" BKT observation:
 * typed at or above the target speed AND accurately enough. This is where
 * accuracy enters the mastery signal, which the pure speed ratio ignores.
 */
export function sampleSuccess(
  sample: KeySample,
  targetSpeed: number,
  maxMissRate = 0.08,
): boolean {
  const fastEnough =
    sample.timeToType > 0 && sample.timeToType <= speedToTime(targetSpeed);
  const total = sample.hitCount + sample.missCount;
  const accurate =
    total === 0 ? sample.hitCount > 0 : sample.missCount / total <= maxMissRate;
  return fastEnough && accurate;
}

/** Derive the BKT observation stream for a key from its lesson samples. */
export function* keyObservations(
  samples: readonly KeySample[],
  targetSpeed: number,
): Iterable<boolean> {
  for (const sample of samples) {
    yield sampleSuccess(sample, targetSpeed);
  }
}

/** BKT posterior mastery (final and peak) for a key, in [0, 1]. */
export function bktMastery(
  samples: readonly KeySample[],
  targetSpeed: number,
  params: BktParams = defaultBktParams,
): { readonly pL: number; readonly pLMax: number } {
  return bktTrace(keyObservations(samples, targetSpeed), params);
}
