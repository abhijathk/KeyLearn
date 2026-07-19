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
   * By default this is the classic speed ratio ({@link confidence}). When
   * `smartConfidence` is enabled it uses a Bayesian Knowledge Tracing posterior
   * (accuracy-aware), scaled so that the mastery threshold maps to 1. When
   * `skillDecay` is enabled the current confidence is multiplied by a
   * spaced-repetition recall factor, so keys not practised for a long time
   * quietly lose confidence over real time; the best-confidence is never decayed
   * (it reflects the historical peak used for unlock gating).
   */
  keyConfidence(keyStats: KeyStats): {
    confidence: number | null;
    bestConfidence: number | null;
  } {
    let confidence: number | null;
    let bestConfidence: number | null;
    if (this.smartConfidence) {
      if (keyStats.samples.length > 0) {
        const { pL, pLMax } = bktMastery(keyStats.samples, this.targetSpeed);
        confidence = pL / bktMasteryThreshold;
        bestConfidence = pLMax / bktMasteryThreshold;
      } else {
        confidence = null;
        bestConfidence = null;
      }
    } else {
      confidence = this.confidence(keyStats.timeToType);
      bestConfidence = this.confidence(keyStats.bestTimeToType);
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
