import { timeToSpeed } from "@keylearn/result";
import { type LessonKey } from "./key.ts";

/**
 * A target speed the learner could actually reach.
 *
 * The gate is correct and the target is what goes wrong. A new letter arrives
 * only once *every* letter in play is at the target, so one slow key holds the
 * whole alphabet — and if the target is set above what that key will ever
 * manage this month, the trail simply stops. Measured on a real 612-lesson
 * profile: eight of ten keys below a 50 wpm target, no new letter for days.
 * Nothing on the page connected "no new letters lately" to "your target", so
 * the learner's reasonable conclusion was that they had stopped improving.
 *
 * This is a suggestion and never an action. Lowering the target lowers the bar
 * for everything, which is a real trade and the learner's to make — but they
 * cannot make it if nobody tells them the lever exists.
 */

/** Targets are set in steps of five, like the settings control. */
const STEP = 5;

/**
 * How far below target the slowest key must sit before this is worth saying.
 *
 * Well below the point where a learner is merely having a slow week: at four
 * fifths of target the next unlock is a session or two away and the page
 * should stay quiet. This fires when the gap is wide enough that the target,
 * not the practice, is what is in the way.
 */
const STALL_RATIO = 0.8;

/** Lessons before the evidence is worth acting on at all. */
const MIN_LESSONS = 20;

export type TargetSuggestion = {
  /** What to suggest, in the engine's own speed units. */
  readonly target: number;
  /** The key holding everything else up. */
  readonly blocker: LessonKey;
};

/**
 * The target that would let the next letter through, or null when the current
 * one is fine.
 *
 * Returns the speed of the slowest key in play, rounded down to a step —
 * because that is exactly the bar the gate is applying, and clearing it is
 * what unlocks. Anything lower would be a discount rather than a correction.
 */
export function suggestTarget(
  includedKeys: readonly LessonKey[],
  currentTarget: number,
  lessonCount: number,
  bounds: { readonly min: number; readonly max: number },
): TargetSuggestion | null {
  if (lessonCount < MIN_LESSONS || includedKeys.length === 0) {
    return null;
  }
  let blocker: LessonKey | null = null;
  let slowest = Infinity;
  for (const key of includedKeys) {
    if (key.timeToType == null) {
      // Never typed. It has no speed to be slow at, and suggesting a target
      // from a key with no evidence would be guessing.
      continue;
    }
    const speed = timeToSpeed(key.timeToType);
    if (speed < slowest) {
      slowest = speed;
      blocker = key;
    }
  }
  if (blocker == null || !Number.isFinite(slowest)) {
    return null;
  }
  // Already within reach: the practice is the thing in the way, not the goal.
  if (slowest >= currentTarget * STALL_RATIO) {
    return null;
  }
  const target = Math.max(
    bounds.min,
    Math.min(bounds.max, Math.floor(slowest / STEP) * STEP),
  );
  // A suggestion that is not actually lower is not a suggestion.
  return target < currentTarget ? { target, blocker } : null;
}
