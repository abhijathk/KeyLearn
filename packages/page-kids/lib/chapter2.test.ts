import { equal, ok } from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
  BLEED,
  MILESTONE_CLEAR,
  type Placed,
  SEGMENT_COUNT,
} from "./chapter1.ts";
import { LESSONS_2 } from "./chapter2.ts";

/**
 * CHAPTER 2, HELD TO CHAPTER 1'S RULES.
 *
 * Chapter 1 has fifty-eight of these and Chapter 2 had none — it was
 * authored after them, against a reference document, and nothing checked it
 * against the invariants the first chapter had to learn one bug at a time.
 * Every rule below is one Chapter 1 already pays for.
 */

const ROOT = new URL(
  "../../../root/public/kids-assets/models/",
  import.meta.url,
);

test("there are ten lessons, numbered 1..10, spanning M10 to M20", () => {
  equal(LESSONS_2.length, SEGMENT_COUNT);
  LESSONS_2.forEach((l, i) => {
    equal(l.n, i + 1, l.name);
    // The brief numbers these 11..20 and the table numbers them 1..10; the
    // milestones are what has to be continuous, and they are `from`/`to`.
    equal(l.from, i, `${l.name} starts at the stone before it`);
    equal(l.to, i + 1, `${l.name} ends at its own stone`);
  });
});

test("nothing stands on the child's side of the road", () => {
  // The single rule that ruins a scene outright: the typing lane is the one
  // place a prop may never be, and the brief says so for every lesson.
  for (const l of LESSONS_2) {
    for (const p of l.props) {
      ok(p.z < 0, `${l.name}: ${p.model} at z ${p.z} is on the road side`);
    }
  }
});

test("every placement sits inside the lesson it belongs to", () => {
  for (const l of LESSONS_2) {
    for (const p of l.props) {
      ok(p.at >= 0 && p.at <= 1, `${l.name}: ${p.model} at ${p.at}`);
    }
  }
});

test("a run of fencing stays inside its own lesson", () => {
  for (const l of LESSONS_2) {
    for (const p of l.props) {
      if (p.run == null) continue;
      const span = (p.h * p.run.aspect * p.run.count) / 100;
      ok(p.at + span <= 1 + BLEED, `${l.name}: ${p.model} run overruns`);
    }
  }
});

test("every boundary run has a way through it", () => {
  // A wall a child cannot see past, with no gate, is a corridor — and the
  // brief asks for openings in every one of them: "break them occasionally
  // with gates, openings, vegetation or eroded sections".
  for (const l of LESSONS_2) {
    for (const p of l.props) {
      if (p.run == null) continue;
      ok(
        p.run.gapAt >= 0 && p.run.gapAt < p.run.count,
        `${l.name}: ${p.model} gap at ${p.run.gapAt} of ${p.run.count}`,
      );
    }
  }
});

test("nothing tall stands where a milestone has to be read", () => {
  // Milestone 13's number was covered by a taro once already. A stone sits
  // at each end of a lesson, so a tall prop at either end needs clearance.
  for (const l of LESSONS_2) {
    for (const p of l.props) {
      if (p.h < 2) continue;
      const nearStone = p.at < 0.04 || p.at > 0.96;
      if (!nearStone) continue;
      ok(
        Math.abs(p.z) > MILESTONE_CLEAR,
        `${l.name}: ${p.model} (h ${p.h}) stands on a milestone at at=${p.at}`,
      );
    }
  }
});

test("anything with a footprint declares how much room it needs", () => {
  // `clear` is what keeps a villager from walking through a wall, and it is
  // about FOOTPRINT rather than height: the palmyra is twenty-five units
  // tall and a hand's breadth through, and Chapter 1 gives it no clearance
  // for exactly that reason. Structures are the things somebody can walk
  // into.
  const STRUCTURE = /House|Hut|Temple|Market|Wall|Fence|Bridge|Cart|Shed|Gate/i;
  for (const l of LESSONS_2) {
    for (const p of l.props) {
      if (!STRUCTURE.test(p.model)) continue;
      ok(
        p.clear != null,
        `${l.name}: ${p.model} (h ${p.h}) declares no clearance`,
      );
    }
  }
});

test("every model the chapter names is on disk", () => {
  for (const l of LESSONS_2) {
    const named = [
      ...l.canopy,
      ...l.mid,
      ...l.ground,
      ...l.props.map((p: Placed) => p.model),
      ...l.herd,
      ...l.folk,
    ];
    for (const m of named) {
      if (!m.includes("/")) continue; // folk and herd are resolved elsewhere
      // THE GREAT HOUSE IS NOT A FILE. It is one name in the table and two
      // things on disk: a portico that is real geometry and a card carrying
      // the body. BOTH have to be there — half a hybrid is either a mansion
      // with no front or a portico standing alone in a field — so this
      // checks the pair rather than letting a virtual name off.
      if (/(?:^|\/)Mana$/i.test(m)) {
        ok(
          existsSync(new URL("ak-3d-pack/ManaPortico.glb", ROOT)),
          `${l.name}: the great house has no portico`,
        );
        ok(
          existsSync(new URL("../cards/ManaBody.webp", ROOT)),
          `${l.name}: the great house has no body card`,
        );
        continue;
      }
      ok(
        existsSync(new URL(`${m}.glb`, ROOT)),
        `${l.name}: ${m}.glb is missing`,
      );
    }
  }
});

