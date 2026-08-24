import { after, before, beforeEach } from "node:test";
import { makeKnex } from "@keylearn/config";
import { Model } from "objection";
import { Order, User, UserExternalId, UserLoginRequest } from "./model.ts";
import { createSchema } from "./schema.ts";

/**
 * Retries a fixture step that lost a deadlock.
 *
 * The suite's flakiest failure was here, and it is not a product bug:
 * plenty of writes in this app are deliberately fire-and-forget — audit
 * rows, security events, notifications, the delivery mark on a forwarded
 * message — so a request that has already answered may still be writing
 * when the next test truncates `user` and seeds it again. Two
 * transactions, opposite lock order, and InnoDB picks a victim. Which
 * test dies is therefore a matter of timing, which is exactly what was
 * seen: a different two to five every run.
 *
 * Nothing in production does a mass DELETE of `user` alongside live
 * traffic, so this shape does not occur there. Retrying is also what the
 * error itself asks for — "try restarting transaction" — and a deadlock
 * is transient by definition: the loser rolled back cleanly and the
 * winner has now finished.
 */
async function withDeadlockRetry<T>(
  body: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await body();
    } catch (err) {
      const code =
        (err as { nativeError?: { code?: string }; code?: string })?.nativeError
          ?.code ??
        (err as { code?: string })?.code ??
        "";
      if (code !== "ER_LOCK_DEADLOCK" && code !== "ER_LOCK_WAIT_TIMEOUT") {
        throw err;
      }
      lastErr = err;
      // Back off a little so the winner is done before the next attempt.
      await new Promise((resolve) => setTimeout(resolve, 25 * (i + 1)));
    }
  }
  throw lastErr;
}

export function useDatabase() {
  const knex = makeKnex();

  before(async () => {
    await createSchema(knex);
  });

  beforeEach(async () => {
    await withDeadlockRetry(async () => {
      await clearTables();
      await seedModels();
    });
  });

  after(async () => {
    await knex.destroy();
  });
}

export async function seedModels() {
  await User.query().delete();
  await User.query().insertGraph([
    {
      email: "user1@keylearn.org",
      name: "user1",
      createdAt: new Date("2001-02-03T04:05:06Z"),
      externalIds: [
        {
          provider: "provider1",
          externalId: "externalId1",
          name: "externalName1",
          url: "url1",
          imageUrl: "imageUrl1",
          createdAt: new Date("2001-02-03T04:05:06Z"),
        } as UserExternalId,
      ],
    } as User,
    {
      email: "user2@keylearn.org",
      name: "user2",
      createdAt: new Date("2001-02-03T04:05:06Z"),
      externalIds: [
        {
          provider: "provider2",
          externalId: "externalId2",
          name: "externalName2",
          url: "url2",
          imageUrl: "imageUrl2",
          createdAt: new Date("2001-02-03T04:05:06Z"),
        } as UserExternalId,
      ],
    } as User,
    {
      email: "user3@keylearn.org",
      name: "user3",
      createdAt: new Date("2001-02-03T04:05:06Z"),
      externalIds: [
        {
          provider: "provider3",
          externalId: "externalId3",
          name: "externalName3",
          url: "url3",
          imageUrl: "imageUrl3",
          createdAt: new Date("2001-02-03T04:05:06Z"),
        } as UserExternalId,
      ],
    } as User,
  ]);
}

export async function clearTables() {
  // Organisation tier first: org_access_event has no FK to organization's
  // dependants, and organization's CASCADE sweeps members, batches,
  // invites, plans and grants in one delete.
  await clearTable("org_access_event");
  await clearTable("organization");
  await clearTable(UserLoginRequest.tableName);
  await clearTable(Order.tableName);
  await clearTable(UserExternalId.tableName);
  await clearTable(User.tableName);
}

export async function clearTable(name: string) {
  const knex = Model.knex();
  const tpl = (sql: string) => {
    return sql.replaceAll("{name}", name);
  };
  await knex.raw(tpl("DELETE FROM `{name}`"));
  switch (knex.client.config.__client) {
    case "mysql":
      await knex.raw(tpl("ALTER TABLE `{name}` AUTO_INCREMENT = 1"));
      break;
    case "sqlite":
      await knex.raw(
        tpl("UPDATE `sqlite_sequence` SET `seq` = 0 WHERE `name` = '{name}';"),
      );
      break;
  }
}
