import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const KEYLEN = 32;
const SALTLEN = 16;

/**
 * scrypt work factors. Node's defaults (N=2^14) sit below current guidance,
 * which puts the minimum at N=2^17 with r=8, p=1 — an 8x increase in the cost of
 * cracking a stolen hash.
 *
 * These are recorded in every hash we write, so they can be raised again later
 * without invalidating existing passwords: {@link verifyPassword} uses whatever
 * parameters are stored alongside the hash, and {@link needsRehash} reports when
 * a stored hash is weaker than what we now issue.
 */
const N = 1 << 17;
const R = 8;
const P = 1;
// scrypt needs roughly 128 * N * r bytes, which at N=2^17 exceeds Node's default
// 32 MB cap, so raise it with headroom.
const MAXMEM = 256 * 1024 * 1024;

function params(n: number, r: number, p: number) {
  return { N: n, r, p, maxmem: MAXMEM };
}

/**
 * Hashes a password with scrypt — built into Node, no native dependency.
 * The result is self-describing: `scrypt$N$r$p$<saltHex>$<hashHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALTLEN);
  const hash = await scrypt(password, salt, KEYLEN, params(N, R, P));
  return ["scrypt", N, R, P, salt.toString("hex"), hash.toString("hex")].join(
    "$",
  );
}

type Parsed = {
  readonly n: number;
  readonly r: number;
  readonly p: number;
  readonly salt: Buffer;
  readonly expected: Buffer;
};

/**
 * Splits a stored hash. Accepts both the current 6-field form and the original
 * `scrypt$salt$hash`, which recorded no parameters and therefore meant Node's
 * defaults — old rows have to keep verifying or every existing user is locked
 * out.
 */
function parse(stored: string): Parsed | null {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt") {
    return null;
  }
  let n: number;
  let r: number;
  let p: number;
  let saltHex: string;
  let hashHex: string;
  if (parts.length === 6) {
    n = Number(parts[1]);
    r = Number(parts[2]);
    p = Number(parts[3]);
    saltHex = parts[4];
    hashHex = parts[5];
  } else if (parts.length === 3) {
    // Legacy: written before the cost was recorded, so it used Node's defaults.
    n = 1 << 14;
    r = 8;
    p = 1;
    saltHex = parts[1];
    hashHex = parts[2];
  } else {
    return null;
  }
  if (!Number.isSafeInteger(n) || n < 2 || (n & (n - 1)) !== 0) {
    return null; // N must be a power of two.
  }
  if (!Number.isSafeInteger(r) || r < 1 || !Number.isSafeInteger(p) || p < 1) {
    return null;
  }
  // Reject absurd work factors, so a tampered row cannot turn a login attempt
  // into memory exhaustion.
  if (n > 1 << 20 || r > 32 || p > 16) {
    return null;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length !== SALTLEN || expected.length !== KEYLEN) {
    return null;
  }
  return { n, r, p, salt, expected };
}

/**
 * Verifies a password against a stored hash using a constant-time comparison.
 * Returns false for any malformed or empty input.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (stored == null) {
    // Do the work anyway, so a missing account is not identifiable by timing.
    await scrypt(password, randomBytes(SALTLEN), KEYLEN, params(N, R, P));
    return false;
  }
  const parsed = parse(stored);
  if (parsed == null) {
    return false;
  }
  const { n, r, p, salt, expected } = parsed;
  const actual = await scrypt(password, salt, KEYLEN, params(n, r, p));
  return timingSafeEqual(actual, expected);
}

/**
 * Whether a stored hash was made with weaker parameters than we now issue and
 * should be replaced. Call after a successful login, when the plaintext is at
 * hand — that is the only moment a hash can be upgraded.
 */
export function needsRehash(stored: string | null | undefined): boolean {
  if (stored == null) {
    return false;
  }
  const parsed = parse(stored);
  if (parsed == null) {
    return false;
  }
  return parsed.n < N || parsed.r < R || parsed.p < P;
}

/** Minimum acceptable password length. */
export const MIN_PASSWORD_LENGTH = 8;
