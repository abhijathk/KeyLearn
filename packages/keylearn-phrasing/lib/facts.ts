/**
 * What the dashboard is allowed to know about a learner.
 *
 * Every field that could be absent is `| null`, and null means "we did not
 * measure this", never "zero". The distinction is the whole point of this
 * file: a brand-new learner has `speed: null`, not `speed: 0`, because a
 * dashboard that renders "0 wpm" on day one has told somebody they failed at
 * something they have not yet attempted.
 *
 * A phrase may only be chosen when every value it interpolates is present —
 * enforced in `phrases.test.ts`, not by remembering to check.
 */

/** A pair of keys the learner keeps swapping, and how often. */
export type Confusion = {
  readonly a: string;
  readonly b: string;
  readonly misses: number;
  /** e.g. "left index" — omitted when the two keys share no obvious trait. */
  readonly sharedTrait: string | null;
};

export type Facts = {
  readonly learnerId: string;
  readonly name: string;
  /** Second person ("you typed") versus third ("Maya typed"). */
  readonly isYou: boolean;
  /** Grown-ups get plainer wording; children get shorter sentences. */
  readonly isChild: boolean;

  /** Completed practice sessions, ever. 0 means never started. */
  readonly sessions: number;
  /** Whole days since the last session. 0 = today, null = never practised. */
  readonly daysSinceLast: number | null;

  readonly streakDays: number;
  /** The streak that just ended, if one did. */
  readonly brokenStreakDays: number | null;
  readonly bestStreakDays: number | null;

  readonly daysPractisedThisWeek: number;
  readonly minutesThisWeek: number;
  /** null until there is a full previous week to compare against. */
  readonly minutesLastWeek: number | null;

  readonly speed: number | null;
  /** Change in wpm over the last fortnight. null if too little history. */
  readonly speedDelta: number | null;
  readonly bestSpeed: number | null;
  /** Percent, 0-100. */
  readonly accuracy: number | null;

  readonly lettersUnlocked: number | null;
  readonly lettersTotal: number;
  readonly lettersGainedThisWeek: number;
  /** The letters currently being learned, in course order. */
  readonly learningLetters: readonly string[];

  readonly confusion: Confusion | null;
  /** A month name we can honestly say this beats, e.g. "June". */
  readonly bestWeekSince: string | null;
  /** A month name for the last comparable gap, e.g. "March". */
  readonly longestGapSince: string | null;
};

/**
 * A learner with nothing to say about them yet.
 *
 * Exported so callers building `Facts` from partial data start from honest
 * nulls rather than from zeros they did not mean.
 */
export function emptyFacts(
  learnerId: string,
  name: string,
  options: { isYou?: boolean; isChild?: boolean; lettersTotal?: number } = {},
): Facts {
  return {
    learnerId,
    name,
    isYou: options.isYou ?? false,
    isChild: options.isChild ?? false,
    sessions: 0,
    daysSinceLast: null,
    streakDays: 0,
    brokenStreakDays: null,
    bestStreakDays: null,
    daysPractisedThisWeek: 0,
    minutesThisWeek: 0,
    minutesLastWeek: null,
    speed: null,
    speedDelta: null,
    bestSpeed: null,
    accuracy: null,
    lettersUnlocked: null,
    lettersTotal: options.lettersTotal ?? 26,
    lettersGainedThisWeek: 0,
    learningLetters: [],
    confusion: null,
    bestWeekSince: null,
    longestGapSince: null,
  };
}

/** Minutes as a person would say them: "40 minutes", "2 h 41 m". */
export function readableMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** "b and v" — joined the way a person reads it aloud, not "b, v". */
export function readablePair(a: string, b: string): string {
  return `${a} and ${b}`;
}
