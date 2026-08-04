/**
 * When the next letter is allowed through.
 *
 * The rule used to be that *every* key in play had to be above the bar at the
 * same moment. That sounds like a fair standard and behaves like a trap,
 * because it is a conjunction: with twenty-six keys and one the learner is
 * genuinely fighting, the whole set is green on roughly one lesson in fifty.
 * The same learner with ten keys clears it every five. So the gate gets
 * *slower the further you get*, which is exactly backwards — the person being
 * punished hardest is the one who has done the most.
 *
 * And the failure is invisible. Every other key is fine, the overall speed is
 * fine, the practice is happening daily, and nothing new arrives for weeks.
 * From inside, that is indistinguishable from an app that has stopped working,
 * and the reasonable response is to go and find a different one.
 *
 * So the standard is high but no longer unanimous: a small number of laggards
 * may sit below the bar without holding the rest of the alphabet hostage. The
 * merit is preserved — nearly everything still has to be at speed, and the
 * allowance never grows past a few — while the one stubborn key becomes
 * something to work on rather than a locked door. The focus and the spaced
 * repetition both keep pointing at it, so it still gets drilled; it just no
 * longer decides whether anything else can happen.
 */

/** Keys in play before any laggard is forgiven at all. */
const FORGIVE_FROM = 10;

/** Never forgive more than this, however long it has been. */
const MAX_ALLOWANCE = 3;

/**
 * Lessons of unrewarded practice before the gate gives a little more ground.
 *
 * The valve for the case the strict rule cannot see: somebody putting in real,
 * consistent work who happens to have one key that will take months. Twenty
 * lessons is long enough that it is plainly a wall rather than a bad evening.
 */
const PATIENCE = 20;

/**
 * How many keys may still be below the bar without blocking the next letter.
 *
 * One per ten keys in play, so the allowance grows with the conjunction it is
 * there to offset, plus one more once the learner has clearly been stuck.
 */
export function laggardAllowance(
  inPlay: number,
  lessonsSinceUnlock: number,
): number {
  if (inPlay < FORGIVE_FROM) {
    // A small set is nearly all fundamentals, and one weak key among six is a
    // much bigger hole than one among twenty-six.
    return 0;
  }
  const base = Math.floor(inPlay / FORGIVE_FROM);
  const stuck = lessonsSinceUnlock >= PATIENCE ? 1 : 0;
  return Math.min(MAX_ALLOWANCE, base + stuck);
}

/** Whether the next letter may be introduced. */
export function canUnlock({
  passed,
  inPlay,
  lessonsSinceUnlock,
}: {
  /** Keys currently at or above the bar. */
  readonly passed: number;
  readonly inPlay: number;
  readonly lessonsSinceUnlock: number;
}): boolean {
  return inPlay - passed <= laggardAllowance(inPlay, lessonsSinceUnlock);
}
