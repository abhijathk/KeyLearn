import { type Context } from "@fastr/core";
import { HttpError } from "@fastr/errors";
import { Env } from "@keybr/config";

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

/**
 * The address every limiter and the CAPTCHA failure counter are keyed on.
 *
 * `X-Forwarded-For` is client-supplied and is honoured ONLY when the immediate
 * peer is a proxy we trust to have rewritten it. Trusting it unconditionally
 * would let anyone rotate the header per request and thereby bypass every rate
 * limit and the adaptive CAPTCHA — the counters would each see a single attempt.
 *
 * Configure with `TRUSTED_PROXIES`: a comma-separated list of proxy addresses,
 * or one of the CIDR-ish prefixes below. Empty (the default) trusts nothing and
 * always uses the socket address, which is correct for a directly-exposed
 * server. Set it to your load balancer's address when running behind one.
 */
export function clientIp(ctx: Context): string {
  const req = (ctx.request as unknown as { req?: any }).req;
  const peer: string = normalize(req?.socket?.remoteAddress ?? "");
  if (peer !== "" && isTrustedProxy(peer)) {
    const fwd = req?.headers?.["x-forwarded-for"];
    if (fwd) {
      // The left-most entry is the originating client. It is only meaningful
      // because a trusted proxy appended to (or replaced) the chain.
      const first = normalize(String(fwd).split(",")[0]);
      if (first !== "") {
        return first;
      }
    }
  }
  return peer || "unknown";
}

// Strips an IPv6-mapped IPv4 prefix and surrounding whitespace/brackets so that
// "::ffff:203.0.113.7" and "203.0.113.7" are one key rather than two.
function normalize(value: string): string {
  const v = value.trim().replace(/^\[|\]$/g, "");
  return v.startsWith("::ffff:") ? v.slice(7) : v;
}

let trusted: readonly string[] | null = null;

function trustedProxies(): readonly string[] {
  return (trusted ??= Env.getString("TRUSTED_PROXIES", "")
    .split(",")
    .map((s) => normalize(s))
    .filter((s) => s !== ""));
}

function isTrustedProxy(peer: string): boolean {
  for (const entry of trustedProxies()) {
    if (entry === peer) {
      return true;
    }
    // "loopback" and "private" cover the usual reverse-proxy-on-the-same-host
    // and sidecar-in-the-same-network deployments without spelling out ranges.
    if (entry === "loopback" && isLoopback(peer)) {
      return true;
    }
    if (entry === "private" && (isLoopback(peer) || isPrivate(peer))) {
      return true;
    }
    // A bare prefix such as "10.8." matches by prefix.
    if (entry.endsWith(".") && peer.startsWith(entry)) {
      return true;
    }
  }
  return false;
}

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.");
}

function isPrivate(ip: string): boolean {
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return true;
  }
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    return second >= 16 && second <= 31;
  }
  // IPv6 unique-local.
  return ip.startsWith("fc") || ip.startsWith("fd");
}
