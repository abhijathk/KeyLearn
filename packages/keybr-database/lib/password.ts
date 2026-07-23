import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const KEYLEN = 32;
const SALTLEN = 16;

/**
 * Hashes a password with scrypt — built into Node, no native dependency.
 * The result is self-describing: `scrypt$<saltHex>$<hashHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALTLEN);
  const hash = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Verifies a password against a stored `scrypt$salt$hash` string using a
 * constant-time comparison. Returns false for any malformed or empty input.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (stored == null) {
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== SALTLEN || expected.length !== KEYLEN) {
    return false;
  }
  const actual = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return timingSafeEqual(actual, expected);
}

/** Minimum acceptable password length. */
export const MIN_PASSWORD_LENGTH = 8;
