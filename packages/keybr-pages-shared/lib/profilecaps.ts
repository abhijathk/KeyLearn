/**
 * How many learners a household may hold.
 *
 * Two allowances, not one. A learner on braille and audio does not use up a
 * place: a household that has to choose between adding another child and
 * adding the blind one is being asked to ration accessibility against everyone
 * else, and the answer to that is not a pricing question. So braille learners
 * get their own places, the same number on every plan — premium buys more room
 * for sighted learners and nothing more.
 *
 * Defined here rather than beside either caller because both the browser and
 * the server enforce them, and a client and a server that disagree about a cap
 * surface as an unexplained refusal rather than as a bug report.
 */
export const PLACES_FREE = 4;
export const PLACES_PREMIUM = 8;

/** Extra places for learners on braille and audio, on every plan. */
export const PLACES_BRAILLE = 4;

export function sightedPlaces(premium: boolean): number {
  return premium ? PLACES_PREMIUM : PLACES_FREE;
}

/** The most profiles of any kind, for a household that uses both allowances. */
export function totalPlaces(premium: boolean): number {
  return sightedPlaces(premium) + PLACES_BRAILLE;
}

/**
 * Anything that knows whether it is a braille learner.
 *
 * Loose on purpose: this counts both API-shaped profiles and raw database rows,
 * and SQLite stores the flag as 0/1 rather than as a boolean.
 */
type Countable = { readonly visionSupport?: boolean | number | null };

export type PlaceCounts = {
  readonly sighted: number;
  readonly braille: number;
  readonly sightedFree: number;
  readonly brailleFree: number;
  /** Whether another learner can be added at all, of either kind. */
  readonly canAdd: boolean;
};

export function countPlaces(
  profiles: readonly Countable[],
  premium: boolean,
): PlaceCounts {
  const braille = profiles.filter((p) => Boolean(p.visionSupport)).length;
  const sighted = profiles.length - braille;
  const sightedFree = Math.max(0, sightedPlaces(premium) - sighted);
  const brailleFree = Math.max(0, PLACES_BRAILLE - braille);
  return {
    sighted,
    braille,
    sightedFree,
    brailleFree,
    canAdd: sightedFree > 0 || brailleFree > 0,
  };
}
