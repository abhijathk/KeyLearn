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
import { deepEqual, equal, isNotNull, isNull, isTrue } from "rich-assert";
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

test("the volunteer teacher who is also a parent — one account, both records", async () => {
  // Balakairali's real shape: Anju teaches the 9am class and her own
  // daughter is in the 11am. Membership and enrolment are separate rows,
  // so one account carries both — and the order they arrive in does not
  // matter.
  const { owner, org, batchA, batchB } = await seed();
  const anju = await findUser("user2@keylearn.org");
  const nila = await Profile.query().insertAndFetch({
    userId: anju.id!,
    kind: "kid",
    firstName: "Nila",
    parentalConsent: true,
  });

  const request = startApp(context.get(Application, kMain));
  await request.become(anju.id!);

  // 1. The teacher invite — issued by the coordinator, for Anju's class.
  const teacherInvite = await OrgInvite.issue({
    organizationId: org.id!,
    batchId: batchA.id!,
    role: "teacher",
    issuedByUserId: owner.id!,
  });
  equal(
    (
      await request
        .POST("/_/org/invites/accept")
        .send({ token: teacherInvite.token })
    ).status,
    200,
  );

  // 2. The guardian invite — for the OTHER class, the one Nila is in.
  const guardianInvite = await OrgInvite.issue({
    organizationId: org.id!,
    batchId: batchB.id!,
    role: "guardian",
    issuedByUserId: owner.id!,
  });
  equal(
    (
      await request
        .POST("/_/org/invites/accept")
        .send({ token: guardianInvite.token, profileIds: [nila.id!] })
    ).status,
    200,
  );

  // She is a teacher of her class…
  const member = await OrgMember.find(org.id!, anju.id!);
  isNotNull(member);
  equal(member!.role, "teacher");
  equal(member!.batchId, batchA.id!);

  // …and Nila is enrolled in the other one, still owned by Anju.
  const grants = await ProfileAccess.liveFor(nila.id!);
  equal(grants.length, 1);
  equal(grants[0]!.batchId, batchB.id!);
  isNotNull(await Profile.findOwned(anju.id!, nila.id!));

  // Teaching does not widen what she may see as a parent: her sight as
  // staff still ends at her own class, so a learner in Nila's class is
  // out of reach even though her daughter is in it.
  const otherChild = await Profile.query().insertAndFetch({
    userId: null,
    organizationId: org.id!,
    batchId: batchB.id!,
    kind: "kid",
    firstName: "Someone",
    parentalConsent: true,
  });
  isNull(await reachProfile({ userId: anju.id! }, otherChild.id!, "read"));
  // And her own daughter she reaches as a parent, as always.
  isNotNull(await reachProfile({ userId: anju.id! }, nila.id!, "read"));
});

