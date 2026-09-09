#!/usr/bin/env node
/**
 * Every character the kids world can put on screen, checked against the
 * rules the world actually uses to drive it.
 *
 * Nearly every defect in this area has been the same shape: a model arrives
 * with clip names nobody predicted, the matcher silently finds nothing, and
 * the character stands there doing one thing forever with no error anywhere.
 * `Wave_Cute` cost the six-year-old his wave; `Running`/`Walking` would have
 * given the robot a walk cycle for a run; `Stand_To_CrossLegged` meant Peeli
 * never sat. None of those threw. This is the check that would have caught
 * all of them before a person had to notice.
 *
 *   node scripts/kids-characters.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";

const HERO_DIR = "root/public/kids-assets/models/hero";
// The commercially licensed characters live apart from the free ones; see
// that folder's COMMERCIAL-LICENSE.md and `LICENSED_MODELS` in world.ts.
const LICENSED_DIR = "root/public/kids-assets/models/licensed";
const modelPath = (name) =>
  existsSync(`${LICENSED_DIR}/${name}.glb`)
    ? `${LICENSED_DIR}/${name}.glb`
    : `${HERO_DIR}/${name}.glb`;

// ── the world's own matching rules, mirrored ─────────────────────────────
const RUN_STRICT = /(?:^|[^a-z])(?:run|gallop)(?:ning|s)?(?:[^a-z]|$)/;
const RUN_LOOSE = /run|gallop|walk/;
const WALK = /(?:^|[^a-z])walk(?:ing|s)?(?:[^a-z]|$)/;
const IDLE_FIRST = /^idle/;
const IDLE = /idle|stand/;
const JOY = /joy|celebrat|victory|cheer/;
const pose = (n) => new RegExp(`^${n}(?:_[a-z0-9]+)*$`);
const BRAVE = [/^martialarts_ready$/, /^high_kick_stepin$/, /^sweeping_kick$/,
  /^punch_forward_bothfists$/, /^punch_right$/, /^punch_left$/, /^kick$/, /^combo_3hit$/];
const FIDGET = [/^excited$/, /^no_disagree$/, /^standing$/];
const WAG = /^tail_wag$/;
const FOOT = /toe|foot|ankle|paw|hoof/i;
const LEG = /leg|shin|calf/i;
const TUNED_WALK = 1.03, TUNED_RUN = 0.63;

function open(file) {
  const b = readFileSync(file);
  let off = 12, json = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
    if (t === 0x4e4f534a) json = JSON.parse(b.subarray(off + 8, off + 8 + len).toString("utf8"));
    off += 8 + len;
  }
  const acc = json.accessors ?? [];
  const clips = (json.animations ?? []).map((a) => ({
    name: a.name,
    dur: Math.max(...a.samplers.map((s) => acc[s.input]?.max?.[0] ?? 0)),
  }));
  const joints = (json.skins?.[0]?.joints ?? []).map((j) => json.nodes[j].name);
  let verts = 0;
  for (const m of json.meshes ?? []) for (const p of m.primitives) verts += acc[p.attributes.POSITION]?.count ?? 0;
  return { json, clips, joints, verts, bytes: b.length };
}

// ── who exists, and what each one must be able to do ─────────────────────
// Read from the page rather than duplicated here, so adding a character to
// a picker without shipping its model fails this check instead of failing
// in front of a child.
function roster(constName) {
  const src = readFileSync("packages/page-kids/lib/KidsPage.tsx", "utf8");
  const at = src.indexOf(`const ${constName} = [`);
  if (at === -1) throw new Error(`${constName} not found in KidsPage.tsx`);
  const body = src.slice(at, src.indexOf("] as const;", at));
  return [...body.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
}
const HEROES = roster("HERO_CHARACTERS");
const COMPANIONS = roster("COMPANIONS");
const SIBLINGS = ["Explorer", "Explorer6", "Peeli"];
const HEIGHTS = { Explorer: 4.8, Peeli: 4.55, Explorer6: 3.95, Robot: 3.0, Puppy: 1.5 };

let failures = 0;
const fail = (who, msg) => { failures++; console.log(`  FAIL  ${who}: ${msg}`); };
const ok = (who, msg) => console.log(`  ok    ${who}: ${msg}`);

// The KayKit heroes ship no clips of their own: `clipsFor()` hands them the
// shared animation GLBs instead, bound at runtime by matching bone names.
// A check that does not model that reports the Knight as broken, which is
// how this script first ran.
const shared = ["anims-move.glb", "anims-idle.glb"]
  .filter((f) => existsSync(`${HERO_DIR}/${f}`))
  .flatMap((f) => open(`${HERO_DIR}/${f}`).clips);
console.log(`Shared clips available to clipless rigs: ${shared.length}` +
  ` (${shared.map((c) => c.name).slice(0, 6).join(", ")}${shared.length > 6 ? " …" : ""})\n`);

const all = [...new Set([...HEROES, ...COMPANIONS])];
console.log(`Checking ${all.length} characters\n`);

for (const name of all) {
  const file = modelPath(name);
  if (!existsSync(file)) { fail(name, `no model at ${file}`); continue; }
  const m = open(file);
  const usable = m.clips.length > 0 ? m.clips : shared;
  const ownClips = m.clips.length > 0;
  const pick = (re) => usable.find((c) => re.test(c.name.toLowerCase())) ?? null;

  // Gait: everyone who walks a trail needs a run and an idle.
  const run = pick(RUN_STRICT) ?? pick(RUN_LOOSE);
  const walkRaw = pick(WALK);
  const walk = walkRaw && walkRaw !== run ? walkRaw : null;
  const idle = pick(IDLE_FIRST) ?? pick(IDLE);
  if (!run) fail(name, "no run clip resolves");
  if (!idle) fail(name, "no idle clip resolves — the companion weighting is skipped entirely without one");
  else if (/jump|land|fall/i.test(idle.name)) fail(name, `idle resolves to "${idle.name}" — that is an airborne pose`);
  if (run && walk && run.name === walk.name) fail(name, "run and walk resolve to the same clip");

  // A gait retimed more than ~3x reads as frantic; it is what made the
  // Cute pair unusable.
  for (const [slot, clip, tuned] of [["run", run, TUNED_RUN], ["walk", walk, TUNED_WALK]]) {
    if (!clip) continue;
    const scale = clip.dur / tuned;
    if (scale > 3) fail(name, `${slot} "${clip.name}" is ${clip.dur.toFixed(2)}s -> retimed ${scale.toFixed(1)}x`);
  }

  // plantFeet must find something to stand on, or it skins every vertex.
  const feet = m.joints.filter((j) => FOOT.test(j));
  const legs = m.joints.filter((j) => LEG.test(j));
  if (feet.length === 0 && legs.length === 0) {
    fail(name, `no foot/leg bones — plantFeet falls back over all ${m.verts.toLocaleString()} vertices`);
  }

  // Height must be deliberate, not the 3.4 default, for anyone we ship.
  if (HEIGHTS[name] == null && SIBLINGS.includes(name)) fail(name, "no registered height");

  // Mirrors the world's quadruped test, so "the dog spins" cannot come back
  // silently if a rig is renamed.
  const quad =
    !m.joints.some((j) => /toe|foot|ankle/i.test(j)) &&
    m.joints.some((j) => /frontleg|foreleg/i.test(j)) &&
    m.joints.some((j) => /backleg|hindleg|rearleg/i.test(j));
  if (name === "Puppy" && !quad) fail(name, "not detected as a quadruped — it will pivot on the spot");
  if (SIBLINGS.includes(name) && quad) fail(name, "detected as a quadruped");

  const bits = [
    `run=${run?.name ?? "-"}`,
    `walk=${walk?.name ?? "-"}`,
    `idle=${idle?.name ?? "-"}`,
    `joy=${pick(JOY)?.name ?? "-"}`,
  ];
  if (quad) bits.push("quadruped");
  if (COMPANIONS.includes(name)) {
    const wag = pick(WAG);
    if (wag) bits.push(`wag=${wag.name}`);
    const fid = FIDGET.map((re) => pick(re)).filter(Boolean);
    if (fid.length) bits.push(`fidget=${fid.map((f) => f.name).join("+")}`);
  }
  if (SIBLINGS.includes(name)) {
    const brave = BRAVE.map((re) => pick(re)).filter(Boolean);
    if (brave.length === 0) fail(name, "a sibling with no brave clips — will never react to skeletons");
    else bits.push(`brave=${brave.length}`);
    const sit = pick(pose("sit_crosslegged_idle")) ?? pick(pose("crosslegged_idle"));
    if (!sit) fail(name, "no cross-legged sit resolves");
    else bits.push("sit=y");
  }
  ok(name, `${(m.bytes / 1048576).toFixed(2)}MB ${m.joints.length}j ${ownClips ? "" : "[shared clips] "}${bits.join(" ")}`);
}

// ── the licensed folder is a licence boundary, so keep it honest ────────
//
// `root/public/kids-assets/models/licensed/` means "commercially licensed,
// not AGPL" — that is the rule for the directory, whatever ends up in it.
// The loader decides where to look from `LICENSED_MODELS` in world.ts, so
// the two can drift: a bought model dropped in the folder but not listed
// would simply 404, and a name listed but shipped in `hero/` would be
// served as though it were free. Both are caught here.
{
  const onDisk = readdirSync(LICENSED_DIR)
    .filter((f) => f.endsWith(".glb"))
    .map((f) => f.replace(/\.glb$/, ""))
    .sort();
  const src = readFileSync("packages/page-kids/lib/world.ts", "utf8");
  const block = src.split("const LICENSED_MODELS")[1]?.split("]")[0] ?? "";
  const declared = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  const missing = onDisk.filter((n) => !declared.includes(n));
  const extra = declared.filter((n) => !onDisk.includes(n));
  if (missing.length) fail("licensed/", `in the folder but not in LICENSED_MODELS: ${missing.join(", ")}`);
  if (extra.length) fail("licensed/", `in LICENSED_MODELS but not in the folder: ${extra.join(", ")}`);
  if (!missing.length && !extra.length) {
    ok("licensed/", `${onDisk.length} commercially licensed model(s), folder and code agree`);
  }
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
