// Per-profile local storage namespacing. Each household profile behaves like
// its own account: results, settings, kids-game scores and preferences are
// all keyed by the active profile. The household itself is written by the
// account page; this module only reads it.

export const HOUSEHOLD_STORAGE_KEY = "keylearn.household";

/** The id of the active household profile, or null when none is selected. */
export function activeProfileId(): string | null {
  try {
    const raw = localStorage.getItem(HOUSEHOLD_STORAGE_KEY);
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      profiles?: { id: string }[];
      activeId?: string | null;
    };
    const id = parsed.activeId ?? null;
    if (id != null && (parsed.profiles ?? []).some((p) => p.id === id)) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

/** The birth year of the active household profile, or null when unknown. */
export function activeProfileBirthYear(): number | null {
  try {
    const raw = localStorage.getItem(HOUSEHOLD_STORAGE_KEY);
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      profiles?: { id: string; birthYear?: number | null }[];
      activeId?: string | null;
    };
    const profile = (parsed.profiles ?? []).find(
      (p) => p.id === parsed.activeId,
    );
    const year = profile?.birthYear;
    return typeof year === "number" && Number.isFinite(year) ? year : null;
  } catch {
    return null;
  }
}

/**
 * Namespaces a storage key by the active profile: "kids.best" becomes
 * "profile-p123.kids.best" while a profile is selected, and stays "kids.best"
 * otherwise — so the no-profile experience is unchanged.
 */
export function profileStorageKey(base: string): string {
  const id = activeProfileId();
  return id == null ? base : `profile-${id}.${base}`;
}
