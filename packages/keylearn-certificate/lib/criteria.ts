// Whether somebody has earned a certificate.
//
// Pure, and deliberately so: the same function answers "am I eligible?" on the
// profile page and "was this genuinely earned?" on the server before a number
// is issued. Two implementations of a standard is two standards.

import {
  type CertificateAudience,
  type CertificateCheck,
  type CertificateEvidence,
  type CertificateKind,
  type CertificateLevel,
  type CertificateVerdict,
} from "./types.ts";

/**
 * The adult bar: 35 words per minute at 95%.
 *
 * Roughly "competent", and meant to be hard. A certificate most people clear
 * on the way past is not worth printing, and the figure is the one an employer
 * or a school would recognise.
 */
export const ADULT_TYPING = { speed: 35, accuracy: 0.95 } as const;

/**
 * The adult braille bar: 50 cells per minute at 95%.
 *
 * Anchored to the curriculum's own `defaultTarget` of 1500 ms per cell — the
 * pace the app already demands before it will introduce another cell, which is
 * 40 cells per minute. A certificate has to ask for more than the floor, so
 * this is a quarter faster, sustained across every cell rather than the
 * handful currently in play.
 */
export const ADULT_BRAILLE = { speed: 50, accuracy: 0.95 } as const;

/**
 * How far above the standard practice has to sit before the assessment is
 * offered.
 *
 * Without this the two bars were the same number, and anyone who became
 * eligible passed almost by definition — the assessment was a rubber stamp on
 * work the gate had already done. It is also backwards to ask for the same
 * figure under harder conditions: the assessment hides the keyboard and uses
 * unseen text, so a learner will type slower there than in practice, not
 * faster.
 */
export const PRACTICE_MARGIN = { typing: 3, braille: 5 } as const;

/**
 * How much of their own practice pace a learner must hold in the assessment.
 *
 * This is the rule that actually tells touch typing from fast hunting, and it
 * does what no absolute number can: somebody genuinely typing by touch barely
 * drops when the keyboard picture disappears, while somebody who has been
 * glancing at it falls off a cliff. It also calibrates itself, so the same
 * rule works for a twelve-word-a-minute six-year-old and a sixty-word-a-minute
 * adult without three separate tables.
 *
 * Children get the gentler figure: they vary more from one sitting to the
 * next, and failing a tired child is the worse mistake.
 */
export const RETENTION = { adult: 0.85, kid: 0.8 } as const;

type Band = {
  readonly maxAge: number;
  readonly typing: readonly [number, number, number];
  readonly braille: readonly [number, number, number];
};

/**
 * Bronze, Silver and Gold by age.
 *
 * A single bar across childhood would be trivial for a twelve-year-old and
 * unreachable for a six-year-old. These sit at the top of each band in
 * `age-norms.ts`, so a level means "doing well for your age" measured against
 * the same figures the profile page already shows a parent.
 *
 * The braille column is scaled from the adult braille figure in the same
 * proportions the typing column uses, so a child's braille certificate is
 * exactly as hard to earn as a child's typing one. Gold at 11–12 lands on the
 * adult bar in both columns; Silver at 11–12 lands on the app's own 1500 ms
 * target. Those figures are anchored rather than sourced — published norms for
 * six-key chorded entry by children barely exist — and should be revisited
 * once there is real data.
 */
const BANDS: readonly Band[] = [
  { maxAge: 6, typing: [8, 11, 14], braille: [12, 16, 20] },
  { maxAge: 8, typing: [12, 16, 20], braille: [17, 23, 29] },
  { maxAge: 10, typing: [18, 24, 30], braille: [26, 34, 42] },
  { maxAge: 12, typing: [22, 28, 35], braille: [31, 40, 50] },
];

/** Used when no birth year is recorded: neither the easiest nor the hardest. */
const NEUTRAL: Band = {
  maxAge: 99,
  typing: [15, 20, 25],
  braille: [22, 29, 36],
};

export function bandFor(
  age: number | null,
  kind: CertificateKind,
): readonly [number, number, number] {
  const band =
    age == null ? NEUTRAL : (BANDS.find((b) => age <= b.maxAge) ?? NEUTRAL);
  return kind === "braille" ? band.braille : band.typing;
}

/**
 * Which of the three certificates gets printed.
 *
 * Separate from the audience on purpose. The audience decides the *standard* —
 * a child is judged against their age band, a grown-up against the adult bar —
 * but the paper is about who will hold it, and a twelve-year-old handed the
 * same sheet as a six-year-old will notice. Braille learners are no exception:
 * they get whichever of the three matches their age, and only the figure on it
 * differs.
 */
export type CertificateTemplate = "child" | "young" | "adult";

/** Below this age, the playful sheet. */
export const YOUNG_FROM = 9;
/** Above this age, the grown-up sheet. */
export const YOUNG_TO = 13;