test("each lesson splits its planting across the three layers", () => {
  for (const l of LESSONS_2) {
    const sum = l.mix[0] + l.mix[1] + l.mix[2];
    ok(Math.abs(sum - 1) < 1e-6, `${l.name}: mix sums to ${sum}`);
    l.mix.forEach((m, i) => ok(m >= 0, `${l.name}: mix[${i}] is ${m}`));
    // A layer given weight must have something to plant in it.
    const layers = [l.canopy, l.mid, l.ground];
    l.mix.forEach((m, i) => {
      if (m > 0.01)
        ok(layers[i]!.length > 0, `${l.name}: layer ${i} weighted but empty`);
    });
  }
});

test("no lesson is planted from a single species", () => {
  // The brief's whole instruction on reuse: "rotate, scale modestly and vary
  // spacing rather than duplicating large clusters identically".
  for (const l of LESSONS_2) {
    const all = new Set([...l.canopy, ...l.mid, ...l.ground]);
    ok(all.size >= 2, `${l.name} is planted from ${all.size} species`);
  }
});

test("depth runs outward and never reaches the road", () => {
  for (const l of LESSONS_2) {
    const [near, far] = l.depth;
    ok(near > 0, `${l.name}: near depth ${near}`);
    ok(far > near, `${l.name}: depth ${near}..${far} does not run outward`);
  }
});

test("a calf is never drawn without a cow", () => {
  for (const l of LESSONS_2) {
    if (l.herd.some((h) => /Calf/i.test(h))) {
      ok(
        l.herd.some((h) => /^Cow$/i.test(h)),
        `${l.name}: calf with no cow`,
      );
    }
  }
});

test("the river is declared once, in the crossing lesson, and fits the road", () => {
  const withRiver = LESSONS_2.filter((l) => l.river != null);
  equal(withRiver.length, 1, "exactly one lesson carries the river");
  const l = withRiver[0]!;
  equal(l.n, 6, "the river is Lesson 16, which is Chapter 2's sixth");
  const r = l.river!;
  ok(r.at > 0.2 && r.at < 0.8, `river at ${r.at} is too close to a milestone`);
  ok(r.half > 0 && r.half < 8, `river half-width ${r.half}`);
  ok(r.depth > 0, `river depth ${r.depth}`);
});

test("nothing is planted in the river", () => {
  // "Keep taro, grass and bank trees outside the playable bridge deck and
  // collision lane" — and out of the water, which is the same rule.
  const l = LESSONS_2.find((x) => x.river != null)!;
  const r = l.river!;
  for (const p of l.props) {
    const dist = Math.abs(p.at - r.at);
    // Anything standing within the channel would be in the water. Bank
    // dressing belongs beyond it.
    ok(dist > 0.04 || p.h < 1.2, `${l.name}: ${p.model} stands in the channel`);
  }
});

test("the chapter opens where Chapter 1 left off and ends open", () => {
  // "Lesson 11 begins exactly where Chapter 1 ends" — so the first lesson
  // still carries village traces, and the last is the emptiest of the ten.
  const first = LESSONS_2[0]!;
  const last = LESSONS_2[SEGMENT_COUNT - 1]!;
  ok(
    first.props.some((p) => /House|Wall|Hut/i.test(p.model)),
    "Lesson 11 keeps no village trace",
  );
  const densities = LESSONS_2.map((l) => l.density);
  ok(
    last.density <= Math.min(...densities) + 0.15,
    `Lesson 20 (${last.density}) is not among the most open`,
  );
  equal(last.herd.length <= 1, true, "Lesson 20 should be near-empty of stock");
});

test("every lesson is named, differently, and fits the chip", () => {
  const seen = new Set<string>();
  for (const l of LESSONS_2) {
    ok(l.name.length > 0 && l.name.length <= 16, l.name);
    ok(l.name.split(/\s+/).length <= 2, l.name);
    ok(!seen.has(l.name), `${l.name} is used twice`);
    seen.add(l.name);
  }
});

test("no lesson is a corridor — that belongs to Chapter 1", () => {
  // The supernatural corridor is M4..M7 of Chapter 1 and nowhere else; the
  // brief is explicit that Chapter 2 introduces no such character.
  for (const l of LESSONS_2) {
    equal(l.corridor, false, `${l.name} declares a corridor`);
  }
});

