import { LocalDate } from "./localdate.ts";
import { type Result } from "./result.ts";

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
 */
export function dailyStreak(results: readonly Result[]): number {
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
  while (days.has(new LocalDate(now).value)) {
    streak += 1;
    now -= dayMs;
  }
  return streak;
}