test("Balakairali's rule — owners and admins must be at the school, teachers need not be", async () => {
  // Option A. The people who can see every learner and appoint others
  // must hold a school address; a teacher sees one class and appoints
  // nobody, so theirs is encouraged and not required.
  const owner = await findUser("user1@keylearn.org");
  const org = await Organization.query().insertAndFetch({
    name: "Balakairali Sydney",
    type: "school",
    staffEmailDomains: "balakairali.org.au",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: owner.id!,
    role: "owner",
  });
  const batch = await Batch.query().insertAndFetch({
    organizationId: org.id!,
    name: "Anju Thomas",
  });

  const outsider = await User.query().insertAndFetch({
    email: "anju.thomas@gmail.com",
    name: "anju",
    emailVerified: true,
  });
  const request = startApp(context.get(Application, kMain));
  await request.become(outsider.id!);

  // An ADMIN invite is refused on a personal address…
  const adminInvite = await OrgInvite.issue({
    organizationId: org.id!,
    role: "admin",
    issuedByUserId: owner.id!,
  });
  const refused = await request
    .POST("/_/org/invites/accept")
    .send({ token: adminInvite.token });
  isTrue(
    (refused.headers.get("Content-Type") ?? "").startsWith(
      "application/error+json",
    ),
  );
  isNull(await OrgMember.find(org.id!, outsider.id!));
  // …and the invite is NOT consumed — a wrong-account click must not
  // cost somebody a re-invitation.
  isNotNull(await OrgInvite.findLive(adminInvite.token));

  // A TEACHER invite on the same address is accepted, with a nudge.
  const teacherInvite = await OrgInvite.issue({
    organizationId: org.id!,
    batchId: batch.id!,
    role: "teacher",
    issuedByUserId: owner.id!,
  });
  const accepted = await request
    .POST("/_/org/invites/accept")
    .send({ token: teacherInvite.token });
  equal(accepted.status, 200);
  const body = await accepted.body.json<{ addressNote: string | null }>();
  isNotNull(body.addressNote);
  const member = await OrgMember.find(org.id!, outsider.id!);
  isNotNull(member);
  equal(member!.role, "teacher");

  // A school address clears the bar for an admin.
  const insider = await User.query().insertAndFetch({
    email: "deepa@balakairali.org.au",
    name: "deepa",
    emailVerified: true,
  });
  await request.become(insider.id!);
  const second = await OrgInvite.issue({
    organizationId: org.id!,
    role: "admin",
    issuedByUserId: owner.id!,
  });
  equal(
    (await request.POST("/_/org/invites/accept").send({ token: second.token }))
      .status,
    200,
  );
  equal((await OrgMember.find(org.id!, insider.id!))!.role, "admin");
});

test("an unverified school address cannot hold a staff role", async () => {
  // A domain check on an address nobody proved they control is theatre.
  const owner = await findUser("user1@keylearn.org");
  const org = await Organization.query().insertAndFetch({
    name: "Balakairali Sydney",
    type: "school",
    staffEmailDomains: "balakairali.org.au",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: owner.id!,
    role: "owner",
  });
  const claimant = await User.query().insertAndFetch({
    email: "treasurer@balakairali.org.au",
    name: "claimant",
    emailVerified: false,
  });
  const request = startApp(context.get(Application, kMain));
  await request.become(claimant.id!);
  const invite = await OrgInvite.issue({
    organizationId: org.id!,
    role: "admin",
    issuedByUserId: owner.id!,
  });
  const res = await request
    .POST("/_/org/invites/accept")
    .send({ token: invite.token });
  isTrue(
    (res.headers.get("Content-Type") ?? "").startsWith(
      "application/error+json",
    ),
  );
  isNull(await OrgMember.find(org.id!, claimant.id!));
});

test("a school with no domain restricts nobody", async () => {
  // The twelve-parents-in-a-hall school, whose committee has only
  // personal addresses, must keep working exactly as before.
  const owner = await findUser("user1@keylearn.org");
  const org = await Organization.query().insertAndFetch({
    name: "A Small School",
    type: "school",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: owner.id!,
    role: "owner",
  });
  const anyone = await User.query().insertAndFetch({
    email: "someone@gmail.com",
    name: "someone",
  });
  const request = startApp(context.get(Application, kMain));
  await request.become(anyone.id!);
  const invite = await OrgInvite.issue({
    organizationId: org.id!,
    role: "admin",
    issuedByUserId: owner.id!,
  });
  equal(
    (await request.POST("/_/org/invites/accept").send({ token: invite.token }))
      .status,
    200,
  );
  equal((await OrgMember.find(org.id!, anyone.id!))!.role, "admin");
});

