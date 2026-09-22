import { deepEqual, equal, ok } from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
  BLEED,
  boundsForBand,
  placements,
  setChapterLessons,
} from "./chapter1.ts";
import {
  LESSONS_3,
  WHISPER_NODES,
  whisperFolkOut,
  whisperState,
} from "./chapter3.ts";

const root = new URL(
  "../../../root/public/kids-assets/models/",
  import.meta.url,
);
test("all ten lessons use shipped assets, continuous local stones, and clear road space", () => {
  equal(LESSONS_3.length, 10);
  LESSONS_3.forEach((l, i) => {
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
    for (const n of [1, 2, 3, 5, 9, 10])
      equal(whisperState(n, 0.1, hour).figure, false);
    for (const n of [4, 6, 7, 8])
      equal(whisperState(n, 0.1, hour).figure, true);
  }
  equal(whisperState(8, 0.5, 2).figure, false);
  equal(whisperState(8, 0.9, 20).props, false);
  equal(whisperState(9, 0.2, 2).props, false);
  for (let h = 0; h < 24; h++) equal(whisperState(10, 0, h).props, false);
});
test("playground has four distinct off-road nodes and the strongest activity", () => {
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
