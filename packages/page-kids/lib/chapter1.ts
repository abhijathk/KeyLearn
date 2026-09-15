import { runLengthFor } from "./run-length.ts";

/**
 * CHAPTER 1: THE VILLAGE — the authored road, as data.
 *
 * Its own module so it can be tested: this is a table and some arithmetic,
 * with no scene, no renderer and no DOM behind it, and importing `world.ts`
 * to reach it drags in three.js and the whole page.
 *
 * THE ROAD IS BUILT TO THE CHAPTER, not the chapter fitted to the road. See
 * `chapterBounds`: a lesson is as long as its passage carries the child, so
 * the stones stand where the typing actually ends and the terrain is sized
 * to whichever band is walking it.
 *
 * ONE WORLD, NOT TEN SCENES. There is no day geometry and no night geometry —
 * each lesson has one physical environment and the hour changes only who is
 * out in it. A child standing at Milestone 5 at noon, at eight, and at two in
 * the morning has to be in visibly the same place.
 */

export const SEGMENT_COUNT = 10;

/**
 * WHERE THE MILESTONES STAND, AND WHY IT IS NOT A CONSTANT.
 *
 * A lesson is a passage, and how far it carries a child is decided by how
 * much they type — `runLengthFor` gives `chars * 0.9`, capped at RUN_LEN.
 * Measured across the bands that is 21.6 units for a five-year-old's first
 * passage and 64 for a nine-year-old's, every lesson:
 *
 *   5-6    21.6 -> 32.4     chapter  270
 *   7-8    45.0 -> 64.0     chapter  548
 *   9-10   64.0 -> 64.0     chapter  640
 *   11+    64.0 -> 64.0     chapter  640
 *
 * So a fixed 26-unit segment is wrong at both ends: the youngest stop short
 * of their own milestone every lesson, and the oldest cover two and a half
 * segments in one passage. The stones have to follow the typing, which means
 * the chapter is as long as the band needs and the road is built to fit.
 *
 * The world is built before any passage exists — it only learns lengths later
 * through `startRun` — so these are PREDICTED from the band's own curve,
 * which is measured and does not move. A child who types a shorter passage
 * than predicted stops a little short of the stone and the next run starts
 * from where they are; the stone is still the marker it was.
 */
export function chapterBounds(
  startChars: number,
  fullChars: number,
): readonly number[] {
  const out = [0];
  for (let k = 0; k < SEGMENT_COUNT; k++) {
    // Passages lengthen as keys unlock, so the curve runs from the band's
    // first passage to its full one across the ten lessons.
    const chars =
      startChars + ((fullChars - startChars) * k) / (SEGMENT_COUNT - 1);
    out.push(out[k]! + runLengthFor(chars));
  }
  return out;
}

/**
 * The youngest band, and the default when nobody says otherwise.
 *
 * 5-6 is the right default rather than an average: it is the shortest
 * chapter, so a world built to it is never SHORTER than the road a child
 * walks. Guessing high would build ground nobody reaches; guessing low runs
 * them off the end of the terrain, which is the failure that shows.
 */
export const DEFAULT_BOUNDS = chapterBounds(24, 36);

/** Where the chapter ends, for a given set of stones. */
export function chapterEnd(bounds: readonly number[] = DEFAULT_BOUNDS): number {
  return bounds[bounds.length - 1]!;
}

/**
 * How much of a segment still remembers the one before it.
 *
 * The brief asks for 15-25%, and the reason is that a milestone is a marker,
 * not a border: an orchard that stops dead at a stone and becomes pasture on
 * the far side reads as two levels glued together. Over the first quarter of
 * a segment the previous lesson's planting fades out as this one's fades in,
 * so the change is something the child walks through rather than crosses.
 */
export const BLEED = 0.22;

