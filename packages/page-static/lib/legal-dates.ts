/**
 * When each legal document last changed.
 *
 * These used to be words inside translatable strings ("Updated August 2026"),
 * which meant a locale file could state a different effective date from the
 * English, and nothing but a person reading both would notice. A date is a
 * fact, not a phrase: it lives here once, the pages format it in the reader's
 * language, and a change to a document is a change to this file in the same
 * commit — which is what the control-centre spec (phase 0.2) asks for.
 *
 * ISO dates. The day is the day the text was published; the pages show only
 * month and year, which is the precision the documents themselves promise.
 */
export const LEGAL_EFFECTIVE = {
  termsOfService: "2026-09-04",
  privacyPolicy: "2026-09-04",
  accessibility: "2026-09-04",
} as const;

export type LegalDocument = keyof typeof LEGAL_EFFECTIVE;

/** The date as a Date, for formatting. Noon UTC so no time zone moves the day. */
export function legalDate(doc: LegalDocument): Date {
  return new Date(`${LEGAL_EFFECTIVE[doc]}T12:00:00Z`);
}
