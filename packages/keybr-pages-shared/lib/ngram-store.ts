import { NgramStats } from "@keybr/result";
import { profileStorageKey } from "./profile-storage.ts";

// Per-profile n-gram weakness statistics, persisted in local storage so the
// bottleneck drill keeps improving across sessions (and the profile page can
// chart it) instead of resetting every reload. Namespaced by profile, so each
// household member — including kids — accrues their own transition data.
const KEY = "keylearn.ngrams";

/**
 * The storage key for a profile's n-gram data.
 *
 * When an explicit `namespace` is given (e.g. "profile-p123", or null for the
 * default history) it is used verbatim — this is how the profile page reads and
 * clears the *selected* learner's data, which may differ from the globally
 * active profile. When omitted, it falls back to the active profile, which is
 * always correct during practice (you practise as the active profile).
 */
function ngramKey(namespace?: string | null): string {
  if (namespace === undefined) {
    return profileStorageKey(KEY);
  }
  return namespace != null ? `${namespace}.${KEY}` : KEY;
}

export function loadNgramStats(namespace?: string | null): NgramStats {
  try {
    const raw = localStorage.getItem(ngramKey(namespace));
    if (raw != null) {
      return NgramStats.fromJSON(JSON.parse(raw));
    }
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return new NgramStats();
}

/** Wipes a profile's n-gram data (the "slowest transitions"). */
export function clearNgramStats(namespace?: string | null): void {
  try {
    localStorage.removeItem(ngramKey(namespace));
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

export function saveNgramStats(
  stats: NgramStats,
  namespace?: string | null,
): void {
  try {
    localStorage.setItem(ngramKey(namespace), JSON.stringify(stats.toJSON()));
  } catch {
    // Storage may be full or unavailable; losing the update is harmless.
  }
}