export function certificateTemplate(
  age: number | null,
  audience: CertificateAudience,
): CertificateTemplate {
  if (age == null) {
    // Nothing to go on. A child of unknown age gets the middle sheet: it is
    // neither babyish for a twelve-year-old nor over-formal for an eight-year-old,
    // which is the least bad guess when the only alternative is to guess wrong
    // in one direction for everybody.
    return audience === "kid" ? "young" : "adult";
  }
  if (age < YOUNG_FROM) {
    return "child";
  }
  return age <= YOUNG_TO ? "young" : "adult";
}

/** The volume, days and span a certificate needs, by who it is for. */
const SHAPE = {
  adult: { volume: 200, brailleVolume: 2500, days: 20, elapsed: 21 },
  kid: { volume: 60, brailleVolume: 1200, days: 15, elapsed: 14 },
} as const;

const KID_ACCURACY = 0.9;

function check(
  id: string,
  label: string,
  required: number,
  actual: number,
  unit: CertificateCheck["unit"],
): CertificateCheck {
  return { id, label, required, actual, met: actual >= required, unit };
}

/**
 * Judge the evidence.
 *
 * Note what this does *not* do: it never looks at a best figure. Every speed
 * and accuracy here is a median over a window, because one exceptional lesson
 * among hundreds is not a standard — it is a good day.
 */
export function assess(evidence: CertificateEvidence): CertificateVerdict {
  const { kind, audience, age } = evidence;
  const shape = SHAPE[audience];
  const volume = kind === "braille" ? shape.brailleVolume : shape.volume;
  const [bronze, silver, gold] = bandFor(age, kind);
  const adultBar = kind === "braille" ? ADULT_BRAILLE : ADULT_TYPING;
  const margin =
    kind === "braille" ? PRACTICE_MARGIN.braille : PRACTICE_MARGIN.typing;
  // Practice must sit above the standard, not on it, so that clearing the gate
  // means being comfortably there rather than exactly there.
  const speedBar = (audience === "kid" ? bronze : adultBar.speed) + margin;
  const accuracyBar = audience === "kid" ? KID_ACCURACY : adultBar.accuracy;
  const unit = kind === "braille" ? "cells" : "letters";

  const checks: readonly CertificateCheck[] = [
    check(
      "coverage",
      `Every one of the ${evidence.total} ${unit} introduced`,
      evidence.total,
      evidence.learned,
      "count",
    ),
    check(
      "settled",
      `Every ${unit.slice(0, -1)} reliable, not merely met`,
      evidence.total,
      evidence.settled,
      "count",
    ),
    check(
      "volume",
      kind === "braille"
        ? "Cells entered correctly"
        : "Course lessons completed",
      volume,
      evidence.volume,
      "count",
    ),
    check("days", "Days practised", shape.days, evidence.daysPractised, "days"),
    check(
      "elapsed",
      "Days from the first lesson to the last",
      shape.elapsed,
      evidence.elapsedDays,
      "days",
    ),
    check("speed", "Sustained speed", speedBar, evidence.speed, "speed"),
    check(
      "accuracy",
      "Sustained accuracy",
      accuracyBar,
      evidence.accuracy,
      "percent",
    ),
  ];

  const eligible = checks.every((c) => c.met);
  return {
    eligible,
    checks,
    level: eligible ? levelFor(evidence, bronze, silver, gold) : null,
    outstanding: checks.filter((c) => !c.met),
  };
}

function levelFor(
  evidence: CertificateEvidence,
  bronze: number,
  silver: number,
  gold: number,
): CertificateLevel {
  // Adults are not banded. The printed speed and accuracy say precisely how
  // well somebody did; a word like "Distinction" compresses that into a claim
  // the reader cannot check, and an unproctored app has not earned the right
  // to grade.
  if (evidence.audience === "adult") {
    return "completion";
  }
  if (evidence.speed >= gold) {
    return "gold";
  }
  // Bronze needs no test: this is only reached when the evidence is eligible,
  // and eligibility already required the speed to clear the bronze bar.
  void bronze;
  return evidence.speed >= silver ? "silver" : "bronze";
}

/** English fallback; the UI renders a translated name. */
export function levelName(level: CertificateLevel): string {
  switch (level) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "bronze":
      return "Bronze";
    case "completion":
      return "Completion";
  }
}

/**
 * The holder's name, shortened only as far as it has to be.
 *
 * A certificate's name field is a fixed width, and a name that overflows it
 * looks like a mistake on a document somebody will keep for years. Shrinking
 * the type instead is worse: the name is the largest thing on the sheet and a
 * smaller one reads as an afterthought.
 *
 * So the name gives way in steps, and only when it must — full name, then the
 * surname reduced to an initial, then the first name alone. Nobody's first
 * name is abbreviated: it is the part they are actually called.
 *
 * `capacity` is how many characters the field holds at its set size, which the
 * caller measures rather than guesses.
 */
export function fitName(
  firstName: string,
  lastName: string | null,
  capacity: number,
): string {
  const first = firstName.trim();
  const last = (lastName ?? "").trim();
  if (last === "") {
    return first;
  }
  const full = `${first} ${last}`;
  if (full.length <= capacity) {
    return full;
  }
  const initialled = `${first} ${[...last][0]}.`;
  return initialled.length <= capacity ? initialled : first;
}
