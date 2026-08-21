import { type Context, type Middleware, type Next } from "@fastr/core";
import {
  type SessionOptions,
  type SessionState,
} from "@fastr/middleware-session";
import { SessionHandler } from "@fastr/middleware-session";
import { DESK_SESSION_HEADER } from "@keylearn/pages-shared";

const DESK_PATH_PREFIXES = ["/desk", "/_/support"];

/**
 * The customer's own half of `/_/support`, which is NOT the desk.
 *
 * The account section lives under `/_/support/my`, and the whole prefix
 * was being routed to the desk cookie — so proving the grown-up PIN wrote
 * `parentPinAt` into the app session (the verify route is
 * `/_/account/parent-pin/verify`) while every support request read the
 * desk session and found nothing. The symptom was a correct PIN, a brief
 * load, and then the lapse overlay asking for it again, forever.
 *
 * Checked before the prefixes, so these two win. Deliberately narrow: the
 * staff routes really do live under `/_/support/tickets` and
 * `/_/support/accounts`, and widening this would sign staff out.
 */
const APP_PATH_PREFIXES = [
  "/_/support/my",
  "/_/support/gate",
  // The guest thread view. Reading a ticket is as sensitive as writing
  // one — the thread carries everything anybody put in it — so this is
  // gated too, and a gate needs to see who is asking.
  "/_/support/t",
];

/**
 * `POST /_/support/tickets` is the customer filing a ticket. `GET` on the
 * very same path is the staff inbox, so this one cannot be told apart by
 * path alone.
 *
 * It matters more than it looks: on the desk session `ctx.state.user` was
 * null for a signed-in household, so `requireParentPinForSupport` saw
 * nobody to gate and let the ticket through. The grown-up PIN was not
 * being enforced on the one route that actually creates a ticket.
 */
function isCustomerTicketPost(ctx: Context): boolean {
  return (
    ctx.request.path === "/_/support/tickets" && ctx.request.method === "POST"
  );
}

/** Exported for the test: which cookie a request gets is worth pinning down. */
export function isDeskRequest(ctx: Context): boolean {
  const path = ctx.request.path;
  if (APP_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }
  if (isCustomerTicketPost(ctx)) {
    return false;
  }
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
