/** The Village of Whispers: global lessons 21–30, on the existing road.
 * Geometry is independent of the clock. All coordinates are behind the lane.
 * The opening retains Chapter 2's meadow; the final road reveals no Chapter 4.
 */
import type { Lesson, Placed } from "./chapter1.ts";
import { footprintsOverlap, villageFootprint } from "./chapter3-layout.ts";
import { depthScale } from "./depth-scale.ts";

const P = "village-plants/";
const U = "village-util/";
const A = "ak-3d-pack/";
const grass = [P + "Taro_Chembu", P + "Hibiscus_Chemparathi"];
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

// ── THE 1960 VILLAGE (owner, 2 Oct 2026) ─────────────────────────────────
//
// Fourteen new Kerala houses and outbuildings (models/village-houses) replace
// the old cottages. Everything below is placed from ONE plan, in absolute
// chapter units (lesson n covers x = (n-1)*64 .. n*64), because the village is
// one continuous street rather than ten separate lessons: see
// keylearn-world-mocks/village-ch3/index.html.
//
//   - houses are at 75% of life (2.57 units per metre of height, falling with
//     depth like everything else), front face on z -11, behind the verge;
//   - five cross roads run back from the main road, with houses on both sides
//     facing the lane (`CHAPTER3_LANES`, drawn by world.ts);
//   - the viewer's side of the road stays empty, as the camera needs.
const persp = (z: number) => depthScale(z, 42, 2);
// 2.35, not 2.57: the owner asked for the houses a touch smaller (3 Oct
// 2026) so they sit better in the frame. The Mana is sized on its own.
const UM = 2.35;
type HouseSpec = { file: string; w: number; d: number; h: number };
const HOUSES: Readonly<Record<number, HouseSpec>> = {
  1: { file: "01_large_nalukettu", w: 15.1, d: 11.3, h: 6.5 },
  2: { file: "02_long_veranda_house", w: 14.0, d: 8.0, h: 5.4 },
  3: { file: "03_two_storey_house", w: 12.4, d: 8.7, h: 8.3 },
  4: { file: "04_compact_tiled_house", w: 9.2, d: 8.0, h: 5.4 },
  5: { file: "05_wooden_laterite_house", w: 10.0, d: 9.0, h: 5.5 },
  6: { file: "06_simple_thatched_house", w: 8.2, d: 7.2, h: 4.5 },
  7: { file: "07_fisherman_coastal_house", w: 10.2, d: 7.0, h: 4.6 },
  8: { file: "08_workers_house_modest", w: 7.7, d: 6.7, h: 4.8 },
  9: { file: "09_storeroom_outbuilding", w: 5.9, d: 5.7, h: 4.5 },
  10: { file: "10_granary_vayalpura", w: 5.8, d: 5.6, h: 4.8 },
  11: { file: "11_ezhara_veedu_elite", w: 13.2, d: 11.8, h: 7.5 },
  12: { file: "12_courtyard_nadumuttam_house", w: 12.6, d: 11.5, h: 4.8 },
  13: { file: "13_hill_slope_house", w: 11.0, d: 11.0, h: 6.8 },
  14: { file: "14_farmers_house_rustic", w: 13.0, d: 7.5, h: 5.3 },
};
export const VILLAGE_HOUSES = "village-houses/";
/** The cross roads: centre x (chapter units), half width, name. Drawn by world.ts. */
export const CHAPTER3_LANES = [
  { x: 96, hw: 4.5, name: "Kulam Lane" },
  { x: 205, hw: 6, name: "Banyan Junction" },
  { x: 380, hw: 5.5, name: "Temple Road" },
  { x: 512, hw: 4.5, name: "Mana Lane" },
  { x: 592, hw: 3.5, name: "Paddy track" },
] as const;
type Abs = Placed & { readonly ax: number };
/** Authored at an absolute chapter x; `byLesson` turns it into (lesson, at). */
const abs = (ax: number, p: Omit<Placed, "at">): Abs => ({ ...p, at: 0, ax });
/** A house facing the road, front face on z -11. */
const roadHouse = (id: number, ax: number): Abs => {
  const sp = HOUSES[id]!;
  const hh = sp.h * UM;
  let z = -11 - (sp.d * UM * 0.78) / 2;
  for (let i = 0; i < 4; i++) z = -11 - (sp.d * UM * persp(z)) / 2;
  // Every house model's front (steps, veranda, door) is on its -Z side, so a
  // house behind the road turns half round to face it. Unturned, all of
  // them showed the road their back wall (owner, 4 Oct 2026: "sideways, but
  // never back to the road"). `laneHouse` already turns -Z toward its lane.
  return abs(ax, {
    model: VILLAGE_HOUSES + sp.file,
    z,
    h: hh,
    turn: Math.PI,
    clear: 3,
  });
};
/** A house beside a cross road, turned to face it (side -1 = left of the lane). */
const laneHouse = (id: number, lane: number, side: -1 | 1): Abs => {
  const sp = HOUSES[id]!;
  const l = CHAPTER3_LANES.find((q) => q.x === lane)!;
  const hh = sp.h * UM;
  let z = -11 - (sp.w * UM * 0.78) / 2;
  for (let i = 0; i < 4; i++) z = -11 - (sp.w * UM * persp(z)) / 2;
  const dx = (sp.d * UM * persp(z)) / 2;
  return abs(lane + side * (l.hw + 1.5 + dx), {
    model: VILLAGE_HOUSES + sp.file,
    z,
    h: hh,
    turn: side < 0 ? -Math.PI / 2 : Math.PI / 2,
    clear: 3,
    // No `lift` for the wooden laterite house any more: its plinth stood
    // clear of the slope beside the Mana Lane (3 Oct 2026) and was sunk by
    // hand; the plot under every house is levelled now (world.ts PADS).
  });
};
/** A stone bench: a flat slab on two upright river stones. */
const bench = (ax: number, z = -9.4): Abs[] => [
  abs(ax - 1.2, { model: "village-stone/River_Stone", z, h: 1.05 }),
  abs(ax + 1.2, { model: "village-stone/River_Stone", z, h: 1.05 }),
  abs(ax, { model: "village-stone/Stepping_Stone", z, h: 0.9, lift: 0.55 }),
];
/** A stone chair: a flat seat with a granite boulder standing behind it. */
const stoneChair = (ax: number, z = -9.4): Abs[] => [
  abs(ax - 0.9, { model: "village-stone/River_Stone", z, h: 1.05 }),
  abs(ax + 0.9, { model: "village-stone/River_Stone", z, h: 1.05 }),
  abs(ax, { model: "village-stone/Mossy_Stone", z, h: 0.75, lift: 0.55 }),
  abs(ax, { model: "village-stone/Granite_Boulder", z: z - 1.2, h: 2.4 }),
];
/** A planted bed: a spread of the village's own plants inside a rectangle. */
const bed = (
  ax0: number,
  ax1: number,
  z0: number,
  z1: number,
  kinds: readonly string[],
  n: number,
): Abs[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const u = (i * 0.618034) % 1;
    return abs(ax0 + (ax1 - ax0) * t, {
      model: kinds[i % kinds.length]!,
      z: z0 + (z1 - z0) * u,
      h: kinds[i % kinds.length]!.includes("Banana") ? 6 : 1.2 + (i % 3) * 0.7,
    });
  });
