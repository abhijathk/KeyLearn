/** One wide river, one genuine island, two road-aligned wooden spans.
 * Coordinates follow lesson bounds, including the shortest children's road.
 * M37 is on the island; the exit crossing occupies the opening of lesson 38.
 */
export type WildCrossing = ReturnType<typeof wildCrossing>;
export function wildCrossing(bounds: readonly number[]) {
  const milestone = bounds[7]!;
  // Reserve dry verges for M36 and M38 as well as M37. The bridge is
  // revealed ahead at the end of L36; walking the second span opens L38.
  const half = Math.max(
    16,
    Math.min(milestone - bounds[6]!, bounds[8]! - milestone) - 9,
  );
  const islandX = milestone;
  const approach = islandX - half;
  const exit = islandX + half;
  const islandRX = Math.min(10, (milestone - bounds[6]!) * 0.24);
  const islandZ = -4;
  const islandRZ = 19;
  const spans = [
    { from: approach - 2, to: islandX - islandRX * 0.57 },
    { from: islandX + islandRX * 0.57, to: exit + 2 },
  ] as const;
  return {
    hills: [
      {
        x: (bounds[3]! + bounds[4]!) / 2,
        width: bounds[5]! - bounds[2]!,
        height: 3.5,
      },
      { x: bounds[9]!, width: bounds[10]! - bounds[8]!, height: 1.8 },
    ],
    approach,
    exit,
    revealStart: bounds[5]! - (bounds[5]! - bounds[4]!) * 0.25,
    islandX,
    islandRX,
    islandZ,
    islandRZ,
    milestone,
    spans,
  };
}
const smooth = (t: number) => {
  const a = Math.max(0, Math.min(1, t));
  return a * a * (3 - 2 * a);
};
/** Open the river behind the approaching bank, revealing it in lesson 35/36. */
export function wildBanks(c: WildCrossing, z: number) {
  const reveal = smooth((-z - 5) / 27);
  return {
    left: c.approach - reveal * (c.approach - c.revealStart),
    right: c.exit + reveal * 6,
  };
}
export function islandRadius(c: WildCrossing, x: number, z: number) {
  return Math.hypot((x - c.islandX) / c.islandRX, (z - c.islandZ) / c.islandRZ);
}
/** Flat dry core and a rounded sandy margin, surrounded by water on all sides. */
export function wildTerrain(
  c: WildCrossing,
  x: number,
  z: number,
  natural: number,
  bankY: number,
) {
  const rise = c.hills.reduce(
    (sum, h) =>
      sum + h.height * Math.exp(-(((x - h.x) / (h.width * 0.4)) ** 2)),
    0,
  );
  natural += rise * smooth((-z - 10) / 20);
  const bank = wildBanks(c, z);
  // THE HILLS COME DOWN TO THE RIVER, NOT OFF A CLIFF INTO IT. The river cut
  // lowers the ground to the bed over three units, which is a bank when the
  // ground there is at bank height and a cliff when a hill stands at the
  // water: behind the far bank the second hill put 2.4 above the bank on the
  // waterline, and the cut dropped six units in three — a steep pale face
  // behind the Lesson 38–39 mangroves (owner, 25 Sep 2026). So the land is
  // eased down to bank height over the last eight units before either bank,
  // and the cut starts from there, as it does everywhere else.
  const toBank =
    x <= bank.left ? bank.left - x : x >= bank.right ? x - bank.right : 0;
  const ease = smooth(toBank / 8);
  natural = natural * ease + bankY * (1 - ease);
  const cut = smooth(Math.min(x - bank.left, bank.right - x) / 3);
  const bed = bankY - 3.6;
  let y = natural * (1 - cut) + bed * cut;
  const island = 1 - smooth((islandRadius(c, x, z) - 0.67) / 0.33);
  y = y * (1 - island) + bankY * island;
  // Level the dry approaches to the same deck elevation. No steps at joins.
  const landing = Math.max(
    1 - smooth(Math.abs(x - bank.left) / 4),
    1 - smooth(Math.abs(x - bank.right) / 4),
  );
  if (x <= bank.left || x >= bank.right)
    y = y * (1 - landing) + bankY * landing;
  return y;
}
export function wildDry(c: WildCrossing, x: number, z: number, margin = 0) {
  const b = wildBanks(c, z);
  return (
    x < b.left - margin ||
    x > b.right + margin ||
    islandRadius(c, x, z) < 0.76 - margin / c.islandRX
  );
}
/**
 * Dry ground all round a point, not just along the road. `wildDry`'s margin
 * is measured in x, which is right for a bank square to the road and wrong
 * for the diagonal one in Lessons 35–36: there the river opens BEHIND a
 * point that passes, and a tree or a buffalo stood on the waterline with
 * water two units back.
 */
