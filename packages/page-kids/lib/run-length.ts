/**
 * How far a passage carries a character along the trail.
 *
 * Its own module so it can be tested: it is arithmetic with no scene, no
 * renderer and no DOM behind it, and importing `world.ts` to reach it
 * drags in three.js and the whole page.
 */

export const RUN_LEN = 64;

/**
 * The furthest a character may travel per keystroke before its feet start
 * to slide.
 *
 * Ground speed on the trail is decided by typing, not by the clip: a
 * passage carries you from `runStart` to `runEnd` however many characters
 * it happens to contain. `RUN_LEN` was fixed, so a short passage covered
 * the same 64 units as a long one and each keystroke had to move the
 * character further — which the gait, tuned to one cycle length, cannot
 * absorb. At 2.67 units per keystroke the five-year-olds' characters were
 * skating.
 *
 * Measured across the bands, and it is not an age problem: `wordCount`
 * grows as keys unlock, so every band runs fast at the start of its own
 * curriculum and settles as the passages lengthen. 5-6 ranged 2.67 -> 1.78,
 * 7-8 1.29 -> 0.90, 9-10 0.83 -> 0.57. The ceiling below is the busiest
 * figure nobody has ever reported as sliding — 7-8 on a full passage — so
 * it is taken from the game rather than chosen.
 */
export const MAX_UNITS_PER_KEY = 0.9;

/**
 * How far this passage should carry them.
 *
 * A cap, never a stretch: a passage long enough to earn the full 64 units
 * still gets them, so every band that reads correctly today is untouched.
 * Only the runs that were outpacing their own gait are brought down.
 */
export function runLengthFor(passageChars: number): number {
  if (!Number.isFinite(passageChars) || passageChars <= 0) return RUN_LEN;
  return Math.min(RUN_LEN, passageChars * MAX_UNITS_PER_KEY);
}

/**
 * THE WORDS FIT THE ROAD (owner, 25 Sep 2026).
 *
 * On Time Keepers every band walks 64-unit lessons at no more than
 * MAX_UNITS_PER_KEY a key. A lesson a child's passage cannot cover in one go
 * is shared out evenly between as many passages as it needs, and this one is
 * cut — at a word boundary — to the word count whose length is CLOSEST to
 * its share (always rounding down left each passage a little short and
 * forced an extra, uneven one at the end). Called again before every
 * passage with what is left, so a miss evens out, and the last passage lands
 * on the milestone: no sliding to make up distance, no jump to the stone.
 *
 * A passage that covers the whole lesson on its own, at the lesson's start,
 * is left as it is — older children just walk a little slower per key.
 */
export function fitPassageToRoad(
  passage: string,
  left: number,
  started: boolean,
): string {
  if (!(left > 0) || passage.length === 0) return passage;
  const perRun = passage.length * MAX_UNITS_PER_KEY;
  const parts = Math.ceil(left / Math.max(1, perRun) - 1e-6);
  if (parts < 2 && !started) return passage;
  const fit = left / parts / MAX_UNITS_PER_KEY;
  const ws = passage.split(" ");
  let best = 1;
  for (let k = 2; k <= ws.length; k++) {
    const len = ws.slice(0, k).join(" ").length;
    const was = ws.slice(0, best).join(" ").length;
    if (Math.abs(len - fit) < Math.abs(was - fit)) best = k;
  }
  return ws.slice(0, best).join(" ");
}

/**
 * How far one passage carries a child along a chapter lesson with `left`
 * units still to walk — the rule `startRun` in world.ts applies: never more
 * than MAX_UNITS_PER_KEY a key, and a sliver under 15% of a run is taken in
 * this one rather than left as a crawl.
 */
export function runAlongLesson(passageChars: number, left: number): number {
  const full = runLengthFor(passageChars);
  let run = Math.min(full, Math.max(0, left));
  if (left - run <= full * 0.15) run = Math.max(0, left);
  return run;
}
