import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 time-based one-time passwords, implemented directly on Node's crypto
 * rather than pulled in as a dependency — it is about forty lines, and every
 * extra package in the auth path is another thing to trust and keep patched.
 */

const DIGITS = 6;
const PERIOD = 30;
/**
 * How many 30-second steps either side of now are accepted. One step tolerates
 * ordinary clock drift and slow typing; widening it further would multiply the
 * number of codes valid at any moment.
 */
const WINDOW = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A fresh, 160-bit secret in the base32 form authenticator apps expect. */
export function generateTotpSecret(): string {
  const buf = randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) {
      throw new Error("Invalid base32 secret");
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The code for a given counter step. */
function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Checks a submitted code against the secret, allowing for a little clock drift.
 * Comparison is constant-time so a code cannot be recovered by measuring how
 * long the check takes.
 */
export function verifyTotp(
  secret: string,
  code: string,
  now: number = Date.now(),
): boolean {
  const trimmed = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmed)) {
    return false;
  }
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false;
  }
  const counter = Math.floor(now / 1000 / PERIOD);
  const supplied = Buffer.from(trimmed, "utf8");
  let ok = false;
  for (let i = -WINDOW; i <= WINDOW; i++) {
    const expected = Buffer.from(hotp(key, counter + i), "utf8");
    // No early exit: every candidate is compared, so the time taken does not
    // reveal which step matched.
    if (
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
    ) {
      ok = true;
    }
  }
  return ok;
}

/** The `otpauth://` URI an authenticator app scans. */
export function totpUri(
  secret: string,
  account: string,
  issuer = "KeyLearn",
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params}`;
}

/**
 * One-time recovery codes, for the very common case of a lost phone. Without
 * these, turning on two-step verification is a way to lock yourself out
 * permanently, which is why people avoid turning it on at all.
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Crockford-ish base32, no vowels, so a written-down code cannot spell
    // something unfortunate and 0/O and 1/I cannot be confused.
    const alphabet = "0123456789BCDFGHJKLMNPQRSTVWXZ";
    let code = "";
    for (let j = 0; j < 10; j++) {
      if (j === 5) {
        code += "-";
      }
      code += alphabet[randomBytes(1)[0] % alphabet.length];
    }
    codes.push(code);
  }
  return codes;
}
