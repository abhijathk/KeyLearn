// Per-profile storage namespacing. The household profiles themselves now live
// server-side (see PageData.profiles); only the *active selection* is a
// per-device preference kept in localStorage, since which learner is at this
// keyboard right now is a device fact, not account data.

import { getPageData } from "./pagedata.tsx";

/** localStorage key holding the active profile id, scoped per account. */
function activeProfileKey(): string | null {
  try {
    const id = getPageData()?.publicUser?.id ?? null;
    return id == null ? null : `keylearn.activeProfile.${id}`;
  } catch {
    return null;
  }
}

export function loadActiveProfileId(): string | null {
  try {
    const key = activeProfileKey();
    return key == null ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveActiveProfileId(id: string | null): void {
  try {
    const key = activeProfileKey();
    if (key == null) {
      return;
    }
    if (id == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, id);
    }
  } catch {
    // Storage may be unavailable.
  }
}

/** The active profile from page data, validated against the current account. */
function activeProfileFromPage(): {
  readonly id: string;
  readonly birthYear: number | null;
} | null {
  const id = loadActiveProfileId();
  if (id == null) {
    return null;
  }
  const profiles = getPageData()?.profiles ?? [];
  return profiles.find((p) => p.id === id) ?? null;
}

/** The id of the active household profile, or null when none is selected. */
export function activeProfileId(): string | null {
  return activeProfileFromPage()?.id ?? null;
}

/** The birth year of the active household profile, or null when unknown. */
export function activeProfileBirthYear(): number | null {
  const year = activeProfileFromPage()?.birthYear;
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