/**
 * A DETERMINISTIC VALUE FOR A PLACE.
 *
 * Every placement in this chapter is drawn from here rather than from
 * `Math.random()`, and that is a requirement rather than a preference: things
 * have to stand in the same spot on every visit so that animals and walkers
 * can be told where they are and route around them. A world re-rolled each
 * session cannot have obstruction-aware anything, because there is nothing
 * stable to be aware of.
 *
 * It is a 32-bit integer hash of the two coordinates and a salt, so the same
 * (x, z, salt) always gives the same number, nearby points give unrelated
 * numbers, and asking a different question about the same point — its
 * species, its lean, its height — means passing a different salt rather than
 * consuming a sequence. There is no sequence, which is what makes it safe to
 * call from anywhere in any order.
 */
export function hash3(x: number, z: number, salt: number): number {
  let h =
    (Math.imul(Math.round(x * 64), 0x27d4eb2d) ^
      Math.imul(Math.round(z * 64), 0x165667b1) ^
      Math.imul(salt + 1, 0x9e3779b1)) >>>
    0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** A deterministic value in a range. */
export function hashRange(
  x: number,
  z: number,
  salt: number,
  lo: number,
  hi: number,
): number {
  return lo + hash3(x, z, salt) * (hi - lo);
}

/** A deterministic pick from a list. Empty list gives null. */
export function hashPick<T>(
  list: readonly T[],
  x: number,
  z: number,
  salt: number,
): T | null {
  if (list.length === 0) return null;
  return list[
    Math.min(list.length - 1, Math.floor(hash3(x, z, salt) * list.length))
  ]!;
}

/** A prop standing in a fixed place, for the whole life of the chapter. */
export type Placed = {
  /** Model path under `models/`, without the .glb. */
  readonly model: string;
  /** Distance along the road, as a fraction of this segment (0..1). */
  readonly at: number;
  /** Depth from the road. Negative is the far side; the near side is empty. */
  readonly z: number;
  /** Height in world units, before the perspective falloff. */
  readonly h: number;
  /** Heading, radians. */
  readonly turn?: number;
  /**
   * How much room this thing needs around it. Animals and walkers keep out
   * of this circle; 0 means it is not an obstruction — grass, ground cover,
   * anything you would walk straight through.
   */
  readonly clear?: number;
};

export type Lesson = {
  readonly n: number;
  readonly name: string;
  /** Milestone numbers: lesson n runs from stone n-1 to stone n. */
  readonly from: number;
  readonly to: number;
  /** Upper layer: what stands over the road. */
  readonly canopy: readonly string[];
  /** Middle layer: what stands at head height. */
  readonly mid: readonly string[];
  /** Lower layer: what covers the ground. */
  readonly ground: readonly string[];
  /** Plants per unit of road, across both verges. Lesson 3 is the densest. */
  readonly density: number;
  /** How far back the planting reaches. The near verge is left clear. */
  readonly depth: readonly [number, number];
  /** Fixed structures, in segment-relative coordinates. */
  readonly props: readonly Placed[];
  /** Grazing animals, by model. Placed on the open ground, away from props. */
  readonly herd: readonly string[];
  /** Who is out here by day. Empty means an unpeopled stretch. */
  readonly folk: readonly string[];
  /**
   * Inside the Kuttichathan corridor, M4 to M7.
   *
   * Traces only, and no figure at all — a moved pot, a disturbed basket.
   * The character is held back until its animation is ready, and the corridor
   * is authored now so there is somewhere for it to arrive.
   */
  readonly corridor: boolean;
};

const PLANTS = "village-plants";
const UTIL = "village-util";

/**
 * THE TEN LESSONS.
 *
 * Read down the `density` column and the shape of the chapter is visible on
 * its own: open at 1.1, thickening to 3.4 through the orchard, dropping back
 * through the village, and opening out again to 1.2 at the end. Lesson 10
 * echoes Lesson 1 deliberately — the chapter closes where it started, at a
 * calmer end-state, and Milestone 10's roadside is meant to look like
 * Milestone 0's.
 */
export const LESSONS: readonly Lesson[] = [
  {
    n: 1,
    name: "The Open Village Edge",
    from: 0,
    to: 1,
    // Light tree density and wide sightlines: this is the chapter's opening
    // and the child is learning to read the road itself. Nothing here is
    // allowed to compete with the milestone or the buffalo.
    canopy: [`${PLANTS}/Coconut_Palm`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.1,
    depth: [8, 24],
    props: [
      { model: "village-stone/Mossy_Stone", at: 0.42, z: -7.5, h: 0.9 },
      { model: "village-stone/Laterite_Rock", at: 0.74, z: -9, h: 0.7 },
    ],
    // The first recognisable living landmark in the chapter.
    herd: ["ak-3d-pack/Buffalo"],
    folk: [],
    corridor: false,
  },
  {
    n: 2,
    name: "Entering Cultivated Land",
    from: 1,
    to: 2,
    // The edge turning into productive family land: useful trees rather than
    // scenery, and the first laterite showing through.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Papaya_Tree`],
    mid: [`${PLANTS}/Banana_Plant`, `${PLANTS}/Drumstick_Muringa`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Taro_Chembu`],
    density: 1.9,
    depth: [7, 26],
    props: [
      // Broken and partial, never a run: the wall is a hint of enclosure
      // here, and becomes a real boundary by Lesson 6.
      { model: `${UTIL}/Laterite_Wall`, at: 0.3, z: -11, h: 2.1, clear: 6 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.38, z: -11.4, h: 2.1, clear: 6 },
      {
        model: `${UTIL}/Cattle_Tether_Post`,
        at: 0.62,
        z: -9,
        h: 1.5,
        clear: 2,
      },
    ],
    herd: ["village-folk/Cow", "village-folk/Cow_Calf", "ak-3d-pack/Buffalo"],
    folk: ["village-folk/FarmerWoman"],
    corridor: false,
  },
  {
    n: 3,
    name: "The Mixed Orchard Belt",
    from: 2,
    to: 3,
    // The richest vegetation in the chapter, and the only segment where all
    // three layers are full. A real Kerala orchard is layered and slightly
    // irregular rather than planted in rows, which is what the density and
    // the species count are doing here rather than any special placement.
    canopy: [
      `${PLANTS}/Coconut_Palm`,
      `${PLANTS}/Arecanut_Palm`,
      `${PLANTS}/Mango_Tree`,
      `${PLANTS}/Jackfruit_Tree`,
    ],
    mid: [
      `${PLANTS}/Banana_Plant`,
      `${PLANTS}/Drumstick_Muringa`,
      `${PLANTS}/Papaya_Tree`,
    ],
    ground: [
      `${PLANTS}/Tapioca_Cassava`,
      `${PLANTS}/Taro_Chembu`,
      `${PLANTS}/Kerala_Fern`,
    ],
    density: 3.4,
    depth: [6, 30],
    props: [
      // In stretches, not as an unbroken wall the whole way — the brief is
      // explicit, and a continuous fence would also hide the orchard it is
      // supposed to enclose.
      { model: `${UTIL}/Bamboo_Fence`, at: 0.18, z: -8, h: 2.4, clear: 5 },
      { model: `${UTIL}/Bamboo_Fence`, at: 0.26, z: -8, h: 2.4, clear: 5 },
      { model: `${UTIL}/Bamboo_Fence`, at: 0.68, z: -8.5, h: 2.4, clear: 5 },
      { model: `${UTIL}/Washing_Stone`, at: 0.52, z: -12, h: 0.5, clear: 2 },
    ],
    herd: [],
    folk: ["village-folk/FarmerWoman"],
    corridor: false,
  },
  {
    n: 4,
    name: "The Old Homestead",
    from: 3,
    to: 4,
    // Fewer packed palms, more mature trees: the house has to emerge THROUGH
    // the vegetation rather than arrive all at once, so the canopy stays and
    // only the middle layer thins.
    canopy: [
      `${PLANTS}/Mango_Tree`,
      `${PLANTS}/Jackfruit_Tree`,
      `${PLANTS}/Peepal_Arayal`,
    ],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`, `${PLANTS}/Banana_Plant`],
    ground: [`${PLANTS}/Taro_Chembu`, `${PLANTS}/Kerala_Fern`],
    density: 2.4,
    depth: [8, 28],
    props: [
      { model: "ak-3d-pack/HouseMoss", at: 0.55, z: -22, h: 11, clear: 12 },
      { model: `${UTIL}/Village_Well`, at: 0.44, z: -13, h: 2.2, clear: 4 },
      { model: `${UTIL}/Washing_Stone`, at: 0.4, z: -11, h: 0.5, clear: 2 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.68, z: -12, h: 2.1, clear: 6 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.76, z: -12, h: 2.1, clear: 6 },
      {
        model: `${UTIL}/Cattle_Tether_Post`,
        at: 0.3,
        z: -10,
        h: 1.5,
        clear: 2,
      },
    ],
    herd: ["village-folk/Cow"],
    folk: ["village-folk/FarmerWoman"],
    // The threshold. Foreshadowing only, near the far end.
    corridor: false,
  },
  {
    n: 5,
    name: "The Village Centre",
    from: 4,
    to: 5,
    // Rural and breathable, not a town: the planting stays heavy between the
    // buildings on purpose, because what stops a cluster of houses reading as
    // a street is the garden between them.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Mango_Tree`],
    mid: [`${PLANTS}/Banana_Plant`, `${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Taro_Chembu`],
    density: 1.6,
    depth: [9, 26],
    props: [
      // The banyan is the social focus and the temple is glimpsed past its
      // trunk, never behind it — the tree stands BESIDE the shrine.
      { model: `${PLANTS}/Banyan_Almaram`, at: 0.3, z: -14, h: 18, clear: 10 },
      {
        model: "ak-3d-pack/Temple",
        at: 0.44,
        z: -17,
        h: 9,
        turn: 0.08,
        clear: 9,
      },
      { model: "ak-3d-pack/HouseThatch", at: 0.66, z: -21, h: 11, clear: 12 },
      { model: "ak-3d-pack/HouseHearth", at: 0.84, z: -24, h: 11, clear: 12 },
      { model: `${UTIL}/Village_Well`, at: 0.56, z: -12, h: 2.2, clear: 4 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.72, z: -13, h: 2.1, clear: 6 },
      {
        model: `${UTIL}/Village_Cart`,
        at: 0.2,
        z: -9,
        h: 2.6,
        turn: 0.9,
        clear: 4,
      },
    ],
    herd: [],
    folk: ["village-folk/Headman", "village-folk/VillageBoy"],
    corridor: true,
  },
  {
    n: 6,
    name: "The Large Orchard Estate",
    from: 5,
    to: 6,
    // Lesson 3 again, but prosperous. Same species; what says "wealthier
    // family" is the length of the boundary wall and the size of the house,
    // not a different orchard.
    canopy: [
      `${PLANTS}/Coconut_Palm`,
      `${PLANTS}/Arecanut_Palm`,
      `${PLANTS}/Jackfruit_Tree`,
      `${PLANTS}/Tamarind_Tree`,
    ],
    mid: [`${PLANTS}/Banana_Plant`, `${PLANTS}/Papaya_Tree`],
    ground: [`${PLANTS}/Tapioca_Cassava`, `${PLANTS}/Kerala_Fern`],
    density: 2.9,
    depth: [7, 30],
    props: [
      // A real run this time. Six segments end to end is the longest
      // continuous boundary in the chapter, which is the whole point.
      { model: `${UTIL}/Laterite_Wall`, at: 0.14, z: -10, h: 2.4, clear: 6 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.22, z: -10, h: 2.4, clear: 6 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.3, z: -10, h: 2.4, clear: 6 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.38, z: -10, h: 2.4, clear: 6 },
      { model: `${UTIL}/Laterite_Wall`, at: 0.46, z: -10, h: 2.4, clear: 6 },
      { model: "ak-3d-pack/HouseHearth", at: 0.6, z: -23, h: 13, clear: 13 },
      {
        model: `${UTIL}/Village_Cart`,
        at: 0.72,
        z: -11,
        h: 2.6,
        turn: 0.4,
        clear: 4,
      },
      { model: `${UTIL}/Petromax_Lamp`, at: 0.62, z: -13, h: 1.1 },
    ],
    herd: [],
    folk: ["village-folk/Headman"],
    corridor: true,
  },
  {
    n: 7,
    name: "The Market Road",
    from: 6,
    to: 7,
    // The social peak, framed by bamboo before and after.
    //
    // THE MARKET ITSELF IS A GAP. The shipped model is four and a third times
    // wider than it is tall and will not carry an honest size, and nothing in
    // any vault has the stalls, sacks, jars and baskets this lesson is built
    // from. So the zone is authored — bamboo, well, the tea-stall worker, the
    // clutter of a place people use — and the market goes in when there is
    // one. What must NOT happen is a smeared market: a village with no market
    // reads as a small village, a village with a broken one reads as broken.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Tamarind_Tree`],
    mid: [`${PLANTS}/Banana_Plant`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`],
    density: 1.4,
    depth: [9, 24],
    props: [
      { model: "nature/KeralaBambooGroves", at: 0.1, z: -11, h: 7, clear: 5 },
      { model: `${UTIL}/Village_Well`, at: 0.46, z: -12, h: 2.2, clear: 4 },
      {
        model: `${UTIL}/Village_Cart`,
        at: 0.56,
        z: -10,
        h: 2.6,
        turn: 1.9,
        clear: 4,
      },
      { model: `${UTIL}/Petromax_Lamp`, at: 0.5, z: -10.5, h: 1.2 },
      { model: "nature/KeralaBambooGroves", at: 0.88, z: -12, h: 7, clear: 5 },
    ],
    herd: [],
    folk: ["village-folk/TeaStall", "village-folk/Headman"],
    corridor: true,
  },
  {
    n: 8,
    name: "Into Grazing Land",
    from: 7,
    to: 8,
    // Decompression. Mature trees over open grass — not empty, because this
    // is still land that belongs to a village economy, but the sightlines
    // come back after the market.
    canopy: [`${PLANTS}/Palmyra_Karimpana`, `${PLANTS}/Mango_Tree`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.5,
    depth: [10, 28],
    props: [
      // Fragments, not a boundary: the wall is a leftover out here.
      { model: `${UTIL}/Laterite_Wall`, at: 0.24, z: -14, h: 2.0, clear: 6 },
      {
        model: "village-stone/Granite_Boulder",
        at: 0.6,
        z: -12,
        h: 1.4,
        clear: 2,
      },
    ],
    herd: ["ak-3d-pack/Buffalo", "village-folk/Cow", "village-folk/Cow_Calf"],
    folk: [],
    corridor: false,
  },
  {
    n: 9,
    name: "The Pasture",
    from: 8,
    to: 9,
    // Simpler and more open than Lesson 8: a small number of strong elements
    // rather than many mixed ones.
    //
    // THE HAYSTACK IS A GAP. It is named as the key landmark prop and there
    // is no haystack in any folder, so the space it wants is left clear at
    // 0.5 rather than filled with something that is not one.
    canopy: [`${PLANTS}/Mango_Tree`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`],
    density: 1.0,
    depth: [11, 30],
    props: [
      {
        model: `${UTIL}/Cattle_Tether_Post`,
        at: 0.36,
        z: -13,
        h: 1.5,
        clear: 2,
      },
    ],
    herd: ["village-folk/Cow", "village-folk/Cow_Calf", "ak-3d-pack/Buffalo"],
    folk: [],
    corridor: false,
  },
  {
    n: 10,
    name: "The Fern Meadow",
    from: 9,
    to: 10,
    // Closure, and a deliberate echo of Lesson 1: the same open language at a
    // calmer end-state, with the buffalo back as a bookend. Trees only at the
    // far edge so the space stays open.
    canopy: [`${PLANTS}/Coconut_Palm`],
    mid: [],
    ground: [`${PLANTS}/Kerala_Fern`, `${PLANTS}/Kerala_Grass_Tuft`],
    density: 1.2,
    depth: [12, 32],
    props: [
      { model: "village-stone/Mossy_Stone", at: 0.45, z: -8, h: 0.9 },
      { model: "village-stone/Laterite_Rock", at: 0.8, z: -9.5, h: 0.7 },
    ],
    herd: ["ak-3d-pack/Buffalo"],
    folk: [],
    corridor: false,
  },
];

/** Which lesson owns this point on the road. Clamped at both ends. */
export function lessonAt(
  x: number,
  bounds: readonly number[] = DEFAULT_BOUNDS,
): Lesson {
  for (let i = SEGMENT_COUNT - 1; i > 0; i--) {
    if (x >= bounds[i]!) return LESSONS[i]!;
  }
  return LESSONS[0]!;
}

/** Where a milestone stands. Stone n closes lesson n. */
export function milestoneX(
  n: number,
  bounds: readonly number[] = DEFAULT_BOUNDS,
): number {
  return bounds[Math.max(0, Math.min(SEGMENT_COUNT, n))]!;
}

/** How long one lesson's stretch of road is. */
export function segmentLen(
  n: number,
  bounds: readonly number[] = DEFAULT_BOUNDS,
): number {
  return bounds[n]! - bounds[n - 1]!;
}

/**
 * The two lessons in play at a point, and how much of the newer one has
 * taken over.
 *
 * `mix` is 0 at the stone and 1 once the bleed is done, so a caller picking a
 * species asks for `prev` below it and `lesson` above it. Past the bleed the
 * two are the same lesson and `mix` is 1, which is the common case and costs
 * the caller no special handling.
 */
export function blendAt(
  x: number,
  bounds: readonly number[] = DEFAULT_BOUNDS,
): { readonly lesson: Lesson; readonly prev: Lesson; readonly mix: number } {
  const lesson = lessonAt(x, bounds);
  const len = segmentLen(lesson.n, bounds);
  const into = (x - bounds[lesson.n - 1]!) / len;
  if (into >= BLEED || lesson.n === 1) {
    return { lesson, prev: lesson, mix: 1 };
  }
  const t = into / BLEED;
  return {
    lesson,
    prev: LESSONS[lesson.n - 2]!,
    // Smoothstep rather than a straight ramp: a linear blend changes fastest
    // at the stone itself, which is exactly where the seam would show.
    mix: Math.max(0, t * t * (3 - 2 * t)),
  };
}

/** Density at a point, carried across the bleed like everything else. */
export function densityAt(
  x: number,
  bounds: readonly number[] = DEFAULT_BOUNDS,
): number {
  const { lesson, prev, mix } = blendAt(x, bounds);
  return prev.density + (lesson.density - prev.density) * mix;
}

/**
 * Everything that stands in a fixed place, in world coordinates.
 *
 * The table stores `at` as a FRACTION of its segment rather than a distance,
 * which is what lets the same authored village sit on a 270-unit chapter and
 * a 640-unit one without a second table: the well stays 44 per cent of the
 * way through Lesson 4 either way.
 */
export function placements(
  bounds: readonly number[] = DEFAULT_BOUNDS,
): readonly (Placed & { readonly x: number })[] {
  const out: (Placed & { x: number })[] = [];
  for (const l of LESSONS) {
    const from = bounds[l.n - 1]!;
    const len = segmentLen(l.n, bounds);
    for (const p of l.props) {
      out.push({ ...p, x: from + p.at * len });
    }
  }
  return out;
}
