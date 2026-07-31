import { type Context, type Middleware, type Next } from "@fastr/core";
import { ForbiddenError } from "@fastr/errors";
import { Logger } from "@keybr/logger";

// Requests that must not change state, and so need no origin proof.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Endpoints that are legitimately called cross-site by a third party and
// therefore cannot carry our origin. The Paddle webhook authenticates itself
// with a signature over the body, which is a stronger check than this one.
const EXEMPT_PATHS = new Set(["/_/checkout"]);

/**
 * Rejects state-changing requests that did not originate from this site.
 *
 * The session cookie is `SameSite=Lax`, which already blocks most cross-site
 * form posts — but that is a single control, enforced by the browser, and it
 * does nothing for a request from a same-site origin (another subdomain under
 * the cookie domain, say one that has been compromised). This adds a check the
 * server itself makes.
 *
 * Preference order:
 *  1. `Sec-Fetch-Site`, which the browser sets and script cannot forge.
 *  2. `Origin`, sent on every cross-origin request and on all CORS-mode fetches.
 *  3. Neither present — allowed, because non-browser clients (curl, health
 *     checks, older browsers) legitimately send no origin at all, and a request
 *     with no cookies is not a CSRF risk in the first place.
 */
export function csrfGuard(): Middleware {
  return async (ctx: Context, next: Next): Promise<void> => {
    const { method } = ctx.request;
    if (SAFE_METHODS.has(method) || EXEMPT_PATHS.has(ctx.request.path)) {
      return next();
    }

    const fetchSite = header(ctx, "sec-fetch-site");
    if (fetchSite != null) {
      // "same-origin" is us; "none" is a user-initiated navigation (typing a
      // URL, a bookmark). "same-site" and "cross-site" are another origin.
      if (fetchSite === "same-origin" || fetchSite === "none") {
        return next();
      }
      throw refuse(ctx, `Sec-Fetch-Site: ${fetchSite}`);
    }

    const origin = header(ctx, "origin");
    if (origin != null && origin !== "null") {
      if (origin === ctx.request.origin) {
        return next();
      }
      throw refuse(ctx, `Origin: ${origin}`);
    }

    // No origin signal at all: not a browser-driven cross-site request.
    return next();
  };
}

function header(ctx: Context, name: string): string | null {
  const value = (ctx.request as unknown as { req?: any }).req?.headers?.[name];
  if (value == null) {
    return null;
  }
  return String(Array.isArray(value) ? value[0] : value).toLowerCase();
}

function refuse(ctx: Context, reason: string): Error {
  Logger.warn(
    "Blocked cross-site %s %s (%s)",
    ctx.request.method,
    ctx.request.path,
    reason,
  );
  return new ForbiddenError("This request did not come from KeyLearn.");
}
