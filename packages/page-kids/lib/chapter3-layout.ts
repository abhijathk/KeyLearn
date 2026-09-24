import type { Placed } from "./chapter1.ts";
import { CHAPTER3_DIMENSIONS } from "./chapter3-dimensions.ts";

export type VillagePlacement = Placed & {
  x: number;
  width?: number;
  depth?: number;
};
export type Footprint = { x: number; z: number; w: number; d: number };
/** One shopkeeper belongs to the roadside market row, never its distant copy. */
export function shopkeeperMarket(placements: readonly VillagePlacement[]) {
  return placements
    .filter((p) => p.model.endsWith("/Village_Market"))
    .sort((a, b) => b.z - a.z)[0];
}
/** Space in front of the forge for the seated smith and his legs. */
export function smithFootprint(
  placements: readonly VillagePlacement[],
  perspective: (z: number) => number,
): Footprint | null {
  const market = shopkeeperMarket(placements);
  if (!market) return null;
  const b = villageFootprint(market, perspective);
  return { x: b.x + b.w * 0.13, z: b.z + b.d / 2 + 0.25, w: 2.4, d: 2 };
}
const building = /House|Cottage|Mana$|Market$|Temple$/;
const boundary = /Laterite_Wall|Estate_Gate|Bamboo_Fence/;
const tree = /Banyan|Peepal|Mango_Tree|Jackfruit_Tree/;

export function villageFootprint(
  p: VillagePlacement,
  perspective: (z: number) => number,
): Footprint {
  const dim = CHAPTER3_DIMENSIONS[p.model];
  if (!dim) throw new Error(`Missing Chapter 3 dimensions: ${p.model}`);
  const s = p.h * perspective(p.z),
    angle = p.turn ?? 0;
  // Canopies can overhang a courtyard. Reserve the trunk/root ground area.
  const w = tree.test(p.model) ? Math.min(dim.w, 0.22) : dim.w;
  const d = tree.test(p.model) ? Math.min(dim.d, 0.22) : dim.d;
  return {
    x: p.x,
    z: p.z,
    w: s * (w * Math.abs(Math.cos(angle)) + d * Math.abs(Math.sin(angle))),
    d: s * (d * Math.abs(Math.cos(angle)) + w * Math.abs(Math.sin(angle))),
  };
}
export function footprintsOverlap(
  a: Footprint,
  b: Footprint,
  gap = 0.35,
): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + gap
  );
}

/** Resolve the whole continuous village, not each lesson in isolation. */
export function resolveChapter3Layout(
  authored: readonly VillagePlacement[],
  bounds: readonly number[],
  perspective: (z: number) => number,
): { placements: VillagePlacement[]; unresolved: string[] } {
  const lesson = (x: number) =>
    Math.max(0, Math.min(9, bounds.findIndex((v, i) => i > 0 && x < v) - 1));
  const entries = authored.map((p, index) => ({
    p: { ...p },
    index,
    lesson: lesson(p.x),
  }));
  const placed: Footprint[] = [],
    unresolved: string[] = [];
  const priority = (p: VillagePlacement) =>
    p.model.endsWith("/Village_Market")
      ? 0
      : /Temple$/.test(p.model)
        ? 1
        : /Mana$/.test(p.model)
          ? 2
          : building.test(p.model)
            ? 3
            : boundary.test(p.model)
              ? 4
              : tree.test(p.model)
                ? 5
                : 6;
  const groups: (typeof entries)[] = [];
  for (const e of entries) {
    const group =
      boundary.test(e.p.model) &&
      groups.find(
        (g) =>
          boundary.test(g[0]!.p.model) &&
          g[0]!.lesson === e.lesson &&
          g[0]!.p.at === e.p.at &&
          g[0]!.p.z === e.p.z,
      );
    if (group) group.push(e);
    else groups.push([e]);
  }
  groups.sort(
    (a, b) =>
      priority(a[0]!.p) - priority(b[0]!.p) || a[0]!.index - b[0]!.index,
  );
  let reservedSmith = false;
  for (const group of groups) {
    const first = group[0]!,
      source = first.p;
    if (!reservedSmith && priority(source) >= 4) {
      const forge = smithFootprint(
        entries.map((e) => e.p),
        perspective,
      );
      if (forge) placed.push(forge);
      reservedSmith = true;
    }
    const from = bounds[first.lesson]!,
      end = bounds[first.lesson + 1]!;
    const gate = group.find((e) => /Estate_Gate$/.test(e.p.model));
    const mana =
      gate &&
      entries.find((e) => e.lesson === first.lesson && /Mana$/.test(e.p.model));
    const alignX = gate && mana ? mana.p.x - gate.p.x : 0;
    const candidates: { dx: number; dz: number; cost: number }[] = [];
    const maxShift = Math.max(12, (end - from) * 0.48);
    for (let dz = -24; dz <= 24; dz += 0.5) {
      for (let dx = -maxShift; dx <= maxShift; dx += 0.5) {
        if (mana && Math.abs(dx) > 0.26) continue;
        candidates.push({
          dx: mana ? alignX : dx + alignX,
          dz,
          cost: dx * dx + dz * dz * 1.2,
        });
      }
    }
    candidates.push({ dx: alignX, dz: 0, cost: 0 });
    candidates.sort((a, b) => a.cost - b.cost);
    let found = false;
    for (const c of candidates) {
      const anchor = gate?.p.x ?? source.x;
      const spacing = boundary.test(source.model)
        ? perspective(source.z + c.dz) / perspective(source.z)
        : 1;
      const next = group.map((e) => ({
        ...e.p,
        x: anchor + (e.p.x - anchor) * spacing + c.dx,
        z: e.p.z + c.dz,
      }));
      if (next.some((p) => p.x < from + 0.5 || p.x > end - 0.5)) continue;
      const boxes = next.map((p) => villageFootprint(p, perspective));
      const frontLimit = source.model.endsWith("/Village_Market") ? -11.5 : -7;
      if (
        boxes.some(
          (b) =>
            b.z - b.d / 2 < -37.5 ||
            b.z + b.d / 2 > frontLimit ||
            placed.some((a) => footprintsOverlap(a, b)),
        )
      )
        continue;
      next.forEach((p, i) => {
        Object.assign(group[i]!.p, p, {
          width: boxes[i]!.w,
          depth: boxes[i]!.d,
        });
      });
      placed.push(...boxes);
      found = true;
      break;
    }
    if (!found) {
      unresolved.push(`${first.lesson + 21}:${source.model}`);
      placed.push(...group.map((e) => villageFootprint(e.p, perspective)));
    }
  }
  return { placements: entries.map((e) => e.p), unresolved };
}

