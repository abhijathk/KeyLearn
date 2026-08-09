import { createHash, randomBytes } from "node:crypto";
import { closeSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { makeNumberingKey, type NumberingKey } from "@keylearn/certificate";
import { Env } from "@keylearn/config";

/**
 * The secret behind the certificate numbering.
 *
 * The scramble used to be a published constant, and this source is AGPL — so
 * anybody could compute the number for sequence 1, 2, 3 and walk the whole
 * register: how many certificates exist, when, at what level, and the names of
 * the grown-ups who chose to be named. Not a forgery risk, because a number
 * proves nothing on its own, but a register nobody meant to publish.
 *
 * Secret by default rather than on request. `CERTIFICATE_SECRET` wins if it is
 * set — which is what a deployment on several machines needs, since they must
 * agree — and otherwise a key is generated once into the data directory. That
 * way a self-hosted copy is unguessable without anybody being told to
 * configure anything, which is the only way a default ever actually holds.
 *
 * Changing the secret does not invalidate a certificate: the sequence is what
 * is stored, and the number is derived from it. It changes what that
 * certificate's number *is*, so anything already printed stops matching. Set
 * it once, before issuing.
 */
const KEY_FILE = "certificate.key";

let cached: NumberingKey | null = null;

export function numberingKey(dataDir: string): NumberingKey {
  if (cached == null) {
    cached = deriveKey(secretFor(dataDir));
  }
  return cached;
}

/** Only for tests, which need each case to start from a known state. */
export function resetNumberingKey(): void {
  cached = null;
}

function deriveKey(secret: string): NumberingKey {
  // Two independent halves of one hash: a stride and an offset that cannot be
  // worked back to each other, let alone to the secret.
  const digest = createHash("sha256")
    .update(`keylearn:certificate:numbering:${secret}`)
    .digest("hex");
  return makeNumberingKey(
    BigInt(`0x${digest.slice(0, 32)}`),
    BigInt(`0x${digest.slice(32)}`),
  );
}

function secretFor(dataDir: string): string {
  const configured = Env.getString("CERTIFICATE_SECRET", "");
  if (configured !== "") {
    return configured;
  }
  const path = join(dataDir, KEY_FILE);
  try {
    const existing = readFileSync(path, "utf8").trim();
    if (existing !== "") {
      return existing;
    }
  } catch {
    // Not written yet.
  }
  const fresh = randomBytes(32).toString("hex");
  try {
    // Exclusive create, so two workers starting together cannot each write a
    // different key and disagree about every number afterwards. The loser of
    // the race reads what the winner wrote.
    const fd = openSync(path, "wx", 0o600);
    try {
      writeSync(fd, `${fresh}\n`);
    } finally {
      closeSync(fd);
    }
    return fresh;
  } catch {
    try {
      return readFileSync(path, "utf8").trim() || fresh;
    } catch {
      // A read-only data directory. Better to number consistently for the
      // lifetime of this process than to refuse to issue at all — and the
      // operator can set CERTIFICATE_SECRET to make it durable.
      return fresh;
    }
  }
}
