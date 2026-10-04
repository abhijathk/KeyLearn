import { timingSafeEqual } from "node:crypto";
import { type Context, type Middleware, type Next } from "@fastr/core";
import { ForbiddenError, HttpError } from "@fastr/errors";
import { randomString, type SessionState } from "@fastr/middleware-session";
import { Env } from "@keylearn/config";
import {
  PasswordHashBusyError,
  StaffAuditEvent,
  User,
} from "@keylearn/database";
import { clientIp } from "./ratelimit.ts";
import {
  ABSOLUTE_SESSION_MS,
  LOGIN_AT_KEY,
  SECOND_FACTOR_KEY,
} from "./sign-in.ts";
import { staffAccessStatus } from "./staff-access.ts";
import { type AuthState } from "./types.ts";

/**
 * Constant-time compare for a bearer secret arriving over a header — a
 * plain `===` would leak timing information about how many leading bytes
 * matched, which matters for a credential with no rate limiting of its
 * own (this is a machine caller, not a human who'll get locked out).
 * Deliberately fails closed on an empty configured key rather than letting
 * an unset `OPS_API_KEY` match an empty header.
 */
function safeEqual(a: string, b: string): boolean {
  if (a === "" || b === "") {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * The ops key, checked for every `/_/internal/*` request before the router
 * runs.
 *
 * Each internal route also checks it itself, but only inside its handler —
 * after the framework has parsed and validated the body. A caller with no key
 * therefore got a 400 describing the body the route wanted, instead of the
 * 403 that says nothing. Checking here first makes the key the first thing
 * any internal route asks for. Every route under the prefix is ops-key only.
 */
export function opsApiGate(): Middleware<SessionState & AuthState> {
  return async (
    ctx: Context<SessionState & AuthState>,
    next: Next,
  ): Promise<void> => {
    if (ctx.request.path.startsWith("/_/internal/")) {
      ctx.state.requireOpsApi();
    }
    return next();
  };
}

// How long a "don't keep me signed in" session lasts before it lapses.
const SHORT_SESSION_TTL_MS = 24 * 3600 * 1000;

export function loadUser(): Middleware<SessionState & AuthState> {
  return async (
    ctx: Context<SessionState & AuthState>,
    next: Next,
  ): Promise<void> => {
    const { state } = ctx;
    Object.assign(state, await makeAuthState(ctx));
    try {
      await next();
    } catch (err) {
      // Every password hasher is busy and the queue is full (password.ts):
      // say so with a 503 now, rather than queue a request that would
      // only time out — that queue is the memory-exhaustion attack.
      if (err instanceof PasswordHashBusyError) {
        ctx.response.headers.set("Retry-After", "5");
        throw new HttpError(503, "The server is busy. Try again in a moment.");
      }
      throw err;
    }
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
    // An absolute ceiling on every session. The cookie rolls, so a session
    // in daily use would otherwise live for ever — and so would one somebody
    // stole. A session from before sign-in stamped the time starts its clock
    // now rather than being thrown out at deploy.
    // (`capFrom`, not the sign-in time itself: an unstamped session has not
    // signed in recently, and `requireRecentAuth` must not think it has.)
    if (user != null) {
      let loginAt = Number(
        session.get(LOGIN_AT_KEY) ?? session.get("capFrom") ?? 0,
      );
      if (loginAt === 0) {
        loginAt = Date.now();
        session.set("capFrom", loginAt);
      }
      if (Date.now() - loginAt > ABSOLUTE_SESSION_MS) {
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
      // Enrolment is not use. A staff account with two-step on that signed
      // in by magic link, reset link or provider never typed a code — and
      // the desk reads every message ever sent. So the session itself must
      // have used a second factor (finishSignIn records it).
      if (session.get(SECOND_FACTOR_KEY) !== true) {
        void StaffAuditEvent.record({
          userId: u.id,
          action: "staff-access-denied",
          detail: "signed in without a second factor this session",
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
    requireOpsApi: () => {
      const configured = Env.getString("OPS_API_KEY", "");
      const provided = ctx.request.headers.get("x-ops-api-key") ?? "";
      if (!safeEqual(configured, provided)) {
        void StaffAuditEvent.record({
          userId: null,
          action: "agent-access-denied",
          detail: "ops app",
          ip: clientIp(ctx),
        });
        throw new ForbiddenError();
      }
    },
  };
}
