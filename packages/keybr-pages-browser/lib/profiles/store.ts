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

const KEY = "keylearn.household";

const EMPTY: Household = { profiles: [], activeId: null };

export function loadHousehold(): Household {
  try {
    const raw = localStorage.getItem(KEY);
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
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    // Storage may be unavailable / full.
  }
}

// Ids are short, stable and readable. Math.random is banned in some contexts
// (workflow scripts) but fine in the browser store.
function newId(): string {
  return "p" + Math.random().toString(36).slice(2, 9);
}

export function addProfile(h: Household, data: Omit<Profile, "id">): Household {
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
