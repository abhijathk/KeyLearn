import { type KeyStatsMap } from "@keybr/result";
import { type LessonKey } from "./key.ts";

// Rounds of practice after which a just-learned key becomes due for review.
// The interval scales with how well the key is known, so solid keys resurface
// less often — a lightweight, self-contained half-life schedule.
const HALF_LIFE_BASE = 5;
const URGENT_FACTOR = 2;

export type DueKey = {
  readonly key: LessonKey;
  /** How overdue the key is; ≥ 1 means past its review interval. */
  readonly dueScore: number;
};

/**
 * Spaced-repetition scheduler. Among the included keys, find the one most
 * overdue for review — the key learned long enough ago (relative to a
 * confidence-scaled half-life) that its skill has likely decayed.
 */
export function findDueKey(
  keyStatsMap: KeyStatsMap,
  includedKeys: readonly LessonKey[],
): DueKey | null {
  const totalRounds = keyStatsMap.results.length;
  let best: DueKey | null = null;
  for (const key of includedKeys) {
    const confidence = key.bestConfidence ?? 0;
    if (confidence < 1) {
      continue; // Only review keys that were actually learned.
    }
    const { samples } = keyStatsMap.get(key.letter);
    if (samples.length === 0) {
      continue;
    }
    const lastIndex = samples[samples.length - 1].index;
    const recency = totalRounds - lastIndex; // rounds since last practiced
    const halfLife = HALF_LIFE_BASE * (0.5 + Math.min(confidence, 3));
    const dueScore = recency / halfLife;
    if (dueScore >= 1 && (best == null || dueScore > best.dueScore)) {
      best = { key, dueScore };
    }
  }
  return best;
}

/** A key so overdue it should interrupt active learning to be reviewed. */
export function isUrgent(due: DueKey): boolean {
  return due.dueScore >= URGENT_FACTOR;
}
