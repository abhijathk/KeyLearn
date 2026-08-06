// The certificate number.
//
// Eight characters, and never repeated. Uniqueness is a property of the
// construction rather than of a collision check: the number is a reversible
// scramble of a sequence, so two certificates cannot land on the same string
// even in principle, and a duplicate cannot be produced by a race between two
// servers issuing at once.

/**
 * Thirty glyphs. 0, 1, I, L, O and U are absent — somebody will read this off
 * a printed certificate and type it back in, and O/0 and I/1/L are exactly
 * where that goes wrong. Dropping U also stops the scramble spelling words.
 */
export const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const BASE = ALPHABET.length; // 30
const WIDTH = 7; // payload characters, plus one check character
export const CERTIFICATE_NUMBER_LENGTH = WIDTH + 1;

/** 30^7 = 21,870,000,000 distinct numbers. */
export const CAPACITY = BASE ** WIDTH;

// Coprime with 30, so multiplication modulo 30^7 is a bijection: every
// sequence gets its own number, for ever. The stride is near the golden ratio
// of the space, which is what stops consecutive certificates landing anywhere
// near each other — holding one number tells you nothing about the next.
const STRIDE = 13_517_460_071n;
const OFFSET = 5_874_311_209n;

/**
 * Weights for the check character.
 *
 * Every one is coprime with 30, and that is the whole point: it makes *every*
 * single-character substitution detectable. A weight sharing a factor with the
 * base (6, say) lets some wrong characters produce the right check digit.
 */
const WEIGHTS = [1, 7, 11, 13, 17, 19, 23] as const;

function check(body: string): string {
  let sum = 0;
  for (let i = 0; i < WIDTH; i++) {
    sum += ALPHABET.indexOf(body[i]) * WEIGHTS[i];
  }
  return ALPHABET[sum % BASE];
}

/**
 * The number for a sequence value, which must come from somewhere
 * authoritative — a database sequence, not a device.
 */
export function certificateNumber(sequence: number | bigint): string {
  const seq = BigInt(sequence);
  if (seq < 0n || seq >= BigInt(CAPACITY)) {
    throw new RangeError(`Sequence ${seq} is outside the numbering space.`);
  }
  let x = (seq * STRIDE + OFFSET) % BigInt(CAPACITY);
  let body = "";
  for (let i = 0; i < WIDTH; i++) {
    body = ALPHABET[Number(x % BigInt(BASE))] + body;
    x /= BigInt(BASE);
  }
  return body + check(body);
}

/**
 * Whether a string could be a certificate number.
 *
 * Cheap, and worth doing before any lookup: a mistyped number is rejected
 * here rather than at the database, which also stops the verification page
 * being used to enumerate what exists.
 */
export function isCertificateNumber(value: string): boolean {
  const s = normalizeCertificateNumber(value);
  if (s.length !== CERTIFICATE_NUMBER_LENGTH) {
    return false;
  }
  for (const ch of s) {
    if (!ALPHABET.includes(ch)) {
      return false;
    }
  }
  return check(s.slice(0, WIDTH)) === s[WIDTH];
}

/**
 * Accept what a person actually types: lower case, and whatever separators
 * they copied along with it.
 *
 * There is deliberately no remapping of confusable characters here. Schemes
 * that drop I, L and O usually fold them onto 1 and 0 on input — this alphabet
 * has none of the six, so there is nothing to fold onto, and any of them
 * appearing means the number was misread rather than mistyped.
 */
export function normalizeCertificateNumber(value: string): string {
  return value.toUpperCase().replace(/[\s\-–—]/g, "");
}

/** Grouped in fours for printing and reading aloud. Stored ungrouped. */
export function formatCertificateNumber(value: string): string {
  return `${value.slice(0, 4)} ${value.slice(4)}`;
}