export function wildDryAround(
  c: WildCrossing,
  x: number,
  z: number,
  r: number,
) {
  if (!wildDry(c, x, z)) return false;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    if (!wildDry(c, x + Math.cos(a) * r, z + Math.sin(a) * r)) return false;
  }
  return true;
}
/** Stop an off-road step at either channel, including steps leaving the island. */
export function wildLimit(
  c: WildCrossing,
  from: number,
  to: number,
  z: number,
) {
  const b = wildBanks(c, z);
  const dz = (z - c.islandZ) / c.islandRZ;
  const half = c.islandRX * Math.sqrt(Math.max(0, 0.76 ** 2 - dz * dz));
  const channels =
    half > 0
      ? [
          [b.left, c.islandX - half],
          [c.islandX + half, b.right],
        ]
      : [[b.left, b.right]];
  let result = to;
  for (const [lo, hi] of channels as [number, number][]) {
    if (to > from && from <= lo && result > lo) result = lo;
    if (to < from && from >= hi && result < hi) result = hi;
  }
  return result;
}
/** Repeated modules extend the asset without stretching its rails or width. */
export function bridgeModules(from: number, to: number, maxLength = 9) {
  const count = Math.max(1, Math.ceil((to - from) / maxLength));
  const length = (to - from) / count;
  return Array.from({ length: count }, (_, i) => ({
    x: from + (i + 0.5) * length,
    length,
  }));
}

/**
 * WHERE THE ISLAND'S WATERLINE IS. `wildTerrain` lifts the island to the bank
 * from a bed 3.6 below it and the water stands 0.9 under the bank, so the
 * shore is where the island blend reaches 0.75 — at 0.778 of its radii.
 */
export const ISLAND_SHORE = 0.778;

/**
 * A point on the island's shore at a bearing (degrees; 90 is toward the
 * camera), moved `inland` world units square to the shore. Negative inland
 * is out into the water.
 */
export function islandShore(c: WildCrossing, deg: number, inland: number) {
  const a = (deg * Math.PI) / 180;
  const x = c.islandX + Math.cos(a) * c.islandRX * ISLAND_SHORE;
  const z = c.islandZ + Math.sin(a) * c.islandRZ * ISLAND_SHORE;
  const nx = -(x - c.islandX) / c.islandRX ** 2;
  const nz = -(z - c.islandZ) / c.islandRZ ** 2;
  const n = Math.hypot(nx, nz) || 1;
  return { x: x + (nx / n) * inland, z: z + (nz / n) * inland };
}

/**
 * THE ISLAND BANYAN — one wide tree with a quarter of its trunk in the river.
 * The numbers and the reasons for them are in world.ts where it is planted;
 * they live here so the sightings below can stand beside the same trunk.
 */
export const ISLAND_BANYAN = {
  deg: -120,
  h: 19,
  tall: 1.6,
  along: 1.6,
  deep: 1.1,
} as const;
/** The trunk proper, not the root flare: 0.06 of the height, deepened. */
export const islandBanyanTrunkR = () =>
  0.06 * ISLAND_BANYAN.h * ISLAND_BANYAN.deep;
export function islandBanyanAt(c: WildCrossing) {
  return islandShore(c, ISLAND_BANYAN.deg, islandBanyanTrunkR() * 0.4);
}

/**
 * THE MANGROVE — beside the entry bridge where it lands on the island, on
 * the back side of the deck, between the bridge and the banyan: standing in
 * the river with a fifth of its root cage on the island. Round at -155 the
 * shore is ten units behind the road, so the cage and crown stay off the
 * deck (it is 6.8 each side of the road). `foot` is the root cage's radius
 * as a fraction of the height (measured off the model, 1.8 m of roots round
 * a 4.3 m tree). The centre goes 0.48 of that radius out from the
 * waterline, which is where this curve of shore leaves 20% of the cage on
 * land — measured, see the chapter 4 test.
 */
