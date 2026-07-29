import { type Context, type Middleware, type Next } from "@fastr/core";
import { ForbiddenError } from "@fastr/errors";
import { randomString, type SessionState } from "@fastr/middleware-session";
import { User } from "@keybr/database";
import { type AuthState } from "./types.ts";

// How long a "don't keep me signed in" session lasts before it lapses.
const SHORT_SESSION_TTL_MS = 24 * 3600 * 1000;

export function loadUser(): Middleware<SessionState & AuthState> {
  return async (
    ctx: Context<SessionState & AuthState>,
    next: Next,
  ): Promise<void> => {
    const { state } = ctx;
    Object.assign(state, await makeAuthState(state));
    await next();
  };
}

async function makeAuthState(
  state: SessionState & AuthState,
): Promise<AuthState> {
  const { session } = state;
  const sessionId = session.id ?? randomString(10);
  const userId = session.get("userId");
  let user: User | null = null;
  if (userId != null) {
    user = await User.findById(userId);
    // "Sign out everywhere" bumps the account's session epoch; a session minted
    // before that (or with no epoch) is no longer valid.
    if (user != null && (session.get("epoch") ?? 0) !== (user.sessionEpoch ?? 0)) {
      session.destroy();
      user = null;
    }
    // "Keep me signed in" was unchecked (shared/family device): the cookie is
    // always 14-day rolling, so we enforce a shorter life at the app level —
    // the session lapses a day after sign-in regardless.
    if (user != null && session.get("shortLived") === true) {
      const loginAt = Number(session.get("loginAt") ?? 0);
      if (loginAt > 0 && Date.now() - loginAt > SHORT_SESSION_TTL_MS) {
        session.destroy();
        user = null;
      }
    }
  }
  const publicUser = User.toPublicUser(user, sessionId);
  return {
    sessionId,
    user,
    publicUser,
    requireUser: () => {
      if (user == null) {
        throw new ForbiddenError();
      } else {
        return user;
      }
    },
  };
}
