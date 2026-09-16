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
export type Activity = "day" | "evening" | "dawn" | "deep";

export function activityAt(hour: number): Activity {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 22 || h < 4) return "deep";
  // DAWN IS ITS OWN STATE, and leaving it out was a real hole: the brief
  // ends deep night at four, and everything after four was therefore "normal
  // village life" — so a child playing at half past four in the morning met
  // a road as busy as noon. A village at that hour is not asleep, but it is
  // not up either: it is one or two people with somewhere to be.
  if (h < 7) return "dawn";
  if (h >= 19) return "evening";
  return "day";
}

/**
 * ARE THE VILLAGE CHILDREN OUT?
 *
 * Between six in the evening and seven in the morning they are not. Adults
 * keep their own hours — a tea seller closes late, a headman walks home in
 * the dark, somebody is always about — but a child on a village road at
 * nine at night is the one thing that would read as wrong to anybody who has
 * been in one, and it reads as wrong to a child playing at nine at night
 * too.
 *
 * Kept separate from `Activity` on purpose. The hours do not line up with
 * the brief's three windows — six in the evening is still "day" by those,
 * and seven in the morning is "dawn" — because this is a different rule
 * about a different thing: not how busy the road is, but who is allowed to
 * be on it.
 */
export function childrenOut(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= 7 && h < 18;
}

/**
 * IS IT LATE ENOUGH FOR THE TIRED WALKS?
 *
 * The headman's limp and the tea seller's unsteady walk are END-OF-DAY
 * gaits: a man stiff on the way home from the temple, another closing up
 * after a long one. They say something because of WHEN they happen. Played
 * in the middle of the afternoon they stop meaning "late" and start meaning
 * "this man is lame" and "this man is drunk at two o'clock", which is a
 * different thing to say about somebody and not one this village is saying.
 *
 * Six in the evening until four in the morning. It is a clock rule and not a
 * `nightNow` one on purpose: a child who toggles night at midday is asking
 * to see the dark, not to be told the headman is injured.
 */
export function tiredWalkAt(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= 18 || h < 4;
}

/** Which of the cast are children, by model name. */
export function isChild(model: string): boolean {
  return model === "VillageBoy";
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
  // Evening and dawn are the same shape from the road's point of view — a
  // few people with somewhere to be — and the brief treats the winding-down
  // and the waking-up as the same reduced state.
  if (a === "evening" || a === "dawn") {
    return l.n === 5 || l.n === 7 ? 1 : 0;
  }
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
   * `aspect` IS THE MODEL'S OWN WIDTH-TO-HEIGHT RATIO, and the spacing is
   * worked out from it rather than written down. Measured: 1.75 for the
   * bamboo fence, 2.61 for the laterite wall.
   *
   * It has to be derived, because a panel is not drawn at the height the
   * table asks for. `stand` scales every prop by `perspective(z)` to fake
   * depth under an orthographic camera, so a fence written as 2.4 tall at
   * z = -8 is drawn at 2.13 and is therefore 3.73 wide, not 4.20. Spacing
   * them by the nominal width left half a unit of daylight between every
   * pair — a fence you can see through, which is not a fence.
   *
   * A fraction of the segment cannot do this job either: a lesson is 21.6
   * units for a five-year-old and 64 for an eleven-year-old, so one fraction
   * would overlap the panels for one child and part them for another.
   */
  readonly run?: {
    readonly count: number;
    readonly aspect: number;
    /** Which panel is missing. The way in. */
    readonly gapAt: number;
  };
  /**
   * Grass and ferns at its foot.
   *
   * Nothing is mown at the base of a fence and nothing walks there, so it is
   * where the ground cover gets away — and a post meeting bare earth along a
   * dead straight line is the clearest sign in any scene that an object was
   * placed rather than built. The skirt settles a boundary INTO its ground.
   */
  readonly skirt?: boolean;
  /**
   * Raised, or — negative — SUNK into the ground.
   *
   * For the banyan, which grows out of a stone platform, and for the one
   * animal on this road that is lying down. There is no lying-down clip in
   * any file we have, and a cow settled in the dust is mostly body: the legs
   * are folded under it and invisible. Sinking a standing cow until its legs
   * are in the earth leaves exactly that silhouette, and this camera never
   * sees beneath anything.
   *
   * It is a trick, and it is the same one the loose stones already use —
   * they are part-buried so the soil reads as having come up around them.
   * If a real resting clip ever arrives, this entry is the only thing that
   * has to change.
   */
  readonly lift?: number;
};

