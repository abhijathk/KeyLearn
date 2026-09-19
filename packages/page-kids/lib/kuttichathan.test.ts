import test from "node:test";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import {
  anchorsFrom,
  beatAt,
  chooseRoutine,
  CLIPS,
  isGone,
  RESERVED_CLIPS,
  routineIsSound,
  ROUTINES,
  routineSeconds,
  routinesFor,
  thinAnchors,
} from "./kuttichathan.ts";

/**
 * The point of these is not that the code runs. It is that the SEQUENCES are
 * playable — a routine whose poses do not join up is a pop on the road, and
 * the only place that is cheap to find is here.
 */

test("every routine is playable as written", () => {
  for (const r of ROUTINES) {
    const fault = routineIsSound(r);
    isNull(fault, fault ?? "");
  }
});

test("every routine can be described in one line", () => {
  // A routine that cannot be said in a sentence is usually a clip list with a
  // name on it, which is the thing these tables exist to not be.
  for (const r of ROUTINES) {
    isTrue(r.says.length > 20, `${r.id}: says nothing`);
    isTrue(r.says.length < 120, `${r.id}: says too much`);
  }
});

test("almost every clip he has is used somewhere", () => {
  const used = new Set(ROUTINES.flatMap((r) => r.beats));
  const unused = [...CLIPS.keys()].filter(
    (c) => !used.has(c) && !RESERVED_CLIPS.has(c),
  );
  // Two of the inherited Meshy clips are allowed to sit unused: the vault is
  // for a wall he has no reason to cross, and the long dive is a drop from a
  // roof height the village does not build. `climbing_up_wall` IS used.
  const allowedIdle = new Set(["Vault_and_Land", "Dive_Down_and_Land_2"]);
  const stranded = unused.filter((c) => !allowedIdle.has(c));
  equal(stranded.length, 0, `unused clips: ${stranded.join(", ")}`);
});

test("the reserved clip is genuinely reserved", () => {
  // If this starts failing, somebody found a slot for `light_hit` — which
  // means an ambient routine now implies an attacker that does not exist.
  const used = new Set(ROUTINES.flatMap((r) => r.beats));
  for (const c of RESERVED_CLIPS) {
    isTrue(!used.has(c), `${c} was supposed to be held back`);
  }
});

test("he is never left invisible", () => {
  // `gone` is a held pose with VFX over it. A routine that ends there, or
  // that vanishes without a reappear, leaves a dust heap lying in the lane.
  for (const r of ROUTINES) {
    const vanishes = r.beats.filter((b) => CLIPS.get(b)!.to === "gone").length;
    const returns = r.beats.filter((b) => CLIPS.get(b)!.from === "gone").length;
    equal(
      vanishes,
      returns,
      `${r.id}: ${vanishes} vanishes, ${returns} returns`,
    );
  }
});

test("a routine is long enough to read and short enough to leave", () => {
  for (const r of ROUTINES) {
    const s = routineSeconds(r);
    // Under about twelve seconds nothing registers as having happened at all;
    // over a minute he stops being a glimpse and becomes furniture.
    isTrue(s >= 8, `${r.id}: only ${s.toFixed(1)}s`);
    isTrue(s <= 60, `${r.id}: ${s.toFixed(1)}s is a residency`);
  }
});

test("the bold routines wait for dark", () => {
  // Stones on a roof and laughing at a house are night things. In daylight
  // the only things on offer at a house are nothing at all.
  const dayHouse = routinesFor("house", false);
  equal(dayHouse.length, 0);
  const nightHouse = routinesFor("house", true);
  isTrue(nightHouse.length >= 2);
  // The tree is his home at any hour.
  isTrue(routinesFor("tree", false).length >= 2);
});

test("choosing a routine is deterministic for a place", () => {
  const a = chooseRoutine("tree", true, 0.42);
  const b = chooseRoutine("tree", true, 0.42);
  isNotNull(a);
  equal(a?.id, b?.id);
  // And it covers the pool rather than always answering the same thing.
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    seen.add(chooseRoutine("tree", true, i / 100)!.id);
  }
  isTrue(seen.size >= 2, `only ever picked ${[...seen].join(", ")}`);
});

test("a haunt with nothing standing for it offers nothing", () => {
  equal(chooseRoutine("well", false, 0.5)?.haunt, "well");
  // `road` exists in the table; a haunt that did not would answer null rather
  // than throw, because a chapter is allowed to not build a thing.
  equal(
    routinesFor("wall", true).every((r) => r.haunt === "wall"),
    true,
  );
});

