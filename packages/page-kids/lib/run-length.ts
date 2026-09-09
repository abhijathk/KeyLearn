/**
 * How far a passage carries a character along the trail.
 *
 * Its own module so it can be tested: it is arithmetic with no scene, no
 * renderer and no DOM behind it, and importing `world.ts` to reach it
 * drags in three.js and the whole page.
 */

export const RUN_LEN = 64;

/**
 * The furthest a character may travel per keystroke before its feet start
 * to slide.
 *
 * Ground speed on the trail is decided by typing, not by the clip: a
 * passage carries you from `runStart` to `runEnd` however many characters
 * it happens to contain. `RUN_LEN` was fixed, so a short passage covered
 * the same 64 units as a long one and each keystroke had to move the
 * character further — which the gait, tuned to one cycle length, cannot
 * absorb. At 2.67 units per keystroke the five-year-olds' characters were
 * skating.
 *
 * Measured across the bands, and it is not an age problem: `wordCount`
 * grows as keys unlock, so every band runs fast at the start of its own
 * curriculum and settles as the passages lengthen. 5-6 ranged 2.67 -> 1.78,
 * 7-8 1.29 -> 0.90, 9-10 0.83 -> 0.57. The ceiling below is the busiest
 * figure nobody has ever reported as sliding — 7-8 on a full passage — so
 * it is taken from the game rather than chosen.
 */
export const MAX_UNITS_PER_KEY = 0.9;

/**
 * How far this passage should carry them.
 *
 * A cap, never a stretch: a passage long enough to earn the full 64 units
 * still gets them, so every band that reads correctly today is untouched.
 * Only the runs that were outpacing their own gait are brought down.
 */
export function runLengthFor(passageChars: number): number {
  if (!Number.isFinite(passageChars) || passageChars <= 0) return RUN_LEN;
  return Math.min(RUN_LEN, passageChars * MAX_UNITS_PER_KEY);
}
