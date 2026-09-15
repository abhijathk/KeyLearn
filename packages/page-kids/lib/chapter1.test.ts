import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { equal, isTrue } from "rich-assert";
import {
  BLEED,
  blendAt,
  CHAPTER_END,
  densityAt,
  hash3,
  hashPick,
  hashRange,
  lessonAt,
  LESSONS,
  milestoneX,
  placements,
  SEGMENT_COUNT,
  SEGMENT_LEN,
} from "./chapter1.ts";
import { MIN_STONE_GAP } from "./stone-x.ts";

/**
 * The chapter has to land on numbers the world already had. If either of
 * these drifts, the milestones stop marking the lessons they are named for
 * and every placement in the table is off by the difference.
 */
test("the chapter fits the road exactly", () => {
  equal(SEGMENT_LEN, MIN_STONE_GAP);
  equal(CHAPTER_END, 260);
  equal(SEGMENT_LEN * SEGMENT_COUNT, CHAPTER_END);
  equal(LESSONS.length, SEGMENT_COUNT);
});

test("lessons run end to end with no gap and no overlap", () => {
  LESSONS.forEach((l, i) => {
    equal(l.n, i + 1);
    equal(l.from, i);
    equal(l.to, i + 1);
  });
});

test("a milestone stands at the boundary of the lesson it names", () => {
  for (let n = 0; n <= SEGMENT_COUNT; n++) {
    equal(milestoneX(n), n * SEGMENT_LEN);
  }
  // Lesson n runs from stone n-1 to stone n, so the point just inside a
  // stone belongs to the lesson the stone opens.
  equal(lessonAt(0).n, 1);
  equal(lessonAt(25.9).n, 1);
  equal(lessonAt(26).n, 2);
  equal(lessonAt(259.9).n, 10);
});

test("off the end of the road clamps rather than throwing", () => {
  equal(lessonAt(-40).n, 1);
  equal(lessonAt(10_000).n, 10);
});

/**
 * A milestone is a marker, not a border. An orchard that stops dead at a
 * stone and is pasture on the far side reads as two levels glued together.
 */
test("each lesson still remembers the previous one at its start", () => {
  const atStone = blendAt(26);
  equal(atStone.lesson.n, 2);
  equal(atStone.prev.n, 1);
  equal(atStone.mix, 0);

  // ...and has finished changing over by the end of the bleed.
  const past = blendAt(26 + SEGMENT_LEN * BLEED + 0.01);
  equal(past.lesson.n, 2);
  equal(past.prev.n, 2);
  equal(past.mix, 1);
});

test("the changeover never runs backwards", () => {
  let last = -1;
  // Past the end of the bleed as well as through it, so the last reading is
  // the settled value rather than the last step before it.
  for (let d = 0; d <= SEGMENT_LEN * BLEED + 0.5; d += 0.25) {
    const { mix } = blendAt(52 + d);
    isTrue(mix >= last, `mix fell at +${d}`);
    last = mix;
  }
  equal(last, 1);
});

test("the first lesson has nothing to bleed from", () => {
  const { lesson, prev, mix } = blendAt(0);
  equal(lesson.n, 1);
  equal(prev.n, 1);
  equal(mix, 1);
});

test("density is carried across the bleed, not stepped", () => {
  // Lesson 2 is 1.9 and lesson 3 is 3.4. At the stone the value is still
  // lesson 2's, and it arrives at lesson 3's by the end of the bleed.
  equal(Math.round(densityAt(52) * 100) / 100, 1.9);
  equal(Math.round(densityAt(52 + SEGMENT_LEN * BLEED + 0.1) * 100) / 100, 3.4);
  const mid = densityAt(52 + SEGMENT_LEN * BLEED * 0.5);
  isTrue(mid > 1.9 && mid < 3.4, `midpoint ${mid} outside the two densities`);
});

/**
 * Everything is placed from here rather than from Math.random, so that
 * animals and walkers have something stable to route around. A world
 * re-rolled every session cannot have obstruction-aware anything.
 */
test("the same place always gives the same value", () => {
  for (const [x, z, s] of [
    [0, 0, 0],
    [13.5, -9.25, 3],
    [-40, 12, 99],
    [259.75, -31.5, 1],
  ] as const) {
    equal(hash3(x, z, s), hash3(x, z, s));
  }
});

