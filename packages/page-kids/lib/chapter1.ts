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
 * HOW CLOSE TO A STONE A TALL THING MAY STAND. In world units either side.
 *
 * The milestone carries the lesson number and is how a child knows they
 * have got somewhere, so nothing at head height goes in front of it. The
 * world applies this to everything it rolls — the planting, the herds, the
 * villagers — and `placements` applies it to the runs, which are the one
 * authored thing whose panels land wherever the arithmetic puts them: a
 * fence written to start at 0.16 of a lesson starts two units past the
 * stone on the shortest band and eight on the longest, and a panel two
 * units behind a slab of the same height is a slab you cannot read.
 *
 * Held here rather than in the world because the world imports this file
 * and not the other way round, and one number kept in two places is the
 * number that drifts.
 */
export const MILESTONE_CLEAR = 3.2;

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

/**
 * A DAY IN THE VILLAGE, ALL OF IT, IN ONE PLACE.
 *
 * This replaces a handful of separate rules that grew one at a time and
 * disagreed with each other. Writing them out together makes the mistake
 * behind most of them obvious:
 *
 *   THE SUN DECIDES WHAT IS LIT. THE BRIEF DECIDES WHO IS OUT.
 *
 * They are two different clocks and I had them as one. A lamp was burning at
 * ten in the morning because ten is not past any shop's closing hour — which
 * is true and irrelevant, since nobody lights a lamp in daylight. Opening
 * hours say whether a shop is TRADING; the sun says whether it needs a lamp
 * to trade by. A shop is lit only when both are true.
 *
 * `rise` and `set` come from the world's own solar model rather than from a
 * hardcoded six and eighteen — over Kerala the sun is up from about ten past
 * six to about half past six, and those few minutes are exactly the ones a
 * guess gets wrong.
 *
 * The people keep the brief's windows, which are clock hours because that is
 * how the document states them and because human habits follow the clock
 * rather than the sun: a market closes at nine whatever the season.
 */
export type VillageDay = {
  /** The hour this answer is for, normalised to 0..24. */
  readonly hour: number;
  /** Is it dark enough that a lamp would be lit? */
  readonly dark: boolean;
  readonly activity: Activity;
  /** Are the village children outside? */
  readonly children: boolean;
  /** Are the end-of-day gaits — the limp, the unsteady walk — in season? */
  readonly tired: boolean;
  /** Is a shop with this closing hour trading? */
  readonly trading: (closes: number) => boolean;
  /** Is its lamp burning? Trading AND dark, never one alone. */
  readonly lampLit: (closes: number) => boolean;
};

/** When the shutters go up. Nothing in this village trades before six. */
export const SHOPS_OPEN = 6;

