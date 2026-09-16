import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { equal, isTrue } from "rich-assert";
import {
  activityAt,
  BLEED,
  blendAt,
  chapterBounds,
  chapterEnd,
  childrenOut,
  DEFAULT_BOUNDS,
  densityAt,
  folkOut,
  hash3,
  hashPick,
  hashRange,
  isChild,
  lessonAt,
  LESSONS,
  milestoneX,
  placements,
  SEGMENT_COUNT,
  segmentLen,
  tiredWalkAt,
} from "./chapter1.ts";
import { RUN_LEN, runLengthFor } from "./run-length.ts";

/**
 * A lesson is a passage, and how far it carries a child is decided by how
 * much they type. A fixed segment is wrong at both ends: the youngest stop
 * short of their own milestone every lesson, the oldest cover two and a half
 * segments in one. So the stones follow the typing.
 */
test("a lesson's stretch of road is as long as its passage carries", () => {
  const bounds = chapterBounds(24, 36);
  equal(bounds.length, SEGMENT_COUNT + 1);
  equal(bounds[0], 0);
  // The first passage of the 5-6 band is 24 characters, and runLengthFor
  // gives 0.9 units per character.
  equal(Math.round(segmentLen(1, bounds) * 10) / 10, runLengthFor(24));
  equal(Math.round(segmentLen(10, bounds) * 10) / 10, runLengthFor(36));
});

test("the stones march forward and never repeat", () => {
  for (const [start, full] of [
    [24, 36],
    [50, 72],
    [77, 112],
    [102, 153],
  ] as const) {
    const b = chapterBounds(start, full);
    for (let i = 1; i < b.length; i++) {
      isTrue(
        b[i]! > b[i - 1]!,
        `stone ${i} did not advance for ${start}/${full}`,
      );
    }
  }
});

test("each band gets the road it needs", () => {
  // Measured, and the reason the road cannot be one length: the two older
  // bands hit the RUN_LEN cap every lesson and need two and a half times the
  // road the youngest does.
  equal(Math.round(chapterEnd(chapterBounds(24, 36))), 270);
  equal(
    Math.round(chapterEnd(chapterBounds(77, 112))),
    RUN_LEN * SEGMENT_COUNT,
  );
  equal(
    Math.round(chapterEnd(chapterBounds(102, 153))),
    RUN_LEN * SEGMENT_COUNT,
  );
});

/**
 * THE CHAPTER MUST NOT END BEFORE LESSON 10.
 *
 * `startRun` used to clamp the start of a run to `TRAIL_END - RUN_LEN`, and
 * RUN_LEN is the 64-unit MAXIMUM rather than the run this child actually
 * walks. For the youngest band that is thirty units behind their own ninth
 * stone, so the last lesson began well short of the marker that opens it and
 * the closing stretch of road was never walked at all.
 */
test("the last lesson starts at its own stone and reaches the end", () => {
  for (const [start, full] of [
    [24, 36],
    [50, 72],
    [77, 112],
    [102, 153],
  ] as const) {
    const b = chapterBounds(start, full);
    const end = chapterEnd(b);
    // Lesson 10 runs from the ninth stone to the tenth, in full.
    equal(
      Math.round((b[9]! + runLengthFor(full)) * 10) / 10,
      Math.round(end * 10) / 10,
    );
    // And the old clamp would have started it behind that stone. Kept as an
    // assertion rather than a comment, because it is the whole reason the
    // clamp is against `runLen` now.
    if (start === 24) {
      isTrue(
        end - RUN_LEN < b[9]!,
        "the youngest band's last lesson no longer needs the fix",
      );
    }
  }
});

/**
 * A chapter is walked across many sittings. `roadStones` counts them, and
 * lesson n starts at Milestone n-1 — so a child who has passed four stones
 * opens their fifth lesson at the fourth stone.
 */
