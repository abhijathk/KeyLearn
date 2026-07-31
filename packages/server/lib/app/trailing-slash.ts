import { type Context, type Middleware, type Next } from "@fastr/core";

/**
 * Redirects `/path/` to `/path`.
 *
 * Routes are declared without a trailing slash, so `/de/` missed every one of
 * them and returned 404 while `/de` worked. Shared links, search engines and
 * hand-typed URLs all carry trailing slashes routinely, and a 404 for what is
 * plainly the same page is both a dead end for the reader and a duplicate URL
 * for anyone indexing the site.
 *
 * The root itself is left alone: `/` IS the canonical form.
 */
export function trailingSlashRedirect(): Middleware {
  return async (ctx: Context, next: Next): Promise<void> => {
    const { pathname, search } = new URL(ctx.request.url, "http://localhost/");
    if (pathname.length > 1 && pathname.endsWith("/")) {
      // 308 keeps the method and body, so a redirected POST is still a POST.
      ctx.response.status = 308;
      ctx.response.headers.set(
        "Location",
        pathname.replace(/\/+$/, "") + search,
      );
      return;
    }
    await next();
  };
}
