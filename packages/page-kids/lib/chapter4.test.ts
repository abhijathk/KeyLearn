import { equal, ok } from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { boundsForBand } from "./chapter1.ts";
import { LESSONS_4, wildState } from "./chapter4.ts";
import {
  bridgeModules,
  ISLAND_MANGROVE,
  ISLAND_SHORE,
  islandBanyanAt,
  islandBanyanTrunkR,
  islandMangroveAt,
  islandRadius,
  islandShore,
  MANGROVE_ROOT,
  mangroveStand,
  wildBanks,
  wildCrossing,
  wildDry,
  wildIslandNodes,
  wildLimit,
  wildTerrain,
} from "./chapter4-crossing.ts";

test("all authored Chapter 4 assets exist, without market or shop occupants", () => {
  for (const l of LESSONS_4) {
    equal(l.corridor, false);
    ok(!l.folk.includes("Blacksmith"));
    for (const m of [
      ...l.canopy,
      ...l.mid,
      ...l.ground,
      ...l.props.map((p) => p.model),
    ]) {
      ok(
        existsSync(
          new URL(
            `../../../root/public/kids-assets/models/${m}.glb`,
            import.meta.url,
          ),
        ),
        m,
      );
      ok(!/Market|Temple|Estate_Gate/.test(m));
    }
  }
});

for (const band of ["5-6", "7-8", "9-10", "11+"]) {
  test(`${band}: two long continuous spans, a central island, three dry milestones`, () => {
    const b = boundsForBand(band);
    const c = wildCrossing(b);
    equal(c.spans.length, 2);
    const nodes = wildIslandNodes(b);
    equal(nodes.length, 3);
    for (const node of nodes) {
      const x = b[6]! + node.at * (b[7]! - b[6]!);
      ok(node.at >= 0 && node.at <= 1, "sighting belongs to lesson 37");
      ok(node.z <= -8, "sighting stays outside the walking corridor");
      if (node.kind === "bridge") {
        ok(x > c.spans[0].from && x < c.spans[0].to);
      } else {
        ok(wildDry(c, x, node.z), "island sighting has dry footing");
      }
    }
    equal(c.islandX, (c.approach + c.exit) / 2);
    ok(
      c.exit - c.approach >= 36,
      "substantially wider than lesson 16's eight-unit channel",
    );
    // Include the camera-aligned x offset of the actual verge markers.
    for (const n of [6, 7, 8]) {
      ok(wildDry(c, b[n]! + 2.2, -7.8, 1), `M${30 + n} dry`);
      ok(
        wildTerrain(c, b[n]! + 2.2, -7.8, 0, 0) > -0.8,
        `M${30 + n} above water`,
      );
    }
    ok(islandRadius(c, b[7]! + 2.2, -7.8) < 0.67, "M37 on flat island core");
    for (const span of c.spans) {
      ok(
        span.to - span.from > 12,
        "extended bridge, not a small stepping platform",
      );
      const parts = bridgeModules(span.from, span.to);
      ok(parts.length >= 2);
      ok(Math.abs(parts[0]!.x - parts[0]!.length / 2 - span.from) < 1e-8);
      ok(Math.abs(parts.at(-1)!.x + parts.at(-1)!.length / 2 - span.to) < 1e-8);
      for (let i = 1; i < parts.length; i++) {
        ok(
          Math.abs(
            parts[i - 1]!.x +
              parts[i - 1]!.length / 2 -
              (parts[i]!.x - parts[i]!.length / 2),
          ) < 1e-8,
        );
      }
    }
    for (let x = c.approach - 3; x <= c.exit + 3; x += 0.2) {
      for (const z of [-4, 0, 2, 4]) {
        const onBridge = c.spans.some((s) => x >= s.from && x <= s.to);
        ok(
          onBridge || wildTerrain(c, x, z, 0, 0) > -0.1,
          `unsupported road at ${x},${z}`,
        );
      }
    }
    // Water wraps around the island, both behind and in front.
    ok(wildTerrain(c, c.islandX, -28, 4, 0) < -2);
    ok(wildTerrain(c, c.islandX, 23, 0, 0) < -2);
    ok(
      wildTerrain(c, b[5]!, -32, 4, 0) < -2,
      "the wide river is visible behind the start of lesson 36",
    );
    ok(wildDry(c, b[5]!, 2), "the riverbank lesson keeps a dry road");
    ok(wildLimit(c, c.islandX, c.exit + 5, -10) < c.exit);
    ok(wildLimit(c, c.islandX, c.approach - 5, -10) > c.approach);
    equal(wildLimit(c, c.exit + 1, c.exit + 5, 0), c.exit + 5);
  });
}

