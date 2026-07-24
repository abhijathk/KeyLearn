import { NgramStats } from "@keybr/result";
import { profileStorageKey } from "./profile-storage.ts";

// Per-profile n-gram weakness statistics, persisted in local storage so the
// bottleneck drill keeps improving across sessions (and the profile page can
// chart it) instead of resetting every reload. Namespaced by profile, so each
// household member — including kids — accrues their own transition data.
const KEY = "keylearn.ngrams";

export function loadNgramStats(): NgramStats {
  try {
    const raw = localStorage.getItem(profileStorageKey(KEY));
    if (raw != null) {
      return NgramStats.fromJSON(JSON.parse(raw));
    }
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return new NgramStats();
}

export function saveNgramStats(stats: NgramStats): void {
  try {
    localStorage.setItem(
      profileStorageKey(KEY),
      JSON.stringify(stats.toJSON()),
    );
  } catch {
    // Storage may be full or unavailable; losing the update is harmless.
  }
}
