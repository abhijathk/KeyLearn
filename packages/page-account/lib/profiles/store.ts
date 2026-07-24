// The household profiles live entirely on this device (localStorage). Only
// the admin has a real account; profiles are Netflix-style sub-identities,
// so no child PII ever leaves the browser — a deliberate COPPA-clean choice.

export type ProfileKind = "adult" | "kid";

export type Avatar =
  | { readonly type: "icon"; readonly id: string }
  | { readonly type: "photo"; readonly dataUrl: string };

export type Profile = {
  readonly id: string;
  readonly kind: ProfileKind;
  readonly firstName: string;
  readonly lastName: string;
  /** Birth year — the only date fact we keep, and only for kids' defaults. */
  readonly birthYear: number | null;
  readonly avatar: Avatar;
};

export type Household = {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
};

import { householdStorageKey } from "@keybr/pages-shared";

const EMPTY: Household = { profiles: [], activeId: null };

export function loadHousehold(): Household {
  try {
    // Signed out there is no key and therefore no household.
    const key = householdStorageKey();
    if (key == null) {
      return EMPTY;
    }
    const raw = localStorage.getItem(key);
    if (raw == null) {
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as Household;
    if (!Array.isArray(parsed.profiles)) {
      return EMPTY;
    }
    return {
      profiles: parsed.profiles,
      activeId:
        parsed.activeId != null &&
        parsed.profiles.some((p) => p.id === parsed.activeId)
          ? parsed.activeId
          : null,
    };
  } catch {
    return EMPTY;
  }
}

export function saveHousehold(h: Household): void {
  try {
    const key = householdStorageKey();
    if (key == null) {
      return;
    }
    localStorage.setItem(key, JSON.stringify(h));
  } catch {
    // Storage may be unavailable / full.
  }
}

// Ids are short, stable and readable. Math.random is banned in some contexts
// (workflow scripts) but fine in the browser store.
function newId(): string {
  return "p" + Math.random().toString(36).slice(2, 9);
}

// A household holds at most this many profiles, kids and grown-ups mixed —
// four on a free account, eight with premium.
export const MAX_PROFILES_FREE = 4;
export const MAX_PROFILES_PREMIUM = 8;

/** Back-compat default cap (free tier). Prefer maxProfiles(premium). */
export const MAX_PROFILES = MAX_PROFILES_FREE;

export function maxProfiles(premium: boolean): number {
  return premium ? MAX_PROFILES_PREMIUM : MAX_PROFILES_FREE;
}

export function addProfile(
  h: Household,
  data: Omit<Profile, "id">,
  max: number = MAX_PROFILES_FREE,
): Household {
  if (h.profiles.length >= max) {
    return h; // The UI hides the add tile at the cap; this is the backstop.
  }
  const profile: Profile = { ...data, id: newId() };
  return {
    profiles: [...h.profiles, profile],
    // The first profile created becomes the active one.
    activeId: h.activeId ?? profile.id,
  };
}

export function updateProfile(
  h: Household,
  id: string,
  patch: Partial<Omit<Profile, "id">>,
): Household {
  return {
    ...h,
    profiles: h.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

export function removeProfile(h: Household, id: string): Household {
  const profiles = h.profiles.filter((p) => p.id !== id);
  return {
    profiles,
    activeId: h.activeId === id ? (profiles[0]?.id ?? null) : h.activeId,
  };
}

export function setActive(h: Household, id: string | null): Household {
  if (id != null && !h.profiles.some((p) => p.id === id)) {
    return h;
  }
  return { ...h, activeId: id };
}

export function activeProfile(h: Household): Profile | null {
  return h.profiles.find((p) => p.id === h.activeId) ?? null;
}

export function adultProfiles(h: Household): readonly Profile[] {
  return h.profiles.filter((p) => p.kind === "adult");
}

/**
 * The local result-history namespace for a profile. Kept stable and distinct
 * from the default "history" store so each learner's progress is their own.
 */
export function historyNamespace(profile: Profile | null): string | null {
  return profile != null ? `profile-${profile.id}` : null;
}

/** Age in whole years from a birth year, using a caller-supplied "now" year. */
export function ageOf(profile: Profile, thisYear: number): number | null {
  return profile.birthYear != null ? thisYear - profile.birthYear : null;
}
