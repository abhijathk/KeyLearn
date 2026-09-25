import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { test } from "node:test";
import { Application } from "@fastr/core";
import { DataDir } from "@keylearn/config";
import {
  Batch,
  Organization,
  OrgMember,
  Profile,
  User,
} from "@keylearn/database";
import { deepEqual, equal, isFalse, isTrue } from "rich-assert";
import { learnerOwner } from "../access/owner.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { OrgLearnerFiles } from "./org-files.ts";

/**
 * Where a mode-A (organisation-owned) learner's files live — see
 * docs/organisations.md. They used to be written under whichever account's
 * device the child practised on, so the organisation that owns them could
 * read none of it.
 */

const context = new TestContext();

async function seed() {
  const owner = await findUser("user1@keylearn.org");
  const device = await findUser("user2@keylearn.org");
  const org = await Organization.query().insertAndFetch({
    name: "Org Files School",
    type: "school",
  });
  const batch = await Batch.query().insertAndFetch({
    organizationId: org.id!,
    name: "Class 1",
  });
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: owner.id!,
    role: "owner",
  });
  // The classroom device's account: a teacher in the learner's batch.
  await OrgMember.query().insert({
    organizationId: org.id!,
    userId: device.id!,
    role: "teacher",
    batchId: batch.id!,
  });
  const learner = await Profile.query().insertAndFetch({
    userId: null,
    organizationId: org.id!,
    batchId: batch.id!,
    kind: "kid",
    firstName: "Asha",
    parentalConsent: true,
  });
  await learner.setPin("1357");
  return { owner, device, org, learner };
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function put(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

test("a household learner's owner is the account; a mode-A learner's is the organisation", async () => {
  const { owner, org, learner } = await seed();
  const household = await Profile.query().insertAndFetch({
    userId: owner.id!,
    kind: "adult",
    firstName: "Grown",
    lastName: "Up",
  });
  equal(learnerOwner(household), owner.id!);
  deepEqual(learnerOwner(learner), { organizationId: org.id! });

  const dataDir = context.get(DataDir);
  equal(
    dataDir.profileStatsFile({ organizationId: 7 }, 42, "classic"),
    dataDir.dataPath("profile_stats", "org", "000000007", "42.classic"),
  );
});

test("practice in a learner session on a classroom device lands with the organisation, and its owner reads it", async () => {
  const { owner, device, org, learner } = await seed();
  const dataDir = context.get(DataDir);
  const request = startApp(context.get(Application, kMain));

  await request.become(device.id!);
  const entered = await request
    .POST(`/_/profiles/${learner.id}/enter`)
    .send({ pin: "1357" });
  equal((await entered.body.json<{ ok: boolean }>()).ok, true);
  const a11y = await request
    .POST(`/_/sync/a11y/profile/${learner.id}`)
    .send({ typeface: "dyslexic" });
  equal(a11y.status, 204);
  await request.POST("/_/profiles/exit").send({});

  const orgFile = dataDir.a11yPrefsFile(
    { organizationId: org.id! },
    learner.id!,
  );
  isTrue(await exists(orgFile));
  isFalse(await exists(dataDir.a11yPrefsFile(device.id!, learner.id!)));

  // The organisation's owner reads the same document.
  await request.become(owner.id!);
  const read = await request.GET(`/_/sync/a11y/profile/${learner.id}`).send();
  equal(read.status, 200);
  deepEqual(await read.body.json(), { typeface: "dyslexic" });

  // Somebody outside the organisation reaches nothing.
  const stranger = await User.query().insertAndFetch({
    email: "stranger@keylearn.org",
    name: "stranger",
  });
  await request.become(stranger.id!);
  const refused = await request
    .GET(`/_/sync/a11y/profile/${learner.id}`)
    .send();
  equal(refused.status, 403);
});

test("relocation moves misplaced mode-A files once, and never overwrites the organisation's", async () => {
  const { device, owner, org, learner } = await seed();
  const dataDir = context.get(DataDir);
  const org_ = { organizationId: org.id! };
  const pid = learner.id!;

  // Written under the device account before the fix.
  await put(dataDir.profileStatsFile(device.id!, pid), "guided");
  await put(dataDir.profileStatsFile(device.id!, pid, "classic"), "classic");
  await put(dataDir.profileDocFile(device.id!, pid, "local"), "{}");
  // A household file with an unrelated id must never be touched.
  await put(dataDir.profileStatsFile(owner.id!, pid + 1000), "someone else");

  const files = context.get(OrgLearnerFiles);
  deepEqual(await files.relocate(), { moved: 3, kept: 0 });
  equal(await readFile(dataDir.profileStatsFile(org_, pid), "utf8"), "guided");
  equal(
    await readFile(dataDir.profileStatsFile(org_, pid, "classic"), "utf8"),
    "classic",
  );
  isTrue(await exists(dataDir.profileDocFile(org_, pid, "local")));
  isFalse(await exists(dataDir.profileStatsFile(device.id!, pid)));
  isTrue(await exists(dataDir.profileStatsFile(owner.id!, pid + 1000)));

  // Idempotent: nothing left to move.
  deepEqual(await files.relocate(), { moved: 0, kept: 0 });

  // A stray written after the move is kept where it is, not merged over.
  await put(dataDir.profileStatsFile(device.id!, pid), "late");
  deepEqual(await files.relocate(), { moved: 0, kept: 1 });
  equal(await readFile(dataDir.profileStatsFile(org_, pid), "utf8"), "guided");
  equal(
    await readFile(dataDir.profileStatsFile(device.id!, pid), "utf8"),
    "late",
  );
});
