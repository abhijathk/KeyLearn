// Household profiles are owned by the account and stored server-side (see
// PageData.profiles and the /_/profiles API). This module holds the shared
// types and the pure, storage-agnostic helpers used across the profile UI.

import {
  type ProfileAvatar,
  type ProfileDetails,
  type ProfileKind,
} from "@keybr/pages-shared";

export type { ProfileKind };
export type Avatar = ProfileAvatar;
export type Profile = ProfileDetails;

export type Household = {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
};

// A household holds at most this many profiles, kids and grown-ups mixed —
// four on a free account, eight with premium. (The server enforces the cap.)
export const MAX_PROFILES_FREE = 4;
export const MAX_PROFILES_PREMIUM = 8;

/** Back-compat default cap (free tier). Prefer maxProfiles(premium). */
export const MAX_PROFILES = MAX_PROFILES_FREE;

export function maxProfiles(premium: boolean): number {
  return premium ? MAX_PROFILES_PREMIUM : MAX_PROFILES_FREE;
}

export function activeProfile(h: Household): Profile | null {
  return h.profiles.find((p) => p.id === h.activeId) ?? null;
}

export function adultProfiles(h: Household): readonly Profile[] {
  return h.profiles.filter((p) => p.kind === "adult");
}

/**
 * Learners a keybr history can be imported into.
 *
 * Grown-ups who are not on braille. Kids were never offered — the import is a
 * grown-up's own typing history. Braille learners are excluded for a harder
 * reason: their progress is measured in cells and does not come from the result
 * store an import writes to, so choosing one would appear to work and then
 * change nothing.
 */
export function importTargets(h: Household): readonly Profile[] {
  return h.profiles.filter((p) => p.kind === "adult" && !p.visionSupport);
}

/**
 * The result-history namespace for a profile. Kept stable and distinct from
 * the default "history" store so each learner's progress is their own.
 */
export function historyNamespace(profile: Profile | null): string | null {
  return profile != null ? `profile-${profile.id}` : null;
}

/** Age in whole years from a birth year, using a caller-supplied "now" year. */
export function ageOf(profile: Profile, thisYear: number): number | null {
  return profile.birthYear != null ? thisYear - profile.birthYear : null;
}
