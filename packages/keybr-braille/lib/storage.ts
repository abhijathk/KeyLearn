import { LETTERS } from "./cell.ts";
import { Progress } from "./progress.ts";

const PREFIX = "keylearn.braille.progress";

/**
 * Where one learner's braille progress lives.
 *
 * Per profile, like every other kind of progress in the app: a household can
 * have more than one braille learner, and a shared key would have had them
 * teaching each other's cells. The unsuffixed key is what the first version
 * wrote, so it is still read as the default profile's progress rather than
 * being abandoned.
 */
function keyFor(profileId: string | null): string {
  return profileId == null || profileId === ""
    ? PREFIX
    : `${PREFIX}.${profileId}`;
}

/**
 * Hands progress written before profiles were namespaced to the first learner
 * who comes looking for theirs.
 *
 * Which learner it actually belonged to is not recorded and cannot be worked
 * out. But it belonged to *someone*, and on a device with a braille learner the
 * overwhelmingly likely answer is them — where leaving it orphaned means their
 * work silently disappearing, which is the worse of the two wrong answers.
 * Claimed once and then removed, so a second profile cannot inherit it too.
 */
function adoptLegacy(profileId: string): string | null {
  const legacy = window.localStorage.getItem(PREFIX);
  if (legacy == null) {
    return null;
  }
  window.localStorage.setItem(keyFor(profileId), legacy);
  window.localStorage.removeItem(PREFIX);
  const days = window.localStorage.getItem(DAYS_KEY);
  if (days != null) {
    window.localStorage.setItem(daysKey(profileId), days);
    window.localStorage.removeItem(DAYS_KEY);
  }
  return legacy;
}

/** Reads saved progress, tolerating anything unexpected in storage. */
export function loadProgress(profileId: string | null = null): Progress {
  try {
    let raw = window.localStorage.getItem(keyFor(profileId));
    if (raw == null && profileId != null && profileId !== "") {
      raw = adoptLegacy(profileId);
    }
    return Progress.fromJSON(raw == null ? null : JSON.parse(raw));
  } catch {
    return new Progress();
  }
}

export function saveProgress(
  progress: Progress,
  profileId: string | null = null,
): void {
  try {
    window.localStorage.setItem(keyFor(profileId), JSON.stringify(progress));
    touch(profileId);
  } catch {
    // Storage unavailable; the session still works, it just will not carry over.
  }
}

/**
 * The days this learner practised braille, most recent first.
 *
 * Kept alongside the cell stats rather than derived from them: the stats say
 * how well each cell is going, not when — and a streak is the one number in
 * the account page's activity line that cannot be reconstructed after the fact.
 * Bounded, because only the tail of it is ever read.
 */
const DAYS_KEY = "keylearn.braille.days";
const DAYS_KEPT = 400;

function daysKey(profileId: string | null): string {
  return profileId == null || profileId === ""
    ? DAYS_KEY
    : `${DAYS_KEY}.${profileId}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function touch(profileId: string | null): void {
  const days = practiceDays(profileId);
  const day = today();
  if (days[0] === day) {
    return;
  }
  window.localStorage.setItem(
    daysKey(profileId),
    JSON.stringify([day, ...days].slice(0, DAYS_KEPT)),
  );
}

export function practiceDays(profileId: string | null = null): string[] {
  try {
    const raw = window.localStorage.getItem(daysKey(profileId));
    const days = raw == null ? [] : JSON.parse(raw);
    return Array.isArray(days) ? days.filter((d) => typeof d === "string") : [];
  } catch {
    return [];
  }
}

export type BrailleStats = {
  /** Cells entered correctly, all time. */
  readonly hits: number;
  /** Cells confidently learned, out of the alphabet. */
  readonly learned: number;
  readonly totalCells: number;
  /** Consecutive days of practice ending today. */
  readonly streakDays: number;
};

/**
 * A braille learner's progress, in the shape the account page's activity line
 * wants.
 *
 * The account page reads typing results, which a braille learner never
 * produces — so without this their row said "No practice yet" no matter how
 * much they had done, which is the one place the app tells a parent whether
 * their child is getting on with it.
 */
export function brailleStats(profileId: string | null = null): BrailleStats {
  // Through loadProgress, so a learner whose work predates per-profile storage
  // has it adopted here rather than only when they next open the page.
  const progress = loadProgress(profileId);
  let hits = 0;
  for (const letter of LETTERS.keys()) {
    hits += progress.statOf(letter).hits;
  }
  const days = practiceDays(profileId);
  let streakDays = 0;
  const cursor = new Date();
  while (days.includes(cursor.toISOString().slice(0, 10))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    hits,
    learned: progress.unlocked().length,
    totalCells: LETTERS.size,
    streakDays,
  };
}
