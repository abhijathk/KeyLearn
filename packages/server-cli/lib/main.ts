import { Container } from "@fastr/invert";
import { ConfigModule, Env } from "@keylearn/config";
import { Command, CommanderError } from "commander";
import Knex from "knex";
import { PremiumCommand } from "./command/premium/index.ts";
import { StatsCommand } from "./command/stats/index.ts";
import { UserInfoCommand } from "./command/user-info/index.ts";

Env.probeFilesSync();
const container = new Container();
container.load(new ConfigModule());
const knex = container.get(Knex);
const program = new Command("keylearn")
  .addCommand(container.get(UserInfoCommand).command())
  .addCommand(container.get(PremiumCommand).command())
  .addCommand(container.get(StatsCommand).command());
program
  .parseAsync()
  .then(() => {
    knex.destroy();
  })
  .catch((err) => {
    if (err instanceof CommanderError) {
      program.error(err.message, err);
    } else {
      throw err;
    }
  });