export function villageDay(
  hour: number,
  rise: number,
  set: number,
): VillageDay {
  const h = ((hour % 24) + 24) % 24;
  // A shade before sunset and a shade after sunrise: lamps are lit while
  // there is still some light in the sky and put out once there is enough,
  // which is what anybody does. Lighting them exactly at sunset makes the
  // whole row come on in one frame.
  // Half an hour before sunset and a shade after sunrise. Lamps go up while
  // there is still light in the sky — anybody closing a shop lights one
  // before they need it, not at the moment they do — and go out once there
  // is enough to work by. Lighting them exactly at sunset brings the whole
  // row on in a single frame, which is the one thing that reads as a switch.
  const dark = h < rise + 0.2 || h >= set - 0.5;
  const trading = (closes: number) => h >= SHOPS_OPEN && h < closes;
  return {
    hour: h,
    dark,
    activity: activityAt(h),
    children: childrenOut(h),
    tired: tiredWalkAt(h),
    trading,
    lampLit: (closes: number) => trading(closes) && dark,
  };
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
export function folkOut(l: Lesson, a: Activity, hour?: number): number {
  // EIGHT TO SIX, AND THAT IS A WORKING DAY RATHER THAN DAYLIGHT.
  //
  // `activity` is "day" from seven in the morning until seven at night,
  // which is when the LIGHT is up — and it was being used to decide when
  // people are in their fields, so a farmer stood at her boundary from seven
  // to seven every day without a break. Nobody works dawn to dusk in the
  // field beside the road; they are out after the morning is under way and
  // in before the light goes.
  //
  // The hour is optional so the older two-argument call still answers about
  // an activity in the abstract, which is what the tests ask it.
  if (hour != null) {
    if (hour >= 8 && hour < 18) {
      return l.folk.length;
    }
    // Outside those hours only the two places the brief keeps occupied into
    // the evening have anybody, and only one of them each.
    return a === "evening" && (l.n === 5 || l.n === 7) ? 1 : 0;
  }
  if (a === "day") return l.folk.length;
  // The evening keeps a few out: the brief leaves people at the village
  // centre and the closing market, and a road at eight has somebody on it.
  if (a === "evening") {
    return l.n === 5 || l.n === 7 ? 1 : 0;
  }
  // DAWN IS EMPTY, and this is a correction. It was treated as the evening's
  // mirror — a few people with somewhere to be — and it is not: the evening
  // is a village that has not gone in yet, dawn is one that has not come out.
  // Before sunrise a Kerala village road is nobody, and it is nobody for a
  // reason this chapter cares about: the small hours belong to the
  // Kuttichathan corridor, and people who believe that do not step outside
  // to test it. They wait for light.
  //
  // It is also what the child sees. Night mode at six in the evening stages
  // six in the morning — the fold picks the dark candidate nearest the clock
  // — so "a few villagers about at dawn" arrives as "villagers wandering
  // around in the dark", which is precisely the thing the corridor is
  // supposed to make impossible.
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
    /** Keep a real gate even when only three boundary slots fit. */
    readonly keepGate?: boolean;
    /**
     * WHAT STANDS IN THE GAP, if anything. A farm boundary's way in is a
     * hole; an estate's is a gate, and that difference is most of what
     * tells a child whose land this is.
     *
     * It has to be declared HERE rather than placed as its own prop,
     * because `at` is a fraction of the lesson and a panel is a number of
     * world units — and a lesson is 21.6 units for a five-year-old and 64
     * for an eleven-year-old. There is no single fraction that lands on
     * the gap for every band. Inside the run it needs no fraction at all:
     * it is put at the slot the gap left, in whatever band, and the clamp
     * that moves the gap on a short lesson moves the gate with it.
     */
    readonly gate?: {
      readonly model: string;
      /** Its own height — gateposts stand taller than the wall they end. */
      readonly h: number;
    };
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
  /**
   * A LAMP THAT IS LIT AFTER DARK, until this hour.
   *
   * The two pressure lanterns the table places — one on the estate's wall,
   * one in the market's forecourt — were models and nothing more: the
   * market's shop-front lamps glow after sunset and go out one by one at
   * their shops' closing hours, and the two standing a few units from
   * them stayed dark all night. A lamp that never lights is a prop; a
   * lamp that lights is somebody's. The hour is when its owner puts it
   * out — the same clock the shop lamps keep, so a child who has watched
   * the market shut sees the forecourt lamp go with it.
   */
  readonly lit?: number;
  /**
   * WHERE THE FLAME SITS, as a fraction of the prop's own height.
   *
   * Defaults to 0.45, which is right for a hurricane lamp hung on a post and
   * wrong for anything whose light is at the top. A nilavilakku is a stem
   * with an oil bowl on it: its flame is at 0.88 and putting it at 0.45 lit
   * the middle of the stem, which is a lamp glowing out of its own leg.
   */
  readonly litUp?: number;
  /**
   * WHAT KIND OF LIGHT. "petromax" is a pressure mantle — near-white, and
   * STEADY, which is the tell that separates it from fire across a dark
   * field. "oil" is a wick: warmer, smaller, and never still.
   *
   * Defaults to petromax because the two props that had `lit` before this
   * existed are both petromax lamps and should not change.
   */
  readonly litKind?: "oil" | "petromax";
  /**
   * A BUILDING: something wide enough that a circle is the wrong shape for
   * it, and big enough that it may not fit the lesson it is written in.
   *
   * `w` and `d` are the model's own width-to-height and depth-to-height
   * ratios, measured off the file the way `run.aspect` is. With them the
   * table knows how much road a thing will actually take up before a
   * single byte of it has loaded, and three things follow:
   *
   *   1. IT IS BLOCKED AS ITS FOOTPRINT, not as a disc. The market is
   *      fifty-seven units wide and fourteen deep; a circle round it is
   *      forty units in radius and reaches across the road, so for the
   *      whole length of the market nothing could be placed on the verge,
   *      in the forecourt, or in the two lessons either side of it — the
   *      social peak of the chapter had no people in it, on any band,
   *      because they were being refused room by a building sixteen units
   *      behind them. `clear` becomes the MARGIN round the footprint.
   *
   *   2. `span` CAPS ITS FRONTAGE to a fraction of the lesson. A lesson is
   *      21.6 units for a five-year-old and 64 for an eleven-year-old and
   *      the building is the same size for both, so a market authored on
   *      the long road straddled two milestones and both neighbouring
   *      lessons on the short one, with the estate's house standing inside
   *      its left end. The height comes down until the frontage fits, and
   *      everything derived from it — the depth, the clearance — comes
   *      down with it. On the long bands nothing changes, because the
   *      building already fits.
   *
   *   3. THE FRONT FACE STAYS PUT when the height comes down. `stand`
   *      centres a model on the z it is given, so a shallower building
   *      with the same centre has its front face further from the road;
   *      the fitted placement moves the centre forward to keep the face
   *      where the authored numbers put it, which is the line every other
   *      thing on the road is arranged against.
   */
  readonly box?: {
    readonly w: number;
    readonly d: number;
    /** Fit repeated buildings at one depth so distant copies still shrink. */
    readonly referenceZ?: number;
    /**
     * The most of its lesson this building may cover. MAY EXCEED 1.
     *
     * It is a brake on the fit rather than the target — see `want`. A
     * village does not get smaller because the child walking through it is
     * five, so the size a building WANTS is a number of world units; this
     * only stops a short lesson's building running the length of the
     * chapter.
     */
    readonly span?: number;
    /**
     * HOW BIG THIS BUILDING IS, IN WORLD UNITS, when the road has room.
     *
     * Without this the market was fitted to its lesson and nothing else,
     * and a lesson is as long as the child's typing: 64 units for an
     * eleven-year-old and 28.8 for a five-year-old. So the youngest child
     * — the one least able to read a distant building — got a market with
     * 24.8 units of frontage where the oldest got 55, and the village's
     * centrepiece was drawn at under half size for the people who needed it
     * biggest. It is the same market in the same village; only the road
     * through it is shorter.
     *
     * A building this wide CANNOT fit a 28.8-unit lesson, so honouring it
     * means letting the frontage cross a milestone. That is a real building
     * standing on a real road: the stones are markers along the way, not
     * property lines, and the reference frames show the market rising
     * behind one rather than stopping at it.
     */
    readonly want?: number;
  };
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
  /**
   * CANOPY SHADE ON THE GROUND, 0..1 — the road included.
   *
   * Real tree shadows cannot be relied on for this. The sun over this road is
   * the real one, and for much of the day it is nearly overhead: a tree at
   * the verge throws a pool round its own trunk and the thirteen-unit cart
   * road stays in full sun. A forest that is meant to be SHADY has to be
   * shady at noon, so the shade is painted into the ground itself — dark
   * under the leaves, broken by flecks of sun — and it bleeds across the
   * milestones like every other property of a lesson.
   */
  readonly shade?: number;
  /**
   * WORN SIDE TRACKS across the grass behind the road — cattle paths and
   * short cuts, the thing that makes open country look walked rather than
   * mown. How many leave the road in this lesson; each one peels off the
   * far verge and wanders back into the field. Drawn in the road's own bare
   * earth, so a track is the same ground as the road it came from.
   */
  readonly tracks?: number;
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
   * HOW FAR BACK FROM THE ROAD THEY STAND, in units behind the carriageway.
   *
   * The rule for a farmer is "behind the boundary, in her own plot" — the
   * fences and walls sit around 8 to 14 units back, so people stand from
   * 14 to 24. That is right for every lesson but one: a market's people are
   * AT the stalls, on the trodden ground between the road and the shop
   * fronts, and put fourteen units back they were being asked to stand
   * inside the building. The default is the plot; the market names its
   * forecourt.
   */
  readonly folkDepth?: readonly [number, number];
  /**
   * VILLAGERS WHO STAND SOMEWHERE IN PARTICULAR, rather than anywhere in
   * the plot.
   *
   * `folk` is a list of people and the placement finds them room; that is
   * right for a farmer in her own field, where the exact spot carries no
   * meaning. It is wrong wherever the POSITION is the story — the tea
   * seller belongs in the tea shop and nowhere else, and "the headman
   * between the bamboo and the well" is a sentence about a place.
   *
   * `at` is a fraction of the segment, like every other placement here, so
   * one post sits in the same relation to its lesson on a 270-unit chapter
   * and a 640-unit one.
   */
  /**
   * A RIVER CROSSING THE ROAD IN THIS LESSON.
   *
   * Not a prop. A river is a shape cut into the ground — see `setRiver` in
   * world.ts — and everything that asks "how high is the ground here" has to
   * get the channel's answer: the ground mesh, the plants, the herd, and the
   * child's own feet. `at` is where the channel's centre line crosses the
   * road, as a fraction of the segment like every other placement here;
   * `half` is half the water's width bank to bank; `depth` is how far the
   * bed drops below the bank.
   *
   * The bridge is placed by the world from these same three numbers, so the
   * two cannot drift apart: a bridge is exactly as long as the water it
   * crosses, plus a landing at each end.
   */
  readonly river?: {
    readonly at: number;
    readonly half: number;
    readonly depth: number;
  };
  readonly posts?: readonly {
    readonly model: string;
    readonly at: number;
    readonly z: number;
    /** Which way to face, in radians. Default is square to the road. */
    readonly face?: number;
  }[];
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
    // TWO IN THE FIELD, NOT ONE. A paddy field is not worked alone, and the
    // tea seller's model is the village's second man — he is back here now
    // that he has idles worth standing still in rather than the one short
    // loop that made him read as a prop.
    folk: ["FarmerWoman", "TeaStall"],
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
      // 3.2, NOT 2.2, for the reason the market's well was raised: a well
      // is a waist-high parapet a grown woman draws from, and at 2.2
      // against a farmer standing 5.4 it was a garden feature. A little
      // under the market's 3.6 — a household well, not a village one.
      //
      // AND AT -14, NOT -13. On the youngest band the compound wall slides
      // back towards the house to keep three panels (see `placements`),
      // and at -13 the well stood across its line. Between the wall at -12
      // and the house front at about -15.5 there are three and a half
      // units; the well is three deep, and -14 is the one place it clears
      // both.
      { model: `${UTIL}/Village_Well`, at: 0.44, z: -14, h: 3.2, clear: 5 },
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
    // NOTHING IS PLACED FROM HERE, AND THAT IS NOT AN OVERSIGHT.
    //
    // The village centre is the one lesson the world builds from its own
    // table rather than from this one: the temple, the banyan on its
    // althara, the three houses, the compound walls and the cart parked
    // past the shrine all come from `theme.village.heart`,
    // `VILLAGE_HOUSE_SPOTS` and the wall loop in the world, which were
    // tuned in place long before the chapter existed and are placed by the
    // chapter telling them WHERE — a third of the way into this segment —
    // rather than WHAT. The build skips Lesson 5's props for that reason.
    //
    // This table used to list a temple, two houses, a well, a wall and a
    // cart anyway, and none of them was ever built. It was worse than dead
    // data: the ground is painted before anything stands on it, and the
    // painter read the houses out of this table and wore a swept yard into
    // the grass in front of each — two bare patches in the village with
    // nothing standing behind them, one of them where the banyan's shade
    // falls. And the temple listed here was a second temple, at a
    // different spot from the one the heart places, so that anybody who
    // ever "fixed" the skip would have got two shrines twelve units apart.
    //
    // A well is the one thing the village centre genuinely lacks. If it
    // gets one it goes in `heart` with the rest, where it can be arranged
    // against the banyan and the shrine rather than against nothing.
    props: [],
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
      // INSIDE THE COMPOUND, NOT THROUGH ITS WALL. At 0.72 and z -11 the
      // cart stood across the boundary: the wall runs at z -10 and is
      // seven tenths of a unit thick, and a cart nearly six units long
      // parked end-on at -11 had the wall passing through its middle, on
      // every band. Measured rather than eyeballed — the two boxes
      // overlapped by the wall's whole depth.
      //
      // So it is parked in the yard behind the wall, where a prosperous
      // house keeps its cart, and seen over the top of it: the wall is two
      // units tall as drawn and the cart a shade more. At the near end of
      // the lesson rather than by the house, because on the shortest band
      // the house's sixteen-unit frontage fills most of a 27-unit lesson and
      // there is no ground beside it that is not also inside it.
      {
        model: `${UTIL}/Village_Cart`,
        at: 0.22,
        z: -13.5,
        h: 2.6,
        turn: 0.4,
        clear: 4,
      },
      // ON THE ROAD SIDE OF THE WALL. At z -13 it was behind a wall twice
      // its height and nobody ever saw it, lit or unlit — a lamp that is
      // hung where the road can see it is the whole of what a lamp on a
      // compound wall is for.
      // Lit until ten: a household's lamp, out when the house goes to bed.
      { model: `${UTIL}/Petromax_Lamp`, at: 0.62, z: -9, h: 1.1, lit: 22 },
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
      // BEHIND THE MARKET, RISING OVER ITS ROOF. At z -16 the trunk stood
      // inside the building: the market's centre is at -21.5 and it is
      // fourteen units deep as drawn, so everything from -28 to -15 along
      // its frontage is under its roof, and 0.72 of the lesson is well
      // inside the frontage on every band. The palmyra was coming up
      // through the stalls. At -31 it stands behind the back wall with its
      // crown over the tiles, which is where the tallest tree in a market
      // town is seen from the road anyway — and it is still on the ground,
      // which stops at -38.
      { model: `${PLANTS}/Palmyra_Karimpana`, at: 0.72, z: -31, h: 26 },
      // BAMBOO GROWS. At 7 it was a shrub — waist-high on the headman, which
      // is a hedge, not a grove. A clump of Kerala bamboo runs forty feet and
      // arches over whatever is beneath it, and the reason the brief frames
      // this lesson with it is that it makes a GATE of the market road: you
      // pass through something to arrive. 18 is forty feet at the chapter's
      // own scale, the same ruler the trees use, and taller than any of them
      // bar the palmyra.
      // THE TWO GROVES ARE NOT IN THIS TABLE ANY MORE — see the market
      // block in world.ts, which stands them off the building's own
      // measured edges.
      //
      // They were at 0.05 and 1.06 of the lesson, and that was a fact about
      // the segment pretending to be a fact about the market. "The grove at
      // the market gate" and "the closing grove past the stone" are both
      // sentences about where the BUILDING ends, and the building is a
      // different width on every band — so on the short road the gate grove
      // stood a third of the way along the frontage and the closing one
      // came up through the last stalls, while on the long road both sat
      // where they were meant to. Measured off the market they frame it on
      // every band, and the market is free to be the size a market is.
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
        //
        // A FORECOURT A WELL CAN STAND IN, AND A ROAD CLOSE ENOUGH TO SEE
        // THE SHOPS FROM. With the front face at -11 there were under four
        // units between the milestone line and the shop fronts, and the
        // well written for "between the bamboo and the market" stood at -12
        // — inside the stalls, on every band, invisible. -21.5 bought seven
        // units of trodden ground for the well and the cart; at -19 the
        // forecourt is still deep enough for the well and the cart, and the
        // row itself comes nearer the child, which is what a market a
        // village actually walks to looks like from the road.
        //
        // -17.5 on the second pass. The forecourt does NOT move again with
        // it: at -19 the well stood three and a half units clear of the
        // shop fronts, and taking the building forward another unit and a
        // half closes that to two — which is a village street rather than a
        // yard, and is the point. Moving the forecourt again would have put
        // the cow and the cart on the carriageway.
        //
        // EVERYTHING IN THE FORECOURT MOVES WITH IT, by exactly the same
        // two and a half: the well, the cart, the lamp and the cow in front
        // of the stalls. Move the building alone and the cart it is parked
        // behind ends up inside it — the forecourt is a group, and its
        // depths are all relative to this one number even though the file
        // has to write them out separately.
        //
        // The back wall sits at about -28, well inside the ground's edge at
        // -38. The smith on his plinth needs no change: he is placed off
        // the building's own measured front face, so he comes forward with
        // the shop he is sitting at.
        z: -17.5,
        h: 17.5,
        // A FOOTPRINT, NOT A DISC — see `box`. `clear` is now the margin of
        // trading ground kept bare of planting round the building; the
        // building's own extent comes from its measured proportions. Forty
        // as a radius reached across the road and through both neighbouring
        // lessons, and refused every villager the lesson names.
        clear: 6,
        // Measured off the file, like `run.aspect`: 4.27 wide and 1.02 deep
        // to every unit of height. `span` at 0.82 trims the long road's row
        // by five per cent — 52 units of frontage rather than 55, which is
        // what ends it a hair short of the closing grove instead of two
        // units inside it — and on the youngest band's 28-unit lesson it
        // brings the row down to a line of low stalls rather than a
        // building that runs from the middle of the estate to the middle
        // of the grazing land.
        // 0.86 OF THE LESSON, UP FROM 0.82 — and `span` is the only lever
        // that does anything here. The cap binds on EVERY band, the longest
        // included: the drawn frontage is always `span * len`, so `h` above
        // is a ceiling that is never reached and raising it would be
        // trimmed straight back to the same number of units. A building
        // asked to be bigger has to be allowed more of its lesson.
        //
        // Four per cent, and it is bounded at both ends rather than chosen
        // for feel: the grove at 0.05 is on one side and Milestone 7 on the
        // other, so at 0.56 the frontage now reaches 0.13 to 0.99 of the
        // segment. The stone is the tighter of the two and it is not
        // actually at risk — the row stands seventeen units back, so it
        // rises BEHIND the marker rather than across it, which is what the
        // reference frames show. The grove is the real limit and this is
        // most of what is left before the two touch.
        // 55 UNITS OF FRONTAGE, BRAKED AT 1.6 LESSONS.
        //
        // 55 is what the longest road was already drawing it at, so nothing
        // changes for a nine- or eleven-year-old. What changes is everyone
        // younger: a 28.8-unit Lesson 7 was giving the five-year-old 24.8
        // units of market, under half the building, and the brake now lets
        // it reach 46 — most of the way back, and as much as a lesson that
        // short can carry without the row becoming the whole chapter.
        //
        // 1.6 rather than something rounder because that is where the
        // youngest band stops gaining: past it the frontage grows into
        // Lesson 8's grazing land faster than it grows on screen.
        box: { w: 4.27, d: 1.02, span: 1.6, want: 55 },
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
        // its whole length reads rather than its nose. Forward with the rest
        // of the forecourt when the row came nearer the road — at -9.5 she
        // was standing against the shop fronts rather than out in the open
        // ground in front of them.
        at: 0.14,
        z: -7,
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
      // IN THE FORECOURT, where it can be seen. See the market's z: at -12
      // this was inside the building.
      {
        model: `${UTIL}/Village_Well`,
        at: 0.3,
        z: -9.1,
        h: 3.6,
        turn: -Math.PI / 2,
        clear: 6,
      },
      {
        model: `${UTIL}/Village_Cart`,
        at: 0.56,
        z: -7.5,
        h: 2.6,
        turn: 1.9,
        clear: 4,
      },
      // Out at nine with the last of the stalls — see the market's own
      // shop lamps, which close between seven and nine.
      { model: `${UTIL}/Petromax_Lamp`, at: 0.5, z: -8, h: 1.2, lit: 21 },
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
    ],
    herd: [],
    // AT THE STALLS. The forecourt runs from the milestone line at about
    // -7.5 to the shop fronts at about -14.6, and a person needs a couple
    // of units from either. Fourteen to twenty-four — the default, a farmer
    // in her plot — is the inside of the market.
    // BOTH OF THIS LESSON'S PEOPLE STAND SOMEWHERE IN PARTICULAR, so the
    // hashed placement has nobody left to place. The tea seller is inside
    // his own shop — see the market block in world.ts, which is the only
    // place that knows where the shop fronts actually ended up after the
    // building was fitted to the band — and the headman has a post below.
    folk: [],
    posts: [
      // BETWEEN THE BAMBOO AND THE WELL. The grove is at 0.05 and the well
      // at 0.3, so halfway is where a man stands when he is talking to
      // whoever is drawing water and watching the road at the same time.
      // A little in front of the well so he does not read as behind it.
      { model: "Headman", at: 0.18, z: -8.6 },
    ],
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
        at: 0.45,
        z: -14,
        h: 2.0,
        clear: 5,
        run: { count: 4, aspect: 2.61, gapAt: 1 },
        skirt: true,
      },
      // WHAT FELL OFF IT. A wall that is "the remains of something" has
      // to have remains: two laterite blocks lying at the foot of the
      // first panel, on the road side, where a course that came down would
      // land. It is the one detail that says the gaps in this wall are
      // age rather than a builder who stopped — the same panels stand
      // whole round the estate two lessons back. At the first panel rather
      // than the last, because the run is clamped to the lesson and its
      // last panel is in a different place on every band; its first is
      // where it is written.
      { model: "village-stone/Laterite_Rock", at: 0.435, z: -13.1, h: 0.55 },
      { model: "village-stone/Laterite_Rock", at: 0.46, z: -13.3, h: 0.4 },
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
      // AND SOMETHING TIED TO IT. A tether post with nothing at it is a
      // stick in a field; the reason the post is out here is that a cow
      // is walked to it in the morning and left on a rope's length of
      // grass all day, which is how cattle are actually kept on a Kerala
      // pasture — the loose herd is the exception, this is the rule. So
      // one stands at the post, broadside to the road so its whole length
      // reads, a rope's length along from it.
      //
      // A prop, not livestock, for the same reason as the cow outside the
      // market: the herd code would give it a grazing loop and walk it
      // off, and a tethered animal is one that stays. At the herd's own
      // 4.5 rather than the market cow's 5.2, because it is met beside the
      // herd and has to be the same animal.
      //
      // `at` is a fraction, so the rope is a unit and a quarter long on
      // the youngest band and two and a half on the oldest. Both read as
      // tethered; what would not is the cow standing ON the post, and its
      // own clearance keeps the herd off it.
      {
        model: "village-folk/Cow",
        at: 0.4,
        z: -13.2,
        h: 4.5,
        turn: 1.45,
        lift: 0,
        clear: 3,
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
      // A PATH OFF THE ROAD, GOING SOMEWHERE. The chapter ends "out the
      // other side", and a stretch of open meadow with nothing leading
      // anywhere ends nowhere. Stepping stones going back off the verge —
      // the same line the orchard was entered by in Lesson 3, laid in the
      // same direction — say there is more land past this and somebody
      // walks to it. It is the smallest possible promise of Chapter 2,
      // made of stones the scatter has already loaded.
      { model: "village-stone/Stepping_Stone", at: 0.62, z: -8.2, h: 0.24 },
      { model: "village-stone/Stepping_Stone", at: 0.63, z: -10.7, h: 0.24 },
      { model: "village-stone/Stepping_Stone", at: 0.64, z: -13.2, h: 0.24 },
      { model: "village-stone/Stepping_Stone", at: 0.65, z: -15.7, h: 0.24 },
      { model: "village-stone/Stepping_Stone", at: 0.66, z: -18.2, h: 0.24 },
    ],
    herd: ["Buffalo"],
    folk: [],
    corridor: false,
  },
];

