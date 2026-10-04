import cluster from "node:cluster";
import { HttpError } from "@fastr/errors";
import { Env } from "@keylearn/config";
import { SupportMessage, SupportTicket } from "@keylearn/database";

/**
 * Limits on the support surface that are NOT keyed on the caller's address.
 *
 * `rateLimit` in auth/ratelimit.ts always appends the client IP to its key,
 * which is right for "this machine is hammering us" and useless for every
 * question asked here: how many tickets has THIS ACCOUNT opened today, how
 * often has THIS ADDRESS been mailed, how busy is the WHOLE intake. A swarm
 * spread over many addresses passes every per-IP bucket; these do not care
 * where the requests come from.
 *
 * Two kinds of counter, deliberately:
 *
 *  - Database counts, for anything the rows already record (tickets per
 *    account, per email, per thread, and global intake). They are exact
 *    across every worker in the cluster and survive a restart.
 *  - In-process windows, for the one thing no row records — when an
 *    address was last mailed. These are per worker, so in a cluster of N a
 *    victim could see up to N mails per cooldown window; the daily DB cap on
 *    guest tickets per address bounds the total regardless.
 *
 * Every number is an environment setting with a default, so an operator can
 * loosen one during a genuine incident without a deploy.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * ASCII only — @fastr writes an HttpError's message into the status line,
 * where a non-ASCII byte makes Node refuse to send the response at all.
 * The second argument is documentation of the intended wait; @fastr's
 * HttpError has nowhere to carry a Retry-After header.
 */
function tooMany(message: string, _retryAfterSeconds?: number): HttpError {
  return new HttpError(429, message, { expose: true });
}

export function accountTicketsPerDay(): number {
  return Env.getNumber("SUPPORT_ACCOUNT_TICKETS_PER_DAY", 5);
}

export function emailTicketsPerDay(): number {
  return Env.getNumber("SUPPORT_EMAIL_TICKETS_PER_DAY", 3);
}

export function threadRepliesPerHour(): number {
  return Env.getNumber("SUPPORT_THREAD_REPLIES_PER_HOUR", 20);
}

/** New tickets across the whole app, per 10 minutes, past which Turnstile is required of everyone. */
export function ingestPressurePer10Min(): number {
  return Env.getNumber("SUPPORT_INGEST_PRESSURE_PER_10MIN", 50);
}

/** New tickets across the whole app, per 10 minutes, past which the anonymous form stops taking them. */
export function ingestCeilingPer10Min(): number {
  return Env.getNumber("SUPPORT_INGEST_CEILING_PER_10MIN", 300);
}

/**
 * The account (or, for a guest, the address) may not open another ticket
 * today. Counted from the rows, so a swarm spread across workers and IPs
 * meets one number.
 */
export async function assertTicketQuota({
  userId,
  email,
}: {
  readonly userId: number | null;
  readonly email: string;
}): Promise<void> {
  const since = new Date(Date.now() - DAY_MS);
  if (userId != null) {
    const n = await SupportTicket.query()
      .where("userId", userId)
      .where("createdAt", ">=", since)
      .resultSize();
    if (n >= accountTicketsPerDay()) {
      throw tooMany(
        "You've opened several conversations today. Please reply in one of them, or try again tomorrow.",
        3600,
      );
    }
    return;
  }
  const n = await SupportTicket.query()
    .whereNull("userId")
    .whereRaw("lower(email) = ?", [email.trim().toLowerCase()])
    .where("createdAt", ">=", since)
    .resultSize();
  if (n >= emailTicketsPerDay()) {
    throw tooMany(
      "This address has opened several requests today. Please reply in the conversation we emailed you, or try again tomorrow.",
      3600,
    );
  }
}

/** Replies by the customer on one thread within the last hour. */
export async function assertThreadReplyQuota(ticketId: number): Promise<void> {
  const n = await SupportMessage.query()
    .where("ticketId", ticketId)
    .where("sender", "them")
    .where("createdAt", ">=", new Date(Date.now() - HOUR_MS))
    .resultSize();
  if (n >= threadRepliesPerHour()) {
    throw tooMany(
      "That's a lot of messages in a short time. Please wait a little before sending more - we have everything so far.",
      600,
    );
  }
}

export type IngestLevel = "normal" | "pressure" | "saturated";

let ingestCache: { at: number; count: number } | null = null;
const INGEST_CACHE_MS = 5_000;

/**
 * How busy intake is across the whole deployment, from the last ten
 * minutes of tickets. Cached for a few seconds per process so that a swarm
 * does not also become a COUNT query per request.
 */
