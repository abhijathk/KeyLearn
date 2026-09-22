/** The Village of Whispers: global lessons 21–30, on the existing road.
 * Geometry is independent of the clock. All coordinates are behind the lane.
 * The opening retains Chapter 2's meadow; the final road reveals no Chapter 4.
 */
import type { Lesson, Placed } from "./chapter1.ts";

const P = "village-plants/";
const U = "village-util/";
const A = "ak-3d-pack/";
const grass = [P + "Kerala_Grass_Tuft", P + "Kerala_Fern"];
const palms = [P + "Coconut_Palm", P + "Arecanut_Palm"];
const gardens = [
  P + "Banana_Plant",
  P + "Taro_Chembu",
  P + "Hibiscus_Chemparathi",
];
const prop = (
  model: string,
  at: number,
  z: number,
  h: number,
  clear = 0,
): Placed => ({ model, at, z, h, clear });
const home = (at: number, z = -25, variant = "CottageTiled"): Placed =>
  prop(A + variant, at, z, 8, 5);
const wall = (at: number, count = 5, z = -14): Placed => ({
  ...prop(U + "Laterite_Wall", at, z, 2, 1),
  run: { count, aspect: 2.61, gapAt: 2 },
  skirt: true,
});
const well = (at: number, z = -12): Placed =>
  prop(U + "Village_Well", at, z, 3.2, 3);
const tree = (at: number, z = -22): Placed => prop(A + "Banyan", at, z, 19, 6);
const market = (at: number, z = -23): Placed => ({
  ...prop(U + "Village_Market", at, z, 6, 1),
  box: { w: 4.27, d: 1.02, span: 0.85 },
});
const cart = (at: number): Placed => prop(U + "Village_Cart", at, -12, 2.8, 2);
const produce = (at: number): Placed => prop(U + "Produce_Pile", at, -10, 1.1);
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
  canopy: palms,
  mid: gardens,
  ground: grass,
  density: 1.5,
  mix: [0.18, 0.22, 0.6],
  depth: [10, 28],
  props,
  herd: [],
  folk: [],
  corridor: false,
  ...options,
});

export const LESSONS_3: readonly Lesson[] = [
  lesson(
    1,
    "Village Road",
    [
      // First fifth is grass/ferns, just like global lesson 20.
      home(0.45, -30),
      home(0.78, -29, "CottageVeranda"),
      prop(U + "Laterite_Wall", 0.72, -14, 1.8),
      prop(P + "Mango_Tree", 0.86, -23, 15, 3),
    ],
    {
      density: 1,
      mix: [0.08, 0.12, 0.8],
      mid: [P + "Kerala_Fern"],
      herd: ["Cow"],
    },
  ),
  lesson(
    2,
    "Outer Houses",
    [
      home(0.18, -25),
      home(0.53, -31, "CottageVeranda"),
      home(0.84, -24, "HouseMoss"),
      wall(0.2),
      well(0.66),
    ],
    { folk: ["FarmerWoman", "Headman"], herd: ["Cow"] },
  ),
  lesson(
    3,
    "Village Lane",
    [
      home(0.22, -29, "CottageVeranda"),
      home(0.75, -28),
      wall(0.15, 8),
      well(0.6, -20),
      prop(P + "Mango_Tree", 0.32, -23, 17, 4),
      prop(P + "Jackfruit_Tree", 0.78, -24, 17, 4),
    ],
    { density: 2.1, folk: ["Headman", "FarmerWoman"] },
  ),
  lesson(
    4,
    "Banyan Junction",
    [
      tree(0.48),
      well(0.23),
      wall(0.73, 4, -19),
      home(0.85, -30),
      prop("village-stone/Stepping_Stone", 0.37, -12, 0.6),
      prop(U + "Nilavilakku", 0.65, -21, 1.6),
    ],
    { density: 1.4, folk: ["Headman", "FarmerWoman"], corridor: true },
  ),
  lesson(
    5,
    "Great Market",
    [
      // Two overlapping rows, with separate depth/forecourts: bigger than Ch1.
      market(0.29),
      market(0.76, -31),
      cart(0.15),
      well(0.57),
      produce(0.38),
      produce(0.7),
      prop(A + "Temple", 0.93, -32, 10, 6),
    ],
    {
      density: 1.1,
      folk: [
        "Headman",
        "Blacksmith",
        "FarmerWoman",
        "FarmerWoman",
        "Headman",
        "VillageBoy",
      ],
      folkDepth: [8, 12],
      corridor: true,
    },
  ),
  lesson(
    6,
    "Temple Street",
    [
      market(0.12, -29),
      prop(A + "Temple", 0.6, -29, 12, 7),
      wall(0.3, 6, -18),
      tree(0.82, -26),
      well(0.35),
      produce(0.18),
      prop(U + "Nilavilakku", 0.64, -19, 2),
    ],
    { folk: ["Headman", "FarmerWoman", "Blacksmith"], corridor: true },
  ),
  lesson(
    7,
    "Playground",
    [
      tree(0.4),
      wall(0.14, 7, -17),
      well(0.7),
      market(0.15, -31),
      home(0.85, -28, "CottageVeranda"),
      cart(0.6),
      produce(0.32),
      produce(0.76),
    ],
    { density: 1.5, folk: ["Headman", "FarmerWoman"], corridor: true },
  ),
  lesson(
    8,
    "Quiet Houses",
    [
      // Carry the previous wall/tree language through the first fifth.
      prop(U + "Laterite_Wall", 0.12, -17, 2),
      tree(0.18, -27),
      home(0.4),
      well(0.58),
      home(0.78, -28, "CottageVeranda"),
    ],
    { density: 1.25, folk: ["Headman", "FarmerWoman"], corridor: true },
  ),
  lesson(
    9,
    "Edge Gardens",
    [
      home(0.2, -28),
      home(0.7, -30, "CottageVeranda"),
      well(0.42),
      {
        ...prop(U + "Bamboo_Fence", 0.3, -14, 1.6),
        run: { count: 4, aspect: 1.75, gapAt: 2 },
        skirt: true,
      },
    ],
    {
      density: 1.3,
      mix: [0.1, 0.35, 0.55],
      folk: ["FarmerWoman"],
      herd: ["Cow"],
    },
  ),
  lesson(10, "Quiet Road", [home(0.13, -32)], {
    density: 0.9,
    mix: [0.07, 0.08, 0.85],
    mid: [P + "Kerala_Fern"],
    herd: ["Cow"],
  }),
];