const FLOWERS = [P + "Hibiscus_Chemparathi", P + "Taro_Chembu"];
const KITCHEN = [P + "Banana_Plant", P + "Tapioca_Cassava", P + "Taro_Chembu"];

// ── THE KAVU (owner, 3 Oct 2026) ────────────────────────────────────────
// Where the big house stood behind milestone 27 there is now a sacred grove,
// a pambin kavu: old trees close overhead, banana and shrubs under them, and
// a floor of fern and grass so thick the ground hardly shows. Fern and grass
// are a floor and may overlap (see GROUND_COVER); the trees are spaced.
const KAVU: readonly Abs[] = (() => {
  const T = (file: string, ax: number, z: number, h: number) =>
    abs(ax, { model: P + file, z, h, grove: true });
  const trees: Abs[] = [
    T("Banyan_Almaram", 452, -31, 21),
    T("Peepal_Arayal", 443, -27, 18),
    T("Mango_Tree", 459, -26, 15),
    T("Mango_Tree", 440, -34, 16),
    T("Mango_Tree", 464, -34, 14),
    T("Mango_Tree", 437, -16, 12),
    T("Jackfruit_Tree", 448, -22, 18),
    T("Jackfruit_Tree", 457, -20, 13),
    T("Jackfruit_Tree", 444, -15, 14),
    T("Jackfruit_Tree", 461, -15, 19),
    // No coconut palms in a kavu (owner); two karimpana stand over it.
    T("Palmyra_Karimpana", 439, -21, 25),
    T("Palmyra_Karimpana", 455, -36, 27),
    T("Mango_Tree", 446, -36, 15),
    T("Peepal_Arayal", 464, -23, 16),
    T("Jackfruit_Tree", 466, -29, 16),
    T("Mango_Tree", 449.5, -33.5, 17),
    T("Mango_Tree", 461, -37, 15),
    T("Arecanut_Palm", 450, -17, 16),
    T("Arecanut_Palm", 435, -27, 17),
    T("Arecanut_Palm", 460, -31, 15),
    T("Arecanut_Palm", 453, -24, 17),
  ];
  let seed = 3102026;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const under: Abs[] = [];
  const shrubs = ["Banana_Plant", "Hibiscus_Chemparathi", "Taro_Chembu", "Tapioca_Cassava", "Taro_Chembu"];
  const tall = { Banana_Plant: 5.5, Hibiscus_Chemparathi: 3, Taro_Chembu: 1.8, Tapioca_Cassava: 2.4 } as Record<string, number>;
  for (let i = 0; i < 44; i++) {
    const f = shrubs[i % shrubs.length]!;
    under.push(T(f, 436 + rnd() * 31, -14 - rnd() * 22, tall[f]! * (0.8 + rnd() * 0.4)));
  }
  // The floor itself (grass and fern, several hundred of them) is planted by
  // world.ts as instanced meshes across this grove's ground: as single props
  // they would be hundreds of draw calls.
  const stones = [
    abs(451, { model: "village-stone/Mossy_Stone", z: -26, h: 1.1, grove: true }),
    abs(454, { model: "village-stone/River_Stone", z: -25, h: 0.8, grove: true }),
    abs(447, { model: "village-stone/Mossy_Stone", z: -27, h: 0.7, grove: true }),
  ];
  return [...trees, ...under, ...stones];
})();

