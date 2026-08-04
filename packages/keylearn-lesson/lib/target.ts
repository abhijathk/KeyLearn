import { type KeyStats, speedToTime } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { bktMastery, bktMasteryThreshold } from "./bkt.ts";
import { recallProbability } from "./decay.ts";
import { lessonProps } from "./settings.ts";

/**
 * How fast one key must be, as a fraction of the goal, to count as learned.
 *
 * The goal is an *overall* speed — it is what the page shows, what the road
 * measures, and what somebody means when they say they type at fifty. But
 * overall speed is the average across every key, and the slowest key always
 * sits in the tail below it: for a normal spread of per-key speeds the worst
 * one lands around four fifths of the average.
 *
 * The gate used to demand that *every* key reach the full goal, which is a
 * quite different and much harder thing. A learner who set fifty was in fact
 * being asked for about sixty-two overall before their last letter cleared, so
 * the number they had chosen did not mean what it said and the trail stopped
 * long before they understood why.
 *
 * Asking for four fifths per key makes the goal mean what it appears to mean.
 */
export const KEY_PASS_RATIO = 0.8;

/**
 * Lessons the current estimate of a key's speed is drawn from.
 *
 * Five, taken as a median. That is deliberately both robust and quick:
 *
 * The stored `timeToType` is exponentially smoothed at alpha 0.1, which has a
 * time constant of about ten lessons and no resistance to outliers at all.
 * Measured, that meant a learner who genuinely improved from 500ms to 300ms on
 * a key was still being read as 480ms after one lesson, 418ms after five, and
 * 370ms after ten — so the engine did not notice real progress for twenty or
 * thirty rounds. And because the unlock gate takes the best of that *smoothed*
 * value, the improvement did not count until the smoothing had caught up.
 *
 * Worse in the other direction: one bad lesson shifted it by 60ms and took
 * twenty-nine good lessons to work back out. With every key needing to be
 * above the bar at once, a single off round could set the next letter back by
 * weeks of practice.
 *
 * A median of five moves within three lessons and ignores up to two bad ones
 * outright — a bad run has to become a habit before it counts against you.
 */
const RECENT_LESSONS = 5;

/**
 * The learner's current speed on a key, in milliseconds, or null when there is
 * nothing to go on.
 *
 * The median of the raw recent samples rather than the smoothed running value:
 * the smoothing is what made both progress and mistakes take tens of lessons
 * to register.
 */
function recentTime(keyStats: KeyStats): number | null {
  const recent: number[] = [];
  for (const sample of keyStats.samples.slice(-RECENT_LESSONS)) {
    if (sample.timeToType > 0) {
      recent.push(sample.timeToType);
    }
  }
  if (recent.length === 0) {
    return null;
  }
  recent.sort((a, b) => a - b);
  return recent[Math.floor(recent.length / 2)];
}

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
   * The blend touches `confidence` only. `bestConfidence` — the unlock gate —
   * stays the pure speed ratio, because it asserts one thing: this key was once
   * typed at the target speed. See below.
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
    let confidence = this.confidence(
      recentTime(keyStats) ?? keyStats.timeToType,
    );
    // The best the learner has *shown*, not the best the smoothing has caught
    // up with. Taking the lifetime best alone meant a genuine improvement was
    // not credited until the running average had crawled to it, twenty or
    // thirty lessons later; a key typed at the bar for three of the last five
    // rounds has demonstrably reached it.
    const historicBest = this.confidence(keyStats.bestTimeToType);
    let bestConfidence =
      historicBest == null
        ? confidence
        : confidence == null
          ? historicBest
          : Math.max(historicBest, confidence);
    if (this.smartConfidence && keyStats.samples.length > 0) {
      const { pL } = bktMastery(keyStats.samples, this.targetSpeed);
      confidence = blend(confidence, pL / bktMasteryThreshold);
      // NOT bestConfidence. That is the unlock gate, and it means one specific
      // thing: this key was once typed at the target speed. Blending a
      // current-mastery posterior into a historical peak of speed mixes two
      // different claims, and the arithmetic bites — with the posterior at 0.5
      // the gate quietly starts demanding 1.19x the target instead of 1.0x, so
      // a learner practising steadily is never given a new letter. Accuracy
      // still shapes `confidence`, which is what drives focus and colour.
    }
    return { confidence, bestConfidence };
  }

  /**
   * Whether a key is quick enough to count as learned.
   *
   * Confidence is still the plain ratio to the goal, so a key at the goal
   * reads as 1 and the number keeps its meaning everywhere it is shown. Only
   * the bar is lower — see {@link KEY_PASS_RATIO}.
   */
  static passes(confidence: number | null): boolean {
    return (confidence ?? 0) >= KEY_PASS_RATIO;
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
