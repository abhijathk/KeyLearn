import { type Reason } from "./types.ts";

/**
 * The ladder: two warnings, then multiplayer is taken away for a while.
 *
 * Warnings come first because most of this is thoughtlessness rather than
 * malice, and a first-time visitor who is banned simply never comes back. What
 * is never taken away is the practice itself — the typing, the profile and the
 * progress are untouched at every step. The room is the privilege; learning is
 * not.
 */

export const MUTE_MS = 5 * 60_000;

/** How long a block lasts, by how many the learner has already had. */
const BLOCKS_MS = [24 * 3_600_000, 7 * 24 * 3_600_000] as const;

/** A strike is forgiven after this long without another. */
export const DECAY_MS = 30 * 24 * 3_600_000;

export type Standing = {
  /** Strikes that have not yet decayed. */
  readonly strikes: number;
  /** When the most recent strike landed, or 0. */
  readonly lastStrikeAt: number;
  /** How many blocks this learner has already served. */
  readonly blocks: number;
};

export type Consequence =
  | { readonly kind: "none" }
  | { readonly kind: "warn" }
  | { readonly kind: "mute"; readonly untilMs: number }
  | { readonly kind: "block"; readonly untilMs: number };

/** Strikes still counting against a learner, after decay. */
export function currentStrikes(
  { strikes, lastStrikeAt }: Standing,
  now: number,
): number {
  if (strikes === 0 || lastStrikeAt === 0) {
    return 0;
  }
  // One forgiven per clean period, rather than the whole tally at once —
  // somebody who slipped twice in March should not be one word from a block in
  // September, but neither should a single clean month wipe a bad week.
  const periods = Math.floor((now - lastStrikeAt) / DECAY_MS);
  return Math.max(0, strikes - periods);
}

/**
 * What happens now, given what the message earned and what came before.
 *
 * Contact details skip the ladder: the response is the same on the first
 * message as on the third, because the reason for it has nothing to do with
 * whether the person has been warned about swearing.
 */
export function escalate(
  standing: Standing,
  earned: number,
  reason: Reason,
  now: number,
): Consequence {
  if (earned === 0) {
    return { kind: "none" };
  }
  if (reason === "contact") {
    return {
      kind: "block",
      untilMs: now + BLOCKS_MS[Math.min(standing.blocks, BLOCKS_MS.length - 1)],
    };
  }
  const total = currentStrikes(standing, now) + earned;
  if (total <= 1) {
    return { kind: "warn" };
  }
  if (total === 2) {
    return { kind: "mute", untilMs: now + MUTE_MS };
  }
  return {
    kind: "block",
    untilMs: now + BLOCKS_MS[Math.min(standing.blocks, BLOCKS_MS.length - 1)],
  };
}