// ── INSIDE THE MANA'S WALL (owner, 3 Oct 2026) ──────────────────────────
// "Lots of shrubs including hibiscus, and fruit plants like jackfruit and
// mango, along inside the fence." The wall runs x 464-492 at z -16 with the
// gate at 478; the strip behind it is planted, the gate-to-poomukham path
// (x 474.5-481.5) is left open, and the fruit trees stand at the flanks so
// none of them hides the house's front.
const MANA_GARDEN: readonly Abs[] = (() => {
  const out: Abs[] = [];
  let seed = 4102026;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const low = [
    ["Hibiscus_Chemparathi", 3],
    ["Hibiscus_Chemparathi", 2.6],
    ["Taro_Chembu", 1.7],
    ["Tapioca_Cassava", 2.3],
    ["Hibiscus_Chemparathi", 3.2],
  ] as const;
  let i = 0;
  for (let x = 465.5; x < 491.5; x += 1.7) {
    if (x > 471.5 && x < 482.5) continue;
    const [f, h] = low[i++ % low.length]!;
    out.push(abs(x + (rnd() - 0.5) * 0.6, { model: P + f, z: -17.6 - rnd() * 2.2, h: h * (0.85 + rnd() * 0.3) }));
  }
  const fruit: [string, number, number, number][] = [
    ["Mango_Tree", 492, -25, 13],
    ["Jackfruit_Tree", 494, -32, 18],
    ["Mango_Tree", 459.5, -31, 15],
    ["Papaya_Tree", 490.5, -20, 6],
    ["Banana_Plant", 491.5, -23.5, 5.5],
    ["Jackfruit_Tree", 466.5, -22, 14],
    ["Papaya_Tree", 468.5, -20.5, 5.5],
    ["Mango_Tree", 463.5, -38, 12],
  ];
  for (const [f, ax, z, h] of fruit) out.push(abs(ax, { model: P + f, z, h }));
  // The household's well, inside the wall to the right of the path.
  out.push(abs(489, { model: U + "Village_Well", z: -21.5, h: 3.2, clear: 2 }));
  return out;
})();

