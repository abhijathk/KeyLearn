/**
 * Build the SHIPPED Chapter 1 villagers and cattle from their masters.
 *
 *   node scripts/chapter1-characters.mjs            # build + install
 *   node scripts/chapter1-characters.mjs --dry      # build, report, do not install
 *   node scripts/chapter1-characters.mjs Cow        # just one
 *
 * Six characters arrive between 7.7 MB and 26.9 MB and have to fit in a world
 * that starts on a school laptop. THE GEOMETRY IS NOT THE PROBLEM AND IS NOT
 * TOUCHED: these are rigged and skinned, and every measured byte of the excess
 * is texture.
 *
 *   Cow            7.7 MB   5.9 of it one 2048 PNG
 *   Cow_Calf       8.0 MB   6.2
 *   Headman       15.8 MB  13.1 across a 2048 and a 4096
 *   FarmerWoman   16.3 MB  13.1
 *   TeaStall      17.6 MB  14.2
 *   VillageBoy    26.9 MB  21.5 across two 4096s
 *
 * THREE CUTS, each measured rather than assumed:
 *
 * 1. THE SECOND MAP IS METALLIC-ROUGHNESS AND SAYS ALMOST NOTHING. glTF reads
 *    G as roughness and B as metallic, and R only where an occlusion texture
 *    is declared — none of these declare one. It is 4096x4096 to state "not
 *    metal, fairly rough", which is two numbers. Dropped to factors, which is
 *    exact for metallic and invisible for roughness on a baked character at
 *    trail distance. That alone is half of every villager.
 *
 * 2. THE COW'S COLOUR MAP IS ALSO WIRED AS AN EMISSIVE MAP. Not a size
 *    problem — a lighting bug. An emissive baseColor means the animal emits
 *    its own diffuse: it would sit in the field at midnight glowing a full
 *    daylight cow, ignoring the moon, the fog and the hour entirely. The
 *    world has a real 24-hour light and this opts out of it. Dropped.
 *
 * 3. BASECOLOR GOES TO 1024 ETC1S WITH MIPS, the same encode and the same
 *    reasoning as the buffalo: at the size these draw on a trail, a few
 *    hundred screen pixels, 2048 and 4096 are several times more texel than
 *    the screen can show, and a single-level texture shimmers as it shrinks.
 *    ETC1S also stays compressed in video memory, which matters more here
 *    than on disk.
 *
 * AND THE CLIPS NOBODY CAN REACH ARE DROPPED. `restpose` is a bind pose, not
 * an animation. VillageBoy carries twelve martial-arts clips — Backflip,
 * Roundhouse_Kick, Spartan_Kick — which are not village behaviour and which
 * `loadModel` strips from every character in the kids app anyway, so they
 * were downloaded on every visit and discarded before anything could play
 * them. His five ABEE_* idle and locomotion clips are the ones this world
 * actually asks for.
 *
 * TWO OF THEM WILL NOT SIMPLIFY PAST A FLOOR, and the budgets say so rather
 * than pretending otherwise. TeaStall stops at 15,939 triangles and
 * VillageBoy at about 13,530 — VillageBoy returns 13,541 at ratio 0.36 and
 * 13,527 at 0.45, which is the same number twice and not a coincidence. It is
 * the plateau buffalo-shipped.mjs ran into: these are Meshy atlases split at
 * every UV seam, so nearly every edge reads as an open border, LockBorder
 * will not cross it, and the budget is spent long before the target. Forcing
 * past it collapses the seams and tears the texture, which is the one thing
 * not worth trading. So their budgets are the measured floor, not a wish.
 *
 * Verify after building — the QA is cheap and not optional:
 *   node scripts/glb-decompress.mjs <shipped> /tmp/raw.glb
 */