test("a saved stone count names where the next lesson starts", () => {
  const b = DEFAULT_BOUNDS;
  for (let passed = 0; passed < SEGMENT_COUNT; passed++) {
    const resume = b[Math.min(SEGMENT_COUNT - 1, passed)]!;
    equal(resume, b[passed]);
    equal(lessonAt(resume, b).n, passed + 1);
  }
  // Past the end there is no eleventh lesson to open; they stay on the last.
  equal(b[Math.min(SEGMENT_COUNT - 1, 14)], b[9]);
});

/**
 * The world is built to the SHORTEST chapter when nobody says otherwise.
 * Guessing high builds ground nobody reaches; guessing low runs a child off
 * the end of the terrain, which is the failure that shows.
 */
test("the default is the youngest band", () => {
  equal(DEFAULT_BOUNDS.join(), chapterBounds(24, 36).join());
});

test("there are ten lessons and eleven stones", () => {
  equal(LESSONS.length, SEGMENT_COUNT);
  equal(DEFAULT_BOUNDS.length, SEGMENT_COUNT + 1);
});

test("lessons run end to end with no gap and no overlap", () => {
  LESSONS.forEach((l, i) => {
    equal(l.n, i + 1);
    equal(l.from, i);
    equal(l.to, i + 1);
  });
});

test("a milestone stands at the boundary of the lesson it names", () => {
  const b = DEFAULT_BOUNDS;
  for (let n = 0; n <= SEGMENT_COUNT; n++) {
    equal(milestoneX(n, b), b[n]);
  }
  // Lesson n runs from stone n-1 to stone n, so the point just inside a
  // stone belongs to the lesson the stone opens.
  equal(lessonAt(0, b).n, 1);
  equal(lessonAt(b[1]! - 0.1, b).n, 1);
  equal(lessonAt(b[1]!, b).n, 2);
  equal(lessonAt(chapterEnd(b) - 0.1, b).n, 10);
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
  const atStone = blendAt(DEFAULT_BOUNDS[1]!);
  equal(atStone.lesson.n, 2);
  equal(atStone.prev.n, 1);
  equal(atStone.mix, 0);

  // ...and has finished changing over by the end of the bleed.
  const past = blendAt(DEFAULT_BOUNDS[1]! + segmentLen(2) * BLEED + 0.01);
  equal(past.lesson.n, 2);
  equal(past.prev.n, 2);
  equal(past.mix, 1);
});