test("mystery uses the reference hours and fades completely by the ending", () => {
  for (let hour = 0; hour < 24; hour += 0.25) {
    for (const n of [1, 4, 10]) {
      equal(wildState(n, 0.1, hour).figure, false);
      equal(wildState(n, 0.1, hour).props, false);
    }
    for (let n = 1; n <= 10; n++) {
      if (hour >= 4 && hour < 22) equal(wildState(n, 0.1, hour).figure, false);
    }
    equal(wildState(9, 0.1, hour).figure, false);
    equal(wildState(9, 0.3, hour).props, false);
    equal(wildState(8, 0.51, hour).figure, false);
  }
  equal(wildState(7, 0.8, 19).props, true);
  equal(wildState(7, 0.8, 21).props, false);
  equal(wildState(7, 0.8, 22).figure, true);
  equal(wildState(7, 0.8, 4).figure, false);
  ok(wildState(7, 0.8, 23).strength > wildState(6, 0.8, 23).strength);
});

for (const band of ["5-6", "7-8", "9-10", "11+"]) {
  test(`${band}: the mangrove stands a fifth on the island, the rest in the river`, () => {
    const c = wildCrossing(boundsForBand(band));
    const at = islandMangroveAt(c);
    const r = ISLAND_MANGROVE.foot * ISLAND_MANGROVE.h;
    let land = 0;
    let all = 0;
    for (let i = -40; i <= 40; i++) {
      for (let j = -40; j <= 40; j++) {
        const dx = (i / 40) * r;
        const dz = (j / 40) * r;
        if (dx * dx + dz * dz > r * r) continue;
        all++;
        if (islandRadius(c, at.x + dx, at.z + dz) < ISLAND_SHORE) land++;
      }
    }
    const share = land / all;
    ok(share > 0.17 && share < 0.23, `land share ${share.toFixed(2)}`);
    ok(at.z + r < -6.8, "root cage clear of the bridge deck");
    ok(
      Math.abs(at.x - c.spans[0].to) < 6,
      "beside the entry bridge's island end",
    );
    const b = islandBanyanAt(c);
    ok(Math.hypot(at.x - b.x, at.z - b.z) < 10, "beside the banyan");
  });
}

for (const band of ["5-6", "7-8", "9-10", "11+"]) {
  test(`${band}: the mangrove stand grows in clumps in the river, off the deck`, () => {
    const c = wildCrossing(boundsForBand(band));
    const stand = mangroveStand(c);
    ok(stand.length >= 10, `${stand.length} trees`);
    const b = islandBanyanAt(c);
    const all = [...stand, { ...islandMangroveAt(c), h: ISLAND_MANGROVE.h }];
    for (const m of stand) {
      const r = MANGROVE_ROOT * m.h;
      ok(m.z + r <= -6.8, "root cage behind the deck");
      ok(islandRadius(c, m.x, m.z) > ISLAND_SHORE, "stands in the river");
      ok(m.x > wildBanks(c, m.z).left, "not on the far bank");
      ok(
        Math.hypot(m.x - b.x, m.z - b.z) > islandBanyanTrunkR(),
        "off the banyan trunk",
      );
      for (const o of all) {
        if (o === m) continue;
        ok(Math.hypot(o.x - m.x, o.z - m.z) > 1, "no shared trunks");
      }
    }
    // Clumped, not a row: most trees have a neighbour within four units.
    const near = stand.filter((m) =>
      all.some((o) => o !== m && Math.hypot(o.x - m.x, o.z - m.z) < 4),
    ).length;
    ok(near / stand.length > 0.6, `clumped ${near}/${stand.length}`);
    ok(
      new Set(stand.map((m) => m.h.toFixed(2))).size === stand.length,
      "all different heights",
    );
    // Several close to the island.
    const toShore = (x: number, z: number) => {
      let d = Infinity;
      for (let deg = -180; deg <= 0; deg += 2) {
        const p = islandShore(c, deg, 0);
        d = Math.min(d, Math.hypot(p.x - x, p.z - z));
      }
      return d;
    };
    const byIsland = stand.filter((m) => toShore(m.x, m.z) < 4).length;
    ok(byIsland >= 5, `clumps against the island: ${byIsland}`);
  });
}
