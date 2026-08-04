import { type Result } from "@keylearn/result";

/**
 * Whether a submitted result is physically possible, for leaderboard purposes.
 *
 * Results are measured in the browser and posted here, so a score is something
 * the client asserts rather than something we observed. Nothing can change
 * that short of replaying keystrokes server-side, and it does not need to:
 * inflating your own history only cheats yourself, and the unlock algorithm
 * will simply stop giving you new letters. The leaderboard is different —
 * it is shared, and one fabricated entry devalues every honest one on it.
 *
 * So these bounds are deliberately far outside human range. They are not
 * trying to catch a good typist having a good day; they are trying to make a
 * fabricated score cost more than a curl command. A learner who trips one of
 * these keeps the result in their own history and simply is not credited on
 * the board.
 */

/**
 * Characters per minute. The app counts in CPM and shows WPM at a fifth of
 * it, so this is 300 WPM — comfortably past Barbara Blackburn's 212 WPM
 * record and past any competitive burst, and therefore reached only by
 * something that was not typed.
 */
export const MAX_SPEED_CPM = 1500;

/**
 * Milliseconds between keystrokes, sustained.
 *
 * Rollover means two keys can land almost together, so this is a floor on the
 * average rather than on any single pair — 20ms average is 50 keys a second,
 * which no hand does over a whole lesson.
 */
export const MIN_MS_PER_KEY = 20;

/**
 * The share of the run the per-key histogram has to actually account for.
 *
 * A fabricated result usually carries a headline speed with a histogram that
 * does not add up to it, because the histogram is the tedious part to forge.
 * Half is lenient: real runs lose some keys to the histogram for legitimate
 * reasons, and this is not meant to be tight.
 */
const MIN_HISTOGRAM_COVERAGE = 0.5;

export type Implausible = {
  /** Which bound was crossed, for the log. */
  readonly reason: string;
};

/** Null when the result could have been typed; a reason when it could not. */
export function implausible(result: Result): Implausible | null {
  const { speed, length, time, accuracy, histogram } = result;

  if (!Number.isFinite(speed) || speed > MAX_SPEED_CPM) {
    return { reason: `speed ${Math.round(speed)}cpm over ${MAX_SPEED_CPM}` };
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1) {
    return { reason: `accuracy ${accuracy} outside 0..1` };
  }
  if (length > 0 && time < length * MIN_MS_PER_KEY) {
    return {
      reason: `${length} keys in ${time}ms is under ${MIN_MS_PER_KEY}ms each`,
    };
  }

  let hits = 0;
  for (const sample of histogram) {
    if (sample.hitCount > 0 && sample.timeToType < MIN_MS_PER_KEY) {
      return {
        reason: `a key averaged ${sample.timeToType}ms, under ${MIN_MS_PER_KEY}ms`,
      };
    }
    hits += sample.hitCount;
  }
  if (length > 0 && hits < length * MIN_HISTOGRAM_COVERAGE) {
    return {
      reason: `histogram accounts for ${hits} of ${length} keys`,
    };
  }

  return null;
}

/**
 * The results fit to be credited on the leaderboard, and the reasons the rest
 * were not.
 *
 * Kept as a partition rather than a filter so the caller can store everything
 * in the learner's own history and still credit only what is plausible — and
 * so a refusal can be logged rather than happening in silence, because a
 * bound that starts refusing honest learners has to be visible.
 */
export function partitionPlausible(results: readonly Result[]): {
  readonly credited: Result[];
  readonly refused: { result: Result; reason: string }[];
} {
  const credited: Result[] = [];
  const refused: { result: Result; reason: string }[] = [];
  for (const result of results) {
    const bad = implausible(result);
    if (bad == null) {
      credited.push(result);
    } else {
      refused.push({ result, reason: bad.reason });
    }
  }
  return { credited, refused };
}