test("the four props the brief names by role are actually there", () => {
  // Each of these was missing for a long time because no asset existed, and
  // each is named in the reference as the thing its lesson is FOR. They are
  // pinned by lesson so that losing one is a failing test rather than a
  // scene that quietly goes back to being a road with a cart on it.
  const has = (n: number, re: RegExp) =>
    LESSONS_2[n - 1]!.props.some((p) => re.test(p.model));
  // "Nestle a small weathered stone idol at the base of the tree."
  ok(has(4, /Shrine_Idol/), "Lesson 14 has no idol at the banyan's roots");
  // "Place a haystack off the road as the main landmark."
  ok(has(5, /Haystack/), "Lesson 15 has no haystack");
  // "Stronger gate pillars or a more formal gate." Hung inside the wall's
  // run rather than placed beside it — see the test below for why.
  ok(
    LESSONS_2[6]!.props.some((p) =>
      /Estate_Gate/.test(p.run?.gate?.model ?? ""),
    ),
    "Lesson 17 has no gate in its wall",
  );
  // "Stacked coconuts, baskets, sacks or produce bundles in small clusters."
  ok(has(8, /Produce_Pile/), "Lesson 18 carries no produce");
});

test("the haystack and the cart leave Milestone 15 readable", () => {
  // The brief asks for this by name, because these are the two biggest
  // things in the lesson and the stone is what the child is counting.
  const l = LESSONS_2[4]!;
  for (const p of l.props) {
    if (!/Haystack|Cart/.test(p.model)) continue;
    ok(p.at < 0.85, `${p.model} at ${p.at} crowds the stone at the far end`);
  }
});

test("the estate gate is hung in the wall's own opening", () => {
  // Not placed beside it. `at` is a fraction of the lesson and a panel is a
  // number of world units, and a lesson runs from 21.6 units to 64 across
  // the age bands — so no fixed fraction lands on the gap for every child.
  // Declaring it inside the run is what makes the question unaskable.
  const l = LESSONS_2[6]!;
  const wall = l.props.find((p) => p.run != null)!;
  ok(wall.run!.gate != null, "the estate wall's opening has no gate");
  ok(/Estate_Gate/.test(wall.run!.gate!.model), wall.run!.gate!.model);
  ok(
    wall.run!.gate!.h > wall.h,
    "gateposts should stand taller than the wall they end",
  );
  ok(
    !l.props.some((p) => p.run == null && /Estate_Gate/.test(p.model)),
    "a second gate is placed loose in the lesson",
  );
});

test("a gate is only ever hung in a run that has an opening", () => {
  for (const l of LESSONS_2) {
    for (const p of l.props) {
      if (p.run?.gate == null) continue;
      ok(
        p.run.gapAt >= 0 && p.run.gapAt < p.run.count,
        `${l.name}: ${p.model} hangs a gate in no opening`,
      );
    }
  }
});

test("the idol stands in front of the banyan, not behind its roots", () => {
  // A banyan's base is a RING. Measured on the model: dense prop roots from
  // 2 to 6 units out at this height, running to 10, and almost nothing
  // within a unit of the axis — so the axis is the one place at the foot of
  // this tree that the road cannot see. The idol was put there first.
  const l = LESSONS_2[3]!;
  const idol = l.props.find((p) => /Shrine_Idol/.test(p.model))!;
  const tree = l.props
    .filter((p) => /Banyan/.test(p.model))
    .sort((a, b) => b.h - a.h)[0]!;
  // Nearer the road than the trunk axis by enough to clear the near roots.
  ok(
    idol.z - tree.z >= 2,
    `idol at z ${idol.z} is only ${(idol.z - tree.z).toFixed(1)} in front of the trunk at ${tree.z}`,
  );
  // AND IT IS THE NEAREST THING IN THE GROVE. Clearing the roots was not
  // enough on its own: at -11.4 it still stood behind the mossy stone and
  // the resting stone, a knee-high object three quarters of the way back in
  // a lesson whose planting runs to -26. The canopy is not the constraint —
  // measured, this banyan spans 18.4 units from its axis at h 24, so its
  // crown reaches out over the road and everything here is under it.
  ok(idol.z >= -10, `idol at z ${idol.z} is too far back to be read`);
  // Things MAY stand in front of it — the lamp is supposed to, that is
  // where a lamp goes. What may not happen is one of them hiding it, so the
  // rule is about HEIGHT rather than order: anything nearer the road has to
  // be short enough to sit below the god-stone rather than across it.
  const hiding = l.props.filter(
    (p) =>
      !/Banyan|Shrine_Idol/.test(p.model) && p.z > idol.z && p.h > idol.h * 0.6,
  );
  equal(
    hiding.length,
    0,
    `${hiding.map((p) => p.model).join(", ")} stand in front of the idol and hide it`,
  );
  // And square on to the road: no turn means model +Z, which is its face.
  equal(idol.turn ?? 0, 0, "the idol has been turned away from the road");
});
