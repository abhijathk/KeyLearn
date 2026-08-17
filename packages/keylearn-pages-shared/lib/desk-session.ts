/**
 * Marks a request to a route the app and the support desk both call
 * (`/auth/login-password`, `/auth/passkey/*`, `/auth/2fa/verify`,
 * `/auth/logout`) as belonging to the desk's own session rather than the
 * signed-in learner's — see `deskAwareSession` on the server. Path alone
 * can't make that call for these routes since both doors use the exact same
 * URLs; this header is the explicit signal.
 */
export const DESK_SESSION_HEADER = "x-keylearn-desk";
