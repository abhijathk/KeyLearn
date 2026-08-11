import { recoverResults, Result } from "@keylearn/result";
import { DatabaseError } from "../errors.ts";
import { PersistentResultStorage } from "./local.ts";
import {
  ResultSyncNamedUser,
  ResultSyncProfile,
  ResultSyncPublicUser,
} from "./remotesync.ts";
import {
  type LocalResultStorage,
  type ProgressListener,
  type RemoteResultSync,
  type ResultStorage,
} from "./types.ts";

export type OpenRequest =
  | {
      // Load our own data.
      readonly type: "private";
      readonly userId: string | null;
      // Kids results live in their own local database, separate from the
      // grown-up history, and never sync to the grown-up account.
      readonly kids?: boolean;
      // A household-profile local namespace (e.g. "profile-p3f9k2"). When set,
      // results are kept in their own local database and never synced.
      readonly namespace?: string | null;
    }
  | {
      // Load data of a public user.
      readonly type: "public";
      readonly userId: string;
    };

export function openResultStorage(request: OpenRequest): ResultStorage {
  return wrapResultStorage(openRawResultStorage(request));
}

export function wrapResultStorage(storage: ResultStorage): ResultStorage {
  return translateErrors(validateResults(storage));
}

function openRawResultStorage(
  request:
    | {
        readonly type: "private";
        readonly userId: string | null;
        readonly kids?: boolean;
        readonly namespace?: string | null;
      }
    | {
        readonly type: "public";
        readonly userId: string;
      },
) {
  switch (request.type) {
    case "private": {
      const { userId, kids = false, namespace = null } = request;
      // A specific learner profile. Signed in, its history syncs to the server
      // (per-profile), so a learner's progress follows them across devices;
      // signed out it stays local only.
      if (namespace != null) {
        const local = new PersistentResultStorage(`history-${namespace}`);
        // "profile-19" is the guided history; "profile-19.classic" is a
        // separate course kept beside it, with its own store and its own path
        // on the server.
        const parsed = /^profile-([^.]+)(?:\.([a-z]{1,16}))?$/.exec(namespace);
        if (userId != null && parsed != null) {
          const remote = new ResultSyncProfile(parsed[1], parsed[2] ?? null);
          return new ResultStorageOfNamedUser(local, remote);
        }
        return new ResultStorageOfAnonymousUser(local);
      }
      if (kids) {
        const local = new PersistentResultStorage("history-kids");
        return new ResultStorageOfAnonymousUser(local);
      }
      if (userId == null) {
        const local = new PersistentResultStorage();
        return new ResultStorageOfAnonymousUser(local);
      } else {
        const local = new PersistentResultStorage();
        const remote = new ResultSyncNamedUser();
        return new ResultStorageOfNamedUser(local, remote);
      }
    }
    case "public": {
      const { userId } = request;
      const remote = new ResultSyncPublicUser(userId);
      return new ResultStorageOfPublicUser(remote);
    }
  }
}

function translateErrors(storage: ResultStorage): ResultStorage {
  return new (class ErrorTranslator implements ResultStorage {
    async load(pl?: ProgressListener): Promise<Result[]> {
      try {
        return await storage.load(pl);
      } catch (err: any) {
        throw new DatabaseError("Cannot read records from database", {
          cause: err,
        });
      }
    }

    async append(
      results: readonly Result[],
      pl?: ProgressListener,
    ): Promise<void> {
      try {
        await storage.append(results, pl);
      } catch (err: any) {
        throw new DatabaseError("Cannot add records to database", {
          cause: err,
        });
      }
    }

    async clear(): Promise<void> {
      try {
        await storage.clear();
      } catch (err: any) {
        throw new DatabaseError("Cannot clear database", {
          cause: err,
        });
      }
    }
  })();
}