test("different places and different questions give different values", () => {
  isTrue(hash3(10, -8, 0) !== hash3(10.5, -8, 0), "x made no difference");
  isTrue(hash3(10, -8, 0) !== hash3(10, -8.5, 0), "z made no difference");
  isTrue(hash3(10, -8, 0) !== hash3(10, -8, 1), "salt made no difference");
});

test("the hash spreads across its range", () => {
  const buckets = new Array(10).fill(0);
  let n = 0;
  for (let x = 0; x < CHAPTER_END; x += 0.5) {
    for (let z = -30; z < -6; z += 2) {
      const v = hash3(x, z, 7);
      isTrue(v >= 0 && v < 1, `${v} out of range`);
      buckets[Math.floor(v * 10)]!++;
      n++;
    }
  }
  // No tenth of the range may be starved: a hash that clumps would put the
  // same species down the whole road.
  for (const [i, b] of buckets.entries()) {
    isTrue(b > n / 25, `bucket ${i} held only ${b} of ${n}`);
  }
});

test("hashRange stays inside its bounds and hashPick inside its list", () => {
  for (let x = 0; x < 200; x += 7.5) {
    const v = hashRange(x, -10, 2, 3, 9);
    isTrue(v >= 3 && v < 9, `${v} outside 3..9`);
    const p = hashPick(["a", "b", "c"], x, -10, 4);
    isTrue(p != null && ["a", "b", "c"].includes(p), `bad pick ${p}`);
  }
  equal(hashPick([], 1, 1, 1), null);
});

/**
 * "I don't want anything on the user's side of the road." The near verge is
 * where the child walks and the side the camera is on, so a building there
 * stands between the viewer and the whole village.
 */
test("nothing stands on the child's side of the road", () => {
  for (const p of placements()) {
    isTrue(p.z < 0, `${p.model} at z=${p.z} is on the near verge`);
  }
});

test("every placement is inside the chapter", () => {
  for (const p of placements()) {
    isTrue(
      p.x >= 0 && p.x < CHAPTER_END,
      `${p.model} at x=${p.x} is off the road`,
    );
  }
});

test("props that block the way declare how much room they need", () => {
  for (const l of LESSONS) {
    for (const p of l.props) {
      // A house with no clearance is a house an animal will walk through.
      if (
        /House|Temple|Banyan|Market|Well|Wall|Cart|Fence|Bamboo/i.test(p.model)
      ) {
        isTrue(
          (p.clear ?? 0) > 0,
          `${p.model} in lesson ${l.n} blocks the way but declares no clearance`,
        );
      }
    }
  }
});

/**
 * THE MODELS HAVE TO BE THERE. Every path in the table is a file the build
 * will ask the network for, and `loadModel` treats a missing one as a prop to
 * skip — so a typo does not throw, it silently empties a lesson. This is the
 * cheapest place to catch that.
 */
test("every model named by the chapter is on disk", () => {
  const root = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../root/public/kids-assets/models",
  );
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const l of LESSONS) {
    for (const m of [
      ...l.canopy,
      ...l.mid,
      ...l.ground,
      ...l.herd,
      ...l.folk,
      ...l.props.map((p) => p.model),
    ]) {
      if (seen.has(m)) continue;
      seen.add(m);
      if (!existsSync(join(root, `${m}.glb`))) missing.push(m);
    }
  }
  equal(missing.join(", "), "");
});

test("the chapter opens and closes on the same open language", () => {
  const first = LESSONS[0]!;
  const last = LESSONS[9]!;
  // Milestone 10's roadside is meant to look like Milestone 0's, and the
  // buffalo is the bookend.
  isTrue(last.herd.includes("ak-3d-pack/Buffalo"), "no buffalo at the end");
  isTrue(first.herd.includes("ak-3d-pack/Buffalo"), "no buffalo at the start");
  isTrue(
    Math.abs(first.density - last.density) < 0.5,
    "the end is not as open as the start",
  );
});

test("the supernatural corridor is M4 to M7 and nowhere else", () => {
  const corridor = LESSONS.filter((l) => l.corridor).map((l) => l.n);
  equal(corridor.join(","), "5,6,7");
});