import {
  readFileSync, writeFileSync, copyFileSync, statSync, mkdirSync, mkdtempSync, rmSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const VAULT = join(REPO, "..", "3D ASSETS");
const OUT = join(REPO, "root/public/kids-assets/models/village-folk");


const CAST = [
  { name: "Cow", ratio: 0.38,         src: "Cows/Village cow.glb",                              tex: 1024, drop: [],           budget: 1_000_000, rename: { "Armature|Unreal Take|baselayer": "Idle" }, splice: ["Graze", "Walk", "Idle_Alert"] },
  { name: "Cow_Calf", ratio: 0.38,    src: "Cows/Village cow calf.glb",                         tex: 1024, drop: [],           budget: 1_000_000, rename: { "Armature|Unreal Take|baselayer": "Idle" }, splice: ["Graze", "Walk", "Idle_Alert"] },
  {
    name: "Headman", ratio: 0.4, tex: 1024, budget: 1_500_000,
    // THE SECOND HEADMAN FILE, which arrived with real animation on it. The
    // first had one usable pose under a UUID; this one has two proper idles
    // and a relaxed walk, which is the difference between a man standing in
    // a field and a man who lives there.
    src: "Villagers/Village headman.glb",
    rename: {
      // Named for what they are. `idlePool` finds anything matching /idle/i
      // and CYCLES it when there is more than one, so two named idles is
      // what stops him holding a single loop for four minutes.
      Long_Breathe_and_Look_Around: "Idle_A",
      Short_Breathe_and_Look_Around: "Idle_B",
      // The stroll takes the name the walker code looks for. A headman
      // walking his own village is not marching.
      //
      // The stiff "Walking" is DROPPED rather than renamed out of the way:
      // dropping happens before renaming in this pipeline, so it is gone by
      // the time Casual_Walk claims its name. Renaming it to a parking name
      // and listing that in `drop` did nothing at all — the drop had already
      // run, and the dead clip shipped.
      Casual_Walk: "Walking",
      // KEPT FOR THE NIGHT. An old man walks home from the temple stiffer
      // than he walked to it, and one gait that only comes out after dark
      // says more about him than any amount of daytime idling.
      Injured_Walk: "Walk_Night",
    },
    drop: [
      "restpose", "Walking", "run_fast_6_inplace",
      "Sit_Cross_Legged_on_Floor", "Stand_Up3", "Stand_to_Sit_Transition_M",
    ],
  },
  {
    name: "TeaStall", ratio: 0.4, error: 0.06,
    src: "Village assets/Man2_TeaStallWorker/Teastall Worker.glb",
    tex: 1024, drop: ["restpose"], budget: 1_450_000,
    rename: { "01a0a1cb-7f7c-76e9-ae94-b34a0dac3262": "Idle_A", Unsteady_Walk: "Walk_Night" },
    flatten: [["Idle_A","Hips","x"],["Idle_A","Hips","z"]],
    // ONE IDLE IS A STATUE ON A TIMER.
    //
    // He arrived with a single 2.5-second idle, which is short enough that a
    // child watching him stand in a field sees the same loop four times in
    // ten seconds — the thing that makes a background figure read as a prop
    // rather than as a person. The headman's two are 8 and 11 seconds of
    // small weight shifts on the same 22-bone rig, bone for bone, so they
    // transfer exactly and cost nothing but the keyframes.
    spliceFrom: "village-folk/Headman.glb",
    spliceRename: { Idle_A: "Idle_B", Idle_B: "Idle_C" },
    splice: ["Idle_B", "Idle_C"],
  },
  {
    name: "FarmerWoman", ratio: 0.4,
    src: "Village assets/Woman3_FarmerWoman/Farmer womon.glb",
    tex: 1024, drop: ["restpose"], budget: 1_300_000,
    rename: { "01a0a210-1735-7771-beef-0f70b0b68827": "Idle_A", "01a0a213-0991-749b-9ddb-7ba0e26ea0ee": "Idle_B" },
    flatten: [["Idle_A","Hips","x"],["Idle_A","Hips","z"],["Idle_B","Hips","x"],["Idle_B","Hips","z"]],
    // Her own two are 3.5 and 3.0 seconds — a pair of short loops that read
    // as one fidget. The headman's long ones give her something to do
    // between them, and the pool is picked at random per villager, so four
    // clips is what stops two women in neighbouring fields moving together.
    spliceFrom: "village-folk/Headman.glb",
    spliceRename: { Idle_A: "Idle_C", Idle_B: "Idle_D" },
    splice: ["Idle_C", "Idle_D"],
  },
  {
    name: "Blacksmith",
    ratio: 0.4,
    error: 0.06,
    src: "Village assets/Man5_Blacksmith/Blacksmith.glb",
    // 2048 FOR THIS ONE, AND IT IS THE ATLAS THAT DECIDES IT.
    //
    // His bake is not like the others'. Where a Meshy villager gets a few
    // large UV islands, this is a shattered atlas — hundreds of small
    // islands, no padding between them, and big cream areas sitting directly
    // against dark ones. Halve it to 1024 and build mips and the averaging
    // pulls the cream straight into the hair: at trail distance the model
    // samples a low mip and he goes grey-haired. It looked like a specular
    // blowout and it is not lighting at all, it is neighbouring islands
    // bleeding into each other.
    //
    // So this one keeps its resolution. Roughly 700 KB more than the rest of
    // the cast pays for it, which is the trade the brief asks for: small,
    // but not at the cost of the texture.
    tex: 2048,
    budget: 2_000_000,
    // THREE CLIPS OUT OF SIX, and the three that go are this character's
    // generic Mixamo set rather than his own: `Casual_Walk` is the walk with
    // his weight in it (4.3 seconds against the generic 1.1), `Run_02` is
    // his run, and the plain `Walking` and `Running` are the stock pair
    // every Mixamo export carries.
    //
    // DROPPING HAPPENS BEFORE RENAMING in this pipeline, so the generic
    // `Walking` and `Running` are gone by the time his own claim their
    // names. Listing a clip in both lists is the order this depends on, not
    // a coincidence.
    drop: ["restpose", "Walking", "Running"],
    rename: {
      Casual_Walk: "Walking",
      // His sit becomes his idle, which is the whole of what he does at the
      // forge. He has no standing idle at all — right for a man who is
      // either sitting at his work or walking somewhere.
      Chair_Sit_Idle_M: "Idle_A",
      // Kept for the rare occasion. He does not run the road for a living
      // and it should read as something happening, not as his gait.
      Run_02: "Running",
    },
    // NO FLATTEN. Measured before building: every clip's hips travel less
    // than 0.08 model units in x and z, so these are in-place cycles and
    // there is no root motion to strip. The farmer's idles needed it because
    // hers were locomotion wearing an idle's name; his are not.
  },
  {
    name: "VillageBoy", ratio: 0.36,
    // He has three idles and two transitions — IdleToWalk and WalkToIdle —
    // and NO cycle between them, so he could not cover ground without
    // skating. Abee's rig is the same rig: 97 bones, every name shared, no
    // difference at all, because they came from the same source. So his walk
    // and run transfer exactly, and the root rebase is a no-op because the
    // rests are identical.
    spliceFrom: "abee/Abee.glb",
    splice: ["walk", "run"],
    src: "Villagers/Modern_village_boy_11 years old.glb",
    tex: 1024,
    // Twelve fight clips the kids app strips on load anyway. See the header.
    drop: [
      "360_Power_Spin_Jump", "Backflip", "Backflip_and_Hooks", "Dodge_and_Counter",
      "Flying_Fist_Kick", "Lunge_Spin_Kick", "Punch_Combo_2", "Right_Jab_from_Guard",
      "Roundhouse_Kick", "Spartan_Kick", "Step_in_High_Kick", "Sweeping_Kick",
    ],
    budget: 1_600_000,
  },
];

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const only = args.filter((a) => !a.startsWith("--"));
const kb = (p) => (statSync(p).size / 1024).toFixed(0);
const run = (script, a) =>
  execFileSync("node", [join(HERE, script), ...a], { stdio: "pipe" }).toString();

function readGlb(path) {
  const src = readFileSync(path);
  let off = 12, json = null, bin = null;
  while (off + 8 <= src.length) {
    const len = src.readUInt32LE(off), type = src.readUInt32LE(off + 4);
    const body = src.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    if (type === 0x004e4942) bin = Buffer.from(body);
    off += 8 + len;
  }
  return { json, bin };
}

/**
 * Rewrite a GLB with a fresh binary chunk, so bytes that lost their last
 * reference actually LEAVE THE FILE. Orphaning an image in the JSON and
 * appending a replacement saves nothing, and the whole exercise here is the
 * megabytes the PNGs occupy — so every bufferView is copied in order and
 * given a new offset. Accessors are untouched and keep pointing at their view.
 */
/**
 * Drop every accessor and bufferView nothing points at any more, and re-index
 * what is left.
 *
 * The alternative — leave the orphans in place and overwrite their bytes with
 * a placeholder — needs no re-indexing and is what this did first, but it
 * leaves an accessor declaring a vertex count that its view can no longer
 * supply. Nothing in three.js reads it, because nothing references it; the
 * tools further down this pipeline DO walk every accessor, and handing them a
 * lie is how a build breaks two steps later with an error about something
 * else. Removing them honestly is twenty lines and removes the doubt.
 */
function prune(json, bin) {
  const keepAcc = new Set();
  for (const m of json.meshes ?? []) {
    for (const pr of m.primitives ?? []) {
      for (const a of Object.values(pr.attributes ?? {})) keepAcc.add(a);
      if (pr.indices != null) keepAcc.add(pr.indices);
      for (const t of pr.targets ?? []) for (const a of Object.values(t)) keepAcc.add(a);
    }
  }
  for (const sk of json.skins ?? []) {
    if (sk.inverseBindMatrices != null) keepAcc.add(sk.inverseBindMatrices);
  }
  for (const an of json.animations ?? []) {
    for (const sm of an.samplers ?? []) { keepAcc.add(sm.input); keepAcc.add(sm.output); }
  }
  const accMap = new Map();
  const accessors = [];
  for (const [i, a] of (json.accessors ?? []).entries()) {
    if (!keepAcc.has(i)) continue;
    accMap.set(i, accessors.length);
    accessors.push(a);
  }
  const freedAcc = (json.accessors ?? []).length - accessors.length;

  const keepView = new Set();
  for (const a of accessors) {
    if (a.bufferView != null) keepView.add(a.bufferView);
    if (a.sparse != null) {
      keepView.add(a.sparse.indices.bufferView);
      keepView.add(a.sparse.values.bufferView);
    }
  }
  for (const im of json.images ?? []) if (im.bufferView != null) keepView.add(im.bufferView);
  const viewMap = new Map();
  const views = [];
  const parts = [];
  let cursor = 0;
  for (const [i, v] of (json.bufferViews ?? []).entries()) {
    if (!keepView.has(i)) continue;
    const body = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const pad = (4 - (body.length % 4)) % 4;
    parts.push(body, Buffer.alloc(pad));
    viewMap.set(i, views.length);
    views.push({ ...v, byteOffset: cursor, byteLength: body.length });
    cursor += body.length + pad;
  }
  const freedView = (json.bufferViews ?? []).length - views.length;

  const reAcc = (i) => accMap.get(i);
  for (const m of json.meshes ?? []) {
    for (const pr of m.primitives ?? []) {
      for (const k of Object.keys(pr.attributes ?? {})) pr.attributes[k] = reAcc(pr.attributes[k]);
      if (pr.indices != null) pr.indices = reAcc(pr.indices);
      for (const t of pr.targets ?? []) for (const k of Object.keys(t)) t[k] = reAcc(t[k]);
    }
  }
  for (const sk of json.skins ?? []) {
    if (sk.inverseBindMatrices != null) sk.inverseBindMatrices = reAcc(sk.inverseBindMatrices);
  }
  for (const an of json.animations ?? []) {
    for (const sm of an.samplers ?? []) { sm.input = reAcc(sm.input); sm.output = reAcc(sm.output); }
  }
  for (const a of accessors) {
    if (a.bufferView != null) a.bufferView = viewMap.get(a.bufferView);
    if (a.sparse != null) {
      a.sparse.indices.bufferView = viewMap.get(a.sparse.indices.bufferView);
      a.sparse.values.bufferView = viewMap.get(a.sparse.values.bufferView);
    }
  }
  for (const im of json.images ?? []) {
    if (im.bufferView != null) im.bufferView = viewMap.get(im.bufferView);
  }
  json.accessors = accessors;
  json.bufferViews = views;
  const out = Buffer.concat(parts);
  out.freed = freedAcc + freedView;
  return out;
}

function writeGlb(path, json, bin, replacements) {
  const parts = [];
  let cursor = 0;
  json.bufferViews = json.bufferViews.map((v, i) => {
    const body = replacements.has(i)
      ? replacements.get(i)
      : bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const pad = (4 - (body.length % 4)) % 4;
    parts.push(body, Buffer.alloc(pad));
    const out = { ...v, byteOffset: cursor, byteLength: body.length };
    cursor += body.length + pad;
    return out;
  });
  const newBin = Buffer.concat(parts);
  json.buffers = [{ byteLength: newBin.length }];
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20);
  const chunks = [
    Buffer.alloc(4), Buffer.alloc(4), jsonBuf, jsonPad,
    Buffer.alloc(4), Buffer.alloc(4), newBin,
  ];
  chunks[0].writeUInt32LE(jsonBuf.length + jsonPad.length);
  chunks[1].writeUInt32LE(0x4e4f534a);
  chunks[4].writeUInt32LE(newBin.length);
  chunks[5].writeUInt32LE(0x004e4942);
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  writeFileSync(path, Buffer.concat([header, body]));
}

