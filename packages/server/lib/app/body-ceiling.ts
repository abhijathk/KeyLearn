import { body } from "@fastr/controller";
import { type Middleware } from "@fastr/core";
import { PayloadTooLargeError } from "@fastr/errors";

/**
 * A ceiling on how much any one request may weigh.
 *
 * @fastr reads a body with no size limit unless a route asks for one, and
 * most routes here do not: at the time of writing, 65 of them take a body
 * with no `maxLength`. Each of those will buffer whatever arrives, parse
 * it, and only then discover the value is the wrong shape — so the cost
 * of refusing a 500 MB body is paid in memory before the refusal.
 *
 * This is the floor under that, not a replacement for it. A route that
 * knows its own shape should still state its own, much tighter, limit —
 * the attachment upload does — because this ceiling has to be generous
 * enough for the largest legitimate request on the whole app.
 *
 * Two layers. `content-length` is a claim, refused here before anything
 * is read. A chunked request has no length to claim, and a gzipped one can
 * claim a small length and decode to a huge one (a 194 KB body inflating
 * to 200 MB took ten seconds of CPU to refuse), so the same ceiling is also
 * the default `maxLength` of every `@body.*` read — @fastr counts the
 * decoded bytes as they stream and stops at it. A route's own, tighter
 * `maxLength` still wins.
 */
export const MAX_REQUEST_BODY = 16 * 1024 * 1024;

export function bodyCeiling(max: number = MAX_REQUEST_BODY): Middleware {
  body.setDefaultOptions({ maxLength: max });
  return async (ctx, next) => {
    const claimed = ctx.request.headers.get("content-length");
    if (claimed != null) {
      const length = Number(claimed);
      if (Number.isFinite(length) && length > max) {
        throw new PayloadTooLargeError(
          "That request is too large for this desk.",
          { expose: true },
        );
      }
    }
    await next();
  };
}
