// Lightweight, per-device history for the Speed Test, so we can show a personal
// best, a recent trajectory and a day streak. Stored in localStorage (the test
// results are deliberately kept out of the practice/guided-lesson history).

export type TestMode = "time" | "words" | "passage";

export type SpeedTestRecord = {
  /** Epoch millis when the test finished. */
  readonly ts: number;
  /** Speed in characters per minute (the app's native unit). */
  readonly cpm: number;
  /** Accuracy, 0..1. */
  readonly accuracy: number;
  readonly mode: TestMode;
  /** e.g. "30s", "25 words". */
  readonly lengthLabel: string;
  readonly chars: number;
  readonly errors: number;
};

export type SpeedTestSummary = {
  /** The fastest run ever (max cpm), or null if none. */
  readonly best: SpeedTestRecord | null;
  /** Most recent runs, oldest→newest, capped. */
  readonly recent: readonly SpeedTestRecord[];
  /** Consecutive calendar days with at least one run, ending today. */
  readonly streakDays: number;
  readonly count: number;
};

const KEY = "keylearn.speedtest.history";
const MAX = 200;

function load(): SpeedTestRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SpeedTestRecord[]) : [];
  } catch {
    return [];
  }
}

function save(list: readonly SpeedTestRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // Storage may be unavailable.
  }
}

/** Append a finished test and return the updated summary. */
export function recordTest(record: SpeedTestRecord): SpeedTestSummary {
  const list = load();
  list.push(record);
  save(list);
  return summarize(list);
}

/** The summary as it stands before the current run (best/recent/streak). */
export function loadSummary(recentCount = 7): SpeedTestSummary {
  return summarize(load(), recentCount);
}

function summarize(
  list: readonly SpeedTestRecord[],
  recentCount = 7,
): SpeedTestSummary {
  let best: SpeedTestRecord | null = null;
  for (const r of list) {
    if (best == null || r.cpm > best.cpm) {
      best = r;
    }
  }
  return {
    best,
    recent: list.slice(-recentCount),
    streakDays: streakOf(list),
    count: list.length,
  };
}

// Local calendar day key, so a streak survives across time zones sensibly.
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function streakOf(list: readonly SpeedTestRecord[]): number {
  if (list.length === 0) {
    return 0;
  }
  const days = new Set(list.map((r) => dayKey(r.ts)));
  let streak = 0;
  const cursor = new Date();
  // Walk back from today; a gap of one full day breaks the streak.
  for (;;) {
    if (days.has(dayKey(cursor.getTime()))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
