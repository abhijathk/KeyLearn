import { type Context, type Middleware, type Next } from "@fastr/core";

/**
 * The customer's own support responses are never cached.
 *
 * Two things go wrong without this, and the second is the worse one.
 *
 * The visible one: `GET /_/support/gate` carried no cache headers at all,
 * so the browser was free to store it heuristically. Closing the account
 * window and reopening it re-asked the question and got the old answer —
 * `proved: true` — from the cache, so the grown-up PIN was not requested
 * again. Only a full page refresh, which bypasses the cache, showed the
 * truth. A lock that a stale cache entry can hold open is not a lock.
 *
 * The quieter one: these responses are a support conversation. They carry
 * the account's email address and everything anybody has ever written
 * into a ticket, and on a shared family tablet they were eligible to be
 * written to the browser's on-disk cache, where they outlive the session
 * and belong to whoever picks the device up next.
 *
 * `no-store` rather than `no-cache`: the latter still permits storing the
 * response and merely requires revalidation, which leaves the file on
 * disk. Nothing here is worth keeping.
 */
export function noStoreSupport(): Middleware {
  return (ctx: Context, next: Next) => {
    const path = ctx.request.path;
    if (path === "/_/support/gate" || path.startsWith("/_/support/my")) {
      ctx.response.headers.set("Cache-Control", "no-store");
      // For anything old enough to ignore Cache-Control.
      ctx.response.headers.set("Pragma", "no-cache");
    }
    return next();
  };
}
