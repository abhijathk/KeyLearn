import { Layout } from "@keylearn/keyboard";
import { type File } from "@sosimple/fsx-file";
import { LockFile } from "@sosimple/fsx-lockfile";
import { exponentialDelay } from "@sosimple/retry";
import { HighScores, type HighScoresData } from "./highscores.ts";

export async function readTable(file: File): Promise<HighScores> {
  try {
    // Reads both shapes: the current { best, recent } object and the plain
    // array written before the store was split, so an existing table survives
    // the upgrade instead of being silently reset.
    return new HighScores((await file.readJson({ reviver })) as HighScoresData);
  } catch {
    return new HighScores();
  }
}

export async function writeTable(file: File, table: HighScores): Promise<void> {
  // Overwrites whatever is there. Only safe when the caller did not base
  // `table` on a read of this same file — otherwise use `updateTable`, which
  // holds the lock across the read as well.
  await LockFile.withLock(
    file,
    { retryLimit: 3, delayer: exponentialDelay(10) },
    async (lock) => {
      await lock.writeFile(JSON.stringify(table));
    },
  );
}

/**
 * Read, change and write the table under a single lock.
 *
 * The board is one shared file and the server runs several worker processes, so
 * a read-modify-write split across two lock acquisitions loses updates: both
 * workers read the same table, each adds its own score, and whichever writes
 * second silently discards the other's entry. A learner's place on the board
 * would simply not be there, with nothing logged and nothing to reproduce.
 *
 * Holding the lock across the read closes that window — the second worker reads
 * the table only after the first has committed, and so sees the entry it must
 * preserve.
 */
export async function updateTable(
  file: File,
  change: (table: HighScores) => void,
): Promise<void> {
  await LockFile.withLock(
    file,
    { retryLimit: 3, delayer: exponentialDelay(10) },
    async (lock) => {
      // Reads the original file, not the lock file: the lock's contents are
      // only moved into place when the callback returns.
      const table = await readTable(file);
      change(table);
      if (table.dirty) {
        await lock.writeFile(JSON.stringify(table));
      }
    },
  );
}

export function reviver(key: any, value: any): any {
  switch (key) {
    case "layout":
      // A layout that no longer exists must not take the file down with it.
      // Throwing here aborts the whole parse, and `readTable` would then hand
      // back an empty board — one unrecognised row silently erasing everyone
      // else's standing.
      try {
        return Layout.ALL.get(value);
      } catch {
        return null;
      }
    case "timeStamp":
      return new Date(value);
    default:
      return value;
  }
}
