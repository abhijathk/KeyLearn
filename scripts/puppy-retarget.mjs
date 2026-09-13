/**
 * Retarget the puppy animation library onto ANY dog model.
 *
 *   node scripts/puppy-retarget.mjs <clips.glb> <target-dog.glb> <out.glb> [--map alias.json] [--clips A,B]
 *
 * The naive way to "reuse" animations is to copy each bone's local rotation
 * curve across by name. That only works when both rigs happen to share a bind
 * pose AND a bone roll, and two dog models almost never do: one has the
 * forelegs straight in bind, another has them slightly flexed; one runs the
 * bone's local X down the limb, another runs Y. Copy local rotations between
 * those and the dog comes out folded inside itself. It looks like the animation
 * is broken; what is broken is the assumption.
 *
 * So this transfers the WORLD-SPACE rotation DELTA instead:
 *
 *   D          = W_src(frame) * conj(W_src(rest))      // what the bone DID
 *   W_dst      = D * W_dst(rest)                       // do the same to theirs
 *   R_dst_local = conj(W_dst(parent)) * W_dst
 *
 * D is "how far this bone turned, in world space, from where it started". That
 * is a statement about the MOTION and carries no assumption about either rig's
 * bind pose or bone roll, so it is meaningful on a skeleton it was not authored
 * for. Both rigs are read from their own rest poses, and each is only ever
 * compared with itself.
 *
 * Root translation is scaled by the ratio of hip heights, measured from each
 * model's own skeleton, so a dog twice the size takes strides twice as long
 * instead of shuffling on the spot.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [srcPath, dstPath, outPath] = positional;
if (!srcPath || !dstPath || !outPath) {
  console.error("usage: puppy-retarget.mjs <clips.glb> <target-dog.glb> <out.glb> [--map alias.json] [--clips A,B]");
  process.exit(2);
}

// ── glTF read/write ─────────────────────────────────────────────────────
function load(path) {
  const src = readFileSync(path);
  let off = 12, json = null, bin = null;
  while (off + 8 <= src.length) {
    const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
    const body = src.subarray(off + 8, off + 8 + len);
    if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    if (t === 0x004e4942) bin = Buffer.from(body);
    off += 8 + len;
  }
  return { json, bin };
}
const readAcc = (g, i) => {
  const a = g.json.accessors[i], v = g.json.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const stride = v.byteStride || n * 4;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(g.bin.readFloatLE(base + k * stride + c * 4));
    out.push(n === 1 ? row[0] : row);
  }
  return out;
};

// ── quaternion / vector ─────────────────────────────────────────────────
const qmul = (a, b) => [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return [q[0]/l, q[1]/l, q[2]/l, q[3]/l]; };
const qrot = (q, v) => {
  const t = [2*(q[1]*v[2] - q[2]*v[1]), 2*(q[2]*v[0] - q[0]*v[2]), 2*(q[0]*v[1] - q[1]*v[0])];
  return [v[0] + q[3]*t[0] + q[1]*t[2] - q[2]*t[1],
          v[1] + q[3]*t[1] + q[2]*t[0] - q[0]*t[2],
          v[2] + q[3]*t[2] + q[0]*t[1] - q[1]*t[0]];
};
const slerp = (a, c, t) => {
  let d = a[0]*c[0] + a[1]*c[1] + a[2]*c[2] + a[3]*c[3];
  let cc = c; if (d < 0) { d = -d; cc = c.map((x) => -x); }
  if (d > 0.9995) return qnorm(a.map((x, i) => x + t * (cc[i] - x)));
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((x, i) => Math.sin((1 - t) * th) / s * x + Math.sin(t * th) / s * cc[i]);
};

// ── rig description, read from a model's own rest pose ──────────────────
function rig(g) {
  const nodes = g.json.nodes;
  const parent = new Map();
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const byName = {};
  nodes.forEach((n, i) => { if (n.name && !(n.name in byName)) byName[n.name] = i; });
  const restT = (i) => nodes[i].translation ?? [0, 0, 0];
  const restR = (i) => nodes[i].rotation ?? [0, 0, 0, 1];
  // World rest transform of every node, including whatever armature node sits
  // above the skeleton and carries the model's orientation.
  const wr = new Map(), wp = new Map();
  const solve = (i) => {
    if (wr.has(i)) return;
    const p = parent.get(i);
    if (p == null) { wr.set(i, restR(i)); wp.set(i, restT(i)); return; }
    solve(p);
    wr.set(i, qmul(wr.get(p), restR(i)));
    wp.set(i, qrot(wr.get(p), restT(i)).map((x, k) => x + wp.get(p)[k]));
  };
  nodes.forEach((_, i) => solve(i));
  const joints = g.json.skins?.[0]?.joints ?? [];
  return { nodes, parent, byName, restT, restR, wr, wp, joints };
}

// ── bone name mapping ───────────────────────────────────────────────────
// Exact match first. Then a small alias table for the conventions actually met
// in the wild - Meshy's own output, Mixamo, and the common "L_"/"_L" variants.
// Anything unmatched is REPORTED, never guessed at: a silently unmapped hind
// leg is far worse than a loud one.
const BUILTIN_ALIASES = {
  Hips: ["hips", "pelvis", "mixamorig:Hips", "root", "Root", "Bip01_Pelvis"],
  spine0: ["spine", "Spine", "mixamorig:Spine", "Bip01_Spine"],
  spine1: ["spine1", "Spine1", "mixamorig:Spine1", "Bip01_Spine1"],
  chest: ["chest", "Chest", "Spine2", "mixamorig:Spine2", "Bip01_Spine2"],
  neck0: ["neck", "Neck", "mixamorig:Neck", "Bip01_Neck"],
  neck1: ["neck1", "Neck1", "neck_01", "Neck2"],
  head: ["head", "Head", "mixamorig:Head", "Bip01_Head"],
  headend: ["jaw", "Jaw", "muzzle", "Muzzle", "chin", "HeadTop_End"],
  tongue: ["tongue", "Tongue"],
  earend: ["ear_L", "L_ear", "EarL", "ear.L", "LeftEar"],
  R_earend: ["ear_R", "R_ear", "EarR", "ear.R", "RightEar"],
  earTipL: ["ear_L_end", "EarL_tip", "ear.L.001"],
  earTipR: ["ear_R_end", "EarR_tip", "ear.R.001"],
  tail: ["tail", "Tail", "tail_0", "Bip01_Tail"],
  tailstart: ["tail1", "Tail1", "tail_1"],
  tail1: ["tail2", "Tail2", "tail_2"],
  tail2: ["tail3", "Tail3", "tail_3"],
  tail3: ["tail4", "Tail4", "tail_4"],
  frontleg: ["shoulder_L", "L_shoulder", "UpperArm_L", "mixamorig:LeftArm", "upperarm_l"],
  frontleg0: ["elbow_L", "L_elbow", "LowerArm_L", "mixamorig:LeftForeArm", "lowerarm_l"],
  frontleg1: ["wrist_L", "L_wrist", "Carpus_L", "mixamorig:LeftHand", "hand_l"],
  frontleg2: ["paw_L", "L_paw", "Foot_L", "toe_l"],
  R_frontleg: ["shoulder_R", "R_shoulder", "UpperArm_R", "mixamorig:RightArm", "upperarm_r"],
  R_frontleg0: ["elbow_R", "R_elbow", "LowerArm_R", "mixamorig:RightForeArm", "lowerarm_r"],
  R_frontleg1: ["wrist_R", "R_wrist", "Carpus_R", "mixamorig:RightHand", "hand_r"],
  R_frontleg2: ["paw_R", "R_paw", "Foot_R", "toe_r"],
  backleg: ["hip_L", "L_hip", "Thigh_L", "mixamorig:LeftUpLeg", "thigh_l"],
  backleg0: ["knee_L", "L_knee", "Shin_L", "mixamorig:LeftLeg", "calf_l"],
  backleg1: ["hock_L", "L_hock", "Ankle_L", "mixamorig:LeftFoot", "foot_l"],
  // NB: no bare "Toe_L" here. Case-insensitively it collides with "toe_l",
  // which is Unreal's FRONT paw - and a silent hind-to-front mapping is the
  // single worst failure this table can produce.
  backleg2: ["hindpaw_L", "L_hindpaw", "mixamorig:LeftToeBase", "ToeBase_L", "ball_l"],
  R_backleg: ["hip_R", "R_hip", "Thigh_R", "mixamorig:RightUpLeg", "thigh_r"],
  R_backleg0: ["knee_R", "R_knee", "Shin_R", "mixamorig:RightLeg", "calf_r"],
  R_backleg1: ["hock_R", "R_hock", "Ankle_R", "mixamorig:RightFoot", "foot_r"],
  R_backleg2: ["hindpaw_R", "R_hindpaw", "mixamorig:RightToeBase", "ToeBase_R", "ball_r"],
};
// Bones the dog can do without. If a target rig has no tongue or no ear tips,
// that is a missing feature, not a failed retarget - the clip still plays.
const OPTIONAL = new Set(["tongue", "earTipL", "earTipR", "headend", "earend", "R_earend",
                          "spine0", "spine1", "neck1", "tail3", "tail2"]);
// Without these there is no dog.
const ESSENTIAL = new Set(["Hips", "chest", "head",
  "frontleg", "frontleg0", "frontleg1", "R_frontleg", "R_frontleg0", "R_frontleg1",
  "backleg", "backleg0", "backleg1", "R_backleg", "R_backleg0", "R_backleg1"]);

const src = load(srcPath), dst = load(dstPath);
const S = rig(src), D = rig(dst);
const userMap = flag("--map") && existsSync(flag("--map")) ? JSON.parse(readFileSync(flag("--map"), "utf8")) : {};

const lower = {};
for (const n of Object.keys(D.byName)) lower[n.toLowerCase()] = D.byName[n];
// Exact matches are exhausted BEFORE any case-insensitive one is considered.
// Interleaving them lets a loose match on an early alias beat an exact match on
// a later one - which is how "Toe_L" (a hind paw) captured "toe_l" (a front
// paw) and silently wired the hind legs to the forelegs.
function mapBone(name) {
  if (userMap[name] && D.byName[userMap[name]] != null) return D.byName[userMap[name]];
  if (D.byName[name] != null) return D.byName[name];
  for (const alias of BUILTIN_ALIASES[name] ?? []) if (D.byName[alias] != null) return D.byName[alias];
  for (const alias of BUILTIN_ALIASES[name] ?? []) {
    const hit = lower[alias.toLowerCase()];
    if (hit != null) return hit;
  }
  return null;
}

const srcJointNames = S.joints.map((i) => S.nodes[i].name);
const pairs = [], missing = [];
for (const name of srcJointNames) {
  const t = mapBone(name);
  if (t == null) missing.push(name); else pairs.push([S.byName[name], t, name]);
}
// Two source bones on one target bone is never correct, and it is invisible in
// the output: the dog just moves wrongly. Caught here, loudly.
const seen = new Map(), collisions = [];
for (const [, t, name] of pairs) {
  if (seen.has(t)) collisions.push(`${seen.get(t)} + ${name} -> ${D.nodes[t].name}`);
  else seen.set(t, name);
}
if (collisions.length) {
  console.error(`\nREFUSING: ${collisions.length} bone(s) on the target rig claimed by more than one source bone:`);
  for (const c of collisions) console.error(`  ${c}`);
  console.error(`\nDisambiguate with --map alias.json.`);
  process.exit(1);
}
const missingEssential = missing.filter((n) => ESSENTIAL.has(n));
console.log(`mapped ${pairs.length}/${srcJointNames.length} bones`);
if (missing.length) {
  console.log(`  unmapped: ${missing.join(", ")}`);
  console.log(`  (optional: ${missing.filter((n) => OPTIONAL.has(n)).join(", ") || "none"})`);
}
if (missingEssential.length) {
  console.error(`\nREFUSING: ${missingEssential.length} ESSENTIAL bone(s) have no counterpart on the target rig:`);
  console.error(`  ${missingEssential.join(", ")}`);
  console.error(`\nSupply a mapping with --map alias.json, e.g. {"backleg":"YourThighL"}.`);
  console.error(`Target rig bones: ${Object.keys(D.byName).slice(0, 60).join(", ")}`);
  process.exit(1);
}

// ── how much bigger is the target dog? ──────────────────────────────────
// Measured from each rig's own rest pose: the hip joint's height above the
// lowest paw. Rotations are scale-free, but the root TRANSLATION is not - a
// stride authored for a 10cm hip height would leave a Great Dane pedalling on
// the spot.
function hipHeight(R) {
  const hip = R.byName.Hips ?? R.joints[0];
  const paws = ["frontleg2", "R_frontleg2", "backleg2", "R_backleg2"]
    .map((n) => R.byName[n]).filter((i) => i != null);
  if (!paws.length || hip == null) return null;
  const lo = Math.min(...paws.map((i) => R.wp.get(i)[1]));
  return R.wp.get(hip)[1] - lo;
}
function hipHeightMapped() {
  const hip = mapBone("Hips");
  const paws = ["frontleg2", "R_frontleg2", "backleg2", "R_backleg2"]
    .map((n) => mapBone(n)).filter((i) => i != null);
  if (!paws.length || hip == null) return null;
  const lo = Math.min(...paws.map((i) => D.wp.get(i)[1]));
  return D.wp.get(hip)[1] - lo;
}
const hS = hipHeight(S), hD = hipHeightMapped();
const scale = hS && hD ? hD / hS : 1;
console.log(`hip height: source ${hS?.toFixed(4) ?? "?"}  target ${hD?.toFixed(4) ?? "?"}  -> root translation x${scale.toFixed(3)}`);
if (!hS || !hD) console.log("  (could not measure both; root translation left unscaled)");

// ── foot re-grounding on the TARGET skeleton ────────────────────────────
//
// Transferring rotations is necessary but NOT sufficient, and this is the part
// most "retargeting" quietly skips.
//
// A rotation delta says how far a bone turned. Apply the same turn to a bone
// that starts from a different bind angle, or sits on a differently
// proportioned limb, and the PAW ENDS SOMEWHERE ELSE. Measured against a test
// rig whose bind pose differs by up to 12 degrees per joint, the paws traced a
// path a quarter of a hip height away from the source - which on a walk is the
// difference between a foot planted on the ground and a foot skating above it.
//
// So the paw positions are transferred too, as a FRACTION OF HIP HEIGHT
// relative to the hip. That is the scale-free, rig-free statement of where the
// foot goes, and CCD puts the target's own leg there. The dog then walks with
// its own proportions and the source's footfalls.
const CCD_LEGS = [["frontleg","frontleg0","frontleg1","frontleg2"],
                  ["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"],
                  ["backleg","backleg0","backleg1","backleg2"],
                  ["R_backleg","R_backleg0","R_backleg1","R_backleg2"]];
const vsub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const vlen = (a) => Math.hypot(a[0],a[1],a[2]);
const vdot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vcross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const qaxis = (ax, deg) => { const l = vlen(ax) || 1, r = deg*Math.PI/360, s = Math.sin(r);
  return [ax[0]/l*s, ax[1]/l*s, ax[2]/l*s, Math.cos(r)]; };

// Local FK over the target rig for one frame's pose map.
function fkTarget(poseR, poseT) {
  const wr = new Map(), wp = new Map();
  const solve = (i) => {
    if (wr.has(i)) return;
    const lr = poseR.get(i) ?? D.restR(i);
    const lt = poseT.get(i) ?? D.restT(i);
    const p = D.parent.get(i);
    if (p == null) { wr.set(i, lr); wp.set(i, lt); return; }
    solve(p);
    wr.set(i, qmul(wr.get(p), lr));
    wp.set(i, qrot(wr.get(p), lt).map((x, k) => x + wp.get(p)[k]));
  };
  D.nodes.forEach((_, i) => solve(i));
  return { wr, wp };
}

const RG = [];
function reground(clip, srcPawRel, srcHipOverPaw) {
  const hipD = mapBone("Hips");
  const chains = CCD_LEGS.map((c) => c.map(mapBone)).filter((c) => c.every((i) => i != null));
  if (!chains.length) return;
  for (let f = 0; f < clip.N; f++) {
    const poseR = new Map(), poseT = new Map();
    for (const [dj, frames] of clip.outLocal) poseR.set(dj, frames[f]);
    if (clip.rootT) poseT.set(clip.dstHip, clip.rootT[f]);
    // CCD each leg onto the transferred, rescaled paw position
    for (let ci = 0; ci < chains.length; ci++) {
      const chain = chains[ci];
      const rel = srcPawRel[f][ci];
      if (!rel) continue;
      let before = null, after = null;
      for (let iter = 0; iter < 26; iter++) {
        const W = fkTarget(poseR, poseT);
        const hip = W.wp.get(hipD);
        const goal = [hip[0] + rel[0]*hD, hip[1] + rel[1]*hD, hip[2] + rel[2]*hD];
        const paw = W.wp.get(chain[3]);
        const err = vlen(vsub(goal, paw));
        if (before === null) before = err;
        after = err;
        if (err < 1e-5) break;
        // tip to root, the standard order: the distal joints do the fine work
        for (let b = 2; b >= 0; b--) {
          const W2 = fkTarget(poseR, poseT);
          const joint = W2.wp.get(chain[b]), tip = W2.wp.get(chain[3]);
          const a = vsub(tip, joint), c = vsub(goal, joint);
          const la = vlen(a), lc = vlen(c);
          if (la < 1e-7 || lc < 1e-7) continue;
          let cosA = vdot(a, c)/(la*lc);
          cosA = cosA > 1 ? 1 : cosA < -1 ? -1 : cosA;
          let deg = Math.acos(cosA)*180/Math.PI;
          if (deg < 1e-4) continue;
          if (deg > 14) deg = 14;                 // step clamp: no snapping
          const axis = vcross(a, c);
          if (vlen(axis) < 1e-9) continue;
          const pw = D.parent.get(chain[b]) != null ? W2.wr.get(D.parent.get(chain[b])) : [0,0,0,1];
          const local = qrot(qconj(pw), axis);
          const cur = poseR.get(chain[b]) ?? D.restR(chain[b]);
          poseR.set(chain[b], qnorm(qmul(qaxis(local, deg), cur)));
        }
      }
      if (process.env.RGDBG2 && f === 0 && clip.name === "Walk") {
        const W = fkTarget(poseR, poseT);
        const hip = W.wp.get(hipD);
        const paw = W.wp.get(chain[3]);
        console.log(`   leg${ci} srcRel ${rel.map((x)=>x.toFixed(2)).join(",")}` +
          `  dstRel ${[(paw[0]-hip[0])/hD,(paw[1]-hip[1])/hD,(paw[2]-hip[2])/hD].map((x)=>x.toFixed(2)).join(",")}`);
      }
      if (process.env.RGDBG && before != null) {
        const W = fkTarget(poseR, poseT);
        const hip = W.wp.get(hipD);
        const goal = [hip[0] + rel[0]*hD, hip[1] + rel[1]*hD, hip[2] + rel[2]*hD];
        RG.push([before/hD, vlen(vsub(goal, W.wp.get(chain[3])))/hD]);
      }
    }
    // then set the body height so the hip rides as high over the lowest paw as
    // it does in the source, in hip-height units
    if (clip.rootT) {
      const W = fkTarget(poseR, poseT);
      const lowest = Math.min(...chains.map((c) => W.wp.get(c[3])[1]));
      const hip = W.wp.get(hipD)[1];
      const want = srcHipOverPaw[f] * hD;
      const dy = want - (hip - lowest);
      if (Math.abs(dy) > 1e-9) {
        const t = poseT.get(clip.dstHip) ?? D.restT(clip.dstHip);
        const p = D.parent.get(clip.dstHip);
        const up = p == null ? [0,1,0] : qrot(qconj(D.wr.get(p)), [0,1,0]);
        poseT.set(clip.dstHip, [t[0]+up[0]*dy, t[1]+up[1]*dy, t[2]+up[2]*dy]);
      }
    }
    for (const [dj, frames] of clip.outLocal) if (poseR.has(dj)) frames[f] = poseR.get(dj);
    if (clip.rootT && poseT.has(clip.dstHip)) clip.rootT[f] = poseT.get(clip.dstHip);
  }
}

// ── retarget ────────────────────────────────────────────────────────────
const wanted = flag("--clips")?.split(",").map((s) => s.trim());
const FPS = 30;
const outAnims = [];
for (const anim of src.json.animations) {
  if (wanted && !wanted.includes(anim.name)) continue;
  // sample the source clip at a fixed rate
  const dur = Math.max(...anim.samplers.map((s) => src.json.accessors[s.input].max[0]));
  const N = Math.round(dur * FPS) + 1;
  const local = new Map();          // srcNode -> {r:[frames], t:[frames]}
  for (const ch of anim.channels) {
    if (ch.target.path === "scale") continue;
    const s = anim.samplers[ch.sampler];
    const times = readAcc(src, s.input), vals = readAcc(src, s.output);
    const per = [];
    for (let f = 0; f < N; f++) {
      const tt = Math.min(dur, f / FPS);
      let k = 0; while (k < times.length - 1 && times[k + 1] <= tt) k++;
      const k2 = Math.min(times.length - 1, k + 1);
      const u = times[k2] === times[k] ? 0 : (tt - times[k]) / (times[k2] - times[k]);
      per.push(ch.target.path === "rotation" ? slerp(vals[k], vals[k2], u)
                                             : vals[k].map((x, i) => x + u * (vals[k2][i] - x)));
    }
    const e = local.get(ch.target.node) ?? {};
    e[ch.target.path === "rotation" ? "r" : "t"] = per;
    local.set(ch.target.node, e);
  }
  // forward kinematics on the SOURCE, per frame, in world space
  const srcWorld = [], srcPos = [];
  for (let f = 0; f < N; f++) {
    const wr = new Map(), wp = new Map();
    const solve = (i) => {
      if (wr.has(i)) return;
      const lr = local.get(i)?.r?.[f] ?? S.restR(i);
      const lt = local.get(i)?.t?.[f] ?? S.restT(i);
      const p = S.parent.get(i);
      if (p == null) { wr.set(i, lr); wp.set(i, lt); return; }
      solve(p);
      wr.set(i, qmul(wr.get(p), lr));
      wp.set(i, qrot(wr.get(p), lt).map((x, k) => x + wp.get(p)[k]));
    };
    S.nodes.forEach((_, i) => solve(i));
    srcWorld.push(wr); srcPos.push(wp);
  }
  // Where each paw sits relative to the hip, as a FRACTION of hip height. This
  // is the scale-free, rig-free statement of a footfall, and it is what makes
  // the clip mean the same thing on a dog of another size and build.
  const srcPawRel = [], srcHipOverPaw = [];
  for (let f = 0; f < N; f++) {
    const hip = srcPos[f].get(S.byName.Hips);
    const row = [], ys = [];
    for (const chain of CCD_LEGS) {
      const pawS = S.byName[chain[3]];
      if (pawS == null) { row.push(null); continue; }
      const p = srcPos[f].get(pawS);
      row.push([(p[0]-hip[0])/hS, (p[1]-hip[1])/hS, (p[2]-hip[2])/hS]);
      ys.push(p[1]);
    }
    srcPawRel.push(row);
    srcHipOverPaw.push(ys.length ? (hip[1] - Math.min(...ys)) / hS : 0);
  }
  // ...and rebuild on the TARGET, parents before children
  const order = pairs.slice().sort((a, b) => depth(D, a[1]) - depth(D, b[1]));
  const outLocal = new Map();       // dstNode -> [frames] quaternion
  const dstWorld = [];
  for (let f = 0; f < N; f++) {
    const wr = new Map();
    for (const [sj, dj] of order) {
      // what the bone DID, in world space, relative to its own rest
      const Dq = qmul(srcWorld[f].get(sj), qconj(S.wr.get(sj)));
      const wTarget = qnorm(qmul(Dq, D.wr.get(dj)));
      wr.set(dj, wTarget);
      const p = D.parent.get(dj);
      // A parent that is not itself retargeted keeps its rest orientation, so
      // its REST world rotation is the correct frame to localise against.
      const wParent = p == null ? [0, 0, 0, 1] : (wr.get(p) ?? D.wr.get(p));
      const lr = qnorm(qmul(qconj(wParent), wTarget));
      if (!outLocal.has(dj)) outLocal.set(dj, []);
      outLocal.get(dj).push(lr);
    }
    dstWorld.push(wr);
  }
  // root translation, scaled
  const srcHip = S.byName.Hips, dstHip = mapBone("Hips");
  let rootT = null;
  if (local.get(srcHip)?.t) {
    const rest = S.restT(srcHip), dRest = D.restT(dstHip);
    rootT = local.get(srcHip).t.map((t) => [
      dRest[0] + (t[0] - rest[0]) * scale,
      dRest[1] + (t[1] - rest[1]) * scale,
      dRest[2] + (t[2] - rest[2]) * scale,
    ]);
  }
  const built = { name: anim.name, N, outLocal, rootT, dstHip };
  if (!args.includes("--no-ground") && hS && hD) reground(built, srcPawRel, srcHipOverPaw);
  outAnims.push(built);
}
function depth(R, i) { let d = 0, c = i; while (R.parent.has(c)) { c = R.parent.get(c); d++; } return d; }

// ── write ───────────────────────────────────────────────────────────────
const extra = []; let cursor = dst.bin.length;
function addAcc(arr, type) {
  const flat = type === "SCALAR" ? arr : arr.flat();
  const buf = Buffer.alloc(flat.length * 4);
  flat.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  const pad = (4 - (cursor % 4)) % 4; if (pad) { extra.push(Buffer.alloc(pad)); cursor += pad; }
  dst.json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length });
  extra.push(buf); cursor += buf.length;
  const a = { bufferView: dst.json.bufferViews.length - 1, componentType: 5126, count: arr.length, type };
  if (type === "SCALAR") { a.min = [Math.min(...arr)]; a.max = [Math.max(...arr)]; }
  dst.json.accessors.push(a);
  return dst.json.accessors.length - 1;
}
dst.json.animations = [];
for (const clip of outAnims) {
  const times = Array.from({ length: clip.N }, (_, f) => f / FPS);
  const tAcc = addAcc(times, "SCALAR");
  const samplers = [], channels = [];
  for (const [dj, frames] of clip.outLocal) {
    const rAcc = addAcc(frames, "VEC4");
    channels.push({ sampler: samplers.length, target: { node: dj, path: "rotation" } });
    samplers.push({ input: tAcc, output: rAcc, interpolation: "LINEAR" });
  }
  if (clip.rootT) {
    const trAcc = addAcc(clip.rootT, "VEC3");
    channels.push({ sampler: samplers.length, target: { node: clip.dstHip, path: "translation" } });
    samplers.push({ input: tAcc, output: trAcc, interpolation: "LINEAR" });
  }
  dst.json.animations.push({ name: clip.name, samplers, channels });
}
const newBin = Buffer.concat([dst.bin, ...extra]);
dst.json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(dst.json), "utf8");
const jp = (4 - (jb.length % 4)) % 4, jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (newBin.length % 4)) % 4, bc = Buffer.concat([newBin, Buffer.alloc(bp)]);
const chunk = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const total = 12 + 8 + jc.length + 8 + bc.length;
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([hdr, chunk(jc.length, 0x4e4f534a), jc, chunk(bc.length, 0x004e4942), bc]));
if (process.env.RGDBG && RG.length) {
  const b = RG.reduce((a, x) => a + x[0], 0) / RG.length;
  const a2 = RG.reduce((a, x) => a + x[1], 0) / RG.length;
  const worst = Math.max(...RG.map((x) => x[1]));
  console.log(`  [reground] paw error before ${b.toFixed(3)} -> after ${a2.toFixed(3)} hip heights (worst ${worst.toFixed(3)}), ${RG.length} solves`);
}
console.log(`wrote ${outPath}  ${total.toLocaleString()} bytes, ${dst.json.animations.length} clips`);
