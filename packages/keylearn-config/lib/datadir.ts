import { join } from "node:path";
import { inject, injectable } from "@fastr/invert";

@injectable()
export class DataDir {
  constructor(@inject("dataDir") readonly dataDir: string) {}

  dataPath(...parts: readonly string[]): string {
    return join(this.dataDir, ...parts);
  }

  /**
   * Returns the full path to a user settings file for the given user id.
   */
  userSettingsFile(userId: number): string {
    const s = String(userId).padStart(9, "0");
    return this.dataPath(
      "user_settings", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
    );
  }

  /**
   * Returns the full path to a user stats file for the given user id.
   */
  userStatsFile(userId: number): string {
    const s = String(userId).padStart(9, "0");
    return this.dataPath(
      "user_stats", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
    );
  }

  /**
   * Returns the full path to a learner's braille progress.
   *
   * Its own file rather than a corner of the stats one: braille progress is a
   * different shape from typing results — cells and chord times rather than
   * lessons — and it is written by a page that produces no results at all.
   */
  brailleProgressFile(userId: number, profileId: number): string {
    const s = String(userId).padStart(9, "0");
    return this.dataPath(
      "braille_progress", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
      String(profileId),
    );
  }

  /**
   * Returns the full path to a per-profile stats file: one file per learner
   * profile, grouped under its owning account.
   */
  profileStatsFile(userId: number, profileId: number): string {
    const s = String(userId).padStart(9, "0");
    return this.dataPath(
      "profile_stats", //
      s.substring(0, 3),
      s.substring(3, 6),
      s,
      String(profileId),
    );
  }
}
