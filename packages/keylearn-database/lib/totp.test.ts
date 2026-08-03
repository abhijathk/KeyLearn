import { test } from "node:test";
import { equal, isFalse, isTrue, notEqual } from "rich-assert";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  totpUri,
  verifyTotp,
} from "./totp.ts";

// A published RFC 6238 vector: the ASCII secret "12345678901234567890" is
// base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ".
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("matches the RFC 6238 reference vector", () => {
  // T = 59s falls in step 1, whose 6-digit SHA-1 code is 287082.
  isTrue(verifyTotp(RFC_SECRET, "287082", 59_000));
});

test("accepts one step of clock drift either way", () => {
  const now = 59_000;
  isTrue(verifyTotp(RFC_SECRET, "287082", now));
  // The same code is still taken 30s later (previous step) ...
  isTrue(verifyTotp(RFC_SECRET, "287082", now + 30_000));
  // ... but not two steps out.
  isFalse(verifyTotp(RFC_SECRET, "287082", now + 90_000));
});

test("rejects malformed input", () => {
  for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56 78"]) {
    isFalse(verifyTotp(RFC_SECRET, bad));
  }
});

test("rejects a wrong code", () => {
  isFalse(verifyTotp(RFC_SECRET, "000000", 59_000));
});

test("tolerates a malformed secret without throwing", () => {
  isFalse(verifyTotp("not-base32!!", "287082"));
});

test("generates distinct 160-bit base32 secrets", () => {
  const a = generateTotpSecret();
  const b = generateTotpSecret();
  notEqual(a, b);
  equal(a.length, 32);
  isTrue(/^[A-Z2-7]+$/.test(a));
});

test("builds a scannable otpauth uri", () => {
  const uri = totpUri("ABC234", "user@keylearn.com");
  isTrue(uri.startsWith("otpauth://totp/KeyLearn:user%40keylearn.com?"));
  isTrue(uri.includes("secret=ABC234"));
  isTrue(uri.includes("issuer=KeyLearn"));
});

test("recovery codes are unique and unambiguous", () => {
  const codes = generateRecoveryCodes(20);
  equal(new Set(codes).size, 20);
  for (const code of codes) {
    // No vowels (so no accidental words) and no 0/O or 1/I confusion.
    isTrue(
      /^[0-9BCDFGHJKLMNPQRSTVWXZ]{5}-[0-9BCDFGHJKLMNPQRSTVWXZ]{5}$/.test(code),
    );
    isFalse(/[AEIOU]/.test(code));
  }
});
