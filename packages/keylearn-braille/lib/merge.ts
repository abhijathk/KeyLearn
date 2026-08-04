import { type CellStat } from "./progress.ts";
import { type DayStats, type Snapshot } from "./storage.ts";

/**
 * Combining one learner's braille progress from two devices.
 *
 * Progress was device-local, so a learner who moved machines started again at
 * the first five cells with everything they had done still sitting in a browser
 * they were no longer using. Syncing it raises the question this file answers:
 * what happens when both sides have work in them.
 *
 * Nothing here is a clock comparison, because the two sides are not versions of
 * the same document — they are two records of real practice, and discarding
 * either would be discarding sessions somebody actually sat through. Every
 * field is merged on what it means:
 *
 *  - hits and misses are counters, so the larger is the one that has seen more;
 *  - the days practised are a set, so the union is simply correct;
 *  - a day's tally is per-day, so days present on one side are kept whole and a
 *    day worked on both takes the larger figures;
 *  - the recent windows come from whichever side is further along, since
 *    interleaving two devices' last twenty attempts would describe a session
 *    that never happened.
 */

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function mergeStat(a: CellStat, b: CellStat): CellStat {
  // Whichever side has more entries behind it is the one whose recent history
  // is the more informative, and its windows are taken whole rather than
  // spliced with the other's.
  const richer = a.hits + a.misses >= b.hits + b.misses ? a : b;
  return {
    hits: Math.max(num(a.hits), num(b.hits)),
    misses: Math.max(num(a.misses), num(b.misses)),
    bestMs:
      a.bestMs == null
        ? b.bestMs
        : b.bestMs == null
          ? a.bestMs
          : Math.min(a.bestMs, b.bestMs),
    recentMs: richer.recentMs ?? [],
    recent: richer.recent ?? [],
  };
}

function mergeDay(a: DayStats, b: DayStats): DayStats {
  return {
    hits: Math.max(num(a.hits), num(b.hits)),
    misses: Math.max(num(a.misses), num(b.misses)),
    totalMs: Math.max(num(a.totalMs), num(b.totalMs)),
    timed: Math.max(num(a.timed), num(b.timed)),
    bestMs:
      a.bestMs == null
        ? b.bestMs
        : b.bestMs == null
          ? a.bestMs
          : Math.min(a.bestMs, b.bestMs),
  };
}

function statsOf(value: unknown): Record<string, CellStat> {
  return value != null && typeof value === "object"
    ? (value as Record<string, CellStat>)
    : {};
}

/** One learner's progress from two devices, with nothing thrown away. */
export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const left = statsOf(a.progress);
  const right = statsOf(b.progress);
  const progress: Record<string, CellStat> = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const one = left[key];
    const other = right[key];
    if (key === "#reached") {
      // Not a cell: the high-water mark of how far the curriculum has gone.
      // The further side wins, or syncing from a stale device would take away
      // cells the learner has already been taught.
      progress[key] = Math.max(
        Number(one) || 0,
        Number(other) || 0,
      ) as unknown as CellStat;
    } else if (one == null || other == null) {
      progress[key] = (one ?? other)!;
    } else {
      progress[key] = mergeStat(one, other);
    }
  }

  const daily: Record<string, DayStats> = { ...a.daily };
  for (const [day, stat] of Object.entries(b.daily ?? {})) {
    daily[day] = daily[day] == null ? stat : mergeDay(daily[day], stat);
  }

  return {
    progress,
    // Newest first, which is the order the streak counter reads them in.
    days: [...new Set([...(a.days ?? []), ...(b.days ?? [])])].sort().reverse(),
    daily,
    savedAt: Math.max(num(a.savedAt), num(b.savedAt)),
  };
}
