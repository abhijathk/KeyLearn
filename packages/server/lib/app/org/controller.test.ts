import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  Batch,
  Organization,
  OrgInvite,
  OrgMember,
  Profile,
  ProfileAccess,
  User,
} from "@keylearn/database";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import { reachProfile } from "../access/resolver.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

const context = new TestContext();

// End-to-end checks of the organisation tier's acceptance criteria that
// need the resolver, the session and the endpoints together —
// docs/organisations.md §11.

async function seed() {
  const owner = await findUser("user1@keylearn.org");
  const guardian = await findUser("user2@keylearn.org");
  const org = await Organization.query().insertAndFetch({
    name: "Melbourne Pallikkoodam",
    type: "school",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: owner.id!,
    role: "owner",
  });
  const batchA = await Batch.query().insertAndFetch({
    organizationId: org.id!,
    name: "Saturday 9am",
  });
  const batchB = await Batch.query().insertAndFetch({
    organizationId: org.id!,
    name: "Saturday 11am",
  });
  return { owner, guardian, org, batchA, batchB };
}

test("A4 — an org member reaches nothing outside their organisation", async () => {
  const { owner, guardian, org, batchA } = await seed();

  // A learner of org, and a household child of an unrelated account.
  const orgLearner = await Profile.query().insertAndFetch({
    userId: null,
    organizationId: org.id!,
    batchId: batchA.id!,
    kind: "kid",
    firstName: "Dhruv",
    parentalConsent: true,
  });
  const householdKid = await Profile.query().insertAndFetch({
    userId: guardian.id!,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });

  // The owner reads their organisation's learner…
  isNotNull(await reachProfile({ userId: owner.id! }, orgLearner.id!, "read"));
  // …but not a household child (no grant), by id or otherwise.
  isNull(await reachProfile({ userId: owner.id! }, householdKid.id!, "read"));
  // And an org role never writes or practises as a learner.
  isNull(await reachProfile({ userId: owner.id! }, orgLearner.id!, "write"));
  isNull(await reachProfile({ userId: owner.id! }, orgLearner.id!, "practise"));
  // A stranger reaches nothing at all.
  const stranger = await User.query().insertAndFetch({
    email: "stranger@keylearn.org",
    name: "stranger",
  });
  isNull(await reachProfile({ userId: stranger.id! }, orgLearner.id!, "read"));
});

test("A11 — a teacher's sight ends at their batch", async () => {
  const { org, batchA, batchB } = await seed();
  const teacher = await User.query().insertAndFetch({
    email: "teacher@keylearn.org",
    name: "anju",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: teacher.id!,
    role: "teacher",
    batchId: batchA.id!,
  });
  const inBatch = await Profile.query().insertAndFetch({
    userId: null,
    organizationId: org.id!,
    batchId: batchA.id!,
    kind: "kid",
    firstName: "InBatch",
    parentalConsent: true,
  });
  const otherBatch = await Profile.query().insertAndFetch({
    userId: null,
    organizationId: org.id!,
    batchId: batchB.id!,
    kind: "kid",
    firstName: "OtherBatch",
    parentalConsent: true,
  });
  isNotNull(await reachProfile({ userId: teacher.id! }, inBatch.id!, "read"));
  isNull(await reachProfile({ userId: teacher.id! }, otherBatch.id!, "read"));
  // And managing (PINs) is above a teacher's rank even in their own batch.
  isNull(await reachProfile({ userId: teacher.id! }, inBatch.id!, "manage"));
});

