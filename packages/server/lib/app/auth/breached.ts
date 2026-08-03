import { createHash } from "node:crypto";
import { Env } from "@keylearn/config";
import { Logger } from "@keylearn/logger";

/**
 * Checks a password against Have I Been Pwned's breach corpus.
 *
 * Credential stuffing — reusing a password exposed in someone else's breach —
 * is the most common way ordinary accounts are taken over, and no amount of
 * entropy scoring catches it: "correct-horse-battery-staple" scores well and is
 * in every wordlist.
 *
 * Uses the k-anonymity range API: only the first five characters of the SHA-1
 * hash leave this server, and the response is a list of suffixes we match
 * locally. The password itself, and the full hash, never go anywhere.
 *
 * Disable with BREACH_CHECK=false (offline installs, air-gapped deployments).
 */

const RANGE_URL = "https://api.pwnedpasswords.com/range/";

export function breachCheckEnabled(): boolean {
  return Env.getBoolean("BREACH_CHECK", true);
}

/**
 * How many breaches a password must appear in before it is refused. A handful
 * of appearances is enough to be in the common wordlists; the threshold exists
 * so a single obscure sighting does not block an otherwise fine password.
 */
function threshold(): number {
  return Env.getNumber("BREACH_CHECK_THRESHOLD", 10);
}

/**
 * Returns how many times the password appears in known breaches, or `null` if
 * the service could not be reached.
 *
 * Callers must treat `null` as "unknown", never as "safe" or "unsafe": failing
 * closed would make sign-up depend on a third party's uptime, and failing open
 * silently is the current behaviour anyway.
 */
export async function breachCount(password: string): Promise<number | null> {
  if (!breachCheckEnabled()) {
    return null;
  }
  const sha1 = createHash("sha1")
    .update(password, "utf8")
    .digest("hex")
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(RANGE_URL + prefix, {
      headers: {
        // Ask for padded responses so the size of the reply does not narrow
        // down which prefix was queried.
        "Add-Padding": "true",
        "User-Agent": "KeyLearn-password-check",
      },
      signal: AbortSignal.timeout(
        Env.getNumber("BREACH_CHECK_TIMEOUT_MS", 3000),
      ),
    });
    if (!res.ok) {
      return null;
    }
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix) {
        return Number(count) || 0;
      }
    }
    return 0;
  } catch (err: any) {
    // An outage must not stop people signing up.
    Logger.warn(err, "Breach check unavailable");
    return null;
  }
}

/** Whether the password is common enough in breaches that it should be refused. */
export async function isBreached(password: string): Promise<boolean> {
  const count = await breachCount(password);
  return count != null && count >= threshold();
}