mkdirSync(OUT, { recursive: true });
let total = 0;
let failed = 0;

for (const c of CAST) {
  if (only.length > 0 && !only.includes(c.name)) continue;
  const tmp = mkdtempSync(join(tmpdir(), `ch1-${c.name}-`));
  const step = (n) => join(tmp, n);
  const from = join(VAULT, c.src);
  console.log(`\n${c.name}  <-  ${c.src}  (${kb(from)} KB)`);

  try {
    // 1 ── clips nobody can reach
    let cur = step("a.glb");
    if (c.drop.length > 0) {
      run("glb-drop-clips.mjs", [from, cur, ...c.drop]);
      console.log(`  dropped ${c.drop.length} clip(s) -> ${kb(cur)} KB`);
    } else {
      copyFileSync(from, cur);
    }

    // 1b ── THE CLIPS THE GAME CANNOT SEE.
    //
    // Clip names are the only handle this world has on an animation: every
    // gait and pose is found by matching the name, and `idlePool` looks for
    // /idle/i. These arrive from Meshy with UUIDs for names, so each
    // villager's only standing loop was invisible and the spawner fell
    // through to whatever `calm()` could find — which is a WALK. That is why
    // the farmers were striding on the spot in the middle of a field.
    //
    // THE CATTLE NEEDED IT FOR A DIFFERENT REASON AGAIN. `spawnWild` plants
    // an animal on its feet by measuring the poses it spends its time in —
    // `plantFeet` is handed the GAITS list, ["Graze", "Idle", "Walk",
    // "Charge_Loop"] — and a cow whose only clip is called
    // "Armature|Unreal Take|baselayer" matches none of them. With nothing to
    // measure, the probe had nothing to say and the animal was never planted:
    // the calf stood half in the floor. Named "Idle", which is both a gait
    // and an idle, so it is grounded AND it stands still.
    if (c.rename != null) {
      const pairs = Object.entries(c.rename).map(([k, v]) => `${k}=${v}`);
      run("glb-rename-clips.mjs", [cur, step("r.glb"), ...pairs]);
      cur = step("r.glb");
      console.log(`  named: ${Object.values(c.rename).join(", ")}`);
    }

    // 1b2 ── AN "IDLE" THAT WALKS ACROSS THE FIELD.
    //
    // Measured on the shipped files, and the numbers are not close: the
    // headman's real idles move his hips 0.02 and 0.07 units over their
    // cycle. The farmer's move hers 2.26 and 3.63, and the tea seller's
    // 2.49. Those are not idles with a sway in them — they are locomotion
    // clips with ROOT MOTION, and renaming a UUID to "Idle_A" did not change
    // what was inside it.
    //
    // So a farmer told to stand in her plot and idle walked steadily out of
    // it, and nothing about the code was wrong: it played the idle it was
    // given. The body motion is worth keeping — arms, spine, a shift of
    // weight, which is what somebody working in a field looks like — and
    // only the TRAVEL has to go. Flattening the hips in x and z holds her
    // where she was put and leaves everything above the waist alone; y is
    // untouched, so she still rises and settles as she moves.
    if (c.flatten != null) {
      for (const [clip, bone, axis] of c.flatten) {
        run("glb-flatten-track.mjs", [cur, step("f.glb"), clip, bone, axis]);
        copyFileSync(step("f.glb"), step("flat.glb"));
        cur = step("flat.glb");
      }
      console.log(`  flattened ${c.flatten.length} root track(s)`);
    }

    // 1c ── ONE CLIP IS NOT AN ANIMAL.
    //
    // The cattle arrived with a single pose apiece, so a cow could stand and
    // do nothing else — it could not graze, could not walk, and could not
    // move out of a buffalo's way. The buffalo already has thirteen clips
    // and its skeleton is a SUPERSET of the cow's: 29 bones against 27, the
    // same names throughout, the extra two being neck0 and neck1. So its
    // gaits transfer directly, and the splice remaps by NAME and leaves the
    // two neck tracks behind.
    //
    // NOT THE TURNS. Turn_Left_90 and Turn_Right_90 were in this list and
    // came out wrong on the cow, and there is no version of tuning them that
    // is worth doing: they are authored around the buffalo's own turn
    // hand-off — the tick fades the clip out while raising the heading by
    // exactly what the clip gives up — and the cattle do not use that
    // machinery at all. Their state machine eases its own yaw, so it never
    // asks for a turn clip. A clip that can only look wrong and can never be
    // played is weight in the file and a trap for whoever reads the list
    // next.
    //
    // Only the calm ones otherwise. Charge_Start, Aggressive_Threat and
    // Supernatural_Rear_Stomp are the buffalo's temper — they are what makes
    // IT the dangerous animal on this road, and a cow that can rear at a
    // child is a different game. The kids app strips attack clips on load
    // anyway, so they would be downloaded and thrown away.
    if (c.splice != null) {
      const donor = join(
        REPO,
        "root/public/kids-assets/models",
        c.spliceFrom ?? "ak-3d-pack/Buffalo.glb",
      );
      run("glb-decompress.mjs", [donor, step("buffalo.glb")]);
      // THE DONOR IS RENAMED, NOT THE RESULT. Both villagers already own an
      // `Idle_A`, and a splice appends rather than merges — take it under its
      // own name and the file ships two clips called Idle_A, of which the
      // matcher can only ever find the first. Renaming on the donor copy is
      // also the only point where the two names are still telling apart.
      if (c.spliceRename != null) {
        run("glb-rename-clips.mjs", [
          step("buffalo.glb"), step("donor.glb"),
          ...Object.entries(c.spliceRename).map(([a, b]) => `${a}=${b}`),
        ]);
        copyFileSync(step("donor.glb"), step("buffalo.glb"));
      }
      run("glb-splice-animations.mjs", [
        cur, step("buffalo.glb"), step("s0.glb"),
        ...c.splice.flatMap((t) => ["--take", t]),
      ]);
      cur = step("s0.glb");
      console.log(`  took from ${c.spliceFrom ?? "the buffalo"}: ${c.splice.join(", ")}`);
      // AND REBASED ONTO THIS ANIMAL'S OWN BODY.
      //
      // The splice remaps by bone name, which is right for rotation — a
      // joint angle means the same thing on any skeleton that has that
      // joint. Every one of these clips is rotation-only except ONE channel:
      // a translation on the hips, carrying the body's height and its bob,
      // written in ABSOLUTE units in the buffalo. Its hips rest at -0.1195,
      // the cow's at -0.0912, the calf's at -0.083 — so the borrowed clips
      // lifted each animal off its own rest, and the calf, having the
      // shortest legs, was thrown furthest. That is why its animation looked
      // fully off while the cow's was merely a little high.
      run("glb-rebase-root.mjs", [
        cur, step("s1.glb"), "--from", step("buffalo.glb"),
        ...c.splice.flatMap((t) => ["--clip", t]),
      ]);
      cur = step("s1.glb");
    }

    // 1b ── the keys that say nothing
    //
    // These arrive with a key on every joint on every frame, because that is
    // what a solver writes: it poses the whole skeleton each frame and saves
    // the result. A man standing in a field is not moving most of his bones
    // most of the time, and a joint turning steadily needs two keys rather
    // than thirty. Thinned against the SAME linear interpolation the runtime
    // performs, to a quarter of a degree — a hard bound on playback error,
    // not an estimate — so this is size off the wire and nothing off the
    // screen. It is what pays for the extra idles above several times over.
    run("glb-reduce-keys.mjs", [cur, step("k0.glb")]);
    cur = step("k0.glb");

    // 2 ── the maps that say nothing, and the emissive that lies
    const { json, bin } = readGlb(cur);
    const keep = new Set();
    let dropped = 0;
    for (const m of json.materials ?? []) {
      const pbr = (m.pbrMetallicRoughness ??= {});
      if (pbr.baseColorTexture != null) {
        keep.add(json.textures[pbr.baseColorTexture.index].source);
      }
      if (pbr.metallicRoughnessTexture != null) {
        delete pbr.metallicRoughnessTexture;
        pbr.metallicFactor = 0;
        pbr.roughnessFactor = 0.85;
        dropped++;
      }
      // AND THE NORMAL MAP, for the same reason as the metallic-roughness.
      //
      // The blacksmith is the first of these to ship one. At the size these
      // draw — a few hundred screen pixels on a trail — a tangent-space
      // normal map is a second full-resolution texture spent on surface
      // detail below the size of a pixel, on a model whose lighting is
      // already baked into its basecolor. Dropped WITH its reference: a
      // material still pointing at a deleted image is the dangling index
      // that made this step fall over.
      if (m.normalTexture != null) { delete m.normalTexture; dropped++; }
      // An emissive baseColor makes the animal its own light source and opts
      // it out of the world's 24-hour lighting entirely. See the header.
      if (m.emissiveTexture != null) { delete m.emissiveTexture; dropped++; }
      if (m.emissiveFactor != null) m.emissiveFactor = [0, 0, 0];
    }
    // AND THE TANGENTS, which are 22 per cent of a villager's mesh and have
    // nothing to orient. A TANGENT attribute exists to give a normal map a
    // frame to work in; none of these carry a normal map, and the one other
    // map they had was the metallic-roughness just deleted above. So it is
    // 0.66 MB per villager of vertex data that the shader has no use for —
    // measured on TeaStall: 41,519 vertices x VEC4 float.
    let tangents = 0;
    for (const m of json.meshes ?? []) {
      for (const pr of m.primitives ?? []) {
        if (pr.attributes?.TANGENT != null) { delete pr.attributes.TANGENT; tangents++; }
      }
    }
    const pruned = prune(json, bin);
    // ── RE-INDEXED, NOT JUST FILTERED ───────────────────────────────────
    //
    // Dropping images renumbers every image after them, and textures and
    // materials address images and textures BY INDEX. Filtering without
    // remapping happened to work for six characters because their basecolor
    // was image 0 and only trailing maps were removed — the blacksmith ships
    // a normal map FIRST, so his basecolor is image 1, and the old code read
    // `images[1]` from an array that now had one entry in it and fell over
    // with "cannot read properties of undefined".
    //
    // Which is the good failure. The same staleness in a material index
    // would not have thrown: it would have pointed a character's skin at
    // whatever texture happened to land on that number.
    const imgKeep = [...(json.images ?? []).keys()].filter((i) => keep.has(i));
    const imgMap = new Map(imgKeep.map((old, now) => [old, now]));
    json.images = imgKeep.map((i) => json.images[i]);
    const texKeep = [...(json.textures ?? []).keys()].filter((i) =>
      imgMap.has(json.textures[i].source),
    );
    const texMap = new Map(texKeep.map((old, now) => [old, now]));
    json.textures = texKeep.map((i) => ({
      ...json.textures[i],
      source: imgMap.get(json.textures[i].source),
    }));
    for (const m of json.materials ?? []) {
      const bct = m.pbrMetallicRoughness?.baseColorTexture;
      if (bct != null) {
        bct.index = texMap.get(bct.index);
      }
    }
    cur = step("b.glb");
    writeGlb(cur, json, pruned, new Map());
    console.log(
      `  dropped ${dropped} map(s)${tangents > 0 ? `, ${tangents} tangent set(s)` : ""}` +
        `, pruned ${pruned.freed} orphan(s) -> ${kb(cur)} KB`,
    );

    // 3 ── basecolor -> 1024 ETC1S with mips. basisu has no resize of its
    //      own; cwebp does it losslessly on the way in.
    // The basecolor's index AFTER the renumbering above — which is 0, because
    // it is the only image left, but taken from the map rather than assumed
    // so the next character with an unexpected texture set says so loudly
    // instead of shipping somebody else's skin.
    const bc = imgMap.get([...keep][0]);
    if (bc != null) {
      const { json: j2, bin: b2 } = readGlb(cur);
      const v = j2.bufferViews[j2.images[bc].bufferView];
      writeFileSync(step("tex.png"), b2.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
      execFileSync("cwebp", ["-quiet", "-resize", String(c.tex), String(c.tex), "-lossless", step("tex.png"), "-o", step("tex.webp")]);
      execFileSync("dwebp", ["-quiet", step("tex.webp"), "-o", step("tex_small.png")]);
      execFileSync("basisu", ["-ktx2", "-mipmap", "-q", "255", "-file", step("tex_small.png"), "-output_file", step("tex.ktx2")], { stdio: "ignore" });
      console.log(`  basecolor -> ${c.tex}x${c.tex} ETC1S, ${kb(step("tex.ktx2"))} KB`);
      run("glb-swap-texture.mjs", [cur, step("c.glb"), String(bc), step("tex.ktx2")]);
      cur = step("c.glb");
    }

    // 4 ── AND NOW THE GEOMETRY, which is what is actually left.
    //
    // With the maps gone the textures are about 250 KB each and the rest of
    // the megabyte is mesh: 30,000-odd triangles apiece. That is a sensible
    // number for a character you inspect and an extravagant one for a cow
    // standing in a field at a couple of hundred screen pixels — the shipped
    // buffalo, which is the nearest thing to these and stands in the same
    // fields, carries 14,162. Simplifying a skin is safe here because
    // meshopt chooses a SUBSET of the original vertices rather than making
    // new ones, so every survivor keeps the joints and weights it was
    // authored with; the skin is not resampled, it is the same skin on fewer
    // points. Read the ratio the tool REPORTS, not the one requested — it
    // stops short rather than exceed its error bound.
    const simp = run("glb-simplify-skinned.mjs", [
      cur, step("s.glb"), "--ratio", String(c.ratio), "--error", String(c.error ?? 0.02),
    ]);
    const got = simp.match(/[\d,]+ *-> *[\d,]+ *tri|ratio [\d.]+/i);
    console.log(`  simplify ${c.ratio} -> ${got ? got[0] : "see tool"}, ${kb(step("s.glb"))} KB`);
    cur = step("s.glb");

    // 5 ── quantize, then meshopt. Not --indices; see buffalo-shipped's
    //      decision 4 — the index codec needs 32-bit indices and widening
    //      them costs more than the codec recovers on meshes like these.
    run("glb-quantize-attrs.mjs", [cur, step("d.glb")]);
    run("glb-compress.mjs", [step("d.glb"), step("e.glb")]);
    const size = statSync(step("e.glb")).size;
    const was = statSync(from).size;
    console.log(`  ${(was / 1e6).toFixed(1)} MB -> ${(size / 1e6).toFixed(2)} MB  (${(100 - (size / was) * 100).toFixed(0)}% off)`);

    if (size > c.budget) {
      console.error(`  OVER BUDGET — expected under ${(c.budget / 1e6).toFixed(2)} MB`);
      failed++;
    }
    if (!DRY) {
      copyFileSync(step("e.glb"), join(OUT, `${c.name}.glb`));
      console.log(`  installed -> village-folk/${c.name}.glb`);
    }
    total += size;
  } catch (e) {
    console.error(`  FAILED: ${e.message.split("\n")[0]}`);
    failed++;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\ntotal shipped ${(total / 1e6).toFixed(2)} MB across ${CAST.length} characters`);
process.exit(failed > 0 ? 1 : 0);
