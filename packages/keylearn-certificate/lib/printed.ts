// What actually gets printed in each field.
//
// Separate from both the layout and the renderers, because the three sheets do
// not print the same things. The grown-up paper has four ruled lines and gives
// a raw speed and accuracy; the two children's papers have three and give a
// level instead, because "Gold" is something a nine-year-old can be pleased
// about and "41.6 wpm" is not.
//
// The strings are English and stay English. The artwork is lettered in English
// — the sheet itself says CERTIFICATE OF COMPLETION — so a translated date
// beside an English heading would read as a mistake rather than a courtesy.

import { type SheetName } from "./layout.ts";
import { type CertificateKind, type CertificateLevel } from "./types.ts";

/** Everything a renderer needs, with nothing left to work out. */
export type PrintedCertificate = {
  readonly sheet: SheetName;
  readonly kind: CertificateKind;
  readonly name: string;
  /** Set under the name: the alphabet and layout, or the braille code. */
  readonly languageLine: string;
  /** In the same order as `SHEETS[sheet].fields`. */
  readonly values: readonly string[];
};

export type CertificateRecord = {
  readonly sheet: SheetName;
  readonly kind: CertificateKind;
  readonly level: CertificateLevel;
  readonly name: string;
  readonly languageLine: string;
  /** Words per minute, or cells per minute for braille. */
  readonly speed: number;
  /** 0 to 1. */
  readonly accuracy: number;
  readonly number: string;
  readonly issued: Date;
};

const LEVEL: Readonly<Record<CertificateLevel, string>> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  completion: "Completed",
};

const LONG = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Group the number in two blocks of four.
 *
 * It exists to be read aloud down a phone and typed back, and eight unbroken
 * characters is exactly the length at which people lose their place.
 */
export function groupNumber(number: string): string {
  return number.length === 8
    ? `${number.slice(0, 4)} ${number.slice(4)}`
    : number;
}

export function printedFields(cert: CertificateRecord): PrintedCertificate {
  const speed =
    cert.kind === "braille"
      ? `${Math.round(cert.speed)} cells/min`
      : `${Math.round(cert.speed * 10) / 10} wpm`;
  const number = groupNumber(cert.number);
  const values =
    cert.sheet === "adult"
      ? [
          LONG.format(cert.issued),
          speed,
          `${(cert.accuracy * 100).toFixed(1)}%`,
          number,
        ]
      : [SHORT.format(cert.issued), LEVEL[cert.level], number];
  return {
    sheet: cert.sheet,
    kind: cert.kind,
    name: cert.name,
    languageLine: cert.languageLine,
    values,
  };
}

/** The key a braille learner's sittings and certificates are grouped under. */
export const BRAILLE_ALPHABET = "braille-ueb";

/**
 * How a stored alphabet key is named to a person.
 *
 * Certificates and sittings are grouped by a key — a layout id like `en-us`,
 * or the braille code — because finishing one alphabet says nothing about
 * another. That key is not what anybody should ever read: a certificate
 * attests an alphabet, and `en-us`, `en-gb` and `en-au` differ in spelling
 * rather than in letters. So only the language subtag is named, and the
 * layout is dropped entirely — QWERTY or Dvorak is *how* somebody types, not
 * what they learned to type.
 */
export function alphabetName(key: string): string {
  if (key === BRAILLE_ALPHABET) {
    return "Unified English Braille · grade 1";
  }
  // "en-dvorak" and "en-us" are both English; the part before the first dash
  // is the language and everything after it is the keyboard.
  const language = key.split("-")[0] ?? key;
  try {
    return (
      new Intl.DisplayNames("en", { type: "language" }).of(language) ??
      language.toUpperCase()
    );
  } catch {
    // A runtime without the display-names data still has to print something,
    // and the code itself is better than an empty line.
    return language.toUpperCase();
  }
}