test("the changeover never runs backwards", () => {
  let last = -1;
  // Past the end of the bleed as well as through it, so the last reading is
  // the settled value rather than the last step before it.
  for (let d = 0; d <= segmentLen(3) * BLEED + 0.5; d += 0.25) {
    const { mix } = blendAt(DEFAULT_BOUNDS[2]! + d);
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
  const m2 = DEFAULT_BOUNDS[2]!;
  equal(Math.round(densityAt(m2) * 100) / 100, 1.9);
  equal(
    Math.round(densityAt(m2 + segmentLen(3) * BLEED + 0.1) * 100) / 100,
    3.4,
  );
  const mid = densityAt(m2 + segmentLen(3) * BLEED * 0.5);
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
  for (let x = 0; x < chapterEnd(); x += 0.5) {
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

/**
 * A boundary is continuous or it is not a boundary — scattered panels read
 * as a fence somebody is halfway through building. But an unbroken run walls
 * the child out of a place they are meant to see into, so every run leaves
 * one panel out for the gate.
 */
test("every fence and wall runs end to end and has a way in", () => {
  for (const l of LESSONS) {
    for (const p of l.props) {
      if (p.run == null) continue;
      isTrue(
        p.run.count >= 3,
        `lesson ${l.n}: a run of ${p.run.count} is not a boundary`,
      );
      isTrue(
        p.run.gapAt > 0 && p.run.gapAt < p.run.count - 1,
        `lesson ${l.n}: the gate is at an end, which is just a shorter run`,
      );
      // The aspect has to be the model's OWN width-to-height ratio, or the
      // panels overlap or leave daylight between them. Measured off the
      // files: bamboo is 1.75 times as wide as tall, laterite 2.61.
      const want = p.model.includes("Bamboo") ? 1.75 : 2.61;
      equal(p.run.aspect, want);
      // And a boundary has to be skirted, or it meets bare earth along a
      // dead straight line.
      isTrue(p.skirt === true, `lesson ${l.n}: ${p.model} has no skirt`);
    }
  }
});

/**
 * A run is written in world units and a lesson is not the same length for
 * every child. Lesson 6's boundary is 69 units of wall; a five-year-old's
 * whole lesson is 21.6. Unclamped it ran through the market and into the
 * grazing land.
 */
test("a run stays inside the lesson it belongs to", () => {
  for (const [start, full] of [
    [24, 36],
    [102, 153],
  ] as const) {
    const b = chapterBounds(start, full);
    for (const p of placements(b)) {
      const l = lessonAt(p.x, b);
      isTrue(
        p.x >= b[l.n - 1]! && p.x < b[l.n]!,
        `${p.model} at ${p.x} is outside lesson ${l.n}`,
      );
    }
    // And the panels of one run are laid end to end, never stacked.
    for (const n of [2, 4, 5, 6, 8]) {
      const xs = placements(b)
        .filter(
          (p) => lessonAt(p.x, b).n === n && p.model.includes("Laterite_Wall"),
        )
        .map((p) => p.x)
        .sort((x, y) => x - y);
      for (let i = 1; i < xs.length; i++) {
        const gap = xs[i]! - xs[i - 1]!;
        isTrue(
          gap > 4,
          `lesson ${n}: panels ${gap.toFixed(2)} apart — stacked`,
        );
      }
    }
  }
});

test("the shortest chapter still gets a boundary worth the name", () => {
  // The youngest band's lessons are 21.6 units, so Lesson 6's twelve-panel
  // run is cut short — but it must not be cut to nothing.
  const b = chapterBounds(24, 36);
  const six = placements(b).filter(
    (p) => lessonAt(p.x, b).n === 6 && p.model.includes("Laterite_Wall"),
  );
  isTrue(six.length >= 3, `only ${six.length} panels survive the clamp`);
});

/**
 * The palmyra is the tree you navigate by, which is a job exactly one tree
 * can hold. Drawn from the canopy list it came up as often as the coconuts.
 */
/**
 * Every list is a flat draw, so its length IS the rarity of each plant in
 * it. A layer with two species gives each of them half the trees in the
 * lesson, which is how a papaya — a plant you see one or two of in a yard —
 * became every second tree on the road.
 */
/**
 * The name is read off a scoreboard chip beside the score and the streak, at
 * the size those are. A long one wraps to three lines and pushes the chips
 * beside it out of the row.
 */
test("a lesson name fits on a chip", () => {
  for (const l of LESSONS) {
    const words = l.name.trim().split(/\s+/);
    isTrue(
      words.length <= 2,
      `lesson ${l.n}: "${l.name}" is ${words.length} words`,
    );
    isTrue(l.name.length <= 16, `lesson ${l.n}: "${l.name}" is long`);
  }
});

test("every lesson is named, and named differently", () => {
  equal(new Set(LESSONS.map((l) => l.name)).size, LESSONS.length);
  for (const l of LESSONS) isTrue(l.name.trim().length > 0, `lesson ${l.n}`);
});

/**
 * A calf is not an animal that turns up on its own — it is a cow's calf, and
 * one grazing by itself in an empty field reads as a lost animal rather than
 * as a herd.
 */
test("a calf is never drawn on its own", () => {
  for (const l of LESSONS) {
    isTrue(
      !l.herd.some((m) => m.includes("Calf")),
      `lesson ${l.n} draws calves from the herd list, so one can appear alone`,
    );
  }
  // And wherever calves can appear, there are cows for them to belong to.
  const withCows = LESSONS.filter((l) => l.herd.includes("Cow"));
  isTrue(withCows.length >= 3, "too few lessons keep cattle");
});

/**
 * Density alone cannot say what a lesson looks like: an orchard and a fern
 * meadow can hold the same plants per unit of road and be nothing alike,
 * because one lesson's are overhead and the other's underfoot.
 */
test("each lesson splits its planting between the layers", () => {
  for (const l of LESSONS) {
    const sum = l.mix.reduce((a, b) => a + b, 0);
    isTrue(
      Math.abs(sum - 1) < 1e-9,
      `lesson ${l.n}: the mix sums to ${sum}, not 1`,
    );
    for (const w of l.mix) isTrue(w >= 0, `lesson ${l.n} has a negative share`);
    // A layer with weight must have something to plant, and a layer with
    // plants must have weight — either way round is a silently empty slot.
    const layers = [l.canopy, l.mid, l.ground];
    for (const [i, list] of layers.entries()) {
      if (l.mix[i]! > 0) {
        isTrue(list.length > 0, `lesson ${l.n} weights an empty layer ${i}`);
      } else {
        isTrue(list.length === 0, `lesson ${l.n} has plants it never draws`);
      }
    }
  }
});

test("the chapter's shape reads off the table", () => {
  const by = (n: number) => LESSONS[n - 1]!;
  // The orchard is the richest vegetation in the chapter, and the estate
  // recalls it.
  const densest = Math.max(...LESSONS.map((l) => l.density));
  equal(by(3).density, densest);
  isTrue(
    by(6).density > by(5).density,
    "the estate is not thicker than the village",
  );
  // The pasture is simpler and more open than the grazing land before it.
  isTrue(by(9).density < by(8).density, "the pasture is not more open");
  // The open edge keeps tree density light; the meadow is ground cover.
  isTrue(by(1).mix[0]! < by(3).mix[0]!, "the open edge has orchard canopy");
  isTrue(by(10).mix[2]! > 0.85, "the fern meadow is not ground-dominant");
  equal(by(10).mix[1], 0);
});

test("no single plant dominates a layer", () => {
  for (const l of LESSONS) {
    for (const [key, list] of [
      ["canopy", l.canopy],
      ["mid", l.mid],
    ] as const) {
      if (list.length === 0) continue;
      const share = 1 / list.length;
      isTrue(
        share <= 0.5,
        `lesson ${l.n} ${key}: ${list.length} species means ${(share * 100).toFixed(0)}% each`,
      );
    }
  }
});

test("the papaya is an occasional tree, never a common one", () => {
  for (const l of LESSONS) {
    for (const list of [l.canopy, l.mid]) {
      if (!list.some((m) => m.includes("Papaya"))) continue;
      isTrue(
        list.length >= 4,
        `lesson ${l.n}: papaya in a list of ${list.length} is one tree in ${list.length}`,
      );
    }
  }
});

test("no lesson is planted from a single species", () => {
  for (const l of LESSONS) {
    const all = [...l.canopy, ...l.mid, ...l.ground];
    isTrue(
      new Set(all).size >= 3,
      `lesson ${l.n} draws from only ${new Set(all).size} plants`,
    );
  }
});

test("the palmyra is a landmark, not a species", () => {
  for (const l of LESSONS) {
    isTrue(
      ![...l.canopy, ...l.mid, ...l.ground].some((m) => m.includes("Palmyra")),
      `lesson ${l.n} still draws palmyras at random`,
    );
    const placed = l.props.filter((p) => p.model.includes("Palmyra"));
    isTrue(placed.length <= 2, `lesson ${l.n} has ${placed.length} palmyras`);
    for (const p of placed) {
      // Taller than anything the canopy draw can produce, which tops out at
      // 11. Being the tallest thing in the frame is the whole of what it does.
      isTrue(p.h >= 15, `a palmyra at ${p.h} is not standing over anything`);
    }
  }
});

test("every placement is inside the chapter", () => {
  for (const p of placements()) {
    isTrue(
      p.x >= 0 && p.x < chapterEnd(),
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
  // RESOLVED THE WAY THE WORLD RESOLVES IT, which is the only version worth
  // testing. `herd` and `folk` go through `modelUrl`, which takes a BARE
  // name and finds the folder itself; `props`, `canopy`, `mid` and `ground`
  // go through `prop()`, which takes a path. Checking both as plain paths
  // passed happily while the cows were 404ing in the game, because
  // "village-folk/Cow.glb" is a real file and "ak-3d-pack/village-folk/
  // Cow.glb" is what was actually requested.
  const FOLDER_OF: Record<string, string> = {
    Buffalo: "ak-3d-pack",
    Cow: "village-folk",
    Cow_Calf: "village-folk",
    Headman: "village-folk",
    TeaStall: "village-folk",
    FarmerWoman: "village-folk",
    VillageBoy: "village-folk",
  };
  const missing: string[] = [];
  const seen = new Set<string>();
  const check = (m: string, bare: boolean) => {
    if (seen.has(m)) return;
    seen.add(m);
    if (bare) {
      const dir = FOLDER_OF[m];
      if (dir == null) {
        missing.push(`${m} (no folder registered — modelUrl cannot find it)`);
        return;
      }
      if (!existsSync(join(root, dir, `${m}.glb`))) missing.push(`${dir}/${m}`);
      return;
    }
    if (m.includes("/")) {
      if (!existsSync(join(root, `${m}.glb`))) missing.push(m);
      return;
    }
    missing.push(`${m} (a prop path must name its folder)`);
  };
  for (const l of LESSONS) {
    for (const m of [...l.canopy, ...l.mid, ...l.ground]) check(m, false);
    for (const m of l.props.map((p) => p.model)) check(m, false);
    for (const m of [...l.herd, ...l.folk]) check(m, true);
  }
  equal(missing.join(", "), "");
});

test("the chapter opens and closes on the same open language", () => {
  const first = LESSONS[0]!;
  const last = LESSONS[9]!;
  // Milestone 10's roadside is meant to look like Milestone 0's, and the
  // buffalo is the bookend.
  isTrue(last.herd.includes("Buffalo"), "no buffalo at the end");
  isTrue(first.herd.includes("Buffalo"), "no buffalo at the start");
  isTrue(
    Math.abs(first.density - last.density) < 0.5,
    "the end is not as open as the start",
  );
});

test("the supernatural corridor is M4 to M7 and nowhere else", () => {
  const corridor = LESSONS.filter((l) => l.corridor).map((l) => l.n);
  equal(corridor.join(","), "5,6,7");
});

/**
 * "Do not create separate day/night geometry variants; instead, create
 * activity-state variants." The scene is one scene at every hour; what
 * changes is who is out in it.
 */
test("the day has the brief's states, and a dawn of its own", () => {
  // Village life.
  for (const h of [7, 9, 12, 17, 18]) equal(activityAt(h), "day");
  // Winding down, 7 PM to 9 PM.
  for (const h of [19, 20, 21]) equal(activityAt(h), "evening");
  // Deep night, 10 PM to 4 AM.
  for (const h of [22, 23, 0, 2, 3]) equal(activityAt(h), "deep");
  // AND FOUR TO SEVEN IS NOT NOON. The brief ends deep night at four and
  // says nothing about what follows, so everything after it was reading as
  // full village life — a road as busy at half past four in the morning as
  // at midday.
  for (const h of [4, 5, 6]) equal(activityAt(h), "dawn");
});

test("dawn is as quiet as the evening", () => {
  for (const l of LESSONS) {
    equal(folkOut(l, "dawn"), folkOut(l, "evening"));
  }
});

/**
 * Adults keep their own hours — a tea seller closes late, a headman walks
 * home in the dark — but a child on a village road at nine at night reads as
 * wrong to anybody who has been in one.
 */
test("the village children are home between six and seven", () => {
  for (const h of [7, 9, 12, 17])
    isTrue(childrenOut(h), `${h}:00 should be out`);
  for (const h of [18, 19, 21, 23, 0, 3, 5, 6]) {
    isTrue(!childrenOut(h), `${h}:00 should be home`);
  }
});

/**
 * The limp and the unsteady walk are END-OF-DAY gaits — a man stiff walking
 * home, another closing up after a long one. Played at two in the afternoon
 * they stop meaning "late" and start meaning "lame" and "drunk", which is a
 * different thing to say about somebody.
 */
test("nobody limps or staggers in the working day", () => {
  for (let h = 4; h < 18; h++) {
    isTrue(!tiredWalkAt(h), `${h}:00 is the working day`);
  }
  for (const h of [18, 20, 23, 0, 2, 3]) {
    isTrue(tiredWalkAt(h), `${h}:00 is late enough`);
  }
});

test("only the children are governed by that", () => {
  isTrue(isChild("VillageBoy"), "the village boy is a child");
  for (const who of ["Headman", "TeaStall", "FarmerWoman"]) {
    isTrue(!isChild(who), `${who} keeps their own hours`);
  }
});

test("the window wraps midnight rather than breaking at it", () => {
  equal(activityAt(23.9), "deep");
  equal(activityAt(0), "deep");
  equal(activityAt(-1), "deep");
  equal(activityAt(27), "deep");
});

test("the road empties as the evening goes on", () => {
  for (const l of LESSONS) {
    equal(folkOut(l, "day"), l.folk.length);
    // Deep night is nobody, everywhere. An empty road at two in the morning
    // is the whole reason the corridor works.
    equal(folkOut(l, "deep"), 0);
  }
  // Evening keeps a few out at the village centre and the closing market,
  // and sends everyone else indoors.
  equal(folkOut(LESSONS[4]!, "evening"), 1);
  equal(folkOut(LESSONS[6]!, "evening"), 1);
  for (const n of [1, 2, 3, 4, 6, 8, 9, 10]) {
    equal(folkOut(LESSONS[n - 1]!, "evening"), 0);
  }
});

/**
 * The corridor is built up to and fallen away from, rather than switched on
 * at one stone and off at another.
 */
test("the traces build to the corridor and fade after it", () => {
  const traced = LESSONS.filter((l) => l.trace != null).map((l) => l.n);
  equal(traced.join(","), "4,5,6,7,8");

  // Lesson 4 is a threshold: one faint thing, near the far END.
  const four = LESSONS[3]!.trace!;
  equal(four.count, 1);
  isTrue(four.span[0] >= 0.8, "lesson 4's foreshadowing is not near the end");

  // Lesson 8 is a leftover: one, near the START, then nothing after it.
  const eight = LESSONS[7]!.trace!;
  equal(eight.count, 1);
  isTrue(eight.span[1] <= 0.25, "lesson 8's leftover is not near the start");
  for (const n of [9, 10]) equal(LESSONS[n - 1]!.trace, undefined);

  // And the market road is the strongest in the chapter.
  const most = Math.max(...LESSONS.map((l) => l.trace?.count ?? 0));
  equal(LESSONS[6]!.trace!.count, most);
});

test("every trace span is a real slice of its segment", () => {
  for (const l of LESSONS) {
    if (l.trace == null) continue;
    const [lo, hi] = l.trace.span;
    isTrue(lo >= 0 && hi <= 1 && lo < hi, `lesson ${l.n} has a bad span`);
    isTrue(l.trace.count > 0, `lesson ${l.n} traces nothing`);
  }
});
