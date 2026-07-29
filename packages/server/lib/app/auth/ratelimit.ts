import { type Context } from "@fastr/core";
import { HttpError } from "@fastr/errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Best-effort in-memory fixed-window rate limit for the auth endpoints. The
 * server runs a worker cluster, so this is PER WORKER — a brute-force slowdown,
 * not a hard global cap. For production-grade limiting put a shared store
 * (Redis) or a proxy/WAF limiter in front. Throws HTTP 429 when exceeded.
 */
export function rateLimit(
  ctx: Context,
  bucket: string,
  limit: number,
  windowMs: number,
): void {
  const key = `${bucket}:${clientIp(ctx)}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (b == null || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else if (b.count >= limit) {
    throw new HttpError(
      429,
      "Too many attempts. Please wait a minute and try again.",
    );
  } else {
    b.count += 1;
  }
  // Opportunistic prune so the map can't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) {
        buckets.delete(k);
      }
    }
  }
}

export function clientIp(ctx: Context): string {
  const req = (ctx.request as unknown as { req?: any }).req;
  const fwd = req?.headers?.["x-forwarded-for"];
  if (fwd) {
    return String(fwd).split(",")[0].trim();
  }
  return req?.socket?.remoteAddress ?? "unknown";
}