export const ISLAND_MANGROVE = {
  deg: -155,
  h: 7,
  foot: 0.42,
} as const;
/** `depth` is the world's depth scale at the spot, which `stand` applies to h. */
export function islandMangroveAt(c: WildCrossing, depth = 1) {
  const r = ISLAND_MANGROVE.foot * ISLAND_MANGROVE.h * depth;
  return islandShore(c, ISLAND_MANGROVE.deg, -0.48 * r);
}

/**
 * THE MANGROVE STAND — the rest of the mangroves, grown the way they grow:
 * in clumps, not in a row. A tall parent with younger trees round it, the
 * clumps thickest against the island's left shore and thinning out along
 * the entry bridge toward the far bank, with a few loners between.
 *
 * Seeded, not hashed per tree: one fixed sequence lays the whole stand, so
 * it is irregular but the same on every visit, and it is laid against this
 * road's own crossing so the youngest band's shorter bridge still gets one.
 *
 * Every tree must:
 *   - stand in the river (its centre off the island and off the left bank);
 *     its roots may reach the shore, which is what the island clumps do;
 *   - keep its root cage behind the deck (6.8 behind the road), on the
 *     banyan's side, so nothing stands in the child's way or in front of
 *     the milestone;
 *   - keep off the banyan's trunk and not share a trunk with a neighbour —
 *     roots may interlace (that is a mangrove thicket), trunks may not.
 */
/**
 * How far a point in the river is from dry land — the nearer bank or the
 * island's shore, in world units. Mangroves stand in the shallows, and the
 * shallows are the first few units out from land.
 */
export function wildToLand(c: WildCrossing, x: number, z: number) {
  const bank = wildBanks(c, z);
  let d = Math.min(Math.abs(x - bank.left), Math.abs(bank.right - x));
  for (let deg = -180; deg < 180; deg += 3) {
    const p = islandShore(c, deg, 0);
    d = Math.min(d, Math.hypot(p.x - x, p.z - z));
  }
  return d;
}
/** Furthest a mangrove's trunk stands from land (owner, 25 Sep 2026). */
export const MANGROVE_SHALLOWS = 3.2;
export const MANGROVE_ROOT = 0.42; // root cage radius / height, off the model
const DECK_BACK = 6.8;
export function mangroveStand(c: WildCrossing) {
  let seed = 0x6d616e67; // "mang"
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (a: number, b: number) => a + (b - a) * rnd();
  const banyan = islandBanyanAt(c);
  const first = islandMangroveAt(c);
  const trees: { x: number; z: number; h: number; turn: number }[] = [
    { x: first.x, z: first.z, h: ISLAND_MANGROVE.h, turn: 2.2 },
  ];
  const fits = (x: number, z: number, h: number) => {
    const r = MANGROVE_ROOT * h;
    if (z + r > -DECK_BACK) return false;
    if (islandRadius(c, x, z) < ISLAND_SHORE + 0.02) return false;
    const bank = wildBanks(c, z);
    if (x - r * 0.5 < bank.left || x + r * 0.5 > bank.right) return false;
    if (Math.hypot(x - banyan.x, z - banyan.z) < islandBanyanTrunkR() + r * 0.7)
      return false;
    // IN THE SHALLOWS, NOT OUT IN THE RIVER. Clumps out along the bridges
    // stood in open deep water, which is not where a mangrove grows.
    if (wildToLand(c, x, z) > MANGROVE_SHALLOWS) return false;
    return trees.every(
      (t) => Math.hypot(t.x - x, t.z - z) > 0.45 * (MANGROVE_ROOT * (t.h + h)),
    );
  };
  const plant = (x: number, z: number, h: number) => {
    if (!fits(x, z, h)) return false;
    trees.push({ x, z, h, turn: range(0, Math.PI * 2) });
    return true;
  };
  const clump = (cx: number, cz: number, n: number, tall: number) => {
    // The parent first, then its young ones round it, each try jittered.
    for (let k = 0, placed = 0; k < n * 12 && placed < n; k++) {
      const h =
        placed === 0 ? tall * range(0.92, 1.08) : tall * range(0.5, 0.82);
      // A parent crowded out of its spot looks a little further off.
      const d = placed === 0 ? range(0, 0.6 + 0.3 * k) : range(1.4, 3.2);
      const a = range(0, Math.PI * 2);
      if (plant(cx + Math.cos(a) * d, cz + Math.sin(a) * d, h)) placed++;
    }
  };
  // Against the island's left and back-left shore, just out in the water.
  for (const [deg, n, tall] of [
    [-138, 3, 6.4],
    [-150, 3, 5.0],
    [-128, 2, 7.2],
    [-165, 2, 4.4],
  ] as const) {
    const p = islandShore(c, deg + range(-5, 5), -range(2.2, 3.6));
    clump(p.x, p.z, n, tall);
  }
  // Along the approach bank as well, in the shallows under it.
  for (const [back, n, tall] of [
    [11, 2, 5.6],
    [16, 3, 6.4],
    [21, 2, 4.8],
  ] as const) {
    const z = -back + range(-1, 1);
    clump(wildBanks(c, z).left + range(1.8, 2.6), z, n, tall);
  }
  // THE FAR BANK, on the way to Milestone 38 and 39: clumps hugging the
  // right bank, where the child steps off the second bridge, and a few
  // out along that bridge. Measured from the bank itself, which opens
  // wider the further back it runs (`wildBanks`).
  for (const [back, n, tall] of [
    [10.5, 3, 7.0],
    [14.0, 3, 5.8],
    [17.5, 2, 6.6],
    [21.0, 2, 5.0],
  ] as const) {
    const z = -back + range(-1, 1);
    clump(wildBanks(c, z).right - range(1.8, 2.6), z, n, tall);
  }
  return trees.slice(1);
}

