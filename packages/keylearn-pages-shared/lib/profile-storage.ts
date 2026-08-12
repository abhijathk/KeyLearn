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

/**
 * Fired whenever the learner at the keyboard changes. Anything keyed by
 * profile — the accent theme is the first — listens for this rather than
 * being wired to the profiles provider, so no package has to depend on
 * another just to notice a switch.
 */
export const PROFILE_CHANGED_EVENT = "keylearn:profile-changed";

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
  try {
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
  } catch {
    // No window during server rendering.
  }
}

/** The active profile from page data, validated against the current account. */
function activeProfileFromPage(): {
  readonly id: string;
  readonly kind: "adult" | "kid";
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

/** The kind of the active household profile, or null when none is selected. */
export function activeProfileKind(): "adult" | "kid" | null {
  return activeProfileFromPage()?.kind ?? null;
}

/** The birth year of the active household profile, or null when unknown. */
/**
 * The active learner's generated painting, when they have one. The share card
 * draws the same family and seed as a bleed behind its text, so the card is
 * recognisably theirs without their name being on it.
 */
export function activeProfileArt(): {
  readonly family: string;
  readonly seed: number;
} | null {
  const id = loadActiveProfileId();
  const profile = (getPageData()?.profiles ?? []).find((p) => p.id === id);
  const avatar = profile?.avatar ?? null;
  return avatar != null && avatar.type === "art"
    ? { family: avatar.family, seed: avatar.seed }
    : null;
}

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
  return profileStorageKeyFor(activeProfileId(), base);
}

/**
 * The same namespacing for a named profile rather than the active one. A
 * parent setting a child's theme is editing a profile they are not currently
 * using, so the key cannot come from the active selection.
 */
export function profileStorageKeyFor(
  profileId: string | null,
  base: string,
): string {
  return profileId == null ? base : `profile-${profileId}.${base}`;
}

/** The courses a learner's history can belong to. */
export type CourseId = "guided" | "classic";

/**
 * Which course a learner is on.
 *
 * Classic is a course in its own right, not a skin over guided practice: it
 * picks its own letters in its own order and keeps its own history, so speed
 * and progress earned in one say nothing about the other. Anything reporting a
 * learner's progress has to ask which course it is reporting on, including for
 * a learner who is not the one at the keyboard.
 */
export function courseOf(profileId: string | null): CourseId {
  try {
    const raw = localStorage.getItem(
      profileStorageKeyFor(profileId, "kids.prefs"),
    );
    if (raw == null) {
      return "guided";
    }
    return JSON.parse(raw)?.classic === true ? "classic" : "guided";
  } catch {
    return "guided";
  }
}

/** Whether this learner has ever been put on Classic. */
export function classicCourseActive(profileId: string | null): boolean {
  return courseOf(profileId) === "classic";
}

/**
 * The history namespace for one learner on one course. Guided keeps the
 * unsuffixed name it has always had, so no existing history moves.
 */
export function courseNamespace(
  profileId: string,
  course: CourseId = "guided",
): string {
  return course === "classic"
    ? `profile-${profileId}.classic`
    : `profile-${profileId}`;
}

/**
 * The learner a history namespace belongs to, or null for the bare account.
 *
 * Namespaces carry a course suffix; the per-learner storage keys do not, so
 * anything crossing from one to the other has to drop it.
 */
export function profileIdOfNamespace(
  namespace: string | null | undefined,
): string | null {
  if (namespace == null) {
    return null;
  }
  const parsed = /^profile-([^.]+)/.exec(namespace);
  return parsed?.[1] ?? null;
}

/**
 * Everything a learner's practice has left in local storage, erased.
 *
 * Results live on the server; the kids game's best score, the land it reached,
 * its sticker album and the days it counted do not — they are local, and
 * "erase all my data" was quietly leaving every one of them behind. A learner
 * who reset their profile and still saw yesterday's best score was told, by
 * the app, that the reset had not worked.
 *
 * Preferences are not progress and are not touched: the world they chose, the
 * name they gave their companion, their sound and keyboard settings all
 * survive, because none of them is a record of what they did.
 */
export function clearProfileProgress(profileId: string | null): void {
  const progress = [
    "kids.best",
    "kids.days",
    "kids.album",
    "kids.land",
    "kids.restNudged",
    "kids.stars",
  ];
  for (const base of progress) {
    try {
      localStorage.removeItem(profileStorageKeyFor(profileId, base));
    } catch {
      // Storage may be unavailable; the results are already gone either way.
    }
  }
}
