import { type Context, type Middleware, type Next } from "@fastr/core";
import {
  type SessionOptions,
  type SessionState,
} from "@fastr/middleware-session";
import { SessionHandler } from "@fastr/middleware-session";
import { DESK_SESSION_HEADER } from "@keylearn/pages-shared";

const DESK_PATH_PREFIXES = ["/desk", "/_/support"];

function isDeskRequest(ctx: Context): boolean {
  const path = ctx.request.path;
  if (DESK_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return true;
  }
  // `/auth/*` is shared by the app's own `/login` and the desk's sign-in
  // screen — path alone can't tell them apart, so the client marks its own
  // desk-originated calls explicitly (see logout.ts, page-support/service.ts).
  return ctx.request.headers.get(DESK_SESSION_HEADER) != null;
}

/**
 * Routes each request to one of two independent sessions — the learner's
 * own, or the support desk's — based on {@link isDeskRequest}. This is the
 * whole fix for "signing into the desk signs me out of the app and vice
 * versa": before this, one `SessionHandler` backed by one cookie served
 * every request, so the desk's login and the app's login raced to overwrite
 * the same session.
 */
export function deskAwareSession(
  appOptions: SessionOptions,
  deskOptions: SessionOptions,
): Middleware<SessionState> {
  const appHandler = new SessionHandler(appOptions);
  const deskHandler = new SessionHandler(deskOptions);
  return (ctx: Context<SessionState>, next: Next) => {
    return isDeskRequest(ctx)
      ? deskHandler.handle(ctx, next)
      : appHandler.handle(ctx, next);
  };
}