/** Fixed off-road nodes. Not random road spawns; never temple interiors. */
export const WHISPER_NODES = [
  { lesson: 4, at: 0.42, z: -12, kind: "root", lift: 0 },
  { lesson: 5, at: 0.43, z: -10, kind: "basket", lift: 0 },
  { lesson: 6, at: 0.35, z: -9, kind: "well", lift: 0 },
  { lesson: 6, at: 0.8, z: -13, kind: "path", lift: 0 },
  { lesson: 7, at: 0.2, z: -15, kind: "wall", lift: 1.5 },
  { lesson: 7, at: 0.38, z: -12, kind: "root", lift: 0 },
  { lesson: 7, at: 0.58, z: -9, kind: "path", lift: 0 },
  { lesson: 7, at: 0.72, z: -9, kind: "well", lift: 0 },
  { lesson: 8, at: 0.16, z: -12, kind: "path", lift: 0 },
] as const;

export const MYSTERY_INTENSITY = [
  0.04, 0.1, 0.2, 0.35, 0.55, 0.75, 1, 0.5, 0.12, 0,
] as const;

/** Uses the world's existing hour; never changes light, sky, or camera. */
export function whisperState(lesson: number, fraction: number, hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const deep = h >= 22 || h < 4;
  const evening = h >= 19 && h < 22;
  const strength =
    (MYSTERY_INTENSITY[lesson - 1] ?? 0) *
    (lesson === 8 ? Math.max(0, 1 - fraction * 2) : 1);
  return {
    strength,
    // No clear reveal before the banyan; the market tells its story with props.
    figure: deep && [4, 6, 7, 8].includes(lesson) && strength > 0,
    props: strength > 0 && (evening || (deep && lesson < 9)),
    seconds: lesson === 4 || lesson === 8 ? 1 : lesson === 7 ? 2 : 1.5,
    gap: 80 - strength * 45,
  };
}

/** Market closes progressively, using the same people and scene graph. */
export function whisperFolkOut(lesson: Lesson, hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 19) return lesson.folk.length;
  if (lesson.n === 5 && h >= 19 && h < 21) {
    return Math.ceil((lesson.folk.length * (21 - h)) / 2);
  }
  return 0;
}