export async function ingestLevel(): Promise<IngestLevel> {
  const now = Date.now();
  if (ingestCache == null || now - ingestCache.at > INGEST_CACHE_MS) {
    const count = await SupportTicket.query()
      .where("createdAt", ">=", new Date(now - 10 * 60 * 1000))
      .resultSize();
    ingestCache = { at: now, count };
  }
  const { count } = ingestCache;
  if (count >= ingestCeilingPer10Min()) {
    return "saturated";
  }
  if (count >= ingestPressurePer10Min()) {
    return "pressure";
  }
  return "normal";
}

/** The anonymous form is closed while intake is saturated. */
export function refuseWhenSaturated(level: IngestLevel): void {
  if (level === "saturated") {
    throw tooMany(
      "We're receiving an unusual number of requests right now. Please try again in a few minutes.",
      300,
    );
  }
}

// ── in-process windows ──

type Window = { count: number; resetAt: number };

/** A fixed-window counter keyed on anything but the IP. Per process. */
export class KeyedWindow {
  readonly #hits = new Map<string, Window>();

  constructor(
    readonly limit: () => number,
    readonly windowMs: () => number,
  ) {}

  /** Whether one more would fit, without spending it. */
  peek(key: string, now = Date.now()): boolean {
    const w = this.#hits.get(key);
    return w == null || now >= w.resetAt || w.count < this.limit();
  }

  /** Spends one if it fits. */
  take(key: string, now = Date.now()): boolean {
    const w = this.#hits.get(key);
    if (w == null || now >= w.resetAt) {
      this.#hits.set(key, { count: 1, resetAt: now + this.windowMs() });
      this.#prune(now);
      return true;
    }
    if (w.count >= this.limit()) {
      return false;
    }
    w.count += 1;
    return true;
  }

  clear(): void {
    this.#hits.clear();
  }

  #prune(now: number): void {
    if (this.#hits.size <= 20_000) {
      return;
    }
    for (const [k, v] of this.#hits) {
      if (now >= v.resetAt) {
        this.#hits.delete(k);
      }
    }
  }
}

function workers(): number {
  return cluster.isWorker
    ? Math.max(1, Env.getNumber("SERVER_HTTP_WORKERS", 4))
    : 1;
}

/** One confirmation mail per address per cooldown. */
const mailCooldown = new KeyedWindow(
  () => 1,
  () => Env.getNumber("SUPPORT_MAIL_COOLDOWN_MINUTES", 10) * 60 * 1000,
);
/** And a daily ceiling per address on top. */
const mailDaily = new KeyedWindow(
  () => Env.getNumber("SUPPORT_MAIL_PER_ADDRESS_PER_DAY", 5),
  () => DAY_MS,
);
/** Every guest confirmation mail the deployment sends, shared out per worker. */
const mailGlobal = new KeyedWindow(
  () =>
    Math.max(
      1,
      Math.floor(
        Env.getNumber("SUPPORT_MAIL_GLOBAL_PER_HOUR", 300) / workers(),
      ),
    ),
  () => HOUR_MS,
);

function addressKey(email: string): string {
  return email.trim().toLowerCase();
}

export type MailVerdict = "ok" | "cooldown" | "budget";

/** Whether a confirmation mail to this address would be allowed now. Spends nothing. */
export function peekGuestMail(email: string): MailVerdict {
  const key = addressKey(email);
  if (!mailGlobal.peek("*")) {
    return "budget";
  }
  if (!mailCooldown.peek(key) || !mailDaily.peek(key)) {
    return "cooldown";
  }
  return "ok";
}

/**
 * Spends a slot for one confirmation mail to this address. Called where the
 * mail is actually issued, so no path can send one without passing it.
 */
export function takeGuestMail(email: string): MailVerdict {
  const verdict = peekGuestMail(email);
  if (verdict !== "ok") {
    return verdict;
  }
  const key = addressKey(email);
  mailGlobal.take("*");
  mailCooldown.take(key);
  mailDaily.take(key);
  return "ok";
}

/** For tests only. */
export function resetSupportLimits(): void {
  mailCooldown.clear();
  mailDaily.clear();
  mailGlobal.clear();
  ingestCache = null;
}

// ── names in mail ──

const URLISH =
  /(?:[a-z][a-z0-9+.-]*:\/\/\S*|www\.\S*|[^\s.]+(?:\.[^\s.]+)*\.[a-z]{2,63}(?:[/:?#]\S*)?(?=[\s.,;:!?)\]'"]|$)|\S*[/\\]\S*)/gi;

/**
 * A display name with anything a mail client would turn into a link taken
 * out. The name is the one field of a guest submission that is quoted back
 * in mail we send ("Hi {name}"), which made it a way to put a link of the
 * sender's choosing into an email from our domain to any address.
 */
export function stripUrlsFromName(name: string): string {
  const cleaned = name
    .replace(URLISH, " ")
    .replace(/[<>]/g, " ")
    // Punctuation a removed link leaves stranded ("see evil.com." → ".").
    .replace(/(^|\s)[.,;:!?)\]'"]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned === "" ? "Guest" : cleaned.slice(0, 64);
}
