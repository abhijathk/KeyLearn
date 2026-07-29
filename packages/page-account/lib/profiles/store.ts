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
