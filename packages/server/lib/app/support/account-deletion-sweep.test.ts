import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { DataDir } from "@keylearn/config";
import {
  AccountDeletionRequest,
  Notification,
  Profile,
  SupportDraft,
  User,
} from "@keylearn/database";
import { equal, isFalse, isTrue } from "rich-assert";
import { TestContext } from "../test/context.ts";
import { findUser } from "../test/sql.ts";
import { AccountDeletionSweep } from "./sweep.ts";

/**
 * A staff-requested deletion, carried out by the sweep once its window has
 * closed: everything the account held goes — rows, every learner file, the
 * sessions that still name it — and nobody else's does.
 */

const context = new TestContext();

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

async function session(userId: number, name: string): Promise<string> {
  const path = join(context.get<string>("dataDir"), "sessions", "zz", name);
  await put(path, JSON.stringify({ expires: 9e9, data: { userId, epoch: 0 } }));
  return path;
}

test("a due deletion erases the account completely and leaves others alone", async () => {
  const gone = await findUser("user1@keylearn.org");
  const kept = await findUser("user2@keylearn.org");
  const dataDir = context.get(DataDir);

  const files: Record<"gone" | "kept", string[]> = { gone: [], kept: [] };
  for (const [who, user] of [
    ["gone", gone],
    ["kept", kept],
  ] as const) {
    const learner = await Profile.query().insertAndFetch({
      userId: user.id!,
      kind: "kid",
      firstName: "Learner",
      parentalConsent: true,
    });
    const pid = learner.id!;
    for (const path of [
      dataDir.profileStatsFile(user.id!, pid),
      dataDir.profileStatsFile(user.id!, pid, "classic"),
      dataDir.profileSettingsFile(user.id!, pid),
      dataDir.brailleProgressFile(user.id!, pid),
      dataDir.a11yPrefsFile(user.id!, pid),
      dataDir.profileDocFile(user.id!, pid, "local"),
      dataDir.userSettingsFile(user.id!),
      dataDir.accountDocFile(user.id!, "local"),
    ]) {
      await put(path, "{}");
      files[who].push(path);
    }
    await Notification.create({ userId: user.id!, kind: "ticket-reply" });
    await SupportDraft.put({ userId: user.id!, subject: "draft" });
  }
  const goneSession = await session(gone.id!, "gone");
  const keptSession = await session(kept.id!, "kept");

  const { request } = await AccountDeletionRequest.request({
    userId: gone.id!,
    requestedByUserId: null,
    reason: "test",
  });
  const now = new Date(request.executeAt!).getTime() + 1000;

  equal(await context.get(AccountDeletionSweep).runOnce(now), 1);

  isTrue((await User.query().findById(gone.id!)) == null);
  equal(await Profile.query().where("userId", gone.id!).resultSize(), 0);
  equal(await Notification.query().where("userId", gone.id!).resultSize(), 0);
  equal(await SupportDraft.query().where("userId", gone.id!).resultSize(), 0);
  for (const path of files.gone) {
    isFalse(await exists(path), path);
  }
  isFalse(await exists(goneSession));

  // Nobody else's.
  isTrue((await User.query().findById(kept.id!)) != null);
  equal(await Notification.query().where("userId", kept.id!).resultSize(), 1);
  for (const path of files.kept) {
    isTrue(await exists(path), path);
  }
  isTrue(await exists(keptSession));

  // Done once: the request is marked complete and not picked up again.
  equal(await context.get(AccountDeletionSweep).runOnce(now), 0);
  equal(
    (await readdir(join(context.get<string>("dataDir"), "sessions", "zz")))
      .length,
    1,
  );
});
