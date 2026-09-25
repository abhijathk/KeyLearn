import { type LearnerOwner } from "@keylearn/config";
import { type Profile } from "@keylearn/database";

/**
 * Whose folder a learner's files live in (docs/organisations.md, "Where
 * mode-A files live").
 *
 * A household learner's belong to the account that owns the profile — not to
 * whoever is signed in, which for a teacher reading a guardian's grant is
 * somebody else entirely. An organisation-owned learner (mode A) has no
 * account behind them at all, so their files belong to the organisation.
 *
 * This answers WHERE only. WHETHER the caller may touch them is the
 * resolver's question (`reachProfile`), and every route asks it first.
 *
 * Null only for a profile with neither owner, which the storage CHECK on
 * `profile` forbids.
 */
export function learnerOwner(profile: Profile): LearnerOwner | null {
  if (profile.userId != null) {
    return profile.userId;
  }
  if (profile.organizationId != null) {
    return { organizationId: profile.organizationId };
  }
  return null;
}
