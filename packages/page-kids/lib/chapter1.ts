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
 * WHAT EACH BAND TYPES, first passage and full.
 *
 * Measured, not chosen — these are the figures `run-length.test.ts` took off
 * the real curriculum, and the same ones `stone-x.test.ts` walks its bands
 * with. Passages lengthen as keys unlock, so every band starts short and
 * settles, and that is why a chapter's first lesson is its shortest stretch
 * of road.
 */
export const BAND_CHARS: Readonly<
  Record<string, { readonly start: number; readonly full: number }>
> = {
  "5-6": { start: 24, full: 36 },
  "7-8": { start: 50, full: 72 },
  "9-10": { start: 77, full: 112 },
  "11+": { start: 102, full: 153 },
};

/** This band's chapter, or the youngest band's if the name is unknown. */
export function boundsForBand(band: string | undefined): readonly number[] {
  const c = BAND_CHARS[band ?? ""] ?? BAND_CHARS["5-6"]!;
  return chapterBounds(c.start, c.full);
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

/**
 * WHAT HOUR IT IS, in the only three flavours this chapter has.
 *
 * "Do not create separate day/night geometry variants; instead, create
 * activity-state variants." The scene is one scene — the same house, the
 * same wall, the same well at noon, at eight, and at two in the morning —
 * and what changes is who is out in it. A child standing at Milestone 5 at
 * any hour has to be visibly in the same place.
 *
 * The windows are the brief's own: village life by day, a settlement winding
 * down between seven and nine, and deep night from ten until four, which is
 * also the only window the Kuttichathan corridor is awake in.
 */
export type Activity = "day" | "evening" | "deep";

export function activityAt(hour: number): Activity {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 22 || h < 4) return "deep";
  if (h >= 19) return "evening";
  return "day";
}

/**
 * How many of a lesson's people are still outside at this hour.
 *
 * Day is everyone the lesson names. Evening is almost nobody: the brief
 * leaves a few outside at the village centre and the closing market and
 * sends everyone else indoors, which is what "winding down" has to mean if
 * it is to differ from day at all. Deep night is nobody — an empty road at
 * two in the morning is the whole reason the corridor is frightening.
 */
