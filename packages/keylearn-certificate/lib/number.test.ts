import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import {
  ALPHABET,
  CERTIFICATE_NUMBER_LENGTH,
  certificateNumber,
  formatCertificateNumber,
  isCertificateNumber,
  normalizeCertificateNumber,
  sequenceOf,
} from "./number.ts";

test("uses only unambiguous glyphs", () => {
  equal(ALPHABET.length, 30);
  for (const ch of "01ILOU") {
    isFalse(ALPHABET.includes(ch), `${ch} must not be in the alphabet`);
  }
});

test("never repeats a number", () => {
  // A collision here is not a bug to be retried around: it would mean two
  // learners holding the same certificate number, for ever.
  const seen = new Set<string>();
  for (let seq = 0; seq < 200_000; seq++) {
    seen.add(certificateNumber(seq));
  }
  equal(seen.size, 200_000);
});

test("is eight characters from the alphabet", () => {
  for (const seq of [0, 1, 7, 999, 123_456, 9_999_999]) {
    const n = certificateNumber(seq);
    equal(n.length, CERTIFICATE_NUMBER_LENGTH);
    for (const ch of n) {
      isTrue(ALPHABET.includes(ch));
    }
    isTrue(isCertificateNumber(n));
  }
});

test("catches every single-character typo", () => {
  // The check character's weights are all coprime with 30 precisely so that
  // this holds. A weight sharing a factor with the base would let some wrong
  // characters produce the right check digit.
  for (const seq of [1, 2, 3, 5_000, 250_000, 8_675_309]) {
    const n = certificateNumber(seq);
    for (let i = 0; i < n.length; i++) {
      for (const ch of ALPHABET) {
        if (ch === n[i]) {
          continue;
        }
        isFalse(
          isCertificateNumber(n.slice(0, i) + ch + n.slice(i + 1)),
          `${n} with ${ch} at ${i} should be rejected`,
        );
      }
    }
  }
});

test("catches most adjacent transpositions", () => {
  let total = 0;
  let caught = 0;
  for (let seq = 1; seq < 4000; seq++) {
    const n = certificateNumber(seq);
    for (let i = 0; i < n.length - 1; i++) {
      if (n[i] === n[i + 1]) {
        continue;
      }
      const swapped = n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2);
      total += 1;
      if (!isCertificateNumber(swapped)) {
        caught += 1;
      }
    }
  }
  isTrue(caught / total > 0.85, `only caught ${caught} of ${total}`);
});

test("does not run in sequence", () => {
  // Holding one certificate must not reveal the next. Consecutive sequence
  // values should share no leading run.
  const a = certificateNumber(1000);
  const b = certificateNumber(1001);
  isFalse(a.slice(0, 3) === b.slice(0, 3));
});

test("accepts a number as a person would type it", () => {
  const n = certificateNumber(42);
  isTrue(isCertificateNumber(formatCertificateNumber(n)));
  isTrue(isCertificateNumber(n.toLowerCase()));
  isTrue(isCertificateNumber(` ${n.slice(0, 4)}-${n.slice(4)} `));
  equal(normalizeCertificateNumber(formatCertificateNumber(n)), n);
});

test("rejects rubbish", () => {
  isFalse(isCertificateNumber(""));
  isFalse(isCertificateNumber("ABCDEFG"));
  isFalse(isCertificateNumber("ABCDEFGHI"));
  // Contains glyphs the alphabet excludes on purpose.
  isFalse(isCertificateNumber("OOOOOOOO"));
  isFalse(isCertificateNumber("11111111"));
});

test("inverts, so verification is a lookup and not a scan", () => {
  for (const seq of [0, 1, 2, 999, 123_456, 20_000_000]) {
    equal(sequenceOf(certificateNumber(seq)), seq);
  }
  // A number that is not one of ours yields nothing to look up.
  equal(sequenceOf("ABCDEFGH"), null);
  equal(sequenceOf("nonsense"), null);
});
