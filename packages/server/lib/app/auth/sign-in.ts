import { type Context } from "@fastr/core";
import { ApplicationError } from "@fastr/errors";
import { type SessionState } from "@fastr/middleware-session";
import { type User } from "@keylearn/database";

/**
 * The one way a sign-in finishes.
 *
 * Every route that ends with "this browser is now that account" — password,
 * magic link, provider, passkey, password reset, completing sign-up — used to
 * write `userId` into the session itself, and only the password route
 * remembered two-step verification. A magic link, a reset link or a Google
 * sign-in therefore walked straight past the second factor. This is the one
 * place that decides, so a new sign-in route cannot forget.
 *
 * When the account has two-step verification on and the route did not
 * itself prove a second factor, the session is PARKED: it carries
 * `pending2faUserId`, which `loadUser` never reads, and nothing is reachable
 * until `/auth/2fa/verify` finishes it — the same flow the password route
 * always used.
 */
export type SignInOptions = {
  /** For the audit trail and the pending marker: "password", "magic-link", … */
  readonly method: string;
  /** "Keep me signed in" unticked: the session lapses after a day. */
  readonly remember?: boolean;
  /**
   * The route itself proved a second factor (an authenticator code, a
   * recovery code, a user-verified passkey). Recorded on the session as
   * {@link SECOND_FACTOR_KEY}, which the staff gate requires.
   */
  readonly secondFactor?: boolean;
};

export type SignInOutcome = "signed-in" | "pending-2fa";

/** Session key: this session's sign-in used a second factor. */
export const SECOND_FACTOR_KEY = "mfa";
/** Session key: when this session signed in (or last re-authenticated). */
export const LOGIN_AT_KEY = "loginAt";
/** Session key: when the owner last re-proved who they are mid-session. */
export const REAUTH_AT_KEY = "reauthAt";

/** A half-finished (password-only) sign-in stays open this long. */
export const PENDING_2FA_TTL_MS = 10 * 60_000;
/** Hard ceiling on any session, however active: sign in again after this. */
export const ABSOLUTE_SESSION_MS = 30 * 24 * 3600_000;
/** How recent a sign-in must be for a sensitive change without re-proving. */
export const RECENT_AUTH_MS = 10 * 60_000;

export function finishSignIn(
  ctx: Context<SessionState>,
  user: User,
  { method, remember, secondFactor = false }: SignInOptions,
): SignInOutcome {
  const { session } = ctx.state;
  // A fresh session id on every privilege change — never reuse whatever the
  // browser arrived with (session fixation).
  session.destroy();
  session.start();
  if (remember === false) {
    session.set("shortLived", true);
  }
  if (user.totpEnabled && !secondFactor) {
    session.set("pending2faUserId", user.id!);
    session.set("pending2faAt", Date.now());
    session.set("pending2faMethod", method);
    return "pending-2fa";
  }
  const now = Date.now();
  session.set("userId", user.id!);
  session.set("epoch", user.sessionEpoch ?? 0);
  session.set(LOGIN_AT_KEY, now);
  if (secondFactor) {
    session.set(SECOND_FACTOR_KEY, true);
  }
  return "signed-in";
}

/**
 * Sensitive changes — adding a passkey, today — need the owner to have
 * signed in, or re-proved themselves through `/auth/reauth`, within the last
 * {@link RECENT_AUTH_MS}. A session left open on a shared machine is not the
 * owner, and a passkey added from it is a permanent key to the account.
 *
 * Answers 403 with `reauth: true`, so the client knows to ask for the
 * password (or an emailed code) rather than show a dead end.
 */
export function requireRecentAuth(ctx: Context<SessionState>): void {
  const { session } = ctx.state;
  const at = Math.max(
    Number(session.get(LOGIN_AT_KEY) ?? 0),
    Number(session.get(REAUTH_AT_KEY) ?? 0),
  );
  if (at > 0 && Date.now() - at <= RECENT_AUTH_MS) {
    return;
  }
  throw new ApplicationError("Confirm it is you to continue.", {
    status: 403,
    body: { error: { message: "Confirm it is you", reauth: true } },
  });
}
