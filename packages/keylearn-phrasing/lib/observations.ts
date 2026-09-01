/**
 * Facts in, observations out.
 *
 * An observation is a *thing worth saying*, decided numerically and before any
 * English exists. Keeping the judgement here rather than in the phrasing means
 * the thresholds can be argued about, tested and tuned without touching a
 * single sentence — and it means the sentences cannot smuggle in a claim the
 * numbers do not support.
 *
 * `values` carries everything the matching phrases interpolate. A phrase whose
 * placeholders are not all present in `values` is unusable, and the test suite
 * fails rather than shipping a sentence with a hole in it.
 */
import {
  type Confusion,
  type Facts,
  readableMinutes,
  readablePair,
} from "./facts.ts";

export type Kind =
  // nothing to report
  | "never_practised"
  | "just_started"
  // attendance
  | "lapsed_short"
  | "lapsed_long"
  | "streak_broken"
  | "streak_running"
  | "streak_milestone"
  | "practised_today"
  // effort
  | "big_week"
  | "quiet_week"
  | "steady"
  // skill
  | "speed_best"
  | "speed_jump"
  | "speed_flat"
  | "speed_dip"
  | "accuracy_high"
  | "accuracy_low"
  // course
  | "letters_gained"
  | "course_nearly_done"
  | "course_done"
  // trouble
  | "confusion_pair";

/**
 * How a sentence should feel. Used to stop the page contradicting itself —
 * we never lead with a nudge when there is something genuinely good to say
 * about a learner who has only just begun.
 */
export type Register = "celebrate" | "note" | "nudge" | "concern";

export type Observation = {
  readonly kind: Kind;
  readonly register: Register;
  /** Higher leads the paragraph. Ties break on declaration order. */
  readonly priority: number;
  readonly values: Readonly<Record<string, string | number>>;
};

const MILESTONES = new Set([7, 14, 21, 30, 50, 75, 100, 150, 200, 365]);

/** Below this, a "trend" is noise — two bad sessions in a row, not a slump. */
const SPEED_NOISE = 1.5;
const SPEED_MOVE = 3;
/** A confusion pair is only worth mentioning once it is a habit. */
const CONFUSION_FLOOR = 10;

