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
const home = (at: number, z = -25, variant = "CottageTiled"): Placed => ({
  ...prop(A + variant, at, z, variant.startsWith("Cottage") ? 9.4 : 11.5, 5),
  turn: z < -28 ? -0.12 : 0.1,
});
const wall = (at: number, count = 5, z = -14): Placed => ({
  ...prop(U + "Laterite_Wall", at, z, 2, 1),
  run: { count, aspect: 2.61, gapAt: 2 },
  skirt: true,
});
const well = (at: number, z = -12): Placed =>
  prop(U + "Village_Well", at, z, 3.2, 3);
const tree = (at: number, z = -22): Placed =>
  prop(P + "Banyan_Almaram", at, z, 20, 7);
const peepal = (at: number, z = -24): Placed =>
  prop(P + "Peepal_Arayal", at, z, 20, 6);
// Chapter 1's shop scale, fitted at a shared depth. Independently fitting
// each row to the same screen width would cancel the distant row's falloff.
const market = (at: number, z = -17.5): Placed => ({
  ...prop(U + "Village_Market", at, z, 17.5, 6),
  box: { w: 4.27, d: 1.02, span: 1.6, want: 55, referenceZ: -17.5 },
});
const gatedWall = (at: number, z = -16): Placed => ({
  ...wall(at, 7, z),
  run: {
    count: 7,
    aspect: 2.61,
    gapAt: 3,
    keepGate: true,
    gate: { model: U + "Estate_Gate", h: 2.65 },
  },
});
const garden = (at: number, z = -18): readonly Placed[] => [
  prop(P + "Banana_Plant", at, z - 3, 6),
  prop(P + "Taro_Chembu", at + 0.035, z, 1.5),
  prop(P + "Tapioca_Cassava", at - 0.035, z - 1, 2.1),
  prop(P + "Hibiscus_Chemparathi", at + 0.065, z - 2, 3),
];
const cart = (at: number): Placed => ({
  ...prop(U + "Village_Cart", at, -10, 2.8, 2),
  turn: Math.PI / 2,
});
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
  // One buffalo to each lesson's open ground (owner, 25 Sep 2026), except
  // where a water buffalo does not graze: the junction round the sacred
  // banyan, the market, the temple street and the children's playground.
  buffalo: ![4, 5, 6, 7].includes(n),
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
      home(0.78, -29, "CottageVeranda"),
      prop(U + "Laterite_Wall", 0.72, -14, 1.8),
      prop(P + "Mango_Tree", 0.86, -23, 15, 3),
      // Palmyras at the village's edges, two or three to a chapter (owner,
      // 25 Sep 2026) — tall, alone, and well back.
      prop(P + "Palmyra_Karimpana", 0.3, -24, 25, 3),
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
      home(0.1, -20),
      home(0.5, -33, "CottageBell"),
      home(0.9, -20, "HouseMoss"),
      gatedWall(0.2, -10.5),
      well(0.77, -29.5),
      ...garden(0.4),
    ],
    { folk: ["FarmerWoman", "Headman"], herd: ["Cow"] },
  ),
  lesson(
    3,
    "Village Lane",
    [
      home(0.78, -27, "HouseHearth"),
      gatedWall(0.15),
      well(0.6, -20),
      prop(P + "Mango_Tree", 0.32, -23, 17, 4),
      prop(P + "Jackfruit_Tree", 0.78, -24, 17, 4),
      ...garden(0.12, -20),
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
      {
        ...prop(U + "Nilavilakku", 0.65, -21, 1.6),
        lit: 21,
        litKind: "oil",
        litUp: 0.88,
      },
      prop("village-stone/Stepping_Stone", 0.57, -13, 0.6),
      ...garden(0.82, -22),
    ],
    { density: 1.4, folk: ["Headman", "FarmerWoman"], corridor: true },
  ),
  lesson(
    5,
    "Great Market",
    [
      // Two overlapping rows, with separate depth/forecourts: bigger than Ch1.
      market(0.3),
      market(0.82, -30),
      cart(0.15),
      well(0.82),
      produce(0.38),
      produce(0.7),
    ],
    {
      density: 1.1,
      folk: [
        "Headman",
        "VillageBoy",
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
      // The actual market behind the start belongs to Lesson 25. A second
      // full duplicate here would intersect the temple on the shortest road.
      prop(A + "Temple", 0.48, -27, 13, 7),
      gatedWall(0.3, -17),
      peepal(0.83, -27),
      well(0.35),
      produce(0.18),
      {
        ...prop(U + "Nilavilakku", 0.64, -19, 2),
        lit: 21,
        litKind: "oil",
        litUp: 0.88,
      },
      ...garden(0.83, -21),
    ],
    { folk: ["Headman", "FarmerWoman"], corridor: true },
  ),
  lesson(
    7,
    "Playground",
    [
      tree(0.4),
      wall(0.14, 7, -17),
      well(0.7),
      // The user requested no market at this lesson's opening.
      home(0.85, -28, "CottageVeranda"),
      cart(0.6),
      produce(0.32),
      produce(0.76),
      prop("village-stone/Stepping_Stone", 0.47, -11, 0.45),
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
      well(0.58),
      gatedWall(0.28),
      prop(A + "Mana", 0.45, -28, 16, 4),
      ...garden(0.86, -20),
    ],
    { density: 1.25, folk: ["Headman", "FarmerWoman"], corridor: true },
  ),
  lesson(
    9,
    "Edge Gardens",
    [
      home(0.1, -28),
      home(0.88, -30, "HouseThatch"),
      well(0.42),
      prop(P + "Palmyra_Karimpana", 0.64, -26, 27, 3),
      ...garden(0.24),
      ...garden(0.76, -20),
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
  // One large boulder in the open ground (owner, 25 Sep 2026).
  lesson(
    10,
    "Quiet Road",
    [
      home(0.13, -32),
      prop("village-stone/Granite_Boulder", 0.58, -18, 3.8, 1.6),
      prop(P + "Palmyra_Karimpana", 0.84, -24, 26, 3),
    ],
    {
      density: 0.9,
      mix: [0.07, 0.08, 0.85],
      mid: [P + "Kerala_Fern"],
      herd: [],
    },
  ),
];

/** Packed-earth lanes and common spaces, with no modern playground kit. */
export const WHISPER_SPACES = [
  { lesson: 1, at: 0.75, z: -18, rx: 1.3, rz: 9, kind: "lane" },
  { lesson: 2, at: 0.65, z: -19, rx: 1.5, rz: 11, kind: "lane" },
  { lesson: 3, at: 0.35, z: -20, rx: 1.4, rz: 12, kind: "lane" },
  { lesson: 3, at: 0.78, z: -22, rx: 1.3, rz: 10, kind: "lane" },
  { lesson: 4, at: 0.28, z: -18, rx: 1.6, rz: 10, kind: "lane" },
  { lesson: 4, at: 0.68, z: -19, rx: 1.6, rz: 11, kind: "lane" },
  { lesson: 4, at: 0.47, z: -13, rx: 5, rz: 3.5, kind: "rest" },
  { lesson: 5, at: 0.64, z: -20, rx: 2, rz: 12, kind: "lane" },
  { lesson: 6, at: 0.33, z: -17, rx: 1.7, rz: 9, kind: "lane" },
  { lesson: 7, at: 0.57, z: -18, rx: 1.6, rz: 10, kind: "lane" },
  { lesson: 7, at: 0.44, z: -11.5, rx: 4, rz: 3, kind: "play" },
  { lesson: 8, at: 0.65, z: -19, rx: 1.4, rz: 11, kind: "lane" },
  { lesson: 9, at: 0.4, z: -18, rx: 1.2, rz: 9, kind: "lane" },
] as const;

/** Fixed off-road nodes. Not random road spawns; never temple interiors. */
export const WHISPER_NODES = [
  { lesson: 4, at: 0.42, z: -12, kind: "root", lift: 0 },
  { lesson: 5, at: 0.43, z: -10, kind: "basket", lift: 0 },
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
  const evening = h >= 19 && h < 21;
  const strength =
    (MYSTERY_INTENSITY[lesson - 1] ?? 0) *
    (lesson === 8 ? Math.max(0, 1 - fraction * 2) : 1);
  return {
    strength,
    // No clear reveal before the banyan; the market tells its story with
    // props. NOT ON TEMPLE STREET (6): he is never seen at or near a temple,
    // and on the shorter roads nowhere in that lesson is far enough from it.
    // Its hints stay, placed clear of the temple — see reserveWhisperProps.
    figure: deep && [4, 7, 8].includes(lesson) && strength > 0,
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