/** Reserve the entire animation sweep, not just a coconut's starting point. */
/** How far either side of a sacred building his moved things must keep. */
export const SACRED_CLEAR = 4;

export function reserveWhisperProps(
  placements: readonly VillagePlacement[],
  bounds: readonly number[],
  perspective: (z: number) => number,
) {
  const occupied = placements.map((p) => villageFootprint(p, perspective));
  const forge = smithFootprint(placements, perspective);
  if (forge) occupied.push(forge);
  // SACRED GROUND IS HIS NO-GO, WHATEVER THE LESSON. Nothing of his happens
  // at or near a temple, shrine, idol or temple lamp — not a sighting, and
  // not one of these moved things either, which is his mischief as surely
  // as a thrown stone. Temple Street's three used to sit right in front of
  // the temple. Kept clear along the road's whole depth, with room to spare
  // either side, so no reading of "near" lets one back in.
  const SACRED = /Temple|Shrine|Idol|Nilavilakku/;
  const sacred = placements
    .filter((p) => SACRED.test(p.model))
    .map((p) => villageFootprint(p, perspective));
  const nearSacred = (b: Footprint) =>
    sacred.some((s) => Math.abs(b.x - s.x) < s.w / 2 + b.w / 2 + SACRED_CLEAR);
  const result: (Footprint & { lesson: number; roll: boolean })[] = [];
  for (let n = 1; n <= 9; n++) {
    const count = n === 7 ? 4 : n === 5 || n === 6 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const roll = i % 2 === 1;
      const from = bounds[n - 1]!,
        end = bounds[n]!;
      const x = from + (end - from) * (0.28 + i * 0.15);
      const candidates: Footprint[] = [];
      for (const z of [-9.5, -8, -11, -12.5, -14]) {
        for (let offset = 0; offset <= end - from; offset += 0.5) {
          for (const sign of [-1, 1])
            candidates.push({
              x: x + offset * sign,
              z,
              w: roll ? 2.6 : 1.3,
              d: 1.1,
            });
        }
      }
      const clear = (b: Footprint) =>
        b.x - b.w / 2 > from + 1 &&
        b.x + b.w / 2 < end - 1 &&
        !occupied.some((a) => footprintsOverlap(a, b));
      const spot = candidates.find((b) => clear(b) && !nearSacred(b));
      if (!spot) {
        // Only the sacred rule may leave a lesson short of a prop: a short
        // road can have no room left once the temple's ground is kept, and
        // one hint fewer is the right answer to that. Any other shortage is
        // still a layout bug and still says so.
        if (candidates.some(clear)) continue;
        throw new Error(`No clear mystery-prop position in lesson ${n + 20}`);
      }
      occupied.push(spot);
      result.push({ ...spot, lesson: n, roll });
    }
  }
  return result;
}
