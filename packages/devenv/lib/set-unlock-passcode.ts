#!/usr/bin/env -S npx tsnode

/**
 * Sets (or changes) the desk's failsafe unlock passcode.
 *
 *   npx tsnode ./packages/devenv/lib/set-unlock-passcode.ts 493028
 *
 * This is the intended way to CHANGE the passcode. `ADMIN_UNLOCK_PASSCODE`
 * in .env only seeds a passcode where none exists yet (first boot of a
 * fresh database) — deliberately, so a stale env value can never silently
 * revert a passcode that was changed later. Changing it means running
 * this, which also resets the failure counter and any lockout.
 *
 * Six digits or more. It guards the switch that stops every customer
 * being answered, and it is rate-limited server-side — but it is still a
 * passcode, so don't pick a birthday.
 */
import { Container } from "@fastr/invert";
import { ConfigModule, Env } from "@keylearn/config";
import { DeskUnlock } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import Knex from "knex";

const passcode = process.argv[2]?.trim() ?? "";
if (!/^\d{6,12}$/.test(passcode)) {
  console.error("Usage: set-unlock-passcode.ts <6-12 digits>");
  process.exit(1);
}

Env.probeFilesSync();
const container = new Container();
container.load(new ConfigModule());
const knex = container.get(Knex);

try {
  await DeskUnlock.setPasscode(passcode);
  Logger.info(
    "Failsafe passcode updated; failure counter and lockout cleared.",
  );
} finally {
  await knex.destroy();
}
