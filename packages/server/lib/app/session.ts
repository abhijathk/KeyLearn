import { type Binder, type Module, provides } from "@fastr/invert";
import {
  type SessionOptions,
  type Store,
  type StoredSession,
} from "@fastr/middleware-session";
import { FileStore } from "@fastr/middleware-session-file-store";
import { DataDir, Env } from "@keylearn/config";

/**
 * A `FileStore` whose writes to one session do not fail each other.
 *
 * `rolling: true` moves the expiry forward every second, so almost every
 * request writes its session file back. A page that fires several requests
 * at once has them all write the same file, and `FileStore` gives up on its
 * lock after three tries in about 70 ms: the loser's `LockFileError` turns a
 * request that had already succeeded into a 500. Measured on the test stack,
 * bursts of six parallel requests from one signed-in browser lost 5 of 120
 * requests that way.
 *
 * Two layers, because there are two kinds of contention. Inside one worker,
 * writes to the same session run one at a time, and while one is running
 * the ones that arrive behind it collapse into a single write of the newest
 * state — every write is the whole session, so only the last one would have
 * mattered anyway. Across the HTTP workers, where nothing can be shared, a
 * write that still loses the lock is tried again, jittered, for up to about
 * three seconds before the error is allowed through. A `destroy()` joins the
 * same line, so a write queued before a sign-out can never land after it and
 * bring the session back.
 */
type PendingWrite = {
  session: StoredSession;
  readonly done: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (err: unknown) => void;
};

type Line = { chain: Promise<void>; pending: PendingWrite | null };

class PatientFileStore implements Store {
  readonly #inner: FileStore;
  readonly #lines = new Map<string, Line>();

  constructor(inner: FileStore) {
    this.#inner = inner;
  }

  load(sessionId: string): Promise<StoredSession | null> {
    return this.#inner.load(sessionId);
  }

  store(sessionId: string, session: StoredSession): Promise<void> {
    const line = this.#line(sessionId);
    if (line.pending != null) {
      // Not started yet: it will now write this, the newer state.
      line.pending.session = session;
      return line.pending.done;
    }
    let resolve!: () => void;
    let reject!: (err: unknown) => void;
    const done = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    line.pending = { session, done, resolve, reject };
    this.#enqueue(sessionId, line, async () => {
      const next = line.pending;
      line.pending = null;
      if (next == null) {
        return; // Taken over by a destroy().
      }
      try {
        await this.#write(sessionId, next.session);
        next.resolve();
      } catch (err) {
        next.reject(err);
      }
    });
    return done;
  }

  destroy(sessionId: string): Promise<void> {
    const line = this.#line(sessionId);
    // A write that has not started is superseded, not performed.
    line.pending?.resolve();
    line.pending = null;
    let result!: Promise<void>;
    this.#enqueue(sessionId, line, () => {
      result = this.#inner.destroy(sessionId);
      return result;
    });
    return line.chain.then(() => result);
  }

  #line(sessionId: string): Line {
    let line = this.#lines.get(sessionId);
    if (line == null) {
      line = { chain: Promise.resolve(), pending: null };
      this.#lines.set(sessionId, line);
    }
    return line;
  }

  #enqueue(sessionId: string, line: Line, task: () => Promise<void>): void {
    const chain = line.chain.then(task).catch(() => {});
    line.chain = chain;
    void chain.then(() => {
      if (line.chain === chain && line.pending == null) {
        this.#lines.delete(sessionId);
      }
    });
  }

  async #write(sessionId: string, session: StoredSession): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.#inner.store(sessionId, session);
      } catch (err) {
        if ((err as Error)?.name !== "LockFileError" || attempt >= 9) {
          throw err;
        }
        // Jittered, so writers that lost together do not retry together;
        // capped, so the worst case stays around three seconds.
        const delay = Math.min(25 * 2 ** attempt, 400);
        await new Promise((resolve) =>
          setTimeout(resolve, delay / 2 + Math.random() * delay),
        );
      }
    }
  }
}

export class SessionModule implements Module {
  configure(binder: Binder) {}

  @provides({ id: "sessionOptions", singleton: true })
  provideSessionOptions(dataDir: DataDir): SessionOptions {
    return {
      store: new PatientFileStore(
        new FileStore({
          directory: dataDir.dataPath("sessions"),
        }),
      ),
      rolling: true,
      key: Env.getString("COOKIE_NAME", "session"),
      maxAge: Env.getNumber("COOKIE_MAX_AGE", 1209600), // 14 days in seconds
      // No default domain. The old one was ".www.keylearn.com" — inherited from
      // upstream, a domain this project does not own, and malformed besides.
      // Deploying without setting COOKIE_DOMAIN would have emitted a cookie the
      // browser rejects outright for not matching the host, so sign-in would
      // fail silently with nothing in the logs. Omitting the attribute gives a
      // host-only cookie, which is what a single-host deployment wants anyway.
      domain: Env.getString("COOKIE_DOMAIN", "") || undefined,
      path: Env.getString("COOKIE_PATH", "/"),
      httpOnly: Env.getBoolean("COOKIE_HTTP_ONLY", true),
      secure: Env.getBoolean("COOKIE_SECURE", true),
      sameSite: "Lax",
    } as SessionOptions;
  }

  /**
   * A second, independent cookie for the support desk — see
   * `deskAwareSession`. Same store/lifetime/security posture as the
   * learner's own session, just a different name, so a staff member signing
   * in on `/desk` doesn't overwrite the account they're also signed into on
   * the main app in the same browser (and vice versa).
   */
  @provides({ id: "deskSessionOptions", singleton: true })
  provideDeskSessionOptions(dataDir: DataDir): SessionOptions {
    return {
      store: new PatientFileStore(
        new FileStore({
          directory: dataDir.dataPath("sessions"),
        }),
      ),
      rolling: true,
      key: Env.getString("DESK_COOKIE_NAME", "desk_session"),
      maxAge: Env.getNumber("COOKIE_MAX_AGE", 1209600),
      domain: Env.getString("COOKIE_DOMAIN", "") || undefined,
      path: Env.getString("COOKIE_PATH", "/"),
      httpOnly: Env.getBoolean("COOKIE_HTTP_ONLY", true),
      secure: Env.getBoolean("COOKIE_SECURE", true),
      sameSite: "Lax",
    } as SessionOptions;
  }
}