/**
 * WHICH CHAPTER'S LESSONS THE ROAD IS CURRENTLY MADE OF.
 *
 * `lessonAt`, `blendAt` and `placements` all have to answer for whichever
 * chapter is being built, and threading a table through every one of their
 * call sites — thirty-odd, across the world build and its tick — would be a
 * parameter that is the same value every time it is passed. So the module
 * holds it, exactly as it holds `ROAD_SINK` and the river: there is one road
 * at a time, and everything that asks about it must get the same answer.
 *
 * DEFAULTS TO CHAPTER 1 AND FALLS BACK TO IT. A table of the wrong length is
 * a chapter that is half-written, and building a road from it would place
 * some lessons and silently drop others; Chapter 1 is a road that works.
 */
let ACTIVE: readonly Lesson[] = LESSONS;

/** Build the road from this chapter's lessons until told otherwise. */
export function setChapterLessons(lessons: readonly Lesson[]): void {
  ACTIVE = lessons.length === SEGMENT_COUNT ? lessons : LESSONS;
}

/** Which lessons the road is made of right now. */
export function activeLessons(): readonly Lesson[] {
  return ACTIVE;
}

/** Which lesson owns this point on the road. Clamped at both ends. */
export function lessonAt(
  x: number,
  bounds: readonly number[] = DEFAULT_BOUNDS,
): Lesson {
  for (let i = SEGMENT_COUNT - 1; i > 0; i--) {
    if (x >= bounds[i]!) return ACTIVE[i]!;
  }
  return ACTIVE[0]!;
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
    prev: ACTIVE[lesson.n - 2]!,
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

/** What `placements` hands out: the table entry, resolved to the road. */
export type Placement = Placed & {
  readonly x: number;
  /**
   * For a `box` prop, how wide and how deep it is DRAWN — after the depth
   * falloff and after any `span` fit. The world uses these where it has to
   * know a building's extent before the model has loaded: the bare ground
   * in front of it is painted before it stands.
   */
  readonly width?: number;
  readonly depth?: number;
};

/**
 * A BUILDING FITTED TO ITS LESSON. See `Placed.box`.
 *
 * Returns the entry as written when it already fits, so on the long bands
 * this is the identity and the numbers in the table are the numbers on the
 * road. When the drawn frontage is more than `span` of the segment, the
 * height is scaled down until it is exactly that, the clearance scales with
 * it (it is a margin round a smaller thing), and the centre comes forward
 * by half the depth it lost so the front face does not move.
 *
 * The falloff is evaluated at the AUTHORED z and not re-derived for the
 * moved centre. It changes by under two per cent over the few units the
 * centre moves, and chasing it would make the fitted height depend on
 * itself.
 */
function fitted(
  p: Placed,
  len: number,
  persp: (z: number) => number,
): Placed & { readonly width?: number; readonly depth?: number } {
  if (p.box == null) {
    return p;
  }
  const s = persp(p.z);
  const width = p.box.w * p.h * s;
  const depth = p.box.d * p.h * s;
  // THE SIZE IT WANTS, BRAKED BY THE LESSON — not the lesson alone. See
  // `box.want`: a village is not smaller for a younger child, so the target
  // is a number of world units and `span` only stops a short lesson's
  // building from running away down the chapter.
  const limit = Math.min(
    p.box.want ?? Infinity,
    p.box.span == null ? Infinity : p.box.span * len,
  );
  const fitWidth = p.box.w * p.h * persp(p.box.referenceZ ?? p.z);
  if (fitWidth <= limit) {
    return { ...p, width, depth };
  }
  const k = limit / fitWidth;
  const h = p.h * k;
  return {
    ...p,
    h,
    clear: p.clear == null ? undefined : p.clear * k,
    // The front face is at z + depth / 2; keep it there.
    z: p.z + (depth - depth * k) / 2,
    width: width * k,
    depth: depth * k,
  };
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
): readonly Placement[] {
  const out: Placement[] = [];
  for (const l of ACTIVE) {
    const from = bounds[l.n - 1]!;
    const len = segmentLen(l.n, bounds);
    for (const raw of l.props) {
      const p = fitted(raw, len, persp);
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
      //
      // AND SHORT OF THE STONE BY `MILESTONE_CLEAR`, at both ends. The
      // clamp used to stop a panel's trailing edge exactly at the stone,
      // which on the shortest band put the orchard fence's last panel a
      // third of a unit behind Milestone 3 and its first two units past
      // Milestone 2 — a slab read against a panel of the same height half a
      // unit behind it. The rule the world applies to every tree applies
      // to every panel.
      const panel = p.run.aspect * p.h * persp(p.z);
      const first = from + MILESTONE_CLEAR + panel / 2;
      const last = from + len - MILESTONE_CLEAR - panel / 2;
      // AND THE LEADING EDGE STARTS INSIDE. Lesson 6's boundary is written
      // at the very top of its segment, so its first panel reached back
      // across the stone into Lesson 5 — the same half-panel error at the
      // other end of the run. The run is nudged forward rather than having
      // its first panel dropped: a boundary missing its first section is a
      // second gateway, and the run already has the one it means to have.
      let start = Math.max(x0, first);
      // How many panels the lesson has room for from here.
      let fits = Math.min(
        p.run.count,
        Math.floor((last - start) / panel + 1e-9) + 1,
      );
      // THREE PANELS OR NOTHING, AND SOONER THAN NOTHING, EARLIER.
      //
      // The file's own rule: scattered posts are litter and a boundary is
      // continuous or it is not one. The homestead's wall is written at
      // 0.62 of its lesson, which on the youngest band leaves room for two
      // panels before the stone — a wall that is two panels long is a wall
      // somebody is halfway through building. Rather than drop it, the run
      // slides back towards the start of the lesson until four slots fit —
      // three panels and the gate — or three if the lesson has no room for
      // four; the wall ends up in front of the house instead of beside it,
      // which is where a compound wall goes anyway.
      if (fits < 4) {
        start = Math.max(first, last - 3 * panel);
        fits = Math.min(
          p.run.count,
          Math.floor((last - start) / panel + 1e-9) + 1,
        );
      }
      if (fits < 3) {
        continue; // a lesson shorter than three panels: no such lesson
      }
      // THE GATE STAYS INSIDE THE RUN. `gapAt` is written for the full
      // count, and on the short bands the clamp cut the run off before it
      // got there: the orchard's fence had its gate at panel 6 of 16 and
      // room for six panels, so the youngest band's orchard was fenced with
      // no way in, and the estate's the same. The gap moves to the same
      // PROPORTION of whatever survives, and never to an end — a gap at the
      // end is just a shorter run.
      //
      // AND A RUN OF THREE HAS NO GATE AT ALL. Three slots with the middle
      // one missing is two panels with daylight between them, which is
      // precisely the half-built look the run exists to avoid; three
      // panels end to end are a short stretch of wall with open ground
      // past both ends, which is a boundary a child can see round. The
      // gate only earns its place once there are three panels to be a
      // gate in.
      const gap =
        fits === p.run.count
          ? p.run.gapAt
          : fits < 4 && !p.run.keepGate
            ? -1
            : Math.min(
                fits - 2,
                Math.max(1, Math.round((p.run.gapAt / p.run.count) * fits)),
              );
      for (let i = 0; i < fits; i++) {
        if (i === gap) {
          // THE WAY IN — which may have a gate hung in it.
          if (p.run.gate != null) {
            out.push({
              ...p,
              model: p.run.gate.model,
              h: p.run.gate.h,
              run: undefined,
              x: start + i * panel,
            });
          }
          continue;
        }
        out.push({ ...p, run: undefined, x: start + i * panel });
      }
    }
  }
  return out;
}
