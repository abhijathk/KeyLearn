import { injectable } from "@fastr/invert";
import { DataDir } from "@keylearn/config";
import { type Result } from "@keylearn/result";
import { File } from "@sosimple/fsx-file";
import { type HighScores } from "./highscores.ts";
import { readTable, updateTable } from "./io.ts";

@injectable()
export class HighScoresFactory {
  readonly #file: File;

  constructor(dataDir: DataDir) {
    this.#file = new File(dataDir.dataPath("highscores.json"));
  }

  async load(): Promise<HighScores> {
    return await readTable(this.#file);
  }

  async append(
    userId: number,
    profileId: number | null,
    results: readonly Result[],
  ): Promise<void> {
    // Read and write under one lock. Reading first and locking only for the
    // write let two workers each add a score to the same table and the later
    // write drop the earlier one.
    await updateTable(this.#file, (table) => {
      table.append(userId, profileId, results);
    });
  }
}
