import { deepEqual, equal, ok } from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { AK_PACK_MISSING } from "./ak-pack-present.ts";
import {
  BLEED,
  boundsForBand,
  LESSONS,
  placements,
  setChapterLessons,
} from "./chapter1.ts";
import {
  CHAPTER3_LANES,
  LESSONS_3,
  WHISPER_NODES,
  whisperFolkOut,
  whisperState,
} from "./chapter3.ts";
import { depthScale } from "./depth-scale.ts";

const root = new URL(
  "../../../root/public/kids-assets/models/",
  import.meta.url,
);
test("all ten lessons use shipped assets, continuous local stones, and clear road space", { skip: AK_PACK_MISSING }, () => {
  equal(LESSONS_3.length, 10);
  LESSONS_3.forEach((l, i) => {
    ok(
      !l.folk.includes("Blacksmith"),
      "the seated smith belongs only to his shop",
    );
    equal(l.n, i + 1);
    equal(l.from, i);
    equal(l.to, i + 1);
    for (const name of [
      ...l.canopy,
      ...l.mid,
      ...l.ground,
      ...l.props.map((p) => p.model),
    ]) {
      ok(existsSync(new URL(name + ".glb", root)), name);
    }
    for (const name of l.folk)
      ok(existsSync(new URL(`village-folk/${name}.glb`, root)), name);
    for (const p of l.props) {
      ok(p.z <= -9, l.name);
      ok(p.at >= 0 && p.at <= 1, l.name);
    }
  });
  ok(BLEED >= 0.15 && BLEED <= 0.25);
});
test("authored placements remain finite across all age bands", () => {
  setChapterLessons(LESSONS_3);
  try {
    for (const band of ["5-6", "7-8", "9-10", "11+"]) {
      for (const p of placements(boundsForBand(band))) {
        ok(Number.isFinite(p.x) && Number.isFinite(p.h));
        ok(p.z <= -9);
      }
    }
  } finally {
    setChapterLessons([]);
  }
});
test("the live clock gates sightings; no daytime figure or late-chapter scare", () => {
  for (let n = 1; n <= 10; n++) {
    for (const hour of [4, 7, 12, 19, 21.99])
      equal(whisperState(n, 0.2, hour).figure, false);
  }
  for (const hour of [22, 0, 3.99]) {
    // 6 is Temple Street: he is never seen at or near a temple.
    for (const n of [1, 2, 3, 5, 6, 9, 10])
      equal(whisperState(n, 0.1, hour).figure, false);
    for (const n of [4, 7, 8]) equal(whisperState(n, 0.1, hour).figure, true);
  }
  equal(whisperState(8, 0.5, 2).figure, false);
  equal(whisperState(8, 0.9, 20).props, false);
  equal(whisperState(9, 0.2, 2).props, false);
  equal(whisperState(7, 0.2, 21).props, false);
  equal(whisperState(7, 0.2, 21.99).props, false);
  for (let h = 0; h < 24; h++) equal(whisperState(10, 0, h).props, false);
});
test("playground has four distinct off-road nodes and the strongest activity", () => {
  ok(LESSONS_3[6]!.props.every((p) => !/Market/.test(p.model)));
  deepEqual(
    new Set(WHISPER_NODES.filter((n) => n.lesson === 7).map((n) => n.kind)),
    new Set(["wall", "root", "path", "well"]),
  );
  for (const n of WHISPER_NODES) ok(n.z <= -9);
  const peak = whisperState(7, 0.2, 2);
  ok(peak.gap > 20);
  ok(peak.seconds <= 2);
  ok(peak.strength > whisperState(6, 0.2, 2).strength);
  ok(peak.strength > whisperState(8, 0.2, 2).strength);
});
test("market closes progressively while deep night is empty", () => {
  const market = LESSONS_3[4]!;
  equal(whisperFolkOut(market, 12), market.folk.length);
  ok(whisperFolkOut(market, 20) < whisperFolkOut(market, 19));
  equal(whisperFolkOut(market, 21), 0);
  for (const l of LESSONS_3) equal(whisperFolkOut(l, 2), 0);
});

