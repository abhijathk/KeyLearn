// Per-profile local storage namespacing. Each household profile behaves like
// its own account: results, settings, kids-game scores and preferences are
// all keyed by the active profile. The household itself is written by the
// account page; this module only reads it.

import { getPageData } from "./pagedata.tsx";

/**
 * Households are stored under a per-account key, so one login can never see
 * another account's learner profiles on a shared device. Signed out there is
 * no household at all.
 */
export function householdStorageKey(): string | null {
  try {
    const id = getPageData()?.publicUser?.id ?? null;
    return id == null ? null : `keylearn.household.${id}`;
  } catch {
    return null;
  }
}

type StoredHousehold = {
  profiles?: { id: string; birthYear?: number | null }[];
  activeId?: string | null;
};

function readHousehold(): StoredHousehold | null {
  try {
    const key = householdStorageKey();
    if (key == null) {
      return null;
    }
    const raw = localStorage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as StoredHousehold);
  } catch {
    return null;
  }
}

/** The id of the active household profile, or null when none is selected. */
export function activeProfileId(): string | null {
  const parsed = readHousehold();
  if (parsed == null) {
    return null;
  }
  const id = parsed.activeId ?? null;
  if (id != null && (parsed.profiles ?? []).some((p) => p.id === id)) {
    return id;
  }
  return null;
}

/** The birth year of the active household profile, or null when unknown. */
export function activeProfileBirthYear(): number | null {
  const parsed = readHousehold();
  if (parsed == null) {
    return null;
  }
  const profile = (parsed.profiles ?? []).find((p) => p.id === parsed.activeId);
  const year = profile?.birthYear;
  return typeof year === "number" && Number.isFinite(year) ? year : null;
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
