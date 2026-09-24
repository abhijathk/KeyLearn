/** The Wild Crossing, global lessons 31–40. The live clock owns lighting. */
import type { Lesson, Placed } from "./chapter1.ts";

const P = "village-plants/";
const S = "village-stone/";
const grass = [P + "Kerala_Grass_Tuft", P + "Kerala_Fern"];
const wet = [P + "Taro_Chembu", P + "Kerala_Fern"];
const trees = [P + "Mango_Tree", P + "Tamarind_Tree", P + "Jackfruit_Tree"];
const prop = (
  model: string,
  at: number,
  z: number,
  h: number,
  clear = 1,
): Placed => ({ model, at, z, h, clear });
const rock = (at: number, z = -13): Placed =>
  prop(S + "Mossy_Stone", at, z, 1.2);
/** A granite boulder, big enough to read as rock and not as a stone. */
const boulder = (at: number, z = -11, h = 2.6): Placed =>
  prop(S + "Granite_Boulder", at, z, h, 1.6);
const tree = (at: number, z = -22, h = 17): Placed =>
  prop(trees[0]!, at, z, h, 4);
const lesson = (
  n: number,
  name: string,
  props: readonly Placed[],
  options: Partial<Lesson> = {},
): Lesson => ({
  n,
  name,
  from: n - 1,
  to: n,
  canopy: trees,
  mid: [P + "Kerala_Fern"],
  ground: grass,
  density: 0.85,
  mix: [0.12, 0.18, 0.7],
  depth: [11, 30],
  props,
  herd: [],
  folk: [],
  corridor: false,
  ...options,
});

