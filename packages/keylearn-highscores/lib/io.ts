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
  // In case of concurrent modification last writer wins.
  // TODO Implement optimistic concurrency control.
  await LockFile.withLock(
    file,
    { retryLimit: 3, delayer: exponentialDelay(10) },
    async (lock) => {
      await lock.writeFile(JSON.stringify(table));
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