test("A12/A13 — guardian invite writes grants; revocation ends sight in one request", async () => {
  const { owner, guardian, org, batchA } = await seed();
  const child = await Profile.query().insertAndFetch({
    userId: guardian.id!,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });
  const { token } = await OrgInvite.issue({
    organizationId: org.id!,
    batchId: batchA.id!,
    role: "guardian",
    issuedByUserId: owner.id!,
  });

  const request = startApp(context.get(Application, kMain));
  await request.become(guardian.id!);
  const response = await request
    .POST("/_/org/invites/accept")
    .send({ token, profileIds: [child.id!] });
  equal(response.status, 200);

  // The org's owner now reads the child (mode B)…
  isNotNull(await reachProfile({ userId: owner.id! }, child.id!, "read"));
  // …but can never manage or write a family-owned learner.
  isNull(await reachProfile({ userId: owner.id! }, child.id!, "manage"));
  isNull(await reachProfile({ userId: owner.id! }, child.id!, "write"));

  // Single use: the same token again fails closed — the framework's
  // client-visible error is HTTP 200 with an application/error+json body.
  const again = await request
    .POST("/_/org/invites/accept")
    .send({ token, profileIds: [child.id!] });
  isTrue(
    (again.headers.get("Content-Type") ?? "").startsWith(
      "application/error+json",
    ),
  );

  // Revocation ends the organisation's sight, not the guardian's.
  await ProfileAccess.revoke(child.id!, org.id!);
  isNull(await reachProfile({ userId: owner.id! }, child.id!, "read"));
  isNotNull(await reachProfile({ userId: guardian.id! }, child.id!, "read"));
});

test("A13 — a role invite is the only door into membership", async () => {
  const { owner, org, batchA } = await seed();
  const teacher = await User.query().insertAndFetch({
    email: "teacher2@keylearn.org",
    name: "vinod",
  });
  const { token } = await OrgInvite.issue({
    organizationId: org.id!,
    batchId: batchA.id!,
    role: "teacher",
    issuedByUserId: owner.id!,
  });

  const request = startApp(context.get(Application, kMain));
  await request.become(teacher.id!);
  const response = await request.POST("/_/org/invites/accept").send({ token });
  equal(response.status, 200);
  const member = await OrgMember.find(org.id!, teacher.id!);
  isNotNull(member);
  equal(member!.role, "teacher");
  equal(member!.batchId, batchA.id!);

  // A garbage token attaches nothing and says only "not valid".
  const probe = await request
    .POST("/_/org/invites/accept")
    .send({ token: "definitely-not-a-real-token-here" });
  isTrue(
    (probe.headers.get("Content-Type") ?? "").startsWith(
      "application/error+json",
    ),
  );
  // And no membership appeared out of it.
  equal((await OrgMember.listFor(org.id!)).length, 2);
});

test("A5 — a PIN-entered session answers only for that learner", async () => {
  const { guardian } = await seed();
  const meera = await Profile.query().insertAndFetch({
    userId: guardian.id!,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });
  const arjun = await Profile.query().insertAndFetch({
    userId: guardian.id!,
    kind: "kid",
    firstName: "Arjun",
    parentalConsent: true,
  });
  await meera.setPin("1234");
  await arjun.setPin("5678");

  const request = startApp(context.get(Application, kMain));
  await request.become(guardian.id!);

  // Wrong PIN: no session.
  const wrong = await request
    .POST(`/_/profiles/${meera.id}/enter`)
    .send({ pin: "9999" });
  equal(wrong.status, 200);
  equal((await wrong.body.json<{ ok: boolean }>()).ok, false);

  // Right PIN: the session narrows to Meera —
  const right = await request
    .POST(`/_/profiles/${meera.id}/enter`)
    .send({ pin: "1234" });
  equal((await right.body.json<{ ok: boolean }>()).ok, true);

  // — so a request naming Arjun's data is refused, not served Meera's.
  const other = await request.GET(`/_/sync/data/profile/${arjun.id}`).send();
  equal(other.status, 403);
  const own = await request.GET(`/_/sync/data/profile/${meera.id}`).send();
  isTrue(own.status < 400);

  // Exit gives the whole household back.
  await request.POST("/_/profiles/exit").send({});
  const afterExit = await request
    .GET(`/_/sync/data/profile/${arjun.id}`)
    .send();
  isTrue(afterExit.status < 400);
});
