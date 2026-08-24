import { type Context } from "@fastr/core";
import { type User } from "@keylearn/database";
import { type Actor } from "./resolver.ts";

/**
 * Session keys for the PIN-entered learner (spec §6.2 step 3: the server
 * session carries WHICH learner is at the keyboard; endpoints read it
 * from here, never from the request).
 */
export const PROFILE_SESSION_KEY = "profileSessionId";
export const PROFILE_SESSION_AT_KEY = "profileSessionAt";

/**
 * A profile session outlives a lesson, not a school day. Shared devices
 * are the whole reason sessions exist, and a learner who walked away
 * hours ago should not still be the learner the keyboard writes to.
 */
export const PROFILE_SESSION_TTL_MS = 12 * 3600 * 1000;

type SessionLike = {
  readonly session?: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    delete?(key: string): void;
  };
};

/**
 * The actor a request is made by: the signed-in account, plus the
 * PIN-entered learner when a live profile session exists. Built here and
 * nowhere else, so the session-narrowing rule (§5.2/A5) cannot be
 * forgotten by a call site — the resolver applies it to whatever this
 * returns.
 *
 * Session state is read defensively: every route in the app runs behind
 * the session middleware, but not every controller carries SessionState
 * in its Context type, and an actor builder must not force 13 type
 * signatures to change to be adopted.
 */
export function actorFor(ctx: Context<unknown>, user: User): Actor {
  return {
    userId: user.id!,
    profileSessionId: readProfileSession(ctx),
  };
}

export function readProfileSession(ctx: Context<unknown>): number | null {
  const session = (ctx.state as SessionLike).session;
  if (session == null) {
    return null;
  }
  const id = Number(session.get(PROFILE_SESSION_KEY) ?? 0);
  const at = Number(session.get(PROFILE_SESSION_AT_KEY) ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  if (Date.now() - at > PROFILE_SESSION_TTL_MS) {
    return null;
  }
  return id;
}

export function startProfileSession(ctx: Context<unknown>, profileId: number) {
  const session = (ctx.state as SessionLike).session;
  session?.set(PROFILE_SESSION_KEY, profileId);
  session?.set(PROFILE_SESSION_AT_KEY, Date.now());
}

export function endProfileSession(ctx: Context<unknown>) {
  const session = (ctx.state as SessionLike).session;
  session?.set(PROFILE_SESSION_KEY, null);
  session?.set(PROFILE_SESSION_AT_KEY, null);
}
