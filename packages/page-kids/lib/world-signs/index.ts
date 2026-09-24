import { SIGN as DINO } from "./dino.ts";
import { SIGN as HERO } from "./hero.ts";
import { SIGN as VILLAGE } from "./village.ts";

/**
 * Each world's title sign, drawn small over the runner on the loading card.
 * Inline pictures — see scripts/kids-world-sign.mjs for why.
 */
export const WORLD_SIGN = { village: VILLAGE, hero: HERO, dino: DINO } as const;