test("a class list is read back before anyone is emailed", async () => {
  const { owner, org, batchA } = await seed();
  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);

  // Someone already in the school, so the list can collide with it.
  const already = await User.query().insertAndFetch({
    email: "r.menon@example.com",
    name: "menon",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: already.id!,
    role: "teacher",
    batchId: batchA.id!,
  });

  const res = await request.POST(`/_/org/${org.id}/invites`).send({
    role: "guardian",
    batchId: batchA.id!,
    emails: [
      "priya.nair@example.com",
      "PRIYA.NAIR@example.com", // same address, shouted
      "r.menon@example.com", // already here
      "suresh@@example", // not an address
      "lakshmi.p@example.com",
    ],
  });
  equal(res.status, 200);
  const body = await res.body.json<{
    sent: number;
    skipped: { email: string; reason: string }[];
  }>();
  equal(body.sent, 2);
  equal(body.skipped.length, 3);
  deepEqual(body.skipped.map((s) => s.reason).sort(), [
    "already-here",
    "not-an-address",
    "repeated",
  ]);

  // Sending the same list twice does not invite anybody a second time.
  const again = await request.POST(`/_/org/${org.id}/invites`).send({
    role: "guardian",
    batchId: batchA.id!,
    emails: ["priya.nair@example.com"],
  });
  equal((await again.body.json<{ sent: number }>()).sent, 0);
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

test("the invite read-back reports every row and writes nothing", async () => {
  const { owner, guardian, org, batchA } = await seed();

  // Already a member, so their address must come back as already-here.
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: guardian.id!,
    role: "teacher",
    batchId: batchA.id!,
  });
  // Already invited, so a second attempt at the same address is a
  // duplicate rather than a second invite.
  await OrgInvite.issue({
    organizationId: org.id!,
    batchId: batchA.id!,
    role: "guardian",
    issuedByUserId: owner.id!,
    email: "pending@example.com",
  });

  const before = (await OrgInvite.listFor(org.id!)).length;

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  const response = await request.POST(`/_/org/${org.id!}/invites/screen`).send({
    emails: [
      "priya@example.com",
      guardian.email!,
      "priya@example.com",
      "pending@example.com",
      "not-an-address",
    ],
  });
  equal(response.status, 200);
  const body = (await response.body.json()) as {
    verdicts: { email: string; verdict: string }[];
    willInvite: number;
  };

  // In the order given: a coordinator is reading this against the rows
  // of a spreadsheet they still have open.
  deepEqual(
    body.verdicts.map((v) => v.verdict),
    ["invite", "already-here", "repeated", "already-invited", "not-an-address"],
  );
  equal(body.willInvite, 1);

  // And not one invite was created by looking.
  equal((await OrgInvite.listFor(org.id!)).length, before);
});

test("reading the list needs the same standing as sending to it", async () => {
  const { org } = await seed();
  const outsider = await findUser("user3@keylearn.org");

  const request = startApp(context.get(Application, kMain));
  await request.become(outsider.id!);
  const response = await request
    .POST(`/_/org/${org.id!}/invites/screen`)
    .send({ emails: ["someone@example.com"] });
  equal(response.status, 403);
});

test("an addressed invite is actually emailed, with the class named", async () => {
  const { owner, org, batchA } = await seed();

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  // The fake mailer accumulates across tests in this file, so empty it
  // first and assert only on what this action put there.
  context.mailer.dump();
  equal(
    (
      await request.POST(`/_/org/${org.id!}/invites`).send({
        role: "guardian",
        batchId: batchA.id!,
        emails: ["parent@example.com"],
      })
    ).status,
    200,
  );

  // Sending is fire-and-forget so one dead mailbox cannot lose the rest,
  // so give the queued send a turn to run before reading the outbox.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const [mail, ...rest] = context.mailer.dump();
  deepEqual(rest, []);
  isNotNull(mail);
  equal(mail!.to, "parent@example.com");
  isTrue(mail!.subject.includes(org.name!));
  // The link is the invite — no code to type, nothing to sign up for
  // first — so it has to be in the body.
  isTrue((mail!.text ?? "").includes("/join/"));
  // And it names the class, because a parent with children in two of
  // them needs to know which one this is.
  isTrue((mail!.text ?? "").includes(batchA.name!));
});

