#!/usr/bin/env -S npx tsnode

import { createHash } from "node:crypto";
import { Container } from "@fastr/invert";
import { ConfigModule, Env } from "@keylearn/config";
import { createSchema, UserLoginRequest } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import Knex from "knex";

const email = "user@localhost";
const accessToken = "xyz";

Env.probeFilesSync();
const container = new Container();
container.load(new ConfigModule());
const knex = container.get(Knex);

/**
 * Whether this run may seed the example account.
 *
 * It may not in production, and the reason is not tidiness. `start-docker`
 * runs this file on every boot, the seeded token is the fixed string
 * "xyz", and `/login/{token}` calls `User.login`, which CREATES the
 * account when it does not exist. So a deployed server was re-arming a
 * publicly guessable URL that hands any visitor a signed-in session, once
 * per restart. The schema step below is why this file runs in production
 * at all; the seeding never should have come with it.
 */
function maySeed(): boolean {
  return Env.getString("NODE_ENV", "development") !== "production";
}

async function exec() {
  try {
    await createSchema(knex);
    Logger.info(`Database schema was created.`);
    if (!maySeed()) {
      // Not just "don't add it": a server that has already been deployed
      // has the row, and it stays usable until it expires. Deleting it
      // here means the fix takes effect on the next boot rather than a
      // day later.
      const removed = await UserLoginRequest.query().delete().where({ email });
      Logger.info(
        removed > 0
          ? `Production: removed ${removed} seeded example login(s).`
          : `Production: skipping the example account.`,
      );
      return;
    }
    await UserLoginRequest.query().delete().where({ email });
    await UserLoginRequest.query().insert({
      email,
      accessToken: createHash("sha256").update(accessToken).digest("hex"),
    });
    const loginLink = new URL(
      `/login/${accessToken}`,
      container.get("canonicalUrl"),
    );
    Logger.info(`Access token '${accessToken}' was created.`);
    Logger.info(`Visit ${loginLink} to login with an example account.`);
  } finally {
    await knex.destroy();
  }
}

exec().catch((err) => {
  console.error(err);
});