// Trees between the Mana and milestone 28, around the storeroom (owner,
// 3 Oct 2026), kept west of the Mana Lane at x 512.
const AFTER_MANA: readonly Abs[] = (
  [
    ["Mango_Tree", 496, -29, 13],
    ["Jackfruit_Tree", 503, -24, 17],
    ["Mango_Tree", 500.5, -35.5, 14],
    ["Arecanut_Palm", 505, -30, 15],
    ["Jackfruit_Tree", 495.5, -35, 13],
    ["Mango_Tree", 507, -21, 12],
    ["Arecanut_Palm", 501.5, -28.5, 16],
    ["Papaya_Tree", 503.5, -15, 6],
    ["Banana_Plant", 504.5, -19.5, 5.5],
    ["Hibiscus_Chemparathi", 502.5, -12.8, 2.8],
  ] as [string, number, number, number][]
).map(([f, ax, z, h]) => abs(ax, { model: P + f, z, h }));
const VILLAGE_BASE: readonly Abs[] = [
  // front row, facing the main road
  roadHouse(14, 18), roadHouse(10, 40), roadHouse(9, 55),
  roadHouse(6, 128), roadHouse(4, 146), roadHouse(5, 168), roadHouse(8, 239),
  roadHouse(9, 498), roadHouse(1, 556), roadHouse(7, 630),
  // both sides of each cross road
  laneHouse(2, 96, -1), laneHouse(4, 96, 1), laneHouse(3, 205, -1),
  laneHouse(12, 380, 1), laneHouse(5, 512, 1), laneHouse(14, 592, -1), laneHouse(13, 592, 1),
  // gardens of the village centre
  ...bed(326, 343, -24, -14, FLOWERS, 6),
  ...bed(231, 247, -37, -27, KITCHEN, 6), ...bed(134, 155, -37, -27, KITCHEN, 6),
  ...bed(214, 230, -20, -13, [P + "Taro_Chembu", P + "Hibiscus_Chemparathi"], 4),
  ...bed(413, 435, -20, -13, [P + "Taro_Chembu", P + "Hibiscus_Chemparathi"], 4),
  // bamboo clumps behind and at the ends of the market (owner, 2 Oct 2026)
  ...[[262, -36], [292, -37], [318, -36], [247, -32], [329, -31]].map(([x, z]) =>
    abs(x!, { model: "nature/KeralaBambooGroves", z: z!, h: 17, clear: 2 }),
  ),
  // stone seats
  ...bench(190.5), ...bench(300, -9), ...bench(418, -12.5),
  ...stoneChair(430, -12.5), ...bench(471.5),
  ...bench(216, -13), ...bench(222, -14.5), ...bench(228, -13), ...bench(318.5, -29),
  // THE TEMPLE POND (owner, 3 Oct 2026; in the approved plan): the stone
  // tank and kulippura after the temple and its garden, before Temple Road,
  // at the back of Lesson 26.
  // `h` is the asset's units per metre, as in Chapters 1 and 2.
  abs(365.5, { model: U + "Kulappura_Pond", z: -21, h: 1.5, clear: 2 }),
];

