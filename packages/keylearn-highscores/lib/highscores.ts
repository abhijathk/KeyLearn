import { type Layout } from "@keylearn/keyboard";
import { type Result } from "@keylearn/result";

export type HighScoresRow = {
  readonly user: number;
  /**
   * The learner who actually typed this, or null for rows recorded before
   * results were attributed per profile. A household has several grown-ups; the
   * account holder is not necessarily the one who set the score.
   */
  readonly profile: number | null;
  readonly layout: Layout;
  readonly timeStamp: Date;
  readonly time: number;
  readonly length: number;
  readonly errors: number;
  readonly complexity: number;
  readonly speed: number;
  readonly score: number;
};

/** Which window a ranking covers. */
export type Range = "week" | "month" | "overall";

export const RANGE_MS: Record<Exclude<Range, "overall">, number> = {
  week: 7 * 24 * 3600 * 1000,
  month: 30 * 24 * 3600 * 1000,
};

/** How long a raw result is retained for the rolling windows. */
export const BUFFER_MS = 30 * 24 * 3600 * 1000;

/** A ceiling on the buffer, so a burst of activity cannot grow it without end. */
export const MAX_BUFFERED = 50_000;

/**
 * The leaderboard's stored state.
 *
 * Two collections, because the ranges genuinely need different data:
 *
 *  - `best` — each learner's best-ever result, one row apiece, kept for good.
 *    This is what "Overall" ranks, and what makes a rank outside the top 20
 *    computable at all.
 *  - `recent` — qualifying results from the last 30 days. The week and month
 *    boards are derived from these, because a sliding window cannot be answered
 *    from a stored best alone.
 *
 * A learner is identified by (user, profile): a household has several
 * grown-ups, and the account holder is not necessarily the one who typed.
 */
export type HighScoresData = {
  readonly best: readonly HighScoresRow[];
  readonly recent: readonly HighScoresRow[];
};

function learnerKey(row: HighScoresRow): string {
  return `${row.user}:${row.profile ?? ""}`;
}

export class HighScores {
  #best: Map<string, HighScoresRow>;
  #recent: HighScoresRow[];
  #dirty: boolean;

  constructor(
    data: HighScoresData | readonly HighScoresRow[] = { best: [], recent: [] },
  ) {
    // An array is the pre-split on-disk format; treat it as bests so an
    // existing table is carried over rather than discarded.
    const { best, recent } = Array.isArray(data)
      ? { best: data as readonly HighScoresRow[], recent: [] }
      : (data as HighScoresData);
    this.#best = new Map();
    for (const row of best) {
      if (row?.layout == null || row.timeStamp == null) {
        continue;
      }
      const key = learnerKey(row);
      const held = this.#best.get(key);
      if (held == null || row.score > held.score) {
        this.#best.set(key, row);
      }
    }
    this.#recent = recent.filter(
      (row) => row?.layout != null && row.timeStamp != null,
    );
    this.#dirty = false;
  }

  get dirty(): boolean {
    return this.#dirty;
  }

  toJSON(): HighScoresData {
    return { best: [...this.#best.values()], recent: this.#recent };
  }

  append(
    userId: number,
    profileId: number | null,
    results: readonly Result[],
    now: number = Date.now(),
  ): void {
    for (const result of results) {
      if (!isValidResult(result, now)) {
        continue;
      }
      const row: HighScoresRow = {
        user: userId,
        profile: profileId,
        layout: result.layout,
        timeStamp: new Date(result.timeStamp),
        time: result.time,
        length: result.length,
        errors: result.errors,
        complexity: result.complexity,
        speed: result.speed,
        score: result.score,
      };
      this.#recent.push(row);
      const key = learnerKey(row);
      const held = this.#best.get(key);
      if (held == null || row.score > held.score) {
        this.#best.set(key, row);
      }
      this.#dirty = true;
    }
    this.#prune(now);
  }

  #prune(now: number): void {
    const cutoff = now - BUFFER_MS;
    const kept = this.#recent.filter((r) => r.timeStamp.getTime() >= cutoff);
    if (kept.length !== this.#recent.length) {
      this.#recent = kept;
      this.#dirty = true;
    }
    if (this.#recent.length > MAX_BUFFERED) {
      // Drop the oldest first — the recent end is what the windows read.
      this.#recent.sort(
        (a, b) => a.timeStamp.getTime() - b.timeStamp.getTime(),
      );
      this.#recent = this.#recent.slice(this.#recent.length - MAX_BUFFERED);
      this.#dirty = true;
    }
  }

  /**
   * The ranking for a window: one row per learner, their best within it,
   * highest score first.
   */
  ranking(range: Range, now: number = Date.now()): HighScoresRow[] {
    if (range === "overall") {
      return [...this.#best.values()].sort((a, b) => b.score - a.score);
    }
    const cutoff = now - RANGE_MS[range];
    const bestIn = new Map<string, HighScoresRow>();
    for (const row of this.#recent) {
      if (row.timeStamp.getTime() < cutoff) {
        continue;
      }
      const key = learnerKey(row);
      const held = bestIn.get(key);
      if (held == null || row.score > held.score) {
        bestIn.set(key, row);
      }
    }
    return [...bestIn.values()].sort((a, b) => b.score - a.score);
  }

  /** How many learners are ranked in a window. Drives the readiness gate. */
  size(range: Range = "overall", now: number = Date.now()): number {
    return this.ranking(range, now).length;
  }
}

/**
 * The fastest speed a leaderboard entry may claim, in characters per minute.
 *
 * Results are composed by the browser and posted to the server, and the binary
 * envelope they travel in is obfuscated rather than authenticated — so a
 * determined client can assert any figure it likes. That is tolerable for a
 * user's own history, which only they see, but the high-score table is public
 * and shared, so it needs an outer bound.
 *
 * ~1500 cpm is roughly 300 wpm, comfortably above the fastest verified human
 * typists, so no genuine result is ever rejected by it. This bounds absurdity;
 * it is not a substitute for server-side verification of the keystroke stream.
 */
const MAX_PLAUSIBLE_CPM = 1500;

/** Below this a "result" is too short to be a real lesson. */
const MIN_TIME_MS = 5000;

function isValidResult(result: Result, now: number = Date.now()): boolean {
  // Simple validation rule to get rid of trivial lessons.
  // Approve results from lessons that are long and complex enough.
  if (result.length < 50 || result.complexity < 10) {
    return false;
  }
  // Reject impossible or self-contradictory figures before they reach a table
  // everyone can see.
  if (
    !Number.isFinite(result.speed) ||
    result.speed <= 0 ||
    result.speed > MAX_PLAUSIBLE_CPM
  ) {
    return false;
  }
  if (!Number.isFinite(result.time) || result.time < MIN_TIME_MS) {
    return false;
  }
  if (result.errors < 0 || result.errors > result.length) {
    return false;
  }
  // The claimed speed has to match the claimed length and duration; without
  // this a client could send a plausible speed with a nonsense timing.
  const impliedCpm = (result.length / result.time) * 60_000;
  if (impliedCpm > MAX_PLAUSIBLE_CPM * 1.05) {
    return false;
  }
  // A timestamp in the future would sit at the top of a time-ordered table
  // forever; allow a little clock skew.
  if (result.timeStamp > now + 5 * 60_000) {
    return false;
  }
  return true;
}
