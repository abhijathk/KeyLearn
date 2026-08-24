import { test } from "node:test";
import { equal, isFalse, isNotNull, isNull, isTrue } from "rich-assert";
import { Profile, User } from "./model.ts";
import {
  Batch,
  can,
  Organization,
  OrganizationPlan,
  OrgInvite,
  OrgMember,
  ProfileAccess,
} from "./organizations.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

// The acceptance criteria that live at the database layer —
// docs/organisations.md §11.

async function seedOrg() {
  const owner = await User.findByEmail("user1@keylearn.org");
  const org = await Organization.query().insertAndFetch({
    name: "Test School",
    type: "school",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: owner!.id!,
    role: "owner",
  });
  const batch = await Batch.query().insertAndFetch({
    organizationId: org.id!,
    name: "Saturday 9am",
  });
  return { owner: owner!, org, batch };
}

test("A2 — exactly one owner on every profile row, enforced by the database", async () => {
  const user = await User.findByEmail("user1@keylearn.org");
  const { org } = await seedOrg();

  // Household-owned: fine.
  const household = await Profile.query().insertAndFetch({
    userId: user!.id!,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });
  isNotNull(household.id);

  // Organisation-owned: fine.
  const owned = await Profile.query().insertAndFetch({
    userId: null,
    organizationId: org.id!,
    kind: "kid",
    firstName: "Dhruv",
    parentalConsent: true,
  });
  isNotNull(owned.id);

  // Both owners: refused by the constraint, not by the code.
  let failed = false;
  try {
    await Profile.query().insert({
      userId: user!.id!,
      organizationId: org.id!,
      kind: "kid",
      firstName: "Nobody",
      parentalConsent: true,
    });
  } catch {
    failed = true;
  }
  isTrue(failed, "a profile with two owners must be refused");

  // Neither owner: refused the same way.
  failed = false;
  try {
    await Profile.query().insert({
      userId: null,
      organizationId: null,
      kind: "kid",
      firstName: "Nobody",
      parentalConsent: true,
    });
  } catch {
    failed = true;
  }
  isTrue(failed, "a profile with no owner must be refused");
});

test("roles are strict supersets — owner ⊇ admin ⊇ teacher", () => {
  // Every action a teacher has, an admin has; every action an admin has,
  // an owner has. The loop IS the guarantee — a new action added with a
  // hole in the ladder fails here.
  const actions = [
    "org.manage",
    "org.billing",
    "members.admins",
    "members.teachers",
    "batches.manage",
    "learners.create",
    "learners.pins",
    "learners.unenrol",
    "learners.read",
    "invites.guardians",
    "session.run",
  ] as const;
  for (const action of actions) {
    if (can("teacher", action)) {
      isTrue(can("admin", action), `admin must cover teacher: ${action}`);
    }
    if (can("admin", action)) {
      isTrue(can("owner", action), `owner must cover admin: ${action}`);
    }
  }
  // And the ladder is real: each rung has something the one below lacks.
  isTrue(can("owner", "org.manage"));
  isFalse(can("admin", "org.manage"));
  isTrue(can("admin", "learners.create"));
  isFalse(can("teacher", "learners.create"));
  isTrue(can("teacher", "learners.read"));
  isFalse(can("stranger", "learners.read"));
});

test("A10 — removing the last owner is refused; a second owner unblocks it", async () => {
  const { owner, org } = await seedOrg();
  let refused = false;
  try {
    await OrgMember.remove(org.id!, owner.id!);
  } catch {
    refused = true;
  }
  isTrue(refused, "the last owner must not be removable");
  isNotNull(await OrgMember.find(org.id!, owner.id!));

  const second = await User.findByEmail("user2@keylearn.org");
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: second!.id!,
    role: "owner",
  });
  await OrgMember.remove(org.id!, owner.id!);
  isNull(await OrgMember.find(org.id!, owner.id!));
});

test("A13 — invites are single-use, expiring, revocable, and probes learn nothing", async () => {
  const { owner, org } = await seedOrg();

  const { invite, token } = await OrgInvite.issue({
    organizationId: org.id!,
    role: "teacher",
    issuedByUserId: owner.id!,
  });
  isNotNull(await OrgInvite.findLive(token));

  // Accepted once → dead, same answer as never-existed.
  await invite
    .$query()
    .patch({ acceptedByUserId: owner.id!, acceptedAt: new Date() });
  isNull(await OrgInvite.findLive(token));

  // Revoked → dead.
  const second = await OrgInvite.issue({
    organizationId: org.id!,
    role: "teacher",
    issuedByUserId: owner.id!,
  });
  await second.invite.$query().patch({ revokedAt: new Date() });
  isNull(await OrgInvite.findLive(second.token));

  // Expired → dead.
  const third = await OrgInvite.issue({
    organizationId: org.id!,
    role: "teacher",
    issuedByUserId: owner.id!,
    expiresInDays: -1,
  });
  isNull(await OrgInvite.findLive(third.token));

  // Garbage → dead, not an error.
  isNull(await OrgInvite.findLive("not-a-token-anyone-issued"));
});

