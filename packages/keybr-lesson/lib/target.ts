import { type KeyStats, speedToTime } from "@keybr/result";
import { type Settings } from "@keybr/settings";
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
   * When `skillDecay` is enabled the resulting confidence is multiplied by a
   * spaced-repetition recall factor, so keys not practised for a long time
   * quietly lose confidence over real time; the best-confidence is never decayed
   * (it reflects the historical peak used for unlock gating).
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
    if (this.skillDecay && confidence != null) {
      confidence *= recallProbability(
        keyStats.samples,
        this.targetSpeed,
        this.now,
      );
    }
    return { confidence, bestConfidence };
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
