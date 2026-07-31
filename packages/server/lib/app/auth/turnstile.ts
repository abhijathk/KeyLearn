import { type Context } from "@fastr/core";
import { ApplicationError } from "@fastr/errors";
import { Env } from "@keybr/config";
import { Logger } from "@keybr/logger";
import { clientIp } from "./ratelimit.ts";

// Cloudflare Turnstile — a modern, privacy-preserving CAPTCHA (no user
// profiling, unlike reCAPTCHA). It is applied ADAPTIVELY: normal traffic sees
// nothing; only after several failed attempts from an IP does the challenge
// kick in, keeping friction near-zero for real users.
//
// Config (all optional; when the secret is unset the whole feature is a no-op,
// so local dev and self-hosters without keys are unaffected):
//   TURNSTILE_SITE_KEY     — public site key, handed to the browser widget
//   TURNSTILE_SECRET_KEY   — secret, used server-side to verify tokens
//   TURNSTILE_FAIL_LIMIT   — failed attempts from an IP before a challenge is
//                            required (default 3)

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const FAIL_WINDOW_MS = 15 * 60 * 1000;

type Fails = { count: number; resetAt: number };
const fails = new Map<string, Fails>();

export function turnstileSiteKey(): string | null {
  return Env.getString("TURNSTILE_SITE_KEY", "") || null;
}

export function turnstileSecret(): string | null {
  return Env.getString("TURNSTILE_SECRET_KEY", "") || null;
}

/** Whether Turnstile is configured on this deployment. */
export function turnstileEnabled(): boolean {
  return turnstileSecret() != null && turnstileSiteKey() != null;
}

function failLimit(): number {
  return Env.getNumber("TURNSTILE_FAIL_LIMIT", 3);
}

/** Record a failed attempt (bad password, invalid token, …) from this client. */
export function recordFailure(ctx: Context): void {
  const key = clientIp(ctx);
  const now = Date.now();
  const f = fails.get(key);
  if (f == null || now >= f.resetAt) {
    fails.set(key, { count: 1, resetAt: now + FAIL_WINDOW_MS });
  } else {
    f.count += 1;
  }
  if (fails.size > 10_000) {
    for (const [k, v] of fails) {
      if (now >= v.resetAt) {
        fails.delete(k);
      }
    }
  }
}

/** Clear the failure streak after a successful attempt. */
export function clearFailures(ctx: Context): void {
  fails.delete(clientIp(ctx));
}

function tooManyFailures(ctx: Context): boolean {
  const f = fails.get(clientIp(ctx));
  return f != null && Date.now() < f.resetAt && f.count >= failLimit();
}

// Thrown when the client must solve a challenge before the request proceeds.
// Signalled two ways so the browser reliably knows to render the Turnstile
// widget and resubmit with a token: HTTP 428 (Precondition Required) and a
// `captcha` marker in the error body.
export class CaptchaRequiredError extends ApplicationError {
  constructor() {
    const message = "Please complete the verification to continue.";
    super(message, {
      status: 428,
      body: { error: { message, captcha: true } },
    });
    // Note: ApplicationError.name is read-only, so don't reassign it here.
  }
}

async function verifyToken(
  token: string | undefined,
  ctx: Context,
): Promise<boolean> {
  const secret = turnstileSecret();
  if (secret == null || !token) {
    return false;
  }
  const body = new URLSearchParams({ secret, response: token });
  const ip = clientIp(ctx);
  if (ip && ip !== "unknown") {
    body.set("remoteip", ip);
  }

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      // Bound the wait: without this a hung connection stalls the request, and
      // an attacker who can slow siteverify would stall the whole gate.
      signal: AbortSignal.timeout(Env.getNumber("TURNSTILE_TIMEOUT_MS", 5000)),
    });
  } catch (err: any) {
    // Only a genuine transport failure (DNS, connection, timeout) fails open, so
    // a Cloudflare outage cannot lock everyone out. The IP rate limit is the
    // backstop, and it is now keyed on an address the client cannot forge.
    Logger.warn(err, "Turnstile siteverify unreachable, allowing request");
    return true;
  }

  // A response that arrived but is not a well-formed success is a REJECTION, not
  // an outage. Parsing inside the same try as the fetch used to turn any 500,
  // captive portal or HTML error page into a silent pass.
  if (!res.ok) {
    Logger.warn("Turnstile siteverify returned HTTP %d", res.status);
    return false;
  }
  try {
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err: any) {
    Logger.warn(err, "Turnstile siteverify returned an unreadable body");
    return false;
  }
}

/**
 * The adaptive gate, called at the top of a sensitive auth endpoint. When
 * Turnstile is enabled AND this IP has too many recent failures, a valid token
 * is required; otherwise it's a no-op. Throws {@link CaptchaRequiredError} when
 * a challenge is needed but not satisfied.
 */
export async function requireCaptchaIfSuspicious(
  ctx: Context,
  token: string | undefined,
): Promise<void> {
  if (!turnstileEnabled() || !tooManyFailures(ctx)) {
    return;
  }
  const ok = await verifyToken(token, ctx);
  if (!ok) {
    throw new CaptchaRequiredError();
  }
  // A solved challenge clears the streak so the user isn't re-challenged on the
  // very next request.
  clearFailures(ctx);
}
