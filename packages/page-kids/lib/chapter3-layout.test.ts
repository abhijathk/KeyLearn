import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  boundsForBand,
  lessonAt,
  placements,
  setChapterLessons,
} from "./chapter1.ts";
import { LESSONS_3 } from "./chapter3.ts";
import {
  footprintsOverlap,
  reserveWhisperProps,
  resolveChapter3Layout,
  SACRED_CLEAR,
  shopkeeperMarket,
  smithFootprint,
  villageFootprint,
} from "./chapter3-layout.ts";
import { depthScale } from "./depth-scale.ts";

test("all four village layouts keep solids, garden plants and animated sweeps clear", () => {
  setChapterLessons(LESSONS_3);
  try {
    for (const band of ["5-6", "7-8", "9-10", "11+"]) {
      const bounds = boundsForBand(band),
        perspective = (z: number) => depthScale(z, 42, 2);
      const authored = placements(bounds, perspective);
      const resolved = resolveChapter3Layout(authored, bounds, perspective);
      deepEqual(resolved.unresolved, [], band);
      equal(
        resolved.placements.length,
        authored.length,
        "never hide an overlapping asset",
      );
      const ps = resolved.placements,
        boxes = ps.map((p) => villageFootprint(p, perspective));
      const forge = smithFootprint(ps, perspective)!;
      for (let i = 0; i < ps.length; i++) {
        if (!/Market$/.test(ps[i]!.model))
          ok(
            !footprintsOverlap(forge, boxes[i]!),
            `${band}: ${ps[i]!.model} blocks the seated blacksmith`,
          );
      }
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i]!,
          box = boxes[i]!;
        ok(box.z + box.d / 2 <= -7, `${band}: ${a.model} enters the road`);
        ok(box.z - box.d / 2 >= -37.5, `${band}: ${a.model} leaves the ground`);
        equal(lessonAt(a.x, bounds).n, lessonAt(authored[i]!.x, bounds).n);
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j]!;
          // Connected boundary panels and their gate intentionally touch.
          const connected =
            /Laterite_Wall|Estate_Gate|Bamboo_Fence/.test(a.model) &&
            /Laterite_Wall|Estate_Gate|Bamboo_Fence/.test(b.model) &&
            a.at === b.at &&
            a.z === b.z &&
            lessonAt(a.x, bounds).n === lessonAt(b.x, bounds).n;
          ok(
            !footprintsOverlap(box, boxes[j]!, connected ? -0.08 : 0.3),
            `${band}: ${a.model} intersects ${b.model}`,
          );
        }
      }
      for (const n of [2, 3, 6, 8])
        ok(
          ps.some(
            (p) =>
              /Estate_Gate$/.test(p.model) && lessonAt(p.x, bounds).n === n,
          ),
          `${band}: lesson ${n} gate`,
        );
      const mana = ps.find((p) => /Mana$/.test(p.model))!;
      const gate = ps.find(
        (p) => /Estate_Gate$/.test(p.model) && lessonAt(p.x, bounds).n === 8,
      )!;
      ok(
        Math.abs(mana.x - gate.x) < 1e-8,
        "old house must align with its gate",
      );
      const props = reserveWhisperProps(ps, bounds, perspective);
      // Nothing of his near sacred ground — the owner's absolute rule.
      for (const holy of ps.filter((p) =>
        /Temple|Shrine|Idol|Nilavilakku/.test(p.model),
      )) {
        const f = villageFootprint(holy, perspective);
        for (const m of props) {
          ok(
            Math.abs(m.x - f.x) >= f.w / 2 + m.w / 2 + SACRED_CLEAR,
            `${band}: a moved thing stands by the ${holy.model}`,
          );
        }
      }
      for (let i = 0; i < props.length; i++) {
        ok(
          !boxes.some((b) => footprintsOverlap(props[i]!, b)),
          "animated sweep intersects scenery",
        );
        ok(
          !props.slice(i + 1).some((b) => footprintsOverlap(props[i]!, b)),
          "animated props intersect",
        );
      }
      const markets = ps
        .filter((p) => /Village_Market$/.test(p.model))
        .sort((a, b) => b.z - a.z);
      equal(markets.length, 2);
      equal(shopkeeperMarket(ps), markets[0]);
      equal(shopkeeperMarket([...ps].reverse()), markets[0]);
      equal(
        shopkeeperMarket(ps.filter((p) => !/Village_Market$/.test(p.model))),
        undefined,
      );
      ok(
        markets[1]!.h * perspective(markets[1]!.z) <
          markets[0]!.h * perspective(markets[0]!.z),
      );
    }
  } finally {
    setChapterLessons([]);
  }
});
