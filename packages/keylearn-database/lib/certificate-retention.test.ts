import { test } from "node:test";
import { Model } from "objection";
import { equal, isTrue } from "rich-assert";
import { Certificate, Profile } from "./model.ts";
import { createSchema } from "./schema.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

/**
 * A certificate outlives its learner and their account (owner decision,
 * 25 Sep 2026). A table created before that cascaded the profile's deletion
 * into the certificate; the migration moves it to SET NULL and keeps every
 * row it already has.
 */

async function seed(): Promise<{ profileId: number; sequence: number }> {
  const profile = await Profile.query().insertAndFetch({
    userId: 1,
    kind: "adult",
    firstName: "Asha",
    lastName: "Menon",
  });
  await Certificate.query().insert({
    sequence: 424242,
    profileId: profile.id!,
    userId: 1,
    kind: "typing",
    audience: "adult",
    language: "en-us",
    level: "completion",
    sheet: "adult",
    speed: 41,
    accuracy: 0.97,
    name: "Asha Menon",
    nameVisible: true,
  } as Partial<Certificate>);
  return { profileId: profile.id!, sequence: 424242 };
}

test("deleting the learner keeps the certificate, detached", async () => {
  const { profileId, sequence } = await seed();
  await Profile.query().deleteById(profileId);
  const kept = await Certificate.query().findOne({ sequence });
  isTrue(kept != null);
  equal(kept!.profileId, null);
  equal(kept!.name, "Asha Menon");
});

test("an older cascading table is migrated in place and keeps its rows", async (t) => {
  const knex = Model.knex();
  const client = (knex.client.config as { __client?: string }).__client;
  if (client === "mysql") {
    t.skip("the SQLite rebuild is what this pins; MySQL alters in place");
    return;
  }
  // Put the table back in its old shape: NOT NULL, ON DELETE CASCADE.
  await knex.raw("PRAGMA foreign_keys = OFF");
  await knex.raw("DROP TABLE certificate");
  await knex.raw(
    "CREATE TABLE `certificate` (`id` integer not null primary key autoincrement, `sequence` bigint not null, " +
      "`profile_id` integer not null, `user_id` integer not null, `kind` varchar(8) not null, " +
      "`audience` varchar(8) not null, `language` varchar(32) not null, `level` varchar(12) not null, " +
      "`speed` float not null, `accuracy` float not null, `name` varchar(80) not null, " +
      "`name_visible` boolean not null default '0', `created_at` datetime not null default CURRENT_TIMESTAMP, " +
      "sheet varchar(8) NOT NULL DEFAULT 'adult', `criteria_version` integer not null default '1', " +
      "`criteria_json` text null, foreign key(`profile_id`) references `profile`(`id`) on delete CASCADE on update CASCADE)",
  );
  await knex.raw(
    "CREATE UNIQUE INDEX `certificate_sequence_unique` on `certificate` (`sequence`)",
  );
  // A trigger of the kind the profile rebuild once destroyed.
  await knex.raw(
    "CREATE TRIGGER certificate_sequence_fixed BEFORE UPDATE OF sequence ON certificate BEGIN SELECT RAISE(ABORT, 'fixed'); END",
  );
  await knex.raw("PRAGMA foreign_keys = ON");
  const { profileId, sequence } = await (async () => {
    const profile = await Profile.query().insertAndFetch({
      userId: 1,
      kind: "adult",
      firstName: "Old",
      lastName: "Row",
    });
    await knex.raw(
      "INSERT INTO certificate (sequence, profile_id, user_id, kind, audience, language, level, speed, accuracy, name) " +
        "VALUES (777, ?, 1, 'typing', 'adult', 'en-us', 'completion', 38, 0.96, 'Old Row')",
      [profile.id!],
    );
    return { profileId: profile.id!, sequence: 777 };
  })();

  await createSchema(knex);
  // And again: the second run finds the new shape and does nothing.
  await createSchema(knex);

  const objects = (await knex.raw(
    "SELECT type, name FROM sqlite_master WHERE tbl_name = 'certificate' ORDER BY name",
  )) as { type: string; name: string }[];
  const names = objects.map((o) => o.name);
  isTrue(names.includes("certificate_sequence_fixed"), "the trigger survived");
  isTrue(
    names.every((n) => !n.includes("__rebuild")),
    "no scratch-table names left behind",
  );
  isTrue(names.includes("certificate_sequence_unique"));
  equal(((await knex.raw("PRAGMA foreign_key_check")) as unknown[]).length, 0);

  const row = await Certificate.query().findOne({ sequence });
  equal(row?.name, "Old Row");
  equal(row?.evidence ?? null, null, "issued before: not server-derived");
  await Profile.query().deleteById(profileId);
  const kept = await Certificate.query().findOne({ sequence });
  isTrue(kept != null, "the certificate survived its learner");
  equal(kept!.profileId, null);
});
