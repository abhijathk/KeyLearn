import { type Context, type Middleware, type Next } from "@fastr/core";
import { ForbiddenError } from "@fastr/errors";
import { randomString, type SessionState } from "@fastr/middleware-session";
import { StaffAuditEvent, User } from "@keylearn/database";
import { clientIp } from "./ratelimit.ts";
import { staffAccessStatus } from "./staff-access.ts";
import { type AuthState } from "./types.ts";

// How long a "don't keep me signed in" session lasts before it lapses.
const SHORT_SESSION_TTL_MS = 24 * 3600 * 1000;

export function loadUser(): Middleware<SessionState & AuthState> {
  return async (
    ctx: Context<SessionState & AuthState>,
    next: Next,
  ): Promise<void> => {
    const { state } = ctx;
    Object.assign(state, await makeAuthState(ctx));
    await next();
  };
}

async function makeAuthState(
  ctx: Context<SessionState & AuthState>,
): Promise<AuthState> {
  const { state } = ctx;
  const { session } = state;
  const sessionId = session.id ?? randomString(10);
  // Only a session that reached the END of sign-in carries `userId`. A password
  // accepted against a two-step-protected account parks the id under
  // `pending2faUserId` instead, and nothing here reads that key — so a
  // half-finished sign-in resolves to no user and reaches nothing. This is the
  // whole guarantee of the second factor; keep the two keys distinct.
  const userId = session.get("userId");
  let user: User | null = null;
  if (userId != null) {
    user = await User.findById(userId);
    // "Sign out everywhere" bumps the account's session epoch; a session minted
    // before that (or with no epoch) is no longer valid.
    if (
      user != null &&
      (session.get("epoch") ?? 0) !== (user.sessionEpoch ?? 0)
    ) {
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
  const requireUser = () => {
    if (user == null) {
      throw new ForbiddenError();
    } else {
      return user;
    }
  };
  return {
    sessionId,
    user,
    publicUser,
    requireUser,
    requireStaff: async () => {
      const u = requireUser();
      const ip = clientIp(ctx);
      const status = await staffAccessStatus(u);
      if (!status.ok) {
        void StaffAuditEvent.record({
          userId: u.id,
          action: "staff-access-denied",
          detail:
            status.reason === "not-staff"
              ? "not staff"
              : "no passkey or two-step verification",
          ip,
        });
        throw new ForbiddenError();
      }
      // Recorded once per session rather than on every request — the
      // request rate to the desk isn't the interesting signal, whether a
      // new session reached it at all is.
      if (session.get("staffAudited") !== true) {
        session.set("staffAudited", true);
        void StaffAuditEvent.record({
          userId: u.id,
          action: "staff-signin",
          ip,
        });
      }
      return u;
    },
  };
}