test("only a staff invite carries the address rule", async () => {
  const { owner, org, batchA } = await seed();
  await org.$query().patch({ staffEmailDomains: "balakairali.org.au" });

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  context.mailer.dump();
  await request
    .POST(`/_/org/${org.id!}/invites`)
    .send({ role: "admin", emails: ["someone@gmail.com"] });
  await request.POST(`/_/org/${org.id!}/invites`).send({
    role: "guardian",
    batchId: batchA.id!,
    emails: ["parent@gmail.com"],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const sent = context.mailer.dump();
  const admin = sent.find((m) => m.to === "someone@gmail.com");
  const parent = sent.find((m) => m.to === "parent@gmail.com");
  isNotNull(admin);
  isNotNull(parent);
  // The admin is told which address to accept on…
  isTrue((admin!.text ?? "").includes("balakairali.org.au"));
  // …and the parent is not, because parents are never restricted and
  // telling them otherwise would turn a non-rule into a barrier.
  isTrue(!(parent!.text ?? "").includes("balakairali.org.au"));
});

test("a school cannot touch the PIN of a family's learner", async () => {
  const { owner, guardian, org, batchA } = await seed();

  // A family's child, enrolled by the guardian accepting an invite —
  // the school can see them, and that is all.
  const child = await Profile.query().insertAndFetch({
    userId: guardian.id!,
    organizationId: null,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });
  await ProfileAccess.grant({
    profileId: child.id!,
    organizationId: org.id!,
    batchId: batchA.id!,
    grantedByUserId: guardian.id!,
  });

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  const response = await request
    .POST(`/_/org/${org.id!}/learners/${child.id!}/pin`)
    .send({ pin: "1234" });
  equal(response.status, 403);

  // Not merely refused — untouched. A partial write here would be a
  // school quietly taking over a family's learner.
  const after = await Profile.query().findById(child.id!);
  equal(after!.userId, guardian.id!);
  isNull(after!.organizationId ?? null);
});

test("a learner the school owns has no account behind them", async () => {
  const { owner, org, batchA } = await seed();

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  const response = await request.POST(`/_/org/${org.id!}/learners`).send({
    firstName: "Dhruv",
    batchId: batchA.id!,
    pin: "4821",
  });
  equal(response.status, 200);
  const { profileId } = (await response.body.json()) as { profileId: number };

  const profile = await Profile.query().findById(profileId);
  // Exactly one owner — the CHECK constraint's whole purpose (A2).
  isNull(profile!.userId ?? null);
  equal(profile!.organizationId, org.id!);
  // And a PIN from birth: it is the only thing telling this child apart
  // from the next one at the same shared machine.
  equal(await profile!.verifyPin("4821"), "ok");
  equal(await profile!.verifyPin("0000"), "wrong");
});

test("the reference is a crib note that dies on acceptance", async () => {
  const { owner, guardian, org, batchA } = await seed();

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  equal(
    (
      await request.POST(`/_/org/${org.id!}/invites`).send({
        role: "guardian",
        batchId: batchA.id!,
        emails: [{ email: "parent@example.com", reference: "Meera Nair" }],
      })
    ).status,
    200,
  );

  // While it is waiting, the coordinator can see who it is for — that
  // is the entire point: an unaccepted address is not a findable
  // person, "the Nair girl in Ms Priya's class" is.
  const listed = (await (
    await request.GET(`/_/org/${org.id!}/invites`).send()
  ).body.json()) as { invites: { email: string; reference: string | null }[] };
  const waiting = listed.invites.find((i) => i.email === "parent@example.com");
  equal(waiting!.reference, "Meera Nair");

  // It is never sent to the person it describes.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const mail = context.mailer.dump().find((m) => m.to === "parent@example.com");
  isNotNull(mail);
  isTrue(!(mail!.text ?? "").includes("Meera Nair"));
  isTrue(!(mail!.html ?? "").includes("Meera Nair"));

  // And once the parent is in, it is gone from the row entirely — not
  // merely hidden. It is a child's name sitting beside an address.
  const invite = (await OrgInvite.listFor(org.id!)).find(
    (i) => i.email === "parent@example.com",
  );
  const child = await Profile.query().insertAndFetch({
    userId: guardian.id!,
    organizationId: null,
    kind: "kid",
    firstName: "Meera",
    parentalConsent: true,
  });
  const { token } = await OrgInvite.issue({
    organizationId: org.id!,
    batchId: batchA.id!,
    role: "guardian",
    issuedByUserId: owner.id!,
    email: "parent2@example.com",
    reference: "Second Child",
  });
  isNotNull(invite);

  await request.become(guardian.id!);
  equal(
    (
      await request
        .POST("/_/org/invites/accept")
        .send({ token, profileIds: [child.id!] })
    ).status,
    200,
  );
  const accepted = (await OrgInvite.listFor(org.id!)).find(
    (i) => i.email === "parent2@example.com",
  );
  isNull(accepted!.reference ?? null);
});

test("the staff address rule can be changed, and only by an owner", async () => {
  const { owner, guardian, org } = await seed();
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: guardian.id!,
    role: "admin",
  });

  const request = startApp(context.get(Application, kMain));

  // An admin cannot widen the rule that decides who may be an admin.
  await request.become(guardian.id!);
  equal(
    (
      await request
        .PATCH(`/_/org/${org.id!}`)
        .send({ staffEmailDomains: "anywhere.example" })
    ).status,
    403,
  );

  await request.become(owner.id!);
  const response = await request
    .PATCH(`/_/org/${org.id!}`)
    .send({ staffEmailDomains: "@Balakairali.ORG.au, notadomain" });
  equal(response.status, 200);
  const body = (await response.body.json()) as {
    staffEmailDomains: string[];
  };
  // Lower-cased, the @ stripped, and the thing that is not a domain
  // dropped rather than stored and silently never matching.
  deepEqual(body.staffEmailDomains, ["balakairali.org.au"]);

  // Empty clears it — a school that drops the rule must be able to.
  const cleared = await request
    .PATCH(`/_/org/${org.id!}`)
    .send({ staffEmailDomains: "" });
  deepEqual(
    ((await cleared.body.json()) as { staffEmailDomains: string[] })
      .staffEmailDomains,
    [],
  );
});