test("A6 — wrong PINs lock the profile they were entered against, and no other", async () => {
  const user = await User.findByEmail("user1@keylearn.org");
  const meera = await Profile.query().insertAndFetch({
    userId: user!.id!,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });
  const arjun = await Profile.query().insertAndFetch({
    userId: user!.id!,
    kind: "kid",
    firstName: "Arjun",
    parentalConsent: true,
  });
  await meera.setPin("1234");
  await arjun.setPin("5678");

  // Five wrong attempts on Meera → her profile soft-locks…
  let fresh = await Profile.query().findById(meera.id!);
  for (let i = 0; i < Profile.PIN_SOFT_LOCK_AT; i++) {
    await fresh!.verifyPin("0000");
    fresh = await Profile.query().findById(meera.id!);
  }
  isTrue(fresh!.pinLocked(), "five misses lock the profile");
  equal(await fresh!.verifyPin("1234"), "locked");

  // …two learners behind one address: Arjun is untouched.
  const sibling = await Profile.query().findById(arjun.id!);
  isFalse(sibling!.pinLocked());
  equal(await sibling!.verifyPin("5678"), "ok");

  // A7 — an explicit unlock clears it, and the right PIN then works.
  await fresh!.unlockPin();
  const unlocked = await Profile.query().findById(meera.id!);
  equal(await unlocked!.verifyPin("1234"), "ok");
});

test("A12 — revoking a grant ends the organisation's sight and nothing else", async () => {
  const guardian = await User.findByEmail("user2@keylearn.org");
  const { org, batch } = await seedOrg();
  const child = await Profile.query().insertAndFetch({
    userId: guardian!.id!,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });

  await ProfileAccess.grant({
    profileId: child.id!,
    organizationId: org.id!,
    batchId: batch.id!,
    grantedByUserId: guardian!.id!,
  });
  equal((await ProfileAccess.liveFor(child.id!)).length, 1);

  isTrue(await ProfileAccess.revoke(child.id!, org.id!));
  equal((await ProfileAccess.liveFor(child.id!)).length, 0);
  // The row survives as history (unenrolment is a timestamp, not a DELETE)…
  equal((await ProfileAccess.query().where("profileId", child.id!)).length, 1);
  // …and the guardian's own ownership was never in question.
  isNotNull(await Profile.findOwned(guardian!.id!, child.id!));
  // Revoking twice is a no-op, not an error.
  isFalse(await ProfileAccess.revoke(child.id!, org.id!));
});

test("seats count learner places — mode A plus live grants — and lapse reads as lapsed", async () => {
  const guardian = await User.findByEmail("user2@keylearn.org");
  const { org, batch } = await seedOrg();

  // No plan: being set up before billing exists — unlimited, not lapsed.
  let seats = await org.seatStatus();
  isNull(seats.seats);
  isFalse(seats.lapsed);
  equal(seats.used, 0);

  await OrganizationPlan.query().insert({ organizationId: org.id!, seats: 5 });

  await Profile.query().insert({
    userId: null,
    organizationId: org.id!,
    batchId: batch.id!,
    kind: "kid",
    firstName: "ModeA",
    parentalConsent: true,
  });
  const child = await Profile.query().insertAndFetch({
    userId: guardian!.id!,
    kind: "kid",
    firstName: "ModeB",
    parentalConsent: true,
  });
  await ProfileAccess.grant({
    profileId: child.id!,
    organizationId: org.id!,
    batchId: batch.id!,
    grantedByUserId: guardian!.id!,
  });

  seats = await org.seatStatus();
  equal(seats.seats, 5);
  equal(seats.used, 2);
  isFalse(seats.lapsed);

  // A lapsed plan is a fact about the plan, and nothing here refuses a
  // learner — A14's read-only rule is the controller's to enforce.
  await OrganizationPlan.query()
    .findById(org.id!)
    .patch({ validUntil: new Date(Date.now() - 1000) });
  seats = await org.seatStatus();
  isTrue(seats.lapsed);
});