export function folkOut(l: Lesson, a: Activity): number {
  if (a === "day") return l.folk.length;
  if (a === "evening") return l.n === 5 || l.n === 7 ? 1 : 0;
  return 0;
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
  /**
   * A LINE OF THIS THING, laid end to end, with a way in.
   *
   * A boundary is continuous or it is not a boundary — scattered posts read
   * as litter, and three fence panels with daylight between them read as a
   * fence somebody is halfway through building. But a run with no break in
   * it walls the child out of a place they are supposed to be able to see
   * into, so every run leaves one segment out: the gate.
   *
   * `step` is in WORLD UNITS, not fractions, and it has to be the model's
   * own width at the height it is drawn — 4.20 for a bamboo fence at 2.4,
   * 6.25 for a laterite wall at the same. Fractions cannot do this job: a
   * segment of road is 21.6 units for a five-year-old and 64 for an
   * eleven-year-old, so the same fraction would overlap the panels for one
   * child and leave gaps between them for another.
   */
  readonly run?: {
    readonly count: number;
    readonly step: number;
    /** Which panel is missing. The way in. */
    readonly gapAt: number;
  };
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
  /**
   * How much is left behind, and WHERE IN THE SEGMENT.
   *
   * The corridor does not switch on at Milestone 4 and off at Milestone 7 —
   * the brief builds up to it and lets it fall away. Lesson 4 is a threshold
   * and gets one faint thing near its END; 5, 6 and 7 are the corridor
   * proper; Lesson 8 gets a single leftover near its START and then nothing
   * for the rest of the chapter. That shape is the difference between a
   * haunted stretch of road and a flag on three lessons.
   */
  readonly trace?: {
    readonly count: number;
    /** Where in the segment the traces may fall, as fractions. */
    readonly span: readonly [number, number];
  };
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
    // A KARIMPANA OR TWO. The palmyra stands above everything else on a
    // Kerala roadside and is the tree you navigate by, so it belongs on the
    // open stretches where there is sky for it to stand against rather than
    // in the orchard where it would be lost. One in the opening frame is a
    // landmark; a row of them would be a plantation.
    canopy: [`${PLANTS}/Coconut_Palm`],
    mid: [`${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.1,
    depth: [8, 24],
    props: [
      // A PALMYRA, AND ONE OF IT. It stands above everything else on a
      // Kerala roadside and is the tree you navigate by — a job exactly one
      // tree can hold. Drawn from the canopy list it came up as often as the
      // coconuts did, and a landmark repeated thirty times is a plantation.
      // So it is PLACED, and at a height nothing else here reaches: 16
      // against the canopy's 6.5 to 11, because being the tallest thing in
      // the frame is the whole of what it does.
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.62, z: -15, h: 16 },
      { model: "village-stone/Mossy_Stone", at: 0.42, z: -7.5, h: 0.9 },
      { model: "village-stone/Laterite_Rock", at: 0.74, z: -9, h: 0.7 },
    ],
    // The first recognisable living landmark in the chapter.
    herd: ["Buffalo"],
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
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.2, z: -17, h: 15.5 },
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.9, z: -14, h: 16.5 },
      // Broken and partial here, which is the brief — but broken means a
      // short run with an end to it, not panels floating apart. Five
      // segments at 5.47, the wall's own width at this height, with the
      // third left out for the way in.
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.26,
        z: -11,
        h: 2.1,
        clear: 5,
        run: { count: 5, step: 5.47, gapAt: 2 },
      },
      // GRASS GROWS AT A GATEWAY. Nothing is built there and nothing walks
      // there often enough to wear it away, so it is the one part of a
      // boundary that greens over — which is also what tells you it IS a
      // gateway rather than a panel that fell down.
      { model: `${PLANTS}/Kerala_Grass_Tuft`, at: 0.29, z: -10, h: 0.9 },
      { model: `${PLANTS}/Kerala_Fern`, at: 0.3, z: -12.2, h: 0.8 },
      {
        model: `${UTIL}/Cattle_Tether_Post`,
        at: 0.62,
        z: -9,
        h: 1.5,
        clear: 2,
      },
    ],
    herd: ["Cow", "Cow_Calf", "Buffalo"],
    folk: ["FarmerWoman"],
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
      // Two runs rather than one unbroken line the whole way, which is the
      // brief's "selected stretches" — and each run has its own gate.
      {
        model: `${UTIL}/Bamboo_Fence`,
        at: 0.12,
        z: -8,
        h: 2.4,
        clear: 4,
        run: { count: 7, step: 4.2, gapAt: 4 },
      },
      {
        model: `${UTIL}/Bamboo_Fence`,
        at: 0.64,
        z: -8.5,
        h: 2.4,
        clear: 4,
        run: { count: 6, step: 4.2, gapAt: 2 },
      },
      { model: `${PLANTS}/Kerala_Grass_Tuft`, at: 0.19, z: -7.2, h: 0.85 },
      { model: `${PLANTS}/Kerala_Fern`, at: 0.2, z: -9.4, h: 0.75 },
      { model: `${PLANTS}/Kerala_Grass_Tuft`, at: 0.68, z: -7.6, h: 0.9 },
      { model: `${UTIL}/Washing_Stone`, at: 0.52, z: -12, h: 0.5, clear: 2 },
      // A FOOTPATH INTO THE PROPERTY, in stepping stones. There is no path
      // asset and painting one into the terrain would fight the road, but a
      // line of stones going back off the verge is how a Kerala smallholding
      // is actually entered — and it reads as somebody's way in rather than
      // as scattered rock because it is straight.
      { model: "village-stone/Stepping_Stone", at: 0.44, z: -8, h: 0.24 },
      { model: "village-stone/Stepping_Stone", at: 0.45, z: -10.5, h: 0.24 },
      { model: "village-stone/Stepping_Stone", at: 0.46, z: -13, h: 0.24 },
      { model: "village-stone/Stepping_Stone", at: 0.47, z: -15.5, h: 0.24 },
      // Leaf litter and fallen fronds, which is what an orchard floor IS.
      { model: "village-stone/River_Stone", at: 0.62, z: -9.5, h: 0.2 },
      { model: "village-stone/Mossy_Stone", at: 0.34, z: -11, h: 0.35 },
    ],
    herd: [],
    folk: ["FarmerWoman"],
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
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.62,
        z: -12,
        h: 2.1,
        clear: 5,
        run: { count: 6, step: 5.47, gapAt: 3 },
      },
      { model: `${PLANTS}/Kerala_Grass_Tuft`, at: 0.72, z: -11, h: 0.95 },
      { model: `${PLANTS}/Kerala_Fern`, at: 0.73, z: -13.2, h: 0.8 },
      {
        model: `${UTIL}/Cattle_Tether_Post`,
        at: 0.3,
        z: -10,
        h: 1.5,
        clear: 2,
      },
    ],
    herd: ["Cow"],
    folk: ["FarmerWoman"],
    // THE THRESHOLD. Not the corridor — but one faint thing near the far
    // end, so Lesson 5 is arrived at rather than switched on.
    corridor: false,
    trace: { count: 1, span: [0.82, 0.96] },
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
      // The garden walls between the houses — short, because the village
      // centre has to stay breathable and a long wall here would turn a row
      // of homes into a street frontage. Still a run with a gate, because
      // the rule is the rule: a boundary is continuous or it is litter.
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.7,
        z: -13,
        h: 2.1,
        clear: 5,
        run: { count: 4, step: 5.47, gapAt: 1 },
      },
      { model: `${PLANTS}/Kerala_Grass_Tuft`, at: 0.73, z: -12, h: 0.95 },
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
    folk: ["Headman", "VillageBoy"],
    corridor: true,
    trace: { count: 3, span: [0.15, 0.9] },
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
      // THE LONGEST BOUNDARY IN THE CHAPTER, which is what says "wealthier
      // family" more than the size of the house does. Twelve panels, and one
      // gate — a prosperous compound has a proper way in rather than a
      // stretch that simply stops.
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.1,
        z: -10,
        h: 2.4,
        clear: 5,
        run: { count: 12, step: 6.25, gapAt: 5 },
      },
      { model: `${PLANTS}/Kerala_Grass_Tuft`, at: 0.33, z: -9, h: 1 },
      { model: `${PLANTS}/Kerala_Fern`, at: 0.34, z: -11.3, h: 0.85 },
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
    folk: ["Headman"],
    corridor: true,
    trace: { count: 3, span: [0.12, 0.92] },
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
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.72, z: -16, h: 16 },
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
    folk: ["TeaStall", "Headman"],
    corridor: true,
    // The strongest in the chapter.
    trace: { count: 4, span: [0.1, 0.94] },
  },
  {
    n: 8,
    name: "Into Grazing Land",
    from: 7,
    to: 8,
    // Decompression. Mature trees over open grass — not empty, because this
    // is still land that belongs to a village economy, but the sightlines
    // come back after the market.
    canopy: [`${PLANTS}/Mango_Tree`],
    // "Small palms", which the arecanut is — slender and short beside the
    // palmyra, and the difference between the two reads as grazing land
    // rather than plantation.
    mid: [`${PLANTS}/Arecanut_Palm`, `${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.5,
    depth: [10, 28],
    props: [
      // Fragments, not a boundary: the wall is a leftover out here.
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.46, z: -18, h: 17 },
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.8, z: -15, h: 15.5 },
      // Fragments, not a boundary: three panels and a hole, the remains of
      // something that enclosed a field long ago.
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.2,
        z: -14,
        h: 2.0,
        clear: 5,
        run: { count: 4, step: 5.21, gapAt: 1 },
      },
      {
        model: "village-stone/Granite_Boulder",
        at: 0.6,
        z: -12,
        h: 1.4,
        clear: 2,
      },
    ],
    herd: ["Buffalo", "Cow", "Cow_Calf"],
    folk: [],
    corridor: false,
    // One leftover suggestion near the start, then nothing for the rest of
    // the chapter. It is what makes the corridor read as something the road
    // came OUT of rather than a zone that ended at a stone.
    trace: { count: 1, span: [0.05, 0.18] },
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
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.58, z: -19, h: 16.5 },
      {
        model: `${UTIL}/Cattle_Tether_Post`,
        at: 0.36,
        z: -13,
        h: 1.5,
        clear: 2,
      },
    ],
    herd: ["Cow", "Cow_Calf", "Buffalo"],
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
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.34, z: -17, h: 16 },
      { model: "village-stone/Mossy_Stone", at: 0.45, z: -8, h: 0.9 },
      { model: "village-stone/Laterite_Rock", at: 0.8, z: -9.5, h: 0.7 },
    ],
    herd: ["Buffalo"],
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
      const x0 = from + p.at * len;
      if (p.run == null) {
        out.push({ ...p, x: x0 });
        continue;
      }
      // CLAMPED TO ITS OWN LESSON, and this is not a detail.
      //
      // A run is written in world units and a lesson is not the same length
      // for every child: Lesson 6's estate boundary is twelve panels at 6.25,
      // which is 69 units of wall, and a five-year-old's whole lesson is
      // 21.6. Unclamped it ran straight through the market and out into the
      // grazing land — one lesson's wall arriving in three others.
      //
      // So the run stops at the stone. The youngest get a shorter boundary
      // than the oldest, which is correct: it is a shorter lesson, and a
      // wall that fits the field it encloses is the point of it.
      const end = from + len;
      for (let i = 0; i < p.run.count; i++) {
        if (i === p.run.gapAt) {
          continue; // the way in
        }
        const x = x0 + i * p.run.step;
        if (x >= end) {
          break;
        }
        out.push({ ...p, run: undefined, x });
      }
    }
  }
  return out;
}
