import { activeProfileBirthYear } from "@keybr/pages-shared";

// Everything on the kids page that should feel different for a five-year-old
// than for a ten-year-old is a knob in this table. The band is derived from
// the active profile's birth year at session start, so kids grow into the
// next band automatically — no setting to update.

export type AgeBand = "5-6" | "7-8" | "9-10" | "11+";

export type BandConfig = {
  /** Words in the first sessions. */
  readonly baseWords: number;
  /** Session-length ceiling as keys unlock. */
  readonly capWords: number;
  /** Preferred word length; longer words are skipped when possible. */
  readonly maxWordLen: number;
  /** Unlocked-key count that graduates to full grown-up passages. */
  readonly fullPassageAt: number;
  /** Unlock target speed, in characters per minute. */
  readonly targetCpm: number;
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
  /** Realistic words-per-minute range for the band, for grown-ups. */
  readonly typicalWpm: readonly [number, number];
};

const CONFIGS: Record<AgeBand, BandConfig> = {
  "5-6": {
    baseWords: 4,
    capWords: 6,
    maxWordLen: 4,
    fullPassageAt: Infinity,
    targetCpm: 75,
    hopEvery: 5,
    cheerChance: 0.3,
    rescueMisses: 2,
    missPenalty: false,
    timerMin: 10,
    bigLetters: true,
    hands: true,
    kbMode: "simple",
    typicalWpm: [5, 8],
  },
  "7-8": {
    baseWords: 6,
    capWords: 8,
    maxWordLen: 6,
    fullPassageAt: Infinity,
    targetCpm: 100,
    hopEvery: 10,
    cheerChance: 0.2,
    rescueMisses: 3,
    missPenalty: true,
    timerMin: 15,
    bigLetters: false,
    hands: true,
    kbMode: "simple",
    typicalWpm: [8, 15],
  },
  "9-10": {
    baseWords: 7,
    capWords: 10,
    maxWordLen: 8,
    fullPassageAt: Infinity,
    targetCpm: 125,
    hopEvery: 10,
    cheerChance: 0.15,
    rescueMisses: 3,
    missPenalty: true,
    timerMin: 20,
    bigLetters: false,
    hands: true,
    kbMode: "simple",
    typicalWpm: [15, 25],
  },
  "11+": {
    baseWords: 7,
    capWords: 10,
    maxWordLen: Infinity,
    fullPassageAt: 20,
    targetCpm: 175,
    hopEvery: 10,
    cheerChance: 0.12,
    rescueMisses: 3,
    missPenalty: true,
    timerMin: 20,
    bigLetters: false,
    hands: false,
    kbMode: "full",
    typicalWpm: [20, 35],
  },
};

/** The active learner's age this calendar year, or null when unknown. */
export function currentAge(): number | null {
  const year = activeProfileBirthYear();
  if (year == null) {
    return null;
  }
  const age = new Date().getFullYear() - year;
  return age >= 0 && age < 120 ? age : null;
}

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
