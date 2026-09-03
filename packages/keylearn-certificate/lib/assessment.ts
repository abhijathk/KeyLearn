// The assessment.
//
// Practice earns the right to sit it; this decides. The split matters: history
// alone rewards volume, and a single test alone rewards a good day.
//
// It runs on the learner's own practice page — same renderer, same input, same
// feel. A separate assessment screen would look like a different app at the
// exact moment somebody is most nervous, and the only thing that needs to
// change is what the page will show them while they type.

import {
  ADULT_BRAILLE,
  ADULT_TYPING,
  bandFor,
  type CertificateCriteria,
  DEFAULT_CRITERIA,
  RETENTION,
} from "./criteria.ts";
import {
  type CertificateAudience,
  type CertificateEvidence,
  type CertificateKind,
  type CertificateLevel,
} from "./types.ts";

/** One timed run. Several make a sitting; several sittings make a verdict. */
export type Run = {
  readonly at: number;
  /** Words per minute for typing, cells per minute for braille. */
  readonly speed: number;
  readonly accuracy: number;
  readonly seconds: number;
};

/** One occasion. Its score is the median of its runs, never the best. */
export type Sitting = {
  readonly at: number;
  readonly kind: CertificateKind;
  readonly runs: readonly Run[];
};

export type AssessmentPlan = {
  /** Timed runs in one sitting. */
  readonly runs: number;
  readonly seconds: number;
  /**
   * Whether the on-screen keyboard and hand guide are taken away.
   *
   * This is the only moment the app can tell touch typing from fast hunting,
   * so for anyone old enough it is not optional. It stays on for the youngest
   * children: their certificate is about finishing the trail rather than about
   * technique, and taking the picture away from a six-year-old tests their
   * nerve rather than their typing.
   */
  readonly hideKeyboard: boolean;
};

/** Below this age the keyboard picture stays. */
export const KEYBOARD_HINT_UNTIL_AGE = 8;

/**
 * How long, and how many.
 *
 * One run for children rather than three. Attention span is a real constraint,
 * and the eligibility history has already done the work of proving the result
 * was not luck.
 */
export function planFor(
  audience: CertificateAudience,
  age: number | null,
): AssessmentPlan {
  if (audience === "adult") {
    return { runs: 3, seconds: 60, hideKeyboard: true };
  }
  const young = age != null && age <= KEYBOARD_HINT_UNTIL_AGE;
  return {
    runs: 1,
    seconds: young ? 30 : 45,
    hideKeyboard: !young,
  };
}

/**
 * Sittings needed before anything can be awarded.
 *
 * Attempts are unlimited on purpose — a cooldown is miserable, and for a child
 * wanting to go again immediately it is the wrong answer. Consistency is what
 * guards the standard instead: the verdict is the median of the last three
 * sittings, so one lucky run cannot carry somebody who is not there yet, and
 * one bad run cannot sink somebody who is.
 */
export const MIN_SITTINGS = 3;

/** How many recent sittings the verdict is taken over. */
const WINDOW = 3;

export type AssessmentVerdict = {
  readonly sittings: number;
  readonly remaining: number;
  /** What fraction of their practice pace they held. Null before the window. */
  readonly retained: number | null;
  readonly retentionRequired: number;
  /** Median speed across the window, or null before there are enough. */
  readonly speed: number | null;
  readonly accuracy: number | null;
  readonly required: { readonly speed: number; readonly accuracy: number };
  readonly passed: boolean;
  readonly level: CertificateLevel | null;
};

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A sitting's own score: the median of its runs. */
export function scoreSitting(sitting: Sitting): Run | null {
  if (sitting.runs.length === 0) {
    return null;
  }
  return {
    at: sitting.at,
    speed: median(sitting.runs.map((r) => r.speed)),
    accuracy: median(sitting.runs.map((r) => r.accuracy)),
    seconds: median(sitting.runs.map((r) => r.seconds)),
  };
}

/**
 * The verdict over a learner's sittings.
 *
 * Only complete sittings reach here — a run abandoned part way is discarded by
 * the caller rather than counted as a failure. With the median rule that costs
 * nothing: quitting a bad run is not a free reroll, because the next three
 * sittings still have to agree.
 */