test("anchors are found by what the chapter actually stands up", () => {
  const placed = [
    { model: "village-plants/Banyan_Almaram", x: 10, z: -19 },
    { model: "village-plants/Peepal_Arayal", x: 40, z: -12 },
    { model: "village-util/Village_Well", x: 60, z: -14 },
    { model: "village-stone/Shrine_Idol", x: 80, z: -9 },
    { model: "ak-3d-pack/Mana", x: 120, z: -31 },
    { model: "village-plants/Mango_Tree", x: 15, z: -8 },
  ];
  const found = anchorsFrom(placed);
  equal(found.length, 5, "the mango tree is not a haunt");
  equal(found.filter((a) => a.haunt === "tree").length, 2);
  equal(found.find((a) => a.haunt === "house")?.x, 120);
});

test("a run of wall panels is one wall, not twelve", () => {
  // Chapter 1 writes its estate boundary as twelve separate panels. Without
  // this he climbs one, drops off, walks four metres and climbs the next.
  const panels = Array.from({ length: 12 }, (_, i) => ({
    model: "village-util/Laterite_Wall",
    x: 100 + i * 6.25,
    z: -12,
  }));
  const thinned = thinAnchors(anchorsFrom(panels));
  isTrue(thinned.length <= 6, `${thinned.length} wall haunts in one boundary`);
  isTrue(thinned.length >= 1);
  // And two genuinely separate walls stay separate.
  const apart = thinAnchors(
    anchorsFrom([
      { model: "village-util/Laterite_Wall", x: 0, z: -12 },
      { model: "village-util/Laterite_Wall", x: 200, z: -12 },
    ]),
  );
  equal(apart.length, 2);
});

test("the clock finds the right beat without being told when a clip ended", () => {
  const r = ROUTINES.find((x) => x.id === "tree-settle")!;
  // Beat 0 is the sneaky walk, held 3.4s.
  equal(beatAt(r, 0).index, 0);
  equal(beatAt(r, 3.0).clip, "kutti_04_sneaky_walk");
  // Then the squat enter, a 2s one-shot: 5.0 in is 1.6 into it.
  equal(beatAt(r, 5.0).clip, "kutti_06_squat_enter");
  // The long squat idle carries most of the routine.
  equal(beatAt(r, 12).clip, "kutti_07_squat_idle");
  // And it finishes rather than running off the end of the table.
  const end = beatAt(r, routineSeconds(r) + 5);
  isTrue(end.done);
  equal(end.index, r.beats.length - 1);
});

test("he is only invisible while the dust is actually on him", () => {
  const r = ROUTINES.find((x) => x.id === "tree-vanish")!;
  // Sitting under the tree: visible.
  isTrue(!isGone(r, 1));
  // The vanish is a 1s collapse; he is not gone at its first frame.
  const vanishStart = CLIPS.get("kutti_06_squat_enter")!.seconds + 14;
  isTrue(!isGone(r, vanishStart + 0.1));
  // He is by the end of it.
  isTrue(isGone(r, vanishStart + 0.95));
  // And back once the reappear has played out.
  isTrue(!isGone(r, vanishStart + 1.0 + 1.1));
});

test("the clip table matches the file that ships", async () => {
  // The durations here are budgeted against by every `holds` entry above. If
  // a clip is retimed and this table is not, the routines quietly go out of
  // step with the animation and nothing else notices.
  const { readFile } = await import("node:fs/promises");
  const url = new URL(
    "../../../../3D ASSETS/Village assets/Kuttichathan/Kuttichathan_clips.json",
    import.meta.url,
  );
  let raw: string;
  try {
    raw = await readFile(url, "utf8");
  } catch {
    return; // the authoring folder is not part of a checkout; nothing to check
  }
  const shipped = JSON.parse(raw) as Record<
    string,
    { seconds: number; loop: boolean }
  >;
  for (const [name, fact] of CLIPS) {
    const s = shipped[name];
    if (s == null) continue; // the inherited Meshy clips are not in the table
    equal(
      Math.round(fact.seconds * 100),
      Math.round(s.seconds * 100),
      `${name}: table says ${fact.seconds}s, file says ${s.seconds}s`,
    );
    equal(fact.loop, s.loop, `${name}: loop flag disagrees with the file`);
  }
});
