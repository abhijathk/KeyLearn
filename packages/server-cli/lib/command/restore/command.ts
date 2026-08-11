import { injectable } from "@fastr/invert";
import { DataDir } from "@keylearn/config";
import { ProfileData } from "@keylearn/database";
import { PublicId } from "@keylearn/publicid";
import { UserDataFactory } from "@keylearn/result-userdata";
import { File } from "@sosimple/fsx-file";
import { Command, Option } from "commander";

/**
 * Writes the database snapshots back out as files.
 *
 * The snapshot sweep copies every learner's history into `profile_data` so that
 * losing the machine does not lose the data. That is only half a backup: until
 * this existed, nothing could read those rows back, so a restore meant somebody
 * writing a script under the worst possible circumstances. This is the other
 * half, and it is the part worth rehearsing before it is needed.
 *
 * Refuses to overwrite by default. A file that is already on disk is the
 * working copy and is newer than any snapshot of it, so replacing it with an
 * older one would lose whatever has been practised since — the restore would
 * itself destroy data.
 */
@injectable()
export class RestoreCommand {
  constructor(
    readonly userData: UserDataFactory,
    readonly dataDir: DataDir,
  ) {}

  command() {
    return new Command("restore-data")
      .description(
        "Write learner data from the database snapshots back to files.",
      )
      .addOption(
        new Option(
          "--user <id>",
          "Restore one account only, by numeric user id.",
        ),
      )
      .addOption(
        new Option(
          "--force",
          "Replace files that already exist. They are newer than the " +
            "snapshot, so this loses anything practised since it was taken.",
        ),
      )
      .addOption(
        new Option(
          "--dry-run",
          "Report what would be written, without writing anything.",
        ),
      )
      .action(this.action.bind(this));
  }

  async action({
    user,
    force = false,
    dryRun = false,
  }: {
    user?: string;
    force?: boolean;
    dryRun?: boolean;
  }): Promise<void> {
    const rows =
      user != null
        ? await ProfileData.listForUser(Number(user))
        : await ProfileData.query().orderBy("id");

    let written = 0;
    let skipped = 0;
    for (const row of rows) {
      const file = this.#fileFor(row);
      if (file == null) {
        continue;
      }
      if ((await file.exists()) && !force) {
        skipped += 1;
        process.stdout.write(`skip (exists) ${file.name}\n`);
        continue;
      }
      if (dryRun) {
        written += 1;
        process.stdout.write(`would write ${row.bytes} bytes ${file.name}\n`);
        continue;
      }
      await file.dir().create(true);
      await file.write(row.payload ?? Buffer.alloc(0));
      written += 1;
      process.stdout.write(`wrote ${row.bytes} bytes ${file.name}\n`);
    }
    process.stdout.write(
      `${dryRun ? "would restore" : "restored"} ${written}, skipped ${skipped}\n`,
    );
  }

  /** Where a row belongs on disk, or null if the kind is unknown. */
  #fileFor(row: ProfileData): File | null {
    const userId = row.userId!;
    if (row.kind === "braille") {
      return row.profileId == null
        ? null // Braille progress always belongs to a learner.
        : new File(this.dataDir.brailleProgressFile(userId, row.profileId));
    }
    if (row.kind === "results") {
      return row.profileId == null
        ? this.userData.load(new PublicId(userId)).file
        : this.userData.loadProfile(userId, row.profileId).file;
    }
    if (row.kind === "classic") {
      return row.profileId == null
        ? null // A course belongs to a learner, never to the account.
        : this.userData.loadProfile(userId, row.profileId, "classic").file;
    }
    return null;
  }
}