/**
 * THE BIG MANGROVE — one full-grown tree (its own model, not the stand's)
 * in the shallows off the approach bank, where lesson 36 walks up to the
 * river (owner, 25 Sep 2026: "near the water.. mangroves grow in shallow
 * waters near the bank"). 3 out from the bank: inside the shallows (the
 * river is 1.2–2.3 deep there, measured on the built terrain), and clear of
 * the bank stones, which sit at most 1.1 out. Back in the bay the bank
 * opens into, not at the bridge head: there it stood behind Milestone 36
 * and the walkers and read as a bush on the bank. The first spot that far
 * back which is well clear of every trunk in the stand.
 */
export const BIG_MANGROVE = {
  h: 7,
  out: 3,
  clear: 4,
  back: 15,
  offDeck: 12,
} as const;
export function bigMangroveAt(c: WildCrossing) {
  const trunks = [...mangroveStand(c), islandMangroveAt(c)];
  const { h, out, clear, back, offDeck } = BIG_MANGROVE;
  for (let z = -back; z >= -30; z -= 0.5) {
    const x = wildBanks(c, z).left + out;
    if (z + MANGROVE_ROOT * h >= -DECK_BACK) continue;
    if (x > c.approach - offDeck) continue;
    if (wildToLand(c, x, z) > MANGROVE_SHALLOWS) continue;
    if (trunks.every((t) => Math.hypot(t.x - x, t.z - z) >= clear)) {
      return { x, z, h, turn: 0.9 };
    }
  }
  return null;
}

/** Island sightings stay attached to their landmarks at every road length. */
export function wildIslandNodes(bounds: readonly number[]) {
  const c = wildCrossing(bounds);
  const begin = bounds[6]!;
  const length = bounds[7]! - begin;
  // At the foot of the banyan's trunk, on the side the road can see — "dart
  // behind an island tree" — rather than where the old mango stood. Toward
  // the road rather than beside it: the trunk is widened along the river,
  // and on the youngest band's short island a spot beside it lands past
  // Milestone 37, in the next lesson.
  const tree = islandBanyanAt(c);
  return [
    { x: c.milestone - 0.6, z: -10, kind: "path" },
    {
      x: tree.x,
      z: tree.z + islandBanyanTrunkR() + 1.5,
      kind: "tree",
    },
    {
      x: (c.spans[0].from + c.spans[0].to) / 2,
      z: -8,
      kind: "bridge",
    },
  ].map(({ x, ...node }) => ({ ...node, lesson: 7, at: (x - begin) / length }));
}
