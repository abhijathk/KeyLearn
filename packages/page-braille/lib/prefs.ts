import { type Mode } from "./mode.ts";

/**
 * How this learner has the page set up.
 *
 * Every one of these reset on every visit, which on this page is worse than it
 * sounds: a learner who runs their screen reader at three times speed had to
 * find and re-set the rate at the start of each session, in an interface they
 * navigate by ear. A preference nobody can see is a preference that has to be
 * remembered for them.
 */
export type Prefs = {
  readonly mode: Mode;
  /** Whether the page speaks at all. */
  readonly speech: boolean;
  /** Whether it names each letter as the cell is entered. */
  readonly echoLetters: boolean;
  /**
   * Speech rate, as a multiplier.
   *
   * The default is 1, and it is the wrong default for most of this page's
   * audience — screen reader users habitually run at two or three times
   * conversational speed and find anything slower unbearable. It stays 1 only
   * because the alternative is guessing at somebody's hearing.
   */
  readonly rate: number;
  /**
   * Whether the board and the prompt keep showing the answer.
   *
   * "auto" fades each cell's hints as that cell settles, so the drill starts
   * as copying and becomes recall. On is the old behaviour, and off is for a
   * learner who wants no visual crutch at all.
   */
  readonly hints: "auto" | "on" | "off";
  /**
   * Minutes of practice to aim for in a day; 0 for no goal at all.
   *
   * A goal to pass, not a clock that runs out. The kids page stops its game at
   * zero, and doing that here would cut a learner off mid-word — braille is
   * slow by nature, and "time is up" at forty cells reads as failure where the
   * same message after four hundred keystrokes does not.
   *
   * Fifteen rather than the thirty the grown-up page asks for. Chording six
   * keys at once is slower and more effortful than typing, so half an hour of
   * it is not the same ask as half an hour of prose.
   */
  readonly goalMinutes: number;
};

export const defaultPrefs: Prefs = {
  mode: "reading",
  speech: true,
  echoLetters: true,
  rate: 1,
  hints: "auto",
  goalMinutes: 15,
};

/** The rates offered. Wide, because this audience's range is wide. */
export const RATES: readonly number[] = [0.75, 1, 1.5, 2, 2.5, 3];

/** The goals offered, in minutes. Zero is "don't ask me for one". */
export const GOALS: readonly number[] = [0, 5, 10, 15, 20, 30, 45];

const KEY = "keylearn.braille.prefs";

function keyFor(profileId: string | null): string {
  return profileId == null || profileId === "" ? KEY : `${KEY}.${profileId}`;
}

const isMode = (v: unknown): v is Mode => v === "reading" || v === "listening";
const isHints = (v: unknown): v is Prefs["hints"] =>
  v === "auto" || v === "on" || v === "off";

export function loadPrefs(profileId: string | null = null): Prefs {
  try {
    const raw = window.localStorage.getItem(keyFor(profileId));
    const value: unknown = raw == null ? null : JSON.parse(raw);
    if (value == null || typeof value !== "object") {
      return defaultPrefs;
    }
    const it = value as Partial<Prefs>;
    return {
      mode: isMode(it.mode) ? it.mode : defaultPrefs.mode,
      speech: typeof it.speech === "boolean" ? it.speech : defaultPrefs.speech,
      echoLetters:
        typeof it.echoLetters === "boolean"
          ? it.echoLetters
          : defaultPrefs.echoLetters,
      // Clamped rather than trusted: a rate of zero is a page that has gone
      // silent with no way to work out why.
      rate:
        typeof it.rate === "number" && Number.isFinite(it.rate)
          ? Math.max(0.5, Math.min(4, it.rate))
          : defaultPrefs.rate,
      hints: isHints(it.hints) ? it.hints : defaultPrefs.hints,
      goalMinutes:
        typeof it.goalMinutes === "number" && Number.isFinite(it.goalMinutes)
          ? Math.max(0, Math.min(120, Math.round(it.goalMinutes)))
          : defaultPrefs.goalMinutes,
    };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(prefs: Prefs, profileId: string | null = null): void {
  try {
    window.localStorage.setItem(keyFor(profileId), JSON.stringify(prefs));
  } catch {
    // Storage unavailable; the session works, it just will not carry over.
  }
}