export function judge(
  sittings: readonly Sitting[],
  evidence: Pick<CertificateEvidence, "audience" | "age" | "kind">,
  /**
   * The pace this learner sustains in ordinary practice.
   *
   * The assessment is judged against it as well as against the standard. An
   * absolute figure alone cannot separate somebody typing by touch from
   * somebody typing fast while glancing at the keyboard — the first barely
   * slows when the picture is taken away, the second collapses. Passing zero
   * makes the ratio moot, which is the right behaviour when it is unknown.
   */
  practiceSpeed = 0,
  criteria: CertificateCriteria = DEFAULT_CRITERIA,
): AssessmentVerdict {
  const bar =
    evidence.audience === "kid"
      ? {
          speed: bandFor(evidence.age, evidence.kind)[0],
          accuracy: 0.9,
        }
      : evidence.kind === "braille"
        ? {
            speed: criteria.adultBraille.speed,
            accuracy: criteria.adultBraille.accuracy,
          }
        : {
            speed: criteria.adultTyping.speed,
            accuracy: criteria.adultTyping.accuracy,
          };

  const scored = sittings
    .map(scoreSitting)
    .filter((r): r is Run => r != null)
    .sort((a, b) => a.at - b.at);
  const window = scored.slice(-WINDOW);

  const retentionRequired =
    evidence.audience === "kid"
      ? criteria.retention.kid
      : criteria.retention.adult;
  const minSittings = Math.max(1, Math.round(criteria.sittingsCounted));

  if (scored.length < minSittings) {
    return {
      sittings: scored.length,
      remaining: minSittings - scored.length,
      retained: null,
      retentionRequired,
      speed: null,
      accuracy: null,
      required: bar,
      passed: false,
      level: null,
    };
  }

  const speed = median(window.map((r) => r.speed));
  const accuracy = median(window.map((r) => r.accuracy));
  const retained = practiceSpeed > 0 ? speed / practiceSpeed : null;
  const passed =
    speed >= bar.speed &&
    accuracy >= bar.accuracy &&
    (retained == null || retained >= retentionRequired);
  return {
    sittings: scored.length,
    remaining: 0,
    retained,
    retentionRequired,
    speed,
    accuracy,
    required: bar,
    passed,
    level: passed ? awardFor(evidence, speed) : null,
  };
}

function awardFor(
  evidence: Pick<CertificateEvidence, "audience" | "age" | "kind">,
  speed: number,
): CertificateLevel {
  if (evidence.audience === "adult") {
    return "completion";
  }
  const [, silver, gold] = bandFor(evidence.age, evidence.kind);
  return speed >= gold ? "gold" : speed >= silver ? "silver" : "bronze";
}

/**
 * What to tell the learner afterwards.
 *
 * A child is never told they failed. There is no red screen, no cross, and no
 * score they fell short of — only that it is not yet, and that the trail is
 * where the rest of it comes from. An adult is told plainly, because being
 * told plainly is what lets them decide what to do next.
 */
export function outcomeMessage(
  verdict: AssessmentVerdict,
  audience: CertificateAudience,
): { readonly tone: "won" | "again" | "more"; readonly text: string } {
  if (verdict.passed) {
    return { tone: "won", text: "That is the certificate earned." };
  }
  if (verdict.remaining > 0) {
    return {
      tone: "more",
      text:
        audience === "kid"
          ? `${verdict.remaining} more ${verdict.remaining === 1 ? "go" : "goes"} to have a proper try.`
          : `${verdict.remaining} more ${verdict.remaining === 1 ? "sitting" : "sittings"} before this can be judged — the standard is a consistent one.`,
    };
  }
  if (audience === "kid") {
    return { tone: "again", text: "Not yet — a few more runs on the trail." };
  }
  // Falling short of your own practice pace means something different from
  // falling short of the standard, and it deserves a different sentence: it is
  // the keyboard you were leaning on, not the speed you can reach.
  const short =
    verdict.retained != null && verdict.retained < verdict.retentionRequired;
  return {
    tone: "again",
    text: short
      ? `Not this time: ${verdict.speed?.toFixed(1)} against the ${Math.round(
          verdict.retentionRequired * 100,
        )}% of your practice pace this asks for. That gap is usually the keyboard — more practice with it hidden is what closes it.`
      : `Not this time: ${verdict.speed?.toFixed(1)} against ${verdict.required.speed}. Sit it again whenever you like.`,
  };
}
