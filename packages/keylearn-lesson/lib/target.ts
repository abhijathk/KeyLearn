import { type KeyStats, speedToTime } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { bktMastery, bktMasteryThreshold } from "./bkt.ts";
import { recallProbability } from "./decay.ts";
import { lessonProps } from "./settings.ts";

export class Target {
  readonly targetSpeed: number;
  readonly smartConfidence: boolean;
  readonly skillDecay: boolean;
  readonly now: number;

  constructor(settings: Settings, now: number = Date.now()) {
    this.targetSpeed = settings.get(lessonProps.targetSpeed);
    this.smartConfidence = settings.get(lessonProps.guided.smartConfidence);
    this.skillDecay = settings.get(lessonProps.guided.skillDecay);
    this.now = now;
  }

  confidence(timeToType: number): number;
  confidence(timeToType: null): null;
  confidence(timeToType: number | null): number | null;
  confidence(timeToType: number | null): number | null {
    if (timeToType == null) {
      return null;
    }
    if (!Number.isFinite(timeToType) || timeToType === 0) {
      throw new Error();
    }
    return speedToTime(this.targetSpeed) / timeToType;
  }

  /**
   * Compute the confidence and best-confidence for a key.
   *
   * The spine is always the classic speed ratio ({@link confidence}). When
   * `smartConfidence` is enabled it is *blended* with a Bayesian Knowledge
   * Tracing posterior (accuracy-aware, scaled so the mastery threshold maps to
   * 1) at a fixed {@link BLEND_CLASSIC}:{@link BLEND_BKT} weighting — the speed
   * ratio stays dominant and BKT adds a minority accuracy signal, so it runs
   * *alongside* the current algorithm rather than replacing it. With no samples
   * yet there is nothing to trace, so the classic ratio is used unblended.
   *
   * Real-time forgetting is deliberately NOT applied here. It used to be: the
   * confidence was multiplied by a recall factor, which meant a key you were
   * still learning — and so one with misses in its history, and therefore the
   * shortest half-life — could lose most of its colour overnight. Opening the
   * app to find yesterday's work visibly undone is both demoralising and
   * overstated; nobody loses ninety percent of a skill while asleep.
   *
   * The forgetting model is still used, but for choosing what to review rather
   * than for what the keyboard paints. See {@link recall} and `findDueKey`.
   */
  keyConfidence(keyStats: KeyStats): {
    confidence: number | null;
    bestConfidence: number | null;
  } {
    let confidence = this.confidence(keyStats.timeToType);
    let bestConfidence = this.confidence(keyStats.bestTimeToType);
    if (this.smartConfidence && keyStats.samples.length > 0) {
      const { pL, pLMax } = bktMastery(keyStats.samples, this.targetSpeed);
      confidence = blend(confidence, pL / bktMasteryThreshold);
      bestConfidence = blend(bestConfidence, pLMax / bktMasteryThreshold);
    }
    return { confidence, bestConfidence };
  }

  /**
   * How likely this key is to still be sharp, in (0, 1].
   *
   * A review-priority signal, not a score: it decides what is worth drilling
   * again, and never what a key looks like. Returns 1 when decay is switched
   * off, so callers need no special case.
   */
  recall(keyStats: KeyStats): number {
    if (!this.skillDecay) {
      return 1;
    }
    return recallProbability(keyStats.samples, this.targetSpeed, this.now);
  }
}

/** Blend weights: 2 parts classic speed ratio to 1 part BKT posterior. */
const BLEND_CLASSIC = 2;
const BLEND_BKT = 1;

/**
 * Weighted blend of the classic confidence with the BKT posterior. Falls back
 * to whichever value is present when the other is null (e.g. no valid speed
 * sample yet, so BKT carries alone).
 */
function blend(classic: number | null, bkt: number): number {
  return classic == null
    ? bkt
    : (BLEND_CLASSIC * classic + BLEND_BKT * bkt) / (BLEND_CLASSIC + BLEND_BKT);
}