// ── THE COMPOUNDS (owner, 2 Oct 2026) ────────────────────────────────────
// "Normal Kerala houses have many trees, plants and coconut palms in their
// land": the ground between and behind the houses is planted, so no house
// stands bare in the open. Deterministic (no Math.random), thinned wherever
// a house, a lane, a public space or a seat already has the ground.
const NO_PLANT: readonly (readonly [number, number])[] = [
  [244, 332], // market
  [338, 376], // the temple, its forecourt and its pond
  [208, 236], // banyan green
  [408, 438], // playground
  [434, 470], // the kavu
  [460, 494], // mana
  ...CHAPTER3_LANES.map((l) => [l.x - l.hw - 4, l.x + l.hw + 4] as const),
];
const GREEN_KINDS: readonly { file: string; h: number; w: number }[] = [
  { file: "village-plants/Coconut_Palm", h: 24, w: 0 },
  { file: "village-plants/Coconut_Palm", h: 21, w: 0 },
  { file: "village-plants/Mango_Tree", h: 13, w: 1 },
  { file: "village-plants/Jackfruit_Tree", h: 10, w: 1 },
  { file: "village-plants/Banana_Plant", h: 5.5, w: 2 },
  { file: "village-plants/Banana_Plant", h: 6.5, w: 2 },
  { file: "village-plants/Hibiscus_Chemparathi", h: 2.8, w: 3 },
  { file: "village-plants/Tapioca_Cassava", h: 2.2, w: 3 },
  { file: "village-plants/Taro_Chembu", h: 1.5, w: 3 },
];
const compounds = (base: readonly Abs[]): Abs[] => {
  const fixed = base.map((p) => ({
    ...p,
    x: p.ax,
    h: p.h,
    z: p.z,
  }));
  const boxes = fixed.map((p) => villageFootprint(p as never, persp));
  const out: Abs[] = [];
  let seed = 20261002;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let x = 5; x < 636; x += 3.2) {
    if (NO_PLANT.some(([a, b]) => x > a && x < b)) continue;
    const n = rnd() < 0.55 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const kind = GREEN_KINDS[Math.floor(rnd() * GREEN_KINDS.length)]!;
      // Palms and trees stand behind; low plants edge the yard fronts.
      const low = kind.w >= 2;
      const z = low ? -12.5 - rnd() * 7 : -22 - rnd() * 13;
      const ax = x + (rnd() - 0.5) * 3;
      const cand = { model: kind.file, x: ax, z, h: kind.h * (0.85 + rnd() * 0.3) };
      const box = villageFootprint(cand as never, persp);
      const hit =
        boxes.some((b) => footprintsOverlap(b, box, 0.4)) ||
        z - box.d / 2 < -37.5;
      if (hit) continue;
      boxes.push(box);
      out.push(abs(ax, { model: cand.model, z, h: cand.h, turn: rnd() * 6 }));
    }
  }
  return out;
};
const VILLAGE: readonly Abs[] = [
  ...VILLAGE_BASE,
  ...KAVU,
  ...MANA_GARDEN,
  ...AFTER_MANA,
  ...compounds([...VILLAGE_BASE, ...KAVU, ...MANA_GARDEN, ...AFTER_MANA]),
];
const lessonOf = (ax: number) => Math.min(10, Math.max(1, Math.floor(ax / 64) + 1));
const byLesson = (n: number): readonly Placed[] =>
  VILLAGE.filter((p) => lessonOf(p.ax) === n).map(({ ax, ...p }) => ({
    ...p,
    at: (ax - (n - 1) * 64) / 64,
  }));
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
// THE SEVEN-SHOP KERALA ROW (owner, 1 Oct 2026), the same asset, size and
// sinking as Chapter 1's market: 19.4 tall, about 52 units of frontage, set a
// little into the ground. Width and depth per unit of height are 3.61 and 0.814.
const market = (at: number, z = -20): Placed => ({
  ...prop(U + "Kerala_Market_Row", at, z, 19.4, 6),
  lift: -1.8,
  box: { w: 3.61, d: 0.814, span: 1.3, want: 56, referenceZ: -20 },
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
  props: [...props, ...byLesson(n)],
  herd: [],
  // No buffalo anywhere in the village (owner, 4 Oct 2026: "no buffalo
  // should be placed inside a village"). This chapter is one continuous
  // street of houses, so its open ground is gardens and yards, not grazing;
  // the buffalo stay in the fields and pastures of the other chapters.
  buffalo: false,
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
      // THE BACK ROW: smaller (about 70 per cent) and further back, mirrored so
      // its two-storey end is on the right (owner, 1 Oct 2026).
      { ...market(0.82, -33), h: 13.6, mirror: true },
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
      // The wall fronts the temple only, and the peepal and garden plot that
      // stood beyond it are gone: the temple pond is there now and must be
      // seen from the road (owner, 3 Oct 2026).
      wall(0.3, 4, -17),
      well(0.35),
      produce(0.18),
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
      // The well went inside the wall (owner, 3 Oct 2026); a cart stands
      // where it used to be.
      cart(0.58),
      // Eight panels, not seven: the wall runs on to the storeroom by the
      // road so the compound is closed (owner, 3 Oct 2026). The gate is
      // still the fourth opening from the left.
      {
        ...gatedWall(0.28),
        run: { ...gatedWall(0.28).run!, count: 8 },
      },
      { ...prop(VILLAGE_HOUSES + "Mana", 0.45, -40.5, 14.8, 4), turn: Math.PI },
      ...garden(0.86, -20),
    ],
    { density: 1.25, folk: ["Headman", "FarmerWoman"], corridor: true },
  ),
  lesson(
    9,
    "Edge Gardens",
    [
      well(0.42),
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