test("changing the rule does not evict the staff already here", async () => {
  const { owner, guardian, org, batchA } = await seed();
  // A teacher on a personal address, which is expressly allowed — and
  // with a class, since a teacher without one reaches nothing by
  // design and would prove the wrong thing here.
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: guardian.id!,
    role: "teacher",
    batchId: batchA.id!,
  });

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  await request
    .PATCH(`/_/org/${org.id!}`)
    .send({ staffEmailDomains: "balakairali.org.au" });

  // Still staff, still reaching their class. The rule is a gate on
  // acceptance, not a standing condition — otherwise a setting change
  // would lock people out of their own school mid-term. Checked with
  // something a teacher may actually do: the staff list is not one.
  isNotNull(await OrgMember.find(org.id!, guardian.id!));
  await request.become(guardian.id!);
  equal((await request.GET(`/_/org/${org.id!}/learners`).send()).status, 200);
});

test("a teacher has no business with the staff list", async () => {
  const { owner, guardian, org, batchA } = await seed();
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: guardian.id!,
    role: "teacher",
    batchId: batchA.id!,
  });

  const request = startApp(context.get(Application, kMain));
  await request.become(owner.id!);
  equal((await request.GET(`/_/org/${org.id!}/members`).send()).status, 200);

  // A teacher sees one class and appoints nobody, so the roster of who
  // else works here is not theirs to read.
  await request.become(guardian.id!);
  equal((await request.GET(`/_/org/${org.id!}/members`).send()).status, 403);
});