test("the great market keeps Chapter 1's full-size shop contract", () => {
  const original = LESSONS.flatMap((l) => l.props).find((p) =>
    p.model.endsWith("/Kerala_Market_Row"),
  )!;
  const rows = LESSONS_3[4]!.props.filter((p) =>
    p.model.endsWith("/Kerala_Market_Row"),
  );
  equal(rows.length, 2);
  for (const row of rows) {
    // The back row is drawn smaller than the front one; both keep the shop box.
    ok(row.h <= original.h);
    const { referenceZ, ...dimensions } = row.box!;
    deepEqual(dimensions, original.box);
    equal(referenceZ, -20);
  }
  equal(Math.max(...rows.map((r) => r.h)), original.h);
});

test("fitting market rows never cancels their distance scaling", () => {
  setChapterLessons(LESSONS_3);
  try {
    for (const band of ["5-6", "7-8", "9-10", "11+"]) {
      const perspective = (z: number) => depthScale(z, 33);
      const rows = placements(boundsForBand(band), perspective)
        .filter((p) => p.model.endsWith("/Kerala_Market_Row"))
        .sort((a, b) => b.z - a.z);
      equal(rows.length, 2);
      ok(rows[1]!.h <= rows[0]!.h);
      ok(
        rows[1]!.h * perspective(rows[1]!.z) <
          rows[0]!.h * perspective(rows[0]!.z),
      );
    }
  } finally {
    setChapterLessons([]);
  }
});

test("the larger village uses all house families, real gates, banyan and peepal assets", { skip: AK_PACK_MISSING }, () => {
  const props = LESSONS_3.flatMap((l) => l.props);
  for (const name of [
    // 11 (ezhara) stood behind milestone 27 until the owner swapped it for a kavu.
    ...Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(2, "0") + "_").filter((n) => n !== "11_"),
    "Mana",
    "Temple",
    "Banyan_Almaram",
    "Peepal_Arayal",
  ]) {
    ok(
      props.some((p) =>
        /^\d\d_$/.test(name)
          ? p.model.startsWith("village-houses/" + name)
          : p.model.endsWith("/" + name),
      ),
      name,
    );
  }
  const gates = props.flatMap((p) => (p.run?.gate == null ? [] : [p.run.gate]));
  ok(gates.length >= 3);
  for (const gate of gates)
    ok(existsSync(new URL(gate.model + ".glb", root)), gate.model);
});

test("no village house turns its back to the road or its lane", () => {
  // Every house model's front (steps, veranda, door) is on its -Z side; a
  // turn of θ points it along (-sin θ, -cos θ). Behind the road (z < 0) the
  // front must point at the road (+Z); beside a cross road, at the lane.
  // Sideways to the road is allowed, a back wall to it is not.
  let houses = 0;
  for (const l of LESSONS_3) {
    for (const p of l.props) {
      if (!/village-houses\/\d\d_/.test(p.model)) continue;
      houses++;
      const t = p.turn ?? 0;
      const fx = -Math.sin(t);
      const fz = -Math.cos(t);
      const x = (l.n - 1) * 64 + p.at * 64;
      if (Math.abs(fx) < 0.5) {
        ok(fz > 0.5, `${p.model} at x ${x.toFixed(0)} faces away from the road`);
      } else {
        const lane = CHAPTER3_LANES.reduce((a, b) =>
          Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a,
        );
        ok(
          Math.sign(fx) === Math.sign(lane.x - x),
          `${p.model} at x ${x.toFixed(0)} faces away from ${lane.name}`,
        );
      }
    }
  }
  ok(houses >= 14, `only ${houses} houses found`);
});

test("no buffalo anywhere in the village", () => {
  // Owner, 4 Oct 2026. The chapter's houses line every lesson, and a lesson's
  // `buffalo` flag and its herd list are the only two ways one is placed
  // (the theme's wild buffalo stand down whenever a chapter is loaded).
  for (const l of LESSONS_3) {
    ok(l.buffalo !== true, `lesson ${l.n} still places a buffalo`);
    ok(
      !l.herd.some((h) => /buffalo/i.test(h)),
      `lesson ${l.n} lists a buffalo in its herd`,
    );
  }
});
