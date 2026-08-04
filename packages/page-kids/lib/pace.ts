import { type Result } from "@keylearn/result";
import { type BandConfig } from "./age.ts";

/**
 * How fast a child has to type before the next letter joins their trail.
 *
 * The bands used to carry one fixed number each, and every one of them sat at
 * or above the top of its own "typical for this age" range — a five-year-old
 * was asked for 15 wpm while the band itself says five to eight is normal.
 * Kids mode also asks for *current* speed on *every* letter at once, which is
 * the strictest gate in the app pointed at its youngest users.
 *
 * Measured on a real profile: twenty-seven sessions, not one new letter, and so
 * never a growth moment and never a hatched egg — the whole reward architecture
 * of the page had never once fired for that child.
 *
 * The target therefore follows the child. Two things matter about how:
 *
 * It is built from PER-KEY speeds, not session speeds. A session average is
 * flattered by the easy letters; the gate is decided by the hardest one. Aiming
 * at the session average sets a bar the weakest key can never reach, which is
 * the trap the fixed numbers already fell into.
 *
 * And it aims near the BOTTOM of that spread, not the middle. An unlock needs
 * every key at target, so the target has to sit within reach of the slowest
 * one — then bringing up two or three laggard keys is what earns the next
 * letter, which is exactly the practice worth rewarding.
 */

/** How much more than their slow keys currently manage a child is asked for. */
const STRETCH = 1.12;

/** Sessions considered. Enough to smooth a bad run, few enough to keep up. */
const WINDOW = 12;

/** Sessions needed before the child's own pace is trusted at all. */
const MIN_SESSIONS = 3;

/**
 * Where in the child's per-key spread the bar is anchored.
 *
 * Near the bottom, because an unlock needs EVERY key at target: anchoring any
 * higher puts the bar permanently above the slowest letters and the trail can
 * never move, which is the trap the fixed numbers fell into. Anchored here, the
 * next letter is earned by bringing the worst two or three keys up by the
 * stretch — a few sessions of exactly the practice that is worth doing.
 */
const PERCENTILE = 0.1;

/**
 * Mean time-to-type per key across recent sessions, in milliseconds.
 *
 * Read straight from the result histograms, so this needs no lesson and can be
 * computed before one is built.
 */
export function perKeyTimes(
  results: readonly Result[],
): ReadonlyMap<number, number> {
  const total = new Map<number, number>();
  const count = new Map<number, number>();
  for (const result of results.slice(-WINDOW)) {
    for (const { codePoint, hitCount, timeToType } of result.histogram) {
      if (hitCount > 0 && timeToType > 0) {
        total.set(codePoint, (total.get(codePoint) ?? 0) + timeToType);
        count.set(codePoint, (count.get(codePoint) ?? 0) + 1);
      }
    }
  }
  const mean = new Map<number, number>();
  for (const [cp, sum] of total) {
    mean.set(cp, sum / (count.get(cp) ?? 1));
  }
  return mean;
}

/**
 * The speed the child's slower keys are currently managing, in characters per
 * minute, or null when there is not yet enough to say.
 */
export function slowKeyPace(results: readonly Result[]): number | null {
  if (results.length < MIN_SESSIONS) {
    return null;
  }
  const times = [...perKeyTimes(results).values()];
  if (times.length === 0) {
    return null;
  }
  // Slowest first, so a low percentile is a slow key.
  const speeds = times.map((ms) => 60000 / ms).sort((a, b) => a - b);
  const at = Math.min(
    speeds.length - 1,
    Math.floor(speeds.length * PERCENTILE),
  );
  return speeds[at];
}

/**
 * The unlock target for this child right now, in characters per minute.
 *
 * Falls back to the band's floor until there are enough sessions to know
 * anything — the bottom of what the band itself calls typical, rather than the
 * old figure that sat above the top of it.
 */
export function paceTarget(
  results: readonly Result[],
  cfg: BandConfig,
): number {
  const pace = slowKeyPace(results);
  if (pace == null) {
    return cfg.paceFloor;
  }
  return Math.round(
    Math.max(cfg.paceFloor, Math.min(cfg.paceCeil, pace * STRETCH)),
  );
}