export function observe(facts: Facts): readonly Observation[] {
  const out: Observation[] = [];
  const add = (
    kind: Kind,
    register: Register,
    priority: number,
    values: Record<string, string | number> = {},
  ) => {
    out.push({
      kind,
      register,
      priority,
      values: { name: facts.name, ...values },
    });
  };

  // ---- nothing to say yet. Both of these are terminal: a learner with no
  // history gets one honest sentence, not a paragraph of absent numbers.
  if (facts.sessions === 0 || facts.daysSinceLast == null) {
    add("never_practised", "note", 100);
    return out;
  }
  if (facts.sessions < 3) {
    add("just_started", "celebrate", 100, { sessions: facts.sessions });
    return out;
  }

  // ---- attendance ------------------------------------------------------
  const { daysSinceLast } = facts;
  if (daysSinceLast >= 5) {
    add("lapsed_long", "concern", 95, {
      days: daysSinceLast,
      ...(facts.longestGapSince != null
        ? { since: facts.longestGapSince }
        : {}),
    });
  } else if (daysSinceLast >= 2) {
    add("lapsed_short", "nudge", 80, { days: daysSinceLast });
  } else if (daysSinceLast === 0) {
    add("practised_today", "note", 30);
  }

  if (facts.brokenStreakDays != null && facts.brokenStreakDays >= 3) {
    add("streak_broken", "concern", 90, { streak: facts.brokenStreakDays });
  }
  if (facts.streakDays >= 3) {
    if (MILESTONES.has(facts.streakDays)) {
      add("streak_milestone", "celebrate", 88, { streak: facts.streakDays });
    } else {
      add("streak_running", "celebrate", 60, { streak: facts.streakDays });
    }
  }

  // ---- effort ----------------------------------------------------------
  const { minutesLastWeek, minutesThisWeek } = facts;
  if (minutesLastWeek != null && minutesLastWeek >= 10) {
    const ratio = minutesThisWeek / minutesLastWeek;
    if (ratio >= 1.4) {
      add("big_week", "celebrate", 65, {
        minutes: readableMinutes(minutesThisWeek),
        days: facts.daysPractisedThisWeek,
        ...(facts.bestWeekSince != null ? { since: facts.bestWeekSince } : {}),
      });
    } else if (ratio <= 0.6 && daysSinceLast < 2) {
      // Quieter, but still turning up — that is a different story from lapsing,
      // and must not be told in the same tone.
      add("quiet_week", "note", 45, {
        minutes: readableMinutes(minutesThisWeek),
        days: facts.daysPractisedThisWeek,
      });
    }
  }
  if (facts.daysPractisedThisWeek >= 4 && daysSinceLast <= 1) {
    add("steady", "note", 40, {
      days: facts.daysPractisedThisWeek,
      minutes: readableMinutes(minutesThisWeek),
    });
  }

  // ---- skill -----------------------------------------------------------
  const { speed, speedDelta, bestSpeed } = facts;
  if (speed != null) {
    if (bestSpeed != null && speed >= bestSpeed) {
      add("speed_best", "celebrate", 85, { speed: Math.round(speed) });
    } else if (speedDelta != null) {
      if (speedDelta >= SPEED_MOVE) {
        add("speed_jump", "celebrate", 70, {
          speed: Math.round(speed),
          delta: Math.round(speedDelta),
        });
      } else if (speedDelta <= -SPEED_MOVE) {
        add("speed_dip", "note", 55, {
          speed: Math.round(speed),
          delta: Math.round(Math.abs(speedDelta)),
        });
      } else if (Math.abs(speedDelta) < SPEED_NOISE) {
        // Flat is only interesting while they are still turning up, and it is
        // reassurance rather than a problem: new letters cost speed first.
        if (facts.daysPractisedThisWeek >= 2) {
          add("speed_flat", "note", 50, {
            speed: Math.round(speed),
            ...(facts.learningLetters.length >= 2
              ? {
                  letters: readablePair(
                    facts.learningLetters[0]!,
                    facts.learningLetters[1]!,
                  ),
                }
              : {}),
          });
        }
      }
    }
  }

  const { accuracy } = facts;
  if (accuracy != null) {
    if (accuracy >= 97) {
      add("accuracy_high", "celebrate", 58, { accuracy: Math.round(accuracy) });
    } else if (accuracy < 90) {
      add("accuracy_low", "nudge", 52, { accuracy: Math.round(accuracy) });
    }
  }

  // ---- course ----------------------------------------------------------
  const { lettersUnlocked, lettersTotal } = facts;
  if (lettersUnlocked != null) {
    const left = lettersTotal - lettersUnlocked;
    if (left <= 0) {
      add("course_done", "celebrate", 92, { total: lettersTotal });
    } else if (left <= 3) {
      add("course_nearly_done", "celebrate", 75, {
        left,
        unlocked: lettersUnlocked,
        total: lettersTotal,
      });
    }
    if (facts.lettersGainedThisWeek > 0) {
      add("letters_gained", "celebrate", 62, {
        gained: facts.lettersGainedThisWeek,
        unlocked: lettersUnlocked,
        total: lettersTotal,
      });
    }
  }

  // ---- trouble ---------------------------------------------------------
  const c: Confusion | null = facts.confusion;
  if (c != null && c.misses >= CONFUSION_FLOOR) {
    add("confusion_pair", "nudge", 68, {
      pair: readablePair(c.a, c.b),
      misses: c.misses,
      ...(c.sharedTrait != null ? { trait: c.sharedTrait } : {}),
    });
  }

  return out.sort((x, y) => y.priority - x.priority);
}
