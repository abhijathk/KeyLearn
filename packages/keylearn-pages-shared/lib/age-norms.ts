import { activeProfileBirthYear } from "./profile-storage.ts";

/**
 * What typing speed is normal for a child of a given age.
 *
 * Shared rather than owned by the kids page, because the number a parent needs
 * is not on the kids page — it is on the profile page, next to the big average
 * speed figure, which is where somebody decides whether their six-year-old is
 * behind. Adult typing speeds are so widely quoted (40 wpm "average", 60 wpm
 * "good") that a child's perfectly normal 7 wpm reads as a problem, and the
 * child is the one who hears about it.
 *
 * The ranges are what children of each age actually do with continuous
 * practice, not what they could reach at a keyboard camp.
 */
const BANDS: readonly {
  readonly maxAge: number;
  readonly wpm: readonly [number, number];
}[] = [
  { maxAge: 6, wpm: [5, 8] },
  { maxAge: 8, wpm: [8, 15] },
  { maxAge: 10, wpm: [15, 25] },
  { maxAge: 12, wpm: [20, 35] },
];

/** The oldest age this advice is for; above it, adult expectations apply. */
export const CHILD_MAX_AGE = 12;

/** Typical words per minute for this age, or null when it is not a child's. */
export function typicalWpmForAge(
  age: number | null,
): readonly [number, number] | null {
  if (age == null || age < 0 || age > CHILD_MAX_AGE) {
    return null;
  }
  return (BANDS.find(({ maxAge }) => age <= maxAge) ?? BANDS.at(-1)!).wpm;
}

/** Age this calendar year from a birth year, or null when it makes no sense. */
export function ageFromBirthYear(year: number | null): number | null {
  if (year == null) {
    return null;
  }
  const age = new Date().getFullYear() - year;
  return age >= 0 && age < 120 ? age : null;
}

/**
 * The active household profile's age — who is at the keyboard right now.
 *
 * Right for the kids page, which is being used by that person. Wrong for the
 * profile page, whose tabs choose whose history to READ without changing who
 * is practising: use the viewed profile's own birth year there.
 */
export function activeProfileAge(): number | null {
  return ageFromBirthYear(activeProfileBirthYear());
}