export const LESSONS_4: readonly Lesson[] = [
  lesson(
    1,
    "Forest Edge",
    [
      prop("ak-3d-pack/CottageTiled", 0.06, -34, 7, 3),
      tree(0.62, -24, 16),
      rock(0.83),
    ],
    {
      canopy: [P + "Coconut_Palm", ...trees],
      density: 0.75,
      mix: [0.07, 0.13, 0.8],
    },
  ),
  // THE ROAD GOES UNDER THE TREES HERE. Planted right up to the far verge —
  // the road's edge is about nine back, so ten is a trunk standing at it —
  // in three full layers: canopy over the road, wild taro and fern
  // between the trunks, grass underfoot. Big boulders sit in the
  // gaps between the trees, the way granite breaks the surface of a Kerala
  // hill forest. `shade` darkens the road itself; see `Lesson.shade`.
  lesson(
    2,
    "Shady Forest",
    [
      prop(trees[1]!, 0.06, -10.5, 21, 3),
      boulder(0.17, -11),
      prop(P + "Taro_Chembu", 0.24, -9.8, 2.2),
      prop(trees[0]!, 0.31, -10, 19, 3),
      prop(S + "Mossy_Stone", 0.38, -10, 1.7),
      boulder(0.44, -12.5, 3.2),
      prop(trees[2]!, 0.53, -10.5, 18, 3),
      prop(P + "Kerala_Fern", 0.6, -9.6, 1.8),
      boulder(0.66, -10.8, 2.4),
      prop(trees[1]!, 0.74, -11, 20, 3),
      prop(S + "Laterite_Rock", 0.81, -10, 1.4),
      prop(P + "Peepal_Arayal", 0.88, -14, 22, 3),
      boulder(0.95, -11.5, 2.8),
      // A second rank further back, so the forest has depth and not one row.
      tree(0.14, -18, 18),
      prop(trees[2]!, 0.47, -19, 17, 3),
      prop(trees[1]!, 0.64, -17, 19, 3),
    ],
    {
      // FOREST PLANTS ONLY. Hibiscus, banana and tapioca are garden and
      // farm plants — they say someone lives here, which is the one thing
      // a forest road must not say. Wild taro and fern are what grow in
      // the damp under a Kerala canopy; the peepal is a wild fig.
      canopy: [...trees, P + "Peepal_Arayal"],
      mid: wet,
      density: 2.6,
      mix: [0.2, 0.35, 0.45],
      depth: [9.5, 30],
      shade: 0.85,
    },
  ),
  lesson(3, "Grass Hills", [rock(0.2), tree(0.72, -26, 14)], {
    canopy: [P + "Coconut_Palm"],
    density: 0.55,
    mix: [0.04, 0.16, 0.8],
    herd: ["Cow"],
    // "Occasional worn side tracks or cattle paths across the grass."
    tracks: 2,
  }),
  lesson(4, "Hilltop Meadow", [tree(0.62, -24, 16), rock(0.26, -18)], {
    density: 0.4,
    mix: [0, 0.16, 0.84],
    mid: [P + "Hibiscus_Chemparathi", P + "Kerala_Fern"],
  }),
  lesson(
    5,
    "River Descent",
    [tree(0.26, -24), rock(0.5), prop(P + "Taro_Chembu", 0.78, -13, 1.8)],
    { density: 0.85, mid: wet },
  ),
  lesson(
    6,
    "Wide Riverbank",
    // "Several mature riverbank trees, but keep gaps so the width of the
    // water remains visible." The scatter's canopy share is too thin to put
    // a tree on a lesson this short, so the three are authored. The bank
    // runs diagonally across this lesson and each is brought forward onto
    // it (see "A TREE COMES FORWARD" in world.ts), so they stand on the
    // waterline with open water between the trunks. No fourth: past ~0.7
    // the bank is almost at the road and a tree there fell back into the
    // first one's corner.
    [
      tree(0.18, -25, 19),
      rock(0.3),
      prop(trees[1]!, 0.41, -22, 21, 4),
      prop(P + "Taro_Chembu", 0.52, -11, 1.8),
      prop(trees[2]!, 0.63, -28, 18, 4),
    ],
    { density: 0.7, mid: wet, mix: [0.05, 0.25, 0.7] },
  ),
  // The island's banyan, boulders and edge plants are placed from crossing
  // geometry (see "ONE WIDE BANYAN" in world.ts),
  // not lesson fractions: Milestone 37 must stay on land at every age band.
  lesson(7, "Island Milestone", [], { density: 0, mix: [0, 0, 1], mid: wet }),
  lesson(
    8,
    "River Woods",
    [tree(0.6, -23, 19), rock(0.75, -15), tree(0.94, -29, 17)],
    { density: 1.05, mid: wet, mix: [0.12, 0.25, 0.63] },
  ),
  lesson(9, "Sunny Uplands", [rock(0.32), tree(0.76, -27, 14)], {
    density: 0.55,
    canopy: [P + "Coconut_Palm"],
    mix: [0.04, 0.16, 0.8],
    // "Light field paths or worn patches" — travelled, without buildings.
    tracks: 2,
  }),
  lesson(10, "Green Road", [prop(P + "Coconut_Palm", 0.52, -27, 15, 3)], {
    density: 0.45,
    canopy: [P + "Coconut_Palm"],
    mix: [0.04, 0.12, 0.84],
  }),
];

export const WILD_INTENSITY = [
  0, 0.1, 0.05, 0, 0.15, 0.35, 0.7, 0.45, 0.1, 0,
] as const;
export function wildState(lesson: number, fraction: number, hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const deep = h >= 22 || h < 4;
  const evening = h >= 19 && h < 21;
  const strength =
    (WILD_INTENSITY[lesson - 1] ?? 0) *
    (lesson === 8
      ? Math.max(0, 1 - fraction * 2)
      : lesson === 9 && fraction > 0.2
        ? 0
        : 1);
  return {
    strength,
    figure: deep && [2, 5, 6, 7, 8].includes(lesson) && strength > 0,
    props: strength > 0 && (evening || (deep && lesson < 9)),
    seconds: lesson === 7 ? 2 : 1,
    gap: 90 - strength * 65,
  };
}
