import { activeProfileAge, typicalWpmForAge } from "@keylearn/pages-shared";

// Everything on the kids page that should feel different for a five-year-old
// than for a ten-year-old is a knob in this table. The band is derived from
// the active profile's birth year at session start, so kids grow into the
// next band automatically — no setting to update.

export type AgeBand = "5-6" | "7-8" | "9-10" | "11+";

export type BandConfig = {
  /** Words in the first sessions. Long enough to find a rhythm, and to
   * give each key enough samples that unlocking the next one means something. */
  readonly baseWords: number;
  /** Session-length ceiling as keys unlock. */
  readonly capWords: number;
  /** Preferred word length; longer words are skipped when possible. */
  readonly maxWordLen: number;
  /** Unlocked-key count that graduates to full grown-up passages. */
  readonly fullPassageAt: number;
  /**
   * Floor and ceiling for the unlock target, in characters per minute.
   *
   * The target itself follows the child (see `pace.ts`); these only stop it
   * running away in either direction. The floor is deliberately at the BOTTOM
   * of the band's typical range, not the top — the old single figure sat above
   * what the band itself called normal for the age, and children stalled.
   */
  readonly paceFloor: number;
  readonly paceCeil: number;
  /** The dino hops every N-key clean streak. */
  readonly hopEvery: number;
  /** Chance of a cheer line per correct key. */
  readonly cheerChance: number;
  /** Misses on one key before the rescue helper appears. */
  readonly rescueMisses: number;
  /** Whether a wrong key costs a point. */
  readonly missPenalty: boolean;
  /** Default session minutes. */
  readonly timerMin: number;
  /** Default text size. */
  readonly bigLetters: boolean;
  /** Default helper hands. */
  readonly hands: boolean;
  /** Default keyboard guide. */
  readonly kbMode: "off" | "simple" | "full";
  /**
   * Whether the coach reads its lines out loud by default.
   *
   * The page coaches entirely in prose, at a reading level the youngest bands
   * do not have — a five-year-old learning where the letters are is not also
   * reading "the trail is quiet… one glowing key starts it again". Every warm
   * word written for them lands on somebody who cannot yet read it, so for the
   * bands below reading fluency the coach speaks.
   */
  readonly readAloud: boolean;
  /** Speech rate for that voice. Younger listeners need it slower. */
  readonly speechRate: number;
  /**
   * Realistic words-per-minute range for the band, for grown-ups.
   *
   * Taken from `@keylearn/pages-shared` rather than written here, because the
   * profile page shows a parent the same figure next to the big average-speed
   * number, and two copies of it would drift.
   */
  readonly typicalWpm: readonly [number, number];
  /** A playful font stack, chosen to fit the age; falls back to rounded sans. */
  readonly font: string;
};

const CONFIGS: Record<AgeBand, BandConfig> = {
  "5-6": {
    baseWords: 6,
    capWords: 9,
    maxWordLen: 4,
    fullPassageAt: Infinity,
    paceFloor: 25,
    paceCeil: 60,
    hopEvery: 5,
    cheerChance: 0.3,
    rescueMisses: 2,
    missPenalty: false,
    timerMin: 10,
    bigLetters: true,
    hands: true,
    kbMode: "simple",
    readAloud: true,
    speechRate: 0.85,
    typicalWpm: typicalWpmForAge(6)!,
    font: '"Andika Kids", "Arial Rounded MT Bold", ui-rounded, sans-serif',
  },
  "7-8": {
    baseWords: 9,
    capWords: 13,
    maxWordLen: 6,
    fullPassageAt: Infinity,
    paceFloor: 40,
    paceCeil: 90,
    hopEvery: 10,
    cheerChance: 0.2,
    rescueMisses: 3,
    missPenalty: true,
    timerMin: 15,
    bigLetters: false,
    hands: true,
    kbMode: "simple",
    readAloud: true,
    speechRate: 0.95,
    typicalWpm: typicalWpmForAge(8)!,
    font: '"Andika Kids", "Arial Rounded MT Bold", ui-rounded, sans-serif',
  },
  "9-10": {
    baseWords: 11,
    capWords: 16,
    maxWordLen: 8,
    fullPassageAt: Infinity,
    paceFloor: 75,
    paceCeil: 140,
    hopEvery: 10,
    cheerChance: 0.15,
    rescueMisses: 3,
    missPenalty: true,
    timerMin: 20,
    bigLetters: false,
    hands: true,
    kbMode: "simple",
    readAloud: false,
    speechRate: 1,
    typicalWpm: typicalWpmForAge(10)!,
    font: '"Nunito Kids", "Arial Rounded MT Bold", ui-rounded, sans-serif',
  },
  "11+": {
    baseWords: 12,
    capWords: 18,
    maxWordLen: Infinity,
    fullPassageAt: 20,
    paceFloor: 100,
    paceCeil: 190,
    hopEvery: 10,
    cheerChance: 0.12,
    rescueMisses: 3,
    missPenalty: true,
    timerMin: 20,
    bigLetters: false,
    hands: false,
    kbMode: "full",
    readAloud: false,
    speechRate: 1,
    typicalWpm: typicalWpmForAge(12)!,
    font: '"Nunito Kids", "Arial Rounded MT Bold", ui-rounded, sans-serif',
  },
};

/** The active learner's age this calendar year, or null when unknown. */
export const currentAge = activeProfileAge;

/** Age band for the active profile; the middle band when age is unknown. */
export function currentBand(): AgeBand {
  const age = currentAge();
  if (age == null) {
    return "7-8";
  }
  if (age <= 6) {
    return "5-6";
  }
  if (age <= 8) {
    return "7-8";
  }
  if (age <= 10) {
    return "9-10";
  }
  return "11+";
}

export function bandConfig(band: AgeBand = currentBand()): BandConfig {
  return CONFIGS[band];
}
