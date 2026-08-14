import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { closeSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { Env } from "@keylearn/config";

/**
 * Encrypts a TOTP secret before it's written to the database, and decrypts
 * it back on read.
 *
 * Unlike the password, the parent PIN, and the recovery codes — all
 * one-way hashes, since the app only ever needs to *compare* against them
 * — a TOTP secret has to come back out in full to compute the current
 * six-digit code, so hashing isn't an option here. This is reversible
 * AES-256-GCM instead: anyone who can read the users table can no longer
 * compute valid codes for every account without also holding this key.
 *
 * `TOTP_ENCRYPTION_KEY` wins if set — required for a deployment on several
 * machines, since they must agree — and otherwise a key is generated once
 * into the data directory, the same fallback {@link ../certificate/key.ts}
 * uses for certificate numbering, so a self-hosted copy is protected
 * without anybody being told to configure anything.
 */

const KEY_FILE = "totp.key";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

/** Only for tests, which need each case to start from a known state. */
export function resetTotpEncryptionKey(): void {
  cachedKey = null;
}

export function encryptTotpSecret(secret: string, dataDir: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyFor(dataDir), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypts a value {@link encryptTotpSecret} produced. `stored` is trusted
 * database content, not attacker input — a malformed value throws, which
 * every call site treats as "this code is not right" rather than a crash,
 * since a raw legacy plaintext secret (predating this encryption) will also
 * fail to base64-decode into a valid IV+tag+ciphertext and should be
 * treated the same way: re-run setup.
 */
export function decryptTotpSecret(stored: string, dataDir: string): string {
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, keyFor(dataDir), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Reads back a stored secret for verification, tolerating one that predates
 * this encryption. A GCM auth tag effectively never verifies against
 * anything other than its own ciphertext, so a decrypt failure reliably
 * means "not a value this function wrote" rather than a false negative on
 * a real one — safe to fall back to using it as the plain base32 secret it
 * always used to be. The next time that account's second factor is set up
 * fresh, it's stored encrypted like any other.
 */
export function resolveTotpSecret(stored: string, dataDir: string): string {
  try {
    return decryptTotpSecret(stored, dataDir);
  } catch {
    return stored;
  }
}

function keyFor(dataDir: string): Buffer {
  if (cachedKey != null) {
    return cachedKey;
  }
  const configured = Env.getString("TOTP_ENCRYPTION_KEY", "");
  const secret = configured !== "" ? configured : secretFromDisk(dataDir);
  cachedKey = createHash("sha256")
    .update(`keylearn:totp:encryption:${secret}`)
    .digest();
  return cachedKey;
}

function secretFromDisk(dataDir: string): string {
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
    // different key and disagree about every stored secret afterwards. The
    // loser of the race reads what the winner wrote.
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
      // A read-only data directory. Better to encrypt consistently for the
      // lifetime of this process than to refuse to set up a second factor
      // at all — the operator can set TOTP_ENCRYPTION_KEY to make it
      // durable.
      return fresh;
    }
  }
}