export type Lesson = {
  readonly n: number;
  /**
   * TWO WORDS AT MOST.
   *
   * This is read off a scoreboard chip beside the score and the streak, at
   * the size those are — not off a contents page. "The Mixed Orchard Belt"
   * wraps to three lines there and pushes the chips beside it out of the
   * row, and a six-year-old halfway through a word is not reading a subtitle
   * anyway. The description of a lesson belongs in this file; what the child
   * needs is the name of the place they are in.
   */
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
  /**
   * HOW THAT DENSITY IS SPLIT BETWEEN THE THREE LAYERS: canopy, middle,
   * ground.
   *
   * Density alone cannot say what a lesson looks like. An orchard and a fern
   * meadow can hold the same number of plants per unit of road and be
   * nothing alike, because the orchard's are overhead and the meadow's are
   * underfoot — the document describes every lesson in exactly these terms
   * ("upper layer... middle layer... lower layer" for the orchard; "grass
   * and ferns dominate" for the meadow; "only a few scattered trees" for the
   * open edge) and one fixed split across all ten threw all of it away.
   *
   * These weights are read straight off the brief's own sentences. Lesson 3
   * is the only one with three full layers; Lesson 10 is almost entirely
   * ground; the pasture has a handful of shade trees over open grass.
   */
  readonly mix: readonly [number, number, number];
  /** How far back the planting reaches. The near verge is left clear. */
  readonly depth: readonly [number, number];
  /** Fixed structures, in segment-relative coordinates. */
  readonly props: readonly Placed[];
  /**
   * Grazing animals, by model. Placed on the open ground, away from props.
   *
   * NO CALVES HERE. A calf is not an animal that turns up on its own — it is
   * a cow's calf, and one grazing by itself in an empty field reads as a lost
   * animal rather than as a herd. So the list names cows, and the placement
   * puts a calf beside one: it is a consequence of a cow, not a draw of its
   * own, which is also the only way to guarantee there is a mother in the
   * frame with it.
   */
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

/**
 * EVERY LIST IS A FLAT DRAW, so its length IS the rarity of each plant in it.
 *
 * A layer with two species gives each of them half the trees in the lesson,
 * which is how a papaya — a plant you see one or two of in a yard — ended up
 * as every second tree on the road. There is no weighting here on purpose: a
 * weight table is a second thing to keep in step with the list, and the same
 * effect comes free from writing down everything that actually grows in that
 * layer. So the lists are long where the planting is mixed and short where a
 * lesson is meant to be dominated by one thing.
 */
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
    name: "Village Edge",
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
    // FEW TREES, BUT NOT ALL THE SAME TREE. "Keep tree density light" is
    // about how many stand here, not about how alike they are — and a
    // handful of identical palms reads as a copied object far more loudly
    // than a crowd of them would.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Tamarind_Tree`],
    // "A few low shrubs" — two kinds of them, for the same reason.
    mid: [`${PLANTS}/Hibiscus_Chemparathi`, `${PLANTS}/Drumstick_Muringa`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.1,
    // "only a few scattered trees; keep tree density light" — open ground carries this lesson.
    mix: [0.18, 0.17, 0.65],
    depth: [8, 24],
    props: [
      // A PALMYRA, AND ONE OF IT. Twenty-five to twenty-eight units, which
      // is seventy real feet at the chapter's own scale — four adults on top
      // of one another, and more than twice the ridge of a house. It stands above everything else on a
      // Kerala roadside and is the tree you navigate by — a job exactly one
      // tree can hold. Drawn from the canopy list it came up as often as the
      // coconuts did, and a landmark repeated thirty times is a plantation.
      // So it is PLACED, and at a height nothing else here reaches: 16
      // against the canopy's 6.5 to 11, because being the tallest thing in
      // the frame is the whole of what it does.
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.62, z: -15, h: 26 },
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
    name: "Farmland",
    from: 1,
    to: 2,
    // The edge turning into productive family land: useful trees rather than
    // scenery, and the first laterite showing through.
    canopy: [
      `${PLANTS}/Coconut_Palm`,
      `${PLANTS}/Mango_Tree`,
      `${PLANTS}/Tamarind_Tree`,
      `${PLANTS}/Papaya_Tree`,
    ],
    mid: [
      `${PLANTS}/Banana_Plant`,
      `${PLANTS}/Drumstick_Muringa`,
      `${PLANTS}/Hibiscus_Chemparathi`,
    ],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Taro_Chembu`],
    density: 1.9,
    // "gradually framed by useful trees and domestic vegetation" — the middle layer arrives.
    mix: [0.28, 0.3, 0.42],
    depth: [7, 26],
    props: [
      // Broken and partial, never a run: the wall is a hint of enclosure
      // here, and becomes a real boundary by Lesson 6.
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.2, z: -17, h: 25 },
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.9, z: -14, h: 27 },
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
        run: { count: 5, aspect: 2.61, gapAt: 2 },
        skirt: true,
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
    herd: ["Cow", "Buffalo"],
    folk: ["FarmerWoman"],
    corridor: false,
  },
  {
    n: 3,
    name: "The Orchard",
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
      `${PLANTS}/Hibiscus_Chemparathi`,
      `${PLANTS}/Papaya_Tree`,
    ],
    ground: [
      `${PLANTS}/Tapioca_Cassava`,
      `${PLANTS}/Taro_Chembu`,
      `${PLANTS}/Kerala_Fern`,
    ],
    density: 3.4,
    // the only lesson with three FULL layers, which is what the brief spells out for it.
    mix: [0.34, 0.3, 0.36],
    depth: [6, 30],
    props: [
      // In stretches, not as an unbroken wall the whole way — the brief is
      // explicit, and a continuous fence would also hide the orchard it is
      // supposed to enclose.
      // ONE FENCE, PANEL TO PANEL, WITH ONE WAY IN.
      //
      // This was two runs with a gate each and a stretch of nothing between
      // them, on the reading that the brief's "selected stretches" meant
      // several short fences. It does not: a smallholding is enclosed, and a
      // boundary that stops and starts again is not enclosing anything. What
      // "in stretches" rules out is fencing the WHOLE lesson — so it is one
      // continuous run along the orchard's frontage, and open ground either
      // side of it.
      //
      // Sixteen panels and a single gap, which is the entrance.
      {
        model: `${UTIL}/Bamboo_Fence`,
        at: 0.16,
        z: -8,
        h: 2.4,
        clear: 4,
        run: { count: 16, aspect: 1.75, gapAt: 6 },
        skirt: true,
      },
      { model: `${PLANTS}/Kerala_Grass_Tuft`, at: 0.42, z: -7.1, h: 0.85 },
      { model: `${PLANTS}/Kerala_Fern`, at: 0.44, z: -9.4, h: 0.75 },
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
    name: "The Homestead",
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
    mid: [
      `${PLANTS}/Hibiscus_Chemparathi`,
      `${PLANTS}/Banana_Plant`,
      `${PLANTS}/Drumstick_Muringa`,
    ],
    ground: [`${PLANTS}/Taro_Chembu`, `${PLANTS}/Kerala_Fern`],
    density: 2.4,
    // "fewer tightly packed palms and more large mature trees", undergrowth retained.
    mix: [0.32, 0.2, 0.48],
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
        run: { count: 6, aspect: 2.61, gapAt: 3 },
        skirt: true,
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
    name: "Village Centre",
    from: 4,
    to: 5,
    // Rural and breathable, not a town: the planting stays heavy between the
    // buildings on purpose, because what stops a cluster of houses reading as
    // a street is the garden between them.
    canopy: [
      `${PLANTS}/Coconut_Palm`,
      `${PLANTS}/Mango_Tree`,
      `${PLANTS}/Jackfruit_Tree`,
    ],
    mid: [
      `${PLANTS}/Banana_Plant`,
      `${PLANTS}/Hibiscus_Chemparathi`,
      `${PLANTS}/Drumstick_Muringa`,
    ],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Taro_Chembu`],
    density: 1.6,
    // "leave room between buildings for plants, gardens and side paths".
    mix: [0.22, 0.28, 0.5],
    depth: [9, 26],
    props: [
      // The banyan is the social focus and the temple is glimpsed past its
      // trunk, never behind it — the tree stands BESIDE the shrine.
      // NOT THE BANYAN. It is placed by the village's own `heart` table with
      // the althara under it, and the chapter skips lesson 5's props for
      // exactly that reason — so an entry here was never built and only read
      // as though the tree were configured in two places at once.
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
        run: { count: 4, aspect: 2.61, gapAt: 1 },
        skirt: true,
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
    name: "The Estate",
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
    mid: [
      `${PLANTS}/Banana_Plant`,
      `${PLANTS}/Drumstick_Muringa`,
      `${PLANTS}/Hibiscus_Chemparathi`,
      `${PLANTS}/Papaya_Tree`,
    ],
    ground: [`${PLANTS}/Tapioca_Cassava`, `${PLANTS}/Kerala_Fern`],
    density: 2.9,
    // Lesson 3 again but prosperous — the same orchard shape.
    mix: [0.32, 0.28, 0.4],
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
        run: { count: 12, aspect: 2.61, gapAt: 5 },
        skirt: true,
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
    name: "The Market",
    from: 6,
    to: 7,
    // The social peak, framed by bamboo before and after.
    //
    // THE MARKET IS A PLACEHOLDER, AND IT IS IN.
    //
    // The shipped model is four and a third times wider than it is tall, and
    // so is the only other one in any vault — measured, both of them, rather
    // than assumed: 4.34 and 4.21. Sized honestly against the child it
    // stretches across most of the road, which is why it was pulled in the
    // first place.
    //
    // It goes back anyway, because an empty market road is a worse lie than
    // a rough market. This lesson is the social peak of the chapter — the
    // busiest thing a child meets on this road — and with nothing in it the
    // segment reads as another orchard with a well. A stand-in says "a
    // market belongs here" and is replaced by one asset swap; a hole says
    // nothing and quietly re-authors the lesson.
    //
    // Kept SHORT rather than honest, at 6 against the houses' 11, because
    // the distortion is in the ratio: the shorter it is drawn the less road
    // it spans, and a low market frontage set back off the verge is a fair
    // reading of the thing anyway. Set well back so its width is read as
    // depth rather than as a wall along the carriageway.
    //
    // The shipped ak-3d-pack copy is used rather than the other, which is
    // the same shape at 31,485 triangles against 5,638.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Tamarind_Tree`],
    mid: [`${PLANTS}/Banana_Plant`, `${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.4,
    // "orchard remnants": what is left of a canopy, not a canopy.
    mix: [0.2, 0.22, 0.58],
    depth: [9, 24],
    props: [
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.72, z: -16, h: 26 },
      // BAMBOO GROWS. At 7 it was a shrub — waist-high on the headman, which
      // is a hedge, not a grove. A clump of Kerala bamboo runs forty feet and
      // arches over whatever is beneath it, and the reason the brief frames
      // this lesson with it is that it makes a GATE of the market road: you
      // pass through something to arrive. 18 is forty feet at the chapter's
      // own scale, the same ruler the trees use, and taller than any of them
      // bar the palmyra.
      { model: "nature/KeralaBambooGroves", at: 0.05, z: -11, h: 18, clear: 5 },
      // PLACEHOLDER — see the note above. Swap the model here when the real
      // one is ready; nothing else in the lesson depends on it.
      //
      // Built from the 25 MB master in two steps — the back thrown away
      // first, then the rest reduced:
      //
      //   node scripts/glb-cull-back.mjs \
      //     "3D ASSETS/Village assets/Market/Village_Market_Row_master.glb" \
      //     /tmp/culled.glb
      //   node scripts/village-prop.mjs /tmp/culled.glb \
      //     root/public/kids-assets/models/village-util/Village_Market.glb \
      //     --tex 2048 --tris 24000
      //
      // THE BACK IS CUT BEFORE ANYTHING ELSE, and the bytes are the small
      // reason. This building is seen from a fixed orthographic camera
      // yawed twelve degrees: it shows one face and a little of one end, for
      // the life of the chapter. 27 per cent of its triangles point away
      // from the road — and meshopt has no idea which side is which, so at a
      // 7,000-triangle target it was spending about 1,800 of them on a wall
      // nobody will ever see. Cut first, the whole budget goes on the face
      // you look at.
      //
      // The master also carries a 4096 metallic-roughness worth nine of its
      // megabytes, to say "not metal, fairly rough" — two numbers. Dropping
      // it pays for a 2048 baseColor, so the side that faces the road gets
      // twice the texel density of the copy this replaces.
      //
      // NO `--sloppy`, AND THAT IS THE WHOLE DIFFERENCE. The topology-blind
      // simplifier will hit any triangle target you name, which is why it
      // was reached for — but it hits them by ignoring connectivity, and a
      // baked prop's detail IS its connectivity: the shop fronts, the
      // shutters and the signboards are shallow geometry carrying a
      // photographic texture, and collapsing across their UV seams smears
      // the texture over the shapes. It reported 1.1 per cent error and
      // looked like a melted building, because the error metric measures
      // distance from the original SURFACE and has nothing to say about
      // what happened to the surface's texture.
      //
      // The seam-aware simplifier will not cross a seam, so it cannot smear.
      // It plateaus at about 23,400 triangles on this mesh however low the
      // target — that plateau IS the model's real detail, the point past
      // which nothing can go without breaking something — and at 24,000 it
      // keeps the signage legible. That costs 1.83 MB against 0.88, which is
      // the right trade for the one building this lesson is named after.
      //
      // The lesson: `--sloppy` is for silhouettes seen at distance, and this
      // is read at twenty units.
      //
      // What is NOT kept is the master's normal map. Nothing here is lit
      // sharply enough for it to show — the texture is a baked one and the
      // prop is thirty units away — and it would cost more than the
      // resolution bump that does show.
      // AT THE ROADSIDE, AND BIG. Set back at -17 and drawn 6 tall it was a
      // shed in a field; a village market is the one building that is not
      // set back, because trading happens off the road itself and a stall
      // nobody can reach from it is not a stall.
      //
      // 11 matches the houses' ridge, which makes it a proper building
      // rather than an outhouse, and at this model's 4.2:1 that is a
      // forty-six unit frontage — a market ROW, which is what the file is
      // called and what a Kerala market actually is: a line of stalls along
      // the road, not a hall. Its width finally works FOR it.
      //
      // The clearance grows with it, so the planting keeps out of the
      // trading ground instead of sprouting between the stalls.
      // AFTER THE BAMBOO, AND BIGGER. The bamboo at 0.1 is the gate of this
      // lesson — you pass through it to arrive — so the market has to be on
      // the far side of it rather than level with it, or there is nothing to
      // arrive AT. 0.46 puts a clear stretch of road between the two.
      //
      // 13 rather than 11, which at this model's 4.27:1 is a 55-unit
      // frontage: longer than the houses' compounds and the biggest thing a
      // child meets on the whole road, which is what the social peak of the
      // chapter should be.
      //
      // AND NOTHING GROWS THROUGH IT. `clear` is a radius and the building
      // is 55 units wide, so 22 left its two ends unprotected — trees were
      // seeding inside the end stalls, because the blocker simply did not
      // reach them. 30 covers the frontage and a margin, which is also the
      // trading ground a market needs in front of it.
      // 0.6, NOT 0.46. A 55-unit frontage centred at 0.46 has its left end
      // back at about 0.1 of the segment — which is where the bamboo stands,
      // so the market was growing out of the grove that is supposed to frame
      // it. The centre has to clear the bamboo by HALF THE BUILDING, not by
      // a comfortable-looking gap, and that is what the extra distance buys.
      //
      // 15.5, which at 4.27:1 is a 66-unit frontage. The largest thing on
      // this road by a wide margin, and by now deliberately so: it is the
      // social peak of the chapter and the only building a child meets that
      // is bigger than a house. Its clearance and its bare yard are both
      // derived from it, so they grew with it and nothing had to be chased.
      //
      // Nudged to 0.62 with the extra length, for the same reason as before:
      // the centre must clear the bamboo by HALF the building.
      // BEHIND THE MILESTONE LINE, not across it. `stand` centres a prop on
      // the z it is given, and this building is about sixteen units deep at
      // this height — so a centre of -12 put its FRONT FACE at roughly -4,
      // which is nearly on the carriageway and a good way in front of the
      // milestones, which stand around -7.5. The market was standing forward
      // of the line every other thing on this road respects.
      //
      // -16.5 puts the frontage just behind the stones: the milestone is met
      // first, the shops open behind it, and the trodden ground between them
      // is the width of a village street.
      // 0.56, with the gate bamboo pulled back to 0.05 to make room for it.
      // There was a stretch of empty road between the two that read as a gap
      // in the lesson rather than as an approach — the market is what this
      // segment is for, and the walk to it should be short. Moving BOTH is
      // what keeps the half-a-building of clearance the bamboo needs: the
      // market could not come left on its own without growing out of the
      // grove again.
      {
        model: `${UTIL}/Village_Market`,
        at: 0.56,
        // 17.5 tall, which at 4.27:1 is a 75-unit frontage. Its DEPTH grows
        // with it — about eighteen units now — so the centre goes back to
        // -18 to keep the front face where it belongs, just behind the
        // milestone line. Deepening a building without moving its centre
        // walks the shop fronts out onto the road, which is the mistake this
        // placement already made once.
        z: -18,
        h: 17.5,
        clear: 40,
      },
      // A COW LYING IN FRONT OF THE MARKET, by the bamboo. Cattle settle
      // exactly here in a Kerala market town — in the shade, on the bare
      // ground, out of the way of the stalls but not out of the way of
      // anybody — and an animal at REST is the clearest thing you can put in
      // a busy place to say it is an ordinary afternoon rather than a set.
      //
      // Placed as a prop rather than as livestock on purpose: the herd code
      // would give it a grazing loop and walk it away from the buffalo,
      // which is the opposite of lying down.
      {
        model: "village-folk/Cow",
        // Between the gate grove and the well, and broadside to the road so
        // its whole length reads rather than its nose.
        at: 0.14,
        z: -9.5,
        h: 5.2,
        // ON THE GROUND, NOT IN IT. The sinking trick is abandoned: it was
        // a way to fake a resting cow without a resting clip, and it does
        // not work. At 2.3 only the back showed, at 1.7 it was a shape in
        // the earth, at 1.1 the legs were still half buried — because the
        // thing that says "lying down" is the FOLD of the legs, and no
        // amount of hiding them supplies it. Hiding a leg reads as a hole,
        // not as a knee.
        //
        // So it stands, which is at least true, and it stands where a cow
        // stands in a market town: on the bare ground outside the stalls, in
        // everybody's way and nobody's. A resting animal here needs a
        // resting clip, and that is an animation job rather than a placement
        // one — the buffalo has thirteen clips and not one of them is lying
        // down either.
        lift: 0,
        turn: 1.45,
        clear: 3,
      },
      // BETWEEN THE BAMBOO AND THE MARKET, which is where a village well
      // belongs on a trade road: the traders draw from it and so does
      // anyone walking in, so it sits on the way rather than behind the
      // stalls. It also gives the stretch between the gate and the shops
      // something to be, rather than being the gap before the market.
      // 3.6, NOT 2.2. A village well is a waist-high parapet a grown woman
      // draws from with a rope — against a headman standing 6.37 it was
      // knee-high, which is a garden feature rather than the thing the whole
      // stretch of road exists around. Its clearance grows with it, so
      // nothing plants itself in the drawing space.
      // A QUARTER TURN, bringing its right-hand side round to face the
      // road. A well is not symmetrical — the winch, the post and the rope
      // are all on one side of it — and which side is showing is the
      // difference between a well and a ring of stones.
      {
        model: `${UTIL}/Village_Well`,
        at: 0.3,
        z: -12,
        h: 3.6,
        turn: -Math.PI / 2,
        clear: 6,
      },
      {
        model: `${UTIL}/Village_Cart`,
        at: 0.56,
        z: -10,
        h: 2.6,
        turn: 1.9,
        clear: 4,
      },
      { model: `${UTIL}/Petromax_Lamp`, at: 0.5, z: -10.5, h: 1.2 },
      // THE CLOSING GROVE, PAST THE STONE. At 0.88 it was inside the market:
      // a 66-unit frontage centred at 0.56 reaches from 0.23 to 0.89 of the
      // segment, so the bamboo was coming up through the last two stalls.
      //
      // The arithmetic is worth keeping in mind for anything else placed in
      // this lesson — the market is two thirds of it, and there are only two
      // clear stretches left, before 0.23 and after 0.89.
      //
      // 0.97 puts it past Milestone 7, which is where a closing grove
      // belongs anyway: the pair of them are the gate at each end, and the
      // far one should be the thing you walk out through.
      // 1.06 — PAST THE STONE, not merely near it. The market reaches 0.89
      // of the segment and a bamboo clump is wide: at 0.97 its near edge was
      // still inside the last stall. A fraction over 1.0 is allowed and is
      // what is wanted here, because the closing grove belongs on the far
      // side of Milestone 7 — it is the gate you walk OUT through, and the
      // stone should be met before it rather than through it.
      { model: "nature/KeralaBambooGroves", at: 1.06, z: -13, h: 18, clear: 5 },
    ],
    herd: [],
    folk: ["TeaStall", "Headman"],
    corridor: true,
    // The strongest in the chapter.
    trace: { count: 4, span: [0.1, 0.94] },
  },
  {
    n: 8,
    name: "Grazing Land",
    from: 7,
    to: 8,
    // Decompression. Mature trees over open grass — not empty, because this
    // is still land that belongs to a village economy, but the sightlines
    // come back after the market.
    canopy: [
      `${PLANTS}/Mango_Tree`,
      `${PLANTS}/Tamarind_Tree`,
      `${PLANTS}/Jackfruit_Tree`,
    ],
    // "Small palms", which the arecanut is — slender and short beside the
    // palmyra, and the difference between the two reads as grazing land
    // rather than plantation.
    mid: [`${PLANTS}/Arecanut_Palm`, `${PLANTS}/Hibiscus_Chemparathi`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.5,
    // "a mixture of mature trees, open grass, scattered shrubs" — grass wins.
    mix: [0.22, 0.18, 0.6],
    depth: [10, 28],
    props: [
      // Fragments, not a boundary: the wall is a leftover out here.
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.46, z: -18, h: 28 },
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.8, z: -15, h: 25 },
      // Fragments, not a boundary: three panels and a hole, the remains of
      // something that enclosed a field long ago.
      {
        model: `${UTIL}/Laterite_Wall`,
        at: 0.2,
        z: -14,
        h: 2.0,
        clear: 5,
        run: { count: 4, aspect: 2.61, gapAt: 1 },
        skirt: true,
      },
      {
        model: "village-stone/Granite_Boulder",
        at: 0.6,
        z: -12,
        h: 1.4,
        clear: 2,
      },
    ],
    herd: ["Buffalo", "Cow"],
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
    canopy: [`${PLANTS}/Mango_Tree`, `${PLANTS}/Tamarind_Tree`],
    // Grazing land is grass and scrub, but "a small number of strong
    // elements" is about how MUCH grows here, not about it all being the
    // same plant. Trampled pasture is patchy by nature.
    mid: [`${PLANTS}/Hibiscus_Chemparathi`, `${PLANTS}/Drumstick_Muringa`],
    ground: [`${PLANTS}/Kerala_Grass_Tuft`, `${PLANTS}/Kerala_Fern`],
    density: 1.0,
    // "large areas of grass... a few scattered small trees or shade trees".
    mix: [0.12, 0.16, 0.72],
    depth: [11, 30],
    props: [
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.58, z: -19, h: 27 },
      {
        model: `${UTIL}/Cattle_Tether_Post`,
        at: 0.36,
        z: -13,
        h: 1.5,
        clear: 2,
      },
    ],
    herd: ["Cow", "Buffalo"],
    folk: [],
    corridor: false,
  },
  {
    n: 10,
    name: "Fern Meadow",
    from: 9,
    to: 10,
    // Closure, and a deliberate echo of Lesson 1: the same open language at a
    // calmer end-state, with the buffalo back as a bookend. Trees only at the
    // far edge so the space stays open.
    canopy: [`${PLANTS}/Coconut_Palm`, `${PLANTS}/Mango_Tree`],
    mid: [],
    ground: [`${PLANTS}/Kerala_Fern`, `${PLANTS}/Kerala_Grass_Tuft`],
    density: 1.2,
    // "grass and ferns dominate... only sparse distant trees" — and no middle layer at all, which is why `mid` is empty.
    mix: [0.08, 0.0, 0.92],
    depth: [12, 32],
    props: [
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.34, z: -17, h: 26 },
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
  /**
   * The world's own depth falloff, so a run's spacing matches the width its
   * panels are actually DRAWN at. Defaults to no falloff, which is what a
   * test wants and what a caller with no camera has.
   */
  persp: (z: number) => number = () => 1,
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
        const x = x0 + i * (p.run.aspect * p.h * persp(p.z));
        if (x >= end) {
          break;
        }
        out.push({ ...p, run: undefined, x });
      }
    }
  }
  return out;
}
