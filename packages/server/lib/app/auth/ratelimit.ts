import cluster from "node:cluster";
import { type Context } from "@fastr/core";
import { HttpError } from "@fastr/errors";
import { Env } from "@keylearn/config";

type Bucket = { count: number; resetAt: number };

/**
 * Counts this worker has been told about by the primary — the authoritative
 * total across the whole cluster as of the last broadcast.
 */
const shared = new Map<string, Bucket>();
/** Hits this worker has taken since that broadcast and not yet reported. */
const pending = new Map<string, Bucket>();

/** How often a worker reports its hits, and the primary answers with totals. */
const SYNC_MS = 100;

/**
 * Fixed-window rate limiting for the auth endpoints, counted across the whole
 * cluster rather than per worker.
 *
 * The server runs several HTTP workers behind one port, and each used to hold
 * its own counters. A worker therefore enforced the full limit alone, and a
 * round-robin attacker got the limit multiplied by the worker count —
 * measured at 80 password attempts a minute against a configured 20. Dividing
 * each worker's budget by the worker count fixed the total but not the shape:
 * the split was static, so an attacker who happened to land on one worker
 * repeatedly hit a limit four times tighter than the one configured, and an
 * honest user could too.
 *
 * Now the primary holds the counts. A worker decides immediately against the
 * last total it was told plus its own unreported hits — so the check stays
 * synchronous and free, which is what lets it sit in front of a handler and
 * simply throw — and reports the hit for the next broadcast. Between
 * broadcasts the workers can collectively overshoot by at most one window's
 * traffic; {@link SYNC_MS} is a tenth of a second, so that is single digits
 * rather than a multiplier.
 *
 * Outside a cluster (a single process, or the tests) there is nothing to
 * share and the local map is the whole truth.
 */
export function rateLimit(
  ctx: Context,
  bucket: string,
  limit: number,
  windowMs: number,
): void {
  const key = `${bucket}:${clientIp(ctx)}`;
  const now = Date.now();

  const s = live(shared.get(key), now);
  const p = live(pending.get(key), now);
  if ((s?.count ?? 0) + (p?.count ?? 0) >= limit) {
    throw new HttpError(
      429,
      "Too many attempts. Please wait a minute and try again.",
    );
  }

  if (p == null) {
    pending.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    p.count += 1;
  }
  scheduleSync();
  prune(now);
}

/**
 * Forgets every counter. For tests only.
 *
 * The buckets are keyed by IP, and every request in a test file comes
 * from the same one — so a file that exercises a limited endpoint more
 * times than the limit allows starts failing on the sixth test for
 * reasons that have nothing to do with what it is testing.
 */
export function resetRateLimits(): void {
  shared.clear();
  pending.clear();
}

/** A bucket if its window has not closed, else nothing. */
function live(bucket: Bucket | undefined, now: number): Bucket | null {
  return bucket != null && now < bucket.resetAt ? bucket : null;
}

/** Opportunistic sweep so neither map can grow without bound. */
function prune(now: number): void {
  if (shared.size + pending.size <= 10_000) {
    return;
  }
  for (const map of [shared, pending]) {
    for (const [k, v] of map) {
      if (now >= v.resetAt) {
        map.delete(k);
      }
    }
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(): void {
  if (syncTimer != null || !cluster.isWorker || pending.size === 0) {
    return;
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    flush();
  }, SYNC_MS);
  // Never a reason to hold the process open.
  syncTimer.unref?.();
}

const MSG = "keylearn:ratelimit";

function flush(): void {
  if (pending.size === 0 || !cluster.isWorker) {
    return;
  }
  const hits: [string, number, number][] = [];
  for (const [key, { count, resetAt }] of pending) {
    hits.push([key, count, resetAt]);
  }
  pending.clear();
  // Reported hits are folded into the shared view immediately, so this worker
  // does not forget them while the primary's answer is in flight.
  for (const [key, count, resetAt] of hits) {
    const had = shared.get(key);
    if (had != null && Date.now() < had.resetAt) {
      had.count += count;
    } else {
      shared.set(key, { count, resetAt });
    }
  }
  process.send?.({ type: MSG, hits });
}

/**
 * Installed once in the primary. It owns the totals and tells every worker
 * what they are, which is the only thing that makes the limit a cluster-wide
 * number rather than a per-worker one.
 */
export function serveRateLimits(): void {
  if (!cluster.isPrimary) {
    return;
  }
  const totals = new Map<string, Bucket>();
  const changed = new Set<string>();

  const onMessage = (message: any) => {
    if (message?.type !== MSG || !Array.isArray(message.hits)) {
      return;
    }
    const now = Date.now();
    for (const [key, count, resetAt] of message.hits as [
      string,
      number,
      number,
    ][]) {
      if (typeof key !== "string" || typeof count !== "number") {
        continue;
      }
      const had = totals.get(key);
      if (had != null && now < had.resetAt) {
        had.count += count;
      } else {
        totals.set(key, { count, resetAt });
      }
      changed.add(key);
    }
  };

  cluster.on("message", (_worker, message) => {
    onMessage(message);
  });

  const broadcast = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of totals) {
      if (now >= bucket.resetAt) {
        totals.delete(key);
        changed.delete(key);
      }
    }
    if (changed.size === 0) {
      return;
    }
    const snapshot: [string, number, number][] = [];
    for (const key of changed) {
      const bucket = totals.get(key);
      if (bucket != null) {
        snapshot.push([key, bucket.count, bucket.resetAt]);
      }
    }
    changed.clear();
    for (const worker of Object.values(cluster.workers ?? {})) {
      worker?.send({ type: MSG, totals: snapshot });
    }
  }, SYNC_MS * 2);
  broadcast.unref?.();
}

// A worker adopts whatever the primary says the totals are. Its own unreported
// hits are counted on top, so nothing it has just seen is lost.
if (cluster.isWorker) {
  process.on("message", (message: any) => {
    if (message?.type !== MSG || !Array.isArray(message.totals)) {
      return;
    }
    for (const [key, count, resetAt] of message.totals as [
      string,
      number,
      number,
    ][]) {
      shared.set(key, { count, resetAt });
    }
  });
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
      const client = clientFromForwarded(String(fwd));
      if (client !== "") {
        return client;
      }
    }
  }
  return peer || "unknown";
}

/**
 * The real client from an `X-Forwarded-For` chain.
 *
 * Read from the RIGHT, not the left. The left-most entry is only the client
 * if every proxy in front of us replaced the header; most append to it
 * instead, and then the left-most entry is whatever the caller sent — so a
 * request arriving with `X-Forwarded-For: 1.2.3.4` gets a counter of its own
 * for every value the attacker invents, and every rate limit falls at once.
 *
 * Walking from the right and skipping the proxies we trust gives the first
 * address that a trusted hop actually observed, which is correct whether the
 * chain was replaced or appended to.
 */
export function clientFromForwarded(header: string): string {
  const chain = header
    .split(",")
    .map((s) => normalize(s))
    .filter((s) => s !== "");
  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isTrustedProxy(chain[i])) {
      return chain[i];
    }
  }
  // Every hop in the chain is one of ours, which means the client's own
  // address never made it in. Nothing here is the client.
  return "";
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

/** Exported for tests, which need the cached list to follow the environment. */
export function resetTrustedProxies(): void {
  trusted = null;
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
