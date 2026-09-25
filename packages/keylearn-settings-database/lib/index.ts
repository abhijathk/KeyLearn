import { injectable } from "@fastr/invert";
import { DataDir, type LearnerOwner } from "@keylearn/config";
import { Settings } from "@keylearn/settings";
import { File } from "@sosimple/fsx-file";
import { LockFile } from "@sosimple/fsx-lockfile";
import { exponentialDelay } from "@sosimple/retry";

@injectable()
export class SettingsDatabase {
  constructor(readonly dataDir: DataDir) {}

  async set(userId: number, settings: Settings | null): Promise<void> {
    const file = this.#getFile(userId);
    await LockFile.withLock(
      file,
      { retryLimit: 5, delayer: exponentialDelay(10) },
      async (lock) => {
        if (settings != null) {
          await lock.writeFile(JSON.stringify(settings.toJSON(), null, 2));
          await lock.commit();
        } else {
          await file.delete();
          await lock.rollback();
        }
      },
    );
  }

  async get(userId: number): Promise<Settings | null> {
    return await readSettings(this.#getFile(userId));
  }

  #getFile(userId: number) {
    return new File(this.dataDir.userSettingsFile(userId));
  }

  async setProfile(
    owner: LearnerOwner,
    profileId: number,
    settings: Settings | null,
  ): Promise<void> {
    const file = this.#getProfileFile(owner, profileId);
    await LockFile.withLock(
      file,
      { retryLimit: 5, delayer: exponentialDelay(10) },
      async (lock) => {
        if (settings != null) {
          await lock.writeFile(JSON.stringify(settings.toJSON(), null, 2));
          await lock.commit();
        } else {
          await file.delete();
          await lock.rollback();
        }
      },
    );
  }

  async getProfile(
    owner: LearnerOwner,
    profileId: number,
  ): Promise<Settings | null> {
    return await readSettings(this.#getProfileFile(owner, profileId));
  }

  #getProfileFile(owner: LearnerOwner, profileId: number) {
    return new File(this.dataDir.profileSettingsFile(owner, profileId));
  }
}

/**
 * Reads without taking the lock.
 *
 * A write never touches the file in place: it goes to the lock file and is
 * renamed over the original on commit, and a delete is a single unlink. So a
 * read always sees one whole version, old or new, and the lock bought it
 * nothing. It did cost: every read took the same exclusive lock as a write,
 * and a page that asked for the same settings several times at once (the
 * page load and the sync call side by side) had the losers give up after
 * five tries and answer 500. Measured on the test stack: 141 of 1,383 on `/`
 * and 135 of 2,251 on `/_/sync/settings`, 30 requests at once on one account.
 */
async function readSettings(file: File): Promise<Settings | null> {
  let json: unknown;
  try {
    json = await file.readJson();
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return null;
    } else {
      throw err;
    }
  }
  return new Settings(json as any);
}
