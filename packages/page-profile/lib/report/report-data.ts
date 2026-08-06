// Everything the printed report needs, derived from the results already
// loaded for the learner whose tab is open. Nothing here fetches: a report is
// a view of what the profile page is already showing, which is also why the
// numbers on the two can never disagree.

import { type Result } from "@keylearn/result";

export type Period = "30d" | "3m" | "year" | "all";

export const PERIOD_DAYS: Readonly<Record<Period, number | null>> = {
  "30d": 30,
  "3m": 91,
  "year": 365,
  "all": null,
};

export type Point = { readonly at: number; readonly speed: number };

export type ReportData = {
  readonly count: number;
  readonly from: number;
  readonly to: number;
  /** Total time at the keyboard, in minutes. */
  readonly minutes: number;
  /** Days with at least one lesson, within the period. */
  readonly daysPractised: number;
  readonly daysInPeriod: number;
  readonly typicalSpeed: number;
  readonly bestSpeed: number;
  readonly accuracy: number;
  /** Change against the first fifth of the period, or null when too short. */
  readonly speedGain: number | null;
  readonly accuracyGain: number | null;
  readonly points: readonly Point[];
  /** Lesson counts by accuracy, from 90% to 100% in twelve buckets. */
  readonly accuracyBuckets: readonly number[];
  /** The longest gap in practice, in days, and when it started. */
  readonly longestGap: { readonly days: number; readonly at: number } | null;
};

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) {
    return 0;
  }
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * `now` is passed rather than read so the report is a pure function of its
 * inputs — a report generated twice from the same data is the same report,
 * which matters when somebody prints one and then prints it again.
 */
export function reportData(
  results: readonly Result[],
  period: Period,
  now: number,
): ReportData | null {
  const days = PERIOD_DAYS[period];
  const since = days == null ? 0 : now - days * DAY;
  const rows = results
    .filter((r) => r.timeStamp >= since)
    .sort((a, b) => a.timeStamp - b.timeStamp);
  if (rows.length === 0) {
    return null;
  }

  const speeds = rows.map((r) => r.speed);
  const from = rows[0].timeStamp;
  const to = rows[rows.length - 1].timeStamp;

  // A fifth of the lessons at each end, so "improvement" is a comparison of
  // two settled figures rather than of the first and last lesson — either of
  // which could be an outlier.
  const slice = Math.max(1, Math.floor(rows.length / 5));
  const early = rows.slice(0, slice);
  const late = rows.slice(-slice);
  const enough = rows.length >= 10;

  const dayKeys = new Set(rows.map((r) => Math.floor(r.timeStamp / DAY)));
  const sortedDays = [...dayKeys].sort((a, b) => a - b);
  let longestGap: ReportData["longestGap"] = null;
  for (let i = 1; i < sortedDays.length; i++) {
    const gap = sortedDays[i] - sortedDays[i - 1] - 1;
    if (gap > 0 && (longestGap == null || gap > longestGap.days)) {
      longestGap = { days: gap, at: sortedDays[i - 1] * DAY };
    }
  }

  const buckets = new Array(12).fill(0);
  for (const r of rows) {
    // 90% and below all land in the first bucket: below that the lesson was
    // not really a lesson, and a long empty tail would squash the rest.
    const t = Math.max(0, Math.min(0.999, (r.accuracy - 0.9) / 0.1));
    buckets[Math.floor(t * 12)] += 1;
  }

  return {
    count: rows.length,
    from,
    to,
    minutes: Math.round(rows.reduce((sum, r) => sum + r.time, 0) / 60000),
    daysPractised: dayKeys.size,
    daysInPeriod: Math.max(1, Math.round((to - from) / DAY)) + 1,
    typicalSpeed: median(speeds),
    bestSpeed: Math.max(...speeds),
    accuracy: median(rows.map((r) => r.accuracy)),
    speedGain: enough
      ? median(late.map((r) => r.speed)) - median(early.map((r) => r.speed))
      : null,
    accuracyGain: enough
      ? median(late.map((r) => r.accuracy)) -
        median(early.map((r) => r.accuracy))
      : null,
    points: rows.map((r) => ({ at: r.timeStamp, speed: r.speed })),
    accuracyBuckets: buckets,
    longestGap,
  };
}

/** A trailing mean, which is what a reader should actually follow. */
export function smooth(
  points: readonly Point[],
  window = 7,
): readonly number[] {
  return points.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = points.slice(from, i + 1);
    return slice.reduce((sum, p) => sum + p.speed, 0) / slice.length;
  });
}
