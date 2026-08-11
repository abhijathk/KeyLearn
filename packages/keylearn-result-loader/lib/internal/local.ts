import { type Result } from "@keylearn/result";
import { resultFromJson, resultToJson } from "@keylearn/result-io";
import {
  type DBDatabase,
  DBNamedFactory,
  type DBTransaction,
} from "./indexeddb/index.ts";
import { type LocalResultStorage } from "./types.ts";

export class PersistentResultStorage implements LocalResultStorage {
  readonly #factory;

  constructor(name = "history") {
    this.#factory = new DBNamedFactory(indexedDB, name, 1);
  }

  /**
   * Open the database, and repair it if it has no store to write into.
   *
   * A database at the current version never runs its migration again, so one
   * that exists without its object store stays broken for good — every read
   * and every write throws NotFoundError, for that learner, on that device,
   * forever. It is reached by anything that opens the name without a version,
   * which browser tooling does, and which the app itself did while a course
   * history was being looked up before it had ever been written.
   *
   * Dropping it costs nothing when it is empty, which by definition it is —
   * a database with nowhere to put results is holding none.
   */
  async #open() {
    let db = await this.#factory.openDatabase(migration);
    if (!db.objectStoreNames.includes(db.name)) {
      db.close();
      await this.#factory.deleteDatabase();
      db = await this.#factory.openDatabase(migration);
    }
    return db;
  }

  async load(): Promise<Result[]> {
    const db = await this.#open();
    try {
      const tx = db.transaction(db.name, "readonly");
      const store = tx.objectStore(db.name);
      const results = await store.readAll((key, value) => {
        return resultFromJson(value);
      });
      await tx.completed;
      return results;
    } finally {
      db.close();
    }
  }

  async append(results: readonly Result[]): Promise<void> {
    const db = await this.#open();
    try {
      const tx = db.transaction(db.name, "readwrite");
      const store = tx.objectStore(db.name);
      for (const result of results) {
        await store.add(resultToJson(result));
      }
      await tx.completed;
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    return await this.#factory.deleteDatabase();
  }
}

async function migration(
  db: DBDatabase,
  tx: DBTransaction,
  oldVersion: number,
  newVersion: number | null,
): Promise<void> {
  // Asked rather than assumed: creating a store that is already there throws,
  // and this now runs on a database that may have been half-made.
  if (!db.objectStoreNames.includes(db.name)) {
    db.createObjectStore(db.name, { autoIncrement: true });
  }
}
