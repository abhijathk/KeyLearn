// What a certificate is about, and what had to be true to earn one.

export type CertificateKind = "typing" | "braille";

export type CertificateAudience = "adult" | "kid";

/** Bronze, Silver and Gold exist for children only — see `criteria.ts`. */
export type CertificateLevel = "bronze" | "silver" | "gold" | "completion";

/**
 * Everything the criteria are judged against, gathered by the caller.
 *
 * Deliberately a plain record rather than the app's result types: the same
 * rules have to run over typing results and over braille cell statistics,
 * which have nothing in common structurally. Whoever assembles this is
 * responsible for counting only course lessons — see `COURSE_MODES`.
 */
export type CertificateEvidence = {
  readonly kind: CertificateKind;
  readonly audience: CertificateAudience;
  /** Null when the learner has not given one; the neutral band is used. */
  readonly age: number | null;
  /** Characters or cells introduced, and how many the curriculum holds. */
  readonly learned: number;
  readonly total: number;
  /** Of those introduced, how many are reliable by the app's own definition. */
  readonly settled: number;
  /** Completed course lessons, or cells entered correctly for braille. */
  readonly volume: number;
  readonly daysPractised: number;
  readonly elapsedDays: number;
  /** Words per minute for typing, cells per minute for braille. */
  readonly speed: number;
  /** 0 to 1. */
  readonly accuracy: number;
};

export type CertificateCheck = {
  readonly id: string;
  /** English fallback; the UI renders a translated label. */
  readonly label: string;
  readonly required: number;
  readonly actual: number;
  readonly met: boolean;
  /** Higher is better for most checks; days and speed included. */
  readonly unit: "count" | "days" | "speed" | "percent";
};

export type CertificateVerdict = {
  readonly eligible: boolean;
  readonly checks: readonly CertificateCheck[];
  /**
   * The level this evidence would earn. Children are banded; adults are not,
   * and always read "completion" — the printed speed and accuracy say how
   * well they did far more precisely than a word could.
   */
  readonly level: CertificateLevel | null;
  /** What is still missing, in the order worth tackling. */
  readonly outstanding: readonly CertificateCheck[];
};

/**
 * The practice that counts toward a certificate.
 *
 * Everything else is welcome practice, but its letter mix is chosen by the
 * learner or by the corpus rather than by the curriculum, so it cannot
 * evidence coverage of an alphabet.
 */
export const COURSE_MODES = ["guided", "classic", "kids", "braille"] as const;

export type CourseMode = (typeof COURSE_MODES)[number];