function validateResults(storage: ResultStorage): ResultStorage {
  return new (class ErrorTranslator implements ResultStorage {
    async load(pl?: ProgressListener): Promise<Result[]> {
      return recoverResults(await storage.load(pl));
    }

    async append(
      results: readonly Result[],
      pl?: ProgressListener,
    ): Promise<void> {
      results = results.filter(Result.isValid);
      if (results.length > 0) {
        await storage.append(results, pl);
      }
    }

    async clear(): Promise<void> {
      await storage.clear();
    }
  })();
}

export class ResultStorageOfAnonymousUser implements ResultStorage {
  readonly #local: LocalResultStorage;

  constructor(local: LocalResultStorage) {
    this.#local = local;
  }

  async load(pl = dummy): Promise<Result[]> {
    return await this.#local.load();
  }

  async append(results: readonly Result[], pl = dummy): Promise<void> {
    await this.#local.append(results);
  }

  async clear(): Promise<void> {
    await this.#local.clear();
  }
}

export class ResultStorageOfNamedUser implements ResultStorage {
  readonly #local: LocalResultStorage;
  readonly #remote: RemoteResultSync;
  // Every touch of the local store queues behind the last, so a flush can
  // never clear a result that arrived while its send was in flight. The local
  // store can only be emptied wholesale — there is no delete-these-rows — so
  // without this the window between "send succeeded" and "clear" would eat any
  // lesson finished inside it.
  #chain: Promise<unknown> = Promise.resolve();

  constructor(local: LocalResultStorage, remote: RemoteResultSync) {
    this.#local = local;
    this.#remote = remote;
    // Waiting for the next lesson to push what is already queued would leave
    // somebody who practised on a train and then closed the tab carrying their
    // results around until they happened to finish another one.
    globalThis.addEventListener?.("online", () => {
      void this.#flush(dummy).catch(() => {});
    });
  }

  #serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#chain.then(work, work);
    this.#chain = next.catch(() => {});
    return next;
  }

  /**
   * Hand everything held locally to the server, and keep it if that fails.
   *
   * Errors are the caller's to swallow: a failed flush means "still offline",
   * which is not a condition anybody upstream can do anything about.
   */
  #flush(pl: ProgressListener): Promise<void> {
    return this.#serial(async () => {
      const pending = await this.#local.load();
      if (pending.length === 0) {
        return;
      }
      await this.#remote.send(pending, pl);
      await this.#local.clear();
    });
  }

  async load(pl = dummy): Promise<Result[]> {
    // Anything typed offline goes up before we ask what the server holds, so
    // the answer already includes it.
    await this.#flush(pl).catch(() => {});
    try {
      return await this.#remote.receive(pl);
    } catch (err) {
      // Offline. Their own history is still on this device, and showing it is
      // better than showing an empty page to somebody who has been practising.
      const local = await this.#local.load();
      if (local.length > 0) {
        return local;
      }
      throw err;
    }
  }

  async append(results: readonly Result[], pl = dummy): Promise<void> {
    // Written locally FIRST. This used to go straight to the server and
    // nowhere else, so a lesson finished without a connection was not saved
    // anywhere — it simply vanished, with the learner watching it count.
    let buffered = true;
    try {
      await this.#serial(() => this.#local.append(results));
    } catch {
      // A device whose local store will not accept writes is a bad reason to
      // lose a lesson that the server would have taken. Writing locally first
      // is a safety net for being offline, and a safety net that drops what it
      // was meant to catch is worse than none.
      buffered = false;
    }
    if (buffered) {
      await this.#flush(pl).catch(() => {});
    } else {
      await this.#remote.send(results, pl);
    }
  }

  async clear(): Promise<void> {
    await this.#remote.clear();
    await this.#serial(() => this.#local.clear());
  }
}

export class ResultStorageOfPublicUser implements ResultStorage {
  readonly #remote: RemoteResultSync;

  constructor(remote: RemoteResultSync) {
    this.#remote = remote;
  }

  async load(pl = dummy): Promise<Result[]> {
    return await this.#remote.receive(pl);
  }

  async append(results: readonly Result[], pl = dummy): Promise<void> {
    throw new Error("Disabled");
  }

  async clear(): Promise<void> {
    throw new Error("Disabled");
  }
}

function dummy(total: number, current: number): void {}
