import { injectable } from "@fastr/invert";
import { DataDir, Env } from "@keylearn/config";
import { Profile, ProfileData, User } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { PublicId } from "@keylearn/publicid";
import { UserDataFactory } from "@keylearn/result-userdata";
import { siteNumber } from "@keylearn/site-config";
import { File } from "@sosimple/fsx-file";
import { repeat } from "../site-config/repeat.ts";

/** How often the snapshot runs. */
export function snapshotIntervalMs(): number {
  return siteNumber("ops.snapshotMin") * 60 * 1000;
}

/** Set to false to keep everything on disk and nowhere else. */
export function snapshotEnabled(): boolean {
  return Env.getBoolean("DATA_SNAPSHOT", true);
}

/**
 * Copies learner data files into the database at intervals.
 *
 * The files under `DATA_DIR` stay the working copy. Every completed lesson is
 * appended to one, and the client is served one verbatim — that path is
 * untouched, because it is fast and already correct. What it is not is durable:
 * those files sit on one machine's disk, and losing, replacing or resizing that
 * machine takes every household's history with it. The database gets backed up;
 * a data directory very often does not.
 *
 * So this is a snapshot, not a second source of truth. Nothing reads back from
 * the database during normal operation — it exists for the day the disk is gone.
 *
 * Runs in the cluster's primary process, which is idle after forking the
 * workers. That matters for more than tidiness: five workers each sweeping the
 * same files would do the same work five times and race each other's writes.
 *
 * Unchanged files cost one hash and no write at all, which is the common case —
 * most learners do not practise most days.
 */
@injectable({ singleton: true })
export class DataSnapshot {
  #timer: (() => void) | null = null;
  #running = false;

  constructor(
    readonly userData: UserDataFactory,
    readonly dataDir: DataDir,
  ) {}

  start(): void {
    if (this.#timer != null || !snapshotEnabled()) {
      return;
    }
    const interval = snapshotIntervalMs();
    // The first pass waits a full interval: a restart loop must not turn into a
    // write storm against the database. Re-read each tick: the period is a
    // control-centre setting.
    this.#timer = repeat(snapshotIntervalMs, () => void this.runOnce());
    Logger.info("Data snapshot scheduled", {
      everyMinutes: interval / 60_000,
    });
  }

  stop(): void {
    if (this.#timer != null) {
      this.#timer();
      this.#timer = null;
    }
  }

  /**
   * One pass over every account. Returns how many files were actually written,
   * which on a quiet interval is normally zero.
   */
  async runOnce(): Promise<number> {
    // A pass that overruns its interval must not be joined by the next one.
    if (this.#running) {
      Logger.warn("Data snapshot still running; skipping this interval");
      return 0;
    }
    this.#running = true;
    let written = 0;
    let considered = 0;
    let pruned = 0;
    try {
      const users = await User.query().select("id");
      for (const user of users) {
        try {
          const userId = user.id!;
          // Every file this account still has, so anything snapshotted whose
          // file has since gone can be dropped below.
          const present = new Set<string>();
          // The account-level history belongs to no learner.
          considered += 1;
          if (
            await this.#snapshotFile(
              userId,
              null,
              "results",
              this.userData.load(new PublicId(userId)).file,
              present,
            )
          ) {
            written += 1;
          }
          for (const profile of await Profile.listForUser(userId)) {
            const profileId = profile.id!;
            considered += 3;
            if (
              await this.#snapshotFile(
                userId,
                profileId,
                "results",
                this.userData.loadProfile(userId, profileId).file,
                present,
              )
            ) {
              written += 1;
            }
            if (
              await this.#snapshotFile(
                userId,
                profileId,
                "classic",
                this.userData.loadProfile(userId, profileId, "classic").file,
                present,
              )
            ) {
              written += 1;
            }
            if (
              await this.#snapshotFile(
                userId,
                profileId,
                "braille",
                new File(this.dataDir.brailleProgressFile(userId, profileId)),
                present,
              )
            ) {
              written += 1;
            }
          }
          // A learner can clear their history in the moment between this pass
          // reading a file and writing the row, which would leave a snapshot of
          // data they had just asked to erase. Deletion cannot close that
          // window on its own, so the next pass does: a row whose file is gone
          // is a row that should not exist.
          for (const row of await ProfileData.listForUser(userId)) {
            if (!present.has(`${row.profileId ?? ""}:${row.kind}`)) {
              await ProfileData.deleteFor(
                userId,
                row.profileId ?? null,
                row.kind,
              );
              pruned += 1;
            }
          }
        } catch (err: any) {
          // One unreadable account must not stop the rest of the pass.
          Logger.warn(err, "Could not snapshot user %s", user.id);
        }
      }
      Logger.info("Data snapshot finished", { considered, written, pruned });
    } catch (err: any) {
      Logger.warn(err, "Data snapshot failed");
    } finally {
      this.#running = false;
    }
    return written;
  }

  /**
   * Copy one file, unless it is missing or identical to what is already stored.
   *
   * The digest is taken from the file that was actually read, so a lesson
   * appended while this runs simply lands in the next pass rather than storing a
   * payload whose digest describes different bytes.
   */
  async #snapshotFile(
    userId: number,
    profileId: number | null,
    kind: "results" | "braille" | "classic",
    file: File,
    present: Set<string>,
  ): Promise<boolean> {
    if (!(await file.exists())) {
      return false;
    }
    const payload = await file.read();
    if (payload.length === 0) {
      return false;
    }
    present.add(`${profileId ?? ""}:${kind}`);
    return await ProfileData.store(userId, profileId, kind, payload);
  }
}
