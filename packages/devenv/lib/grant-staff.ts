#!/usr/bin/env -S npx tsnode

// Grants (or revokes) support-desk staff access for one account by email.
//
// There is no admin UI for this on purpose — the very first staff grant on a
// deployment has nobody to click the button, so it has to be an ops action
// against the database directly.
//
//   npx tsnode packages/devenv/lib/grant-staff.ts user@example.com
//   npx tsnode packages/devenv/lib/grant-staff.ts user@example.com --revoke

import { Container } from "@fastr/invert";
import { ConfigModule, Env } from "@keylearn/config";
import { User } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import Knex from "knex";

const [email, flag] = process.argv.slice(2);
const staff = flag !== "--revoke";

if (email == null) {
  console.error(
    "usage: grant-staff.ts <email> [--revoke]\n" +
      "  npx tsnode packages/devenv/lib/grant-staff.ts user@example.com\n" +
      "  npx tsnode packages/devenv/lib/grant-staff.ts user@example.com --revoke",
  );
  process.exit(2);
}

Env.probeFilesSync();
const container = new Container();
container.load(new ConfigModule());
const knex = container.get(Knex);

async function exec() {
  try {
    const user = await User.findByEmail(email);
    if (user == null) {
      Logger.error(`No account with email '${email}'.`);
      process.exitCode = 1;
      return;
    }
    await user.$query().patch({ staff });
    Logger.info(
      `${email} (user #${user.id}) is now ${staff ? "staff" : "not staff"}.`,
    );
  } finally {
    await knex.destroy();
  }
}

exec().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
