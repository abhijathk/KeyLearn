/**
 * WHICH SCENE A LESSON BELONGS TO, on the Hero Trail and on Dino Run.
 *
 * A scene lasts ten lessons. Lessons 1 to 10 are one place — the road simply
 * carries on — and the world changes only when the tenth is finished. A
 * lesson here is a flag: the round that ends at one, which is what the page
 * already counts.
 *
 * It used to change on a counter that ticked every time the page was loaded,
 * and the trail map offered a new land every third round, so a child met
 * different scenery twice in an afternoon and the same scenery again a week
 * later. Both were about the software's bookkeeping. This is about the
 * journey: the scene is a function of how far the child has got and of
 * nothing else, so the same lesson is always in the same place, on every
 * device, and a returning child resumes where they stopped.
 *
 * Time Keepers does not use this. Its road is authored, chapter by chapter.
 */

/** How many lessons one scene lasts. */
export const SCENE_LESSONS = 10;

/** A count made safe: whole, never negative, and zero for anything else. */
const whole = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

/** The scene a child is in, counted from zero, given lessons completed. */
export const sceneIndexOf = (lessonsDone: number): number =>
  Math.floor(whole(lessonsDone) / SCENE_LESSONS);

/** The lesson within its scene, 1 to 10, for a child about to start one. */
export const lessonInScene = (lessonsDone: number): number =>
  (whole(lessonsDone) % SCENE_LESSONS) + 1;

/** True when the lesson just finished was the last of its scene. */
export const sceneJustEnded = (lessonsDone: number): boolean =>
  whole(lessonsDone) > 0 && whole(lessonsDone) % SCENE_LESSONS === 0;

/**
 * A small seeded generator. Not cryptographic and not meant to be: it only
 * has to give the same sequence for the same seed on every device.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which of `count` places the given scene is set in.
 *
 * Scenes go through every place once, in an order shuffled afresh each time
 * round, and the shuffle never puts the place a child has just left first in
 * the next round — so the same scenery never appears twice running, however
 * long the road is. Pure: the same scene always gives the same place.
 */
export function sceneSlot(count: number, scene: number): number {
  if (count <= 1) {
    return 0;
  }
  const round = Math.floor(whole(scene) / count);
  return roundOrder(count, round)[whole(scene) % count]!;
}

/** Every round worked out so far, by number of places. */
const rounds = new Map<number, number[][]>();

/**
 * The order the places come in during one round.
 *
 * Built from the first round onwards and remembered, because whether a round
 * may start with a given place depends on how the round before it ended —
 * and that round's end was itself adjusted by the one before.
 */
function roundOrder(count: number, round: number): number[] {
  let known = rounds.get(count);
  if (known == null) {
    known = [];
    rounds.set(count, known);
  }
  for (let r = known.length; r <= round; r++) {
    const rand = mulberry32(0x9e3779b1 ^ Math.imul(r + 1, 0x85ebca6b));
    const slots = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [slots[i], slots[j]] = [slots[j]!, slots[i]!];
    }
    const before = r > 0 ? known[r - 1]![count - 1] : undefined;
    if (slots[0] === before) {
      // The second place cannot also be the one just left.
      [slots[0], slots[1]] = [slots[1]!, slots[0]!];
    }
    known.push(slots);
  }
  return known[round]!;
}

/** The land a scene is set in, out of the ones a world has. */
export function landForScene<T>(lands: readonly T[], scene: number): T {
  return lands[sceneSlot(lands.length, scene)]!;
}
