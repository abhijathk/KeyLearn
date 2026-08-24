import {
  can,
  OrgAccessEvent,
  OrgMember,
  Profile,
  ProfileAccess,
} from "@keylearn/database";

/**
 * The access chokepoint — docs/organisations.md §5.
 *
 * ONE place answers "may this actor reach this profile" (P2). Every
 * profile-scoped endpoint calls {@link reachProfile}; no endpoint answers
 * the question itself, and a test enumerates the call sites so a bypass
 * fails the suite (A3). Three branches live behind the one question:
 *
 *  - household — the phase-1 `user_id` comparison, unchanged, so
 *    existing family behaviour is preserved by construction (P1);
 *  - mode A — the profile is organisation-owned, and the actor is a
 *    member whose role allows the action, a teacher's sight ending at
 *    their batch;
 *  - mode B — a live enrolment grant lets an organisation actor reach a
 *    family-owned learner, exactly as far as the grant's batch allows,
 *    and never narrows the owning guardian's own access.
 *
 * §5.2 sits above all three: when a PIN-entered profile session is
 * active, the resolver answers ONLY for that profile — a request naming
 * a different one is refused, not silently served the session's (A5).
 */

/**
 * What the request is trying to do. Deliberately coarse — four verbs
 * cover every call site, and a finer taxonomy would be an invitation to
 * answer access questions outside the resolver again.
 */
export type ProfileAction =
  /** See the learner's data — results, settings, certificates, scores. */
  | "read"
  /** Write practice data or settings on the profile. */
  | "write"
  /** Change the profile itself — rename, convert, delete, PINs. */
  | "manage"
  /** Sit at the keyboard as this learner — races, live sessions. */
  | "practise";

export type Actor = {
  readonly userId: number;
  /**
   * The PIN-entered learner, when a profile session is active (§6.2
   * step 4: endpoints read the learner from the session, never from the
   * request). Null when no session is active — every household today.
   */
  readonly profileSessionId?: number | null;
};

/**
 * May this actor reach this profile for this action? Returns the profile
 * when yes — call sites keep the `findOwned` shape they always had — and
 * null when no, with "does not exist" and "not yours" giving the same
 * answer so an id probe learns nothing.
 */
export async function reachProfile(
  actor: Actor,
  profileId: number,
  action: ProfileAction,
): Promise<Profile | null> {
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    return null;
  }

  // §5.2 / A5: an active profile session narrows the whole world to that
  // one learner. The session's learner reads, writes and practises their
  // own data; `manage` stays with the grown-ups — a child at the keyboard
  // must not be able to rename or delete the profile they are signed
  // into, PIN or no PIN.
  if (actor.profileSessionId != null) {
    if (actor.profileSessionId !== profileId || action === "manage") {
      return null;
    }
    const profile = await Profile.query().findById(profileId);
    if (profile == null) {
      return null;
    }
    // The session was established through this same resolver's rules (the
    // enter endpoint), so reaching here again means the underlying access
    // still stands — unless it was an org whose grant has since been
    // revoked, which the checks below re-answer.
    if (profile.userId === actor.userId) {
      return profile;
    }
    return (
      (await orgReach(actor, profile, action)) ??
      (await grantReach(actor, profile, action))
    );
  }

  const profile = await Profile.query().findById(profileId);
  if (profile == null) {
    return null;
  }

  // Household: the owner reaches their own profile for everything. The
  // one comparison phase 1 always made, and still the common case.
  if (profile.userId != null && profile.userId === actor.userId) {
    return profile;
  }

  // Mode A: organisation-owned.
  if (profile.organizationId != null) {
    return await orgReach(actor, profile, action);
  }

  // Mode B: family-owned, possibly enrolled somewhere the actor works.
  if (profile.userId != null) {
    return await grantReach(actor, profile, action);
  }

  return null;
}

/**
 * What an organisation role may do to a learner, in resolver verbs.
 * Reading progress is `learners.read` (teachers included, batch-scoped);
 * managing the profile or its PIN is owner/admin. `write` and `practise`
 * are NEVER granted by a role — only the learner produces practice, and
 * the learner arrives through a profile session, not a role.
 */
function orgActionAllowed(role: string, action: ProfileAction): boolean {
  switch (action) {
    case "read":
      return can(role, "learners.read");
    case "manage":
      return can(role, "learners.pins");
    case "write":
    case "practise":
      return false;
  }
}

async function orgReach(
  actor: Actor,
  profile: Profile,
  action: ProfileAction,
): Promise<Profile | null> {
  // A profile-session actor practising as an org-owned learner: the
  // session IS the authority (established via PIN through the enter
  // endpoint); read/write/practise on itself was already allowed above.
  if (
    actor.profileSessionId === profile.id &&
    (action === "read" || action === "write" || action === "practise")
  ) {
    return profile;
  }
  const member = await OrgMember.find(profile.organizationId!, actor.userId);
  if (member == null) {
    return null;
  }
  if (!orgActionAllowed(member.role!, action)) {
    return null;
  }
  // A11: a teacher's sight ends at their batch — other batches in their
  // own organisation included.
  if (
    member.role === "teacher" &&
    (member.batchId == null || member.batchId !== (profile.batchId ?? null))
  ) {
    return null;
  }
  // A15: staff looking at an individual learner is a recorded event.
  if (action === "read") {
    OrgAccessEvent.record({
      organizationId: profile.organizationId!,
      actorUserId: actor.userId,
      profileId: profile.id!,
      action: "progress-read",
    });
  }
  return profile;
}

async function grantReach(
  actor: Actor,
  profile: Profile,
  action: ProfileAction,
): Promise<Profile | null> {
  // Mode B is visibility, never ownership: reading is all a grant can
  // ever allow. Managing a family-owned child stays with the family.
  if (action !== "read") {
    return null;
  }
  const grants = await ProfileAccess.liveFor(profile.id!);
  for (const grant of grants) {
    const member = await OrgMember.find(grant.organizationId!, actor.userId);
    if (member == null || !can(member.role!, "learners.read")) {
      continue;
    }
    if (
      member.role === "teacher" &&
      (member.batchId == null || member.batchId !== (grant.batchId ?? null))
    ) {
      continue;
    }
    OrgAccessEvent.record({
      organizationId: grant.organizationId!,
      actorUserId: actor.userId,
      profileId: profile.id!,
      action: "progress-read",
    });
    return profile;
  }
  return null;
}
