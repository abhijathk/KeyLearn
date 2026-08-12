import { LocalDate } from "./localdate.ts";

/**
 * Consecutive days practised, counting back from today.
 *
 * Derived from the results themselves rather than from a separate tally, so
 * every page that shows a streak shows the same number. The kids page used to
 * keep its own list of days in local storage, which meant Classic — a screen
 * that saves exactly the same results as the grown-up page — could disagree
 * with the grown-up page about how long the learner had been going.
 *
 * A day not yet practised does not break the streak: the count runs to
 * yesterday until something is recorded today, because a streak that resets at
 * midnight punishes people for not having practised yet.
 *
 * `grace` is how many missed days a run survives. Nought is the ordinary
 * streak. One or more is for a learner who has asked for it — a streak is a
 * loss-aversion device, and for somebody with a fatiguing illness, or an
 * anxious child, it punishes exactly the rest they were told to take. The
 * missed days are not counted, only forgiven: seven days practised across nine
 * reads seven, so the number stays a true count of days at the keyboard.
 */
export function dailyStreak(
  // Only the day each result landed on matters, so anything carrying a
  // timestamp will do. Narrower than this and the profile page cannot call it,
  // which is how it came to keep a second copy of the algorithm and disagree
  // with every other page about the same learner.
  results: readonly { readonly timeStamp: number }[],
  grace = 0,
): number {
  if (results.length === 0) {
    return 0;
  }
  const days = new Set(
    results.map(({ timeStamp }) => new LocalDate(timeStamp).value),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  let now = Date.now();
  if (!days.has(new LocalDate(now).value)) {
    now -= dayMs;
  }
  let streak = 0;
  let missed = 0;
  while (missed <= grace) {
    if (days.has(new LocalDate(now).value)) {
      streak += 1;
    } else if (streak === 0) {
      // Nothing has started yet; a gap before the first day practised is not
      // a gap in anything.
      break;
    } else {
      missed += 1;
    }
    now -= dayMs;
  }
  return streak;
}
