import { type Binder, type Module, provides } from "@fastr/invert";
import { type SessionOptions } from "@fastr/middleware-session";
import { FileStore } from "@fastr/middleware-session-file-store";
import { DataDir, Env } from "@keylearn/config";

export class SessionModule implements Module {
  configure(binder: Binder) {}

  @provides({ id: "sessionOptions", singleton: true })
  provideSessionOptions(dataDir: DataDir): SessionOptions {
    return {
      store: new FileStore({
        directory: dataDir.dataPath("sessions"),
      }),
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
      store: new FileStore({
        directory: dataDir.dataPath("sessions"),
      }),
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
