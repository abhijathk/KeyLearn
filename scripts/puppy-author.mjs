/**
 * PUPPY animation author.
 *
 * Ported from the buffalo pipeline: same CCD IK with reach clamping, the same
 * per-joint limits learned from the source Walk rather than guessed, the same
 * skin-accurate floor settling. What changes is the animal. A dog is not a
 * bison and almost every number below comes from canine measurement.
 *
 * The three that matter most, because they are counter-intuitive:
 *   - a play bow lasts 0.31-0.38 s, not one or two seconds;
 *   - a shake rotates the SKELETON only ~30 deg (the famous 90 is loose skin);
 *   - neck lateral bend is anatomically forced to roll with it, 1.7x.
 *
 * Secondary motion (ears, tongue, tail, breath, weight shift) is not keyed per
 * clip. It is a pass that runs over every finished clip and is driven by what
 * the body actually did, so it can never disagree with the primary animation.
 *
 *   node scripts/puppy-author.mjs Puppy_SOURCE_rigged.glb out.glb
 */
import { readFileSync, writeFileSync } from "node:fs";

const [origPath, outPath] = process.argv.slice(2);
const src = readFileSync(origPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}
const acc = json.accessors;
const rd = (i) => {
  const a = acc[i], v = json.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const st = v.byteStride || n * 4, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const o = [];
  for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < n; c++) r.push(bin.readFloatLE(base + k * st + c * 4)); o.push(n === 1 ? r[0] : r); }
  return o;
};
// ── math ────────────────────────────────────────────────────────────────
const qmul = (a, c) => [a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1], a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0], a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3], a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => { const u=[q[0],q[1],q[2]], s=q[3]; const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]]; return [v[0]+2*(s*uv[0]+uuv[0]), v[1]+2*(s*uv[1]+uuv[1]), v[2]+2*(s*uv[2]+uuv[2])]; };
const qaxis = (ax, deg) => { const r = deg*Math.PI/360, s = Math.sin(r); const l = Math.hypot(...ax)||1; return [ax[0]/l*s, ax[1]/l*s, ax[2]/l*s, Math.cos(r)]; };
const qnorm = (q) => { const l = Math.hypot(...q)||1; return [q[0]/l,q[1]/l,q[2]/l,q[3]/l]; };
const slerp = (a, c, t) => { let d=a[0]*c[0]+a[1]*c[1]+a[2]*c[2]+a[3]*c[3]; let cc=c; if(d<0){d=-d;cc=c.map(x=>-x);} if(d>0.9995){return qnorm(a.map((x,i)=>x+t*(cc[i]-x)));} const th=Math.acos(d),s=Math.sin(th); return a.map((x,i)=>Math.sin((1-t)*th)/s*x+Math.sin(t*th)/s*cc[i]); };
const vadd = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]; const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]; const vscale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const vlen=(a)=>Math.hypot(...a); const vnorm=(a)=>{const l=vlen(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const vdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

// ── body shape: what the skin actually occupies ─────────────────────────
//
// Contact QA can only see joints, but the floor is hit by the SKIN. Reading
// the skinned mesh gives every joint the cloud of vertices it carries, in its
// own local frame (via the inverse bind matrix), so the lowest point of the
// animal can be evaluated for any pose: world = jointPos + jointRot * offset.
// Kept down to the extreme point in each of 26 directions per joint, which
// bounds the shape closely at a thousandth of the vertex count.
const rdRaw = (i) => {
  const a = acc[i], v = json.bufferViews[a.bufferView];
  const n = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 }[a.type];
  const sz = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 }[a.componentType];
  const st = v.byteStride || n * sz, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const get = { 5120:"readInt8", 5121:"readUInt8", 5122:"readInt16LE",
                5123:"readUInt16LE", 5125:"readUInt32LE", 5126:"readFloatLE" }[a.componentType];
  const o = [];
  for (let k = 0; k < a.count; k++) { const r = [];
    for (let c = 0; c < n; c++) r.push(bin[get](base + k * st + c * sz));
    o.push(n === 1 ? r[0] : r); }
  return o;
};
const SHAPE = new Map();   // joint id -> [[x,y,z], ...] offsets in that joint's frame
(function buildShape() {
  const prim = json.meshes?.[0]?.primitives?.[0];
  const skin = json.skins[0];
  if (!prim || prim.attributes.JOINTS_0 == null || skin.inverseBindMatrices == null) return;
  const pos = rdRaw(prim.attributes.POSITION);
  const jj  = rdRaw(prim.attributes.JOINTS_0);
  const ww  = rdRaw(prim.attributes.WEIGHTS_0);
  const ibmFlat = rdRaw(skin.inverseBindMatrices);
  const xform = (m, v) => [                      // column-major 4x4 * (v,1)
    m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
    m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
    m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
  // A vertex is claimed by every joint that meaningfully drives it, not just
  // the strongest one - a vertex spanning two bones is carried by both, and
  // dropping it from either leaves a hole exactly at the joints that bend.
  const buckets = new Map();
  for (let i = 0; i < pos.length; i++) {
    let bw = -1;
    for (let c = 0; c < 4; c++) if (ww[i][c] > bw) bw = ww[i][c];
    if (bw <= 0) continue;
    for (let c = 0; c < 4; c++) {
      if (ww[i][c] < 0.25 * bw) continue;
      const id = skin.joints[jj[i][c]];
      if (!buckets.has(id)) buckets.set(id, []);
      buckets.get(id).push(xform(ibmFlat[jj[i][c]], pos[i]));
    }
  }
  // Evenly spread directions (Fibonacci sphere) bound the hull far more
  // tightly than the 26 axis/corner directions, which miss shallow bulges.
  const DIRS = [], ND = 160, GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < ND; i++) {
    const y = 1 - (i / (ND - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y*y)), th = GA * i;
    DIRS.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  for (const [id, pts] of buckets) {
    const keep = new Set();
    for (const d of DIRS) { let bi = 0, bv = -Infinity;
      for (let i = 0; i < pts.length; i++) { const s = vdot(pts[i], d); if (s > bv) { bv = s; bi = i; } }
      keep.add(bi); }
    SHAPE.set(id, [...keep].map(i => pts[i]));
  }
})();
// Lowest point of the skin for a pose, and the joint responsible.
function lowestSkin(local, skip = null, only = null) {
  const W = fk(local);
  let lo = Infinity, who = null;
  for (const [id, pts] of SHAPE) {
    if (skip && skip.has(id)) continue;
    if (only && !only.has(id)) continue;
    const p = W.pos.get(id), r = W.rot.get(id);
    if (!p) continue;
    for (const o of pts) { const y = p[1] + qrot(r, o)[1]; if (y < lo) { lo = y; who = id; } }
  }
  return { y: lo, joint: who };
}

// The counterpart of lowestSkin: the TOP of a chosen set of bones' skin. Used
// to find out how high the forelegs actually are where the chin comes down, so
// the head can be rested ON them rather than at some fixed height that happens
// to be near them.
function highestSkin(local, only, zNear = null, zWin = 0.06) {
  const W = fk(local);
  let hi = -Infinity;
  for (const [id, pts] of SHAPE) {
    if (!only.has(id)) continue;
    const p = W.pos.get(id), r = W.rot.get(id);
    if (!p) continue;
    for (const o of pts) {
      const w = qrot(r, o);
      if (zNear != null && Math.abs(p[2] + w[2] - zNear) > zWin) continue;
      const y = p[1] + w[1];
      if (y > hi) hi = y;
    }
  }
  return hi;
}

// ── rig ─────────────────────────────────────────────────────────────────
const joints = json.skins[0].joints;
const nName = (i) => json.nodes[i].name;
const idByName = Object.fromEntries(joints.map((j) => [nName(j), j]));
const parent = new Map(); json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
const restT = (i) => json.nodes[i].translation ?? [0,0,0];
const restR = (i) => json.nodes[i].rotation ?? [0,0,0,1];
const LEGS = { LF:["frontleg","frontleg0","frontleg1","frontleg2"], RF:["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"],
               LB:["backleg","backleg0","backleg1","backleg2"], RB:["R_backleg","R_backleg0","R_backleg1","R_backleg2"] };
const TAIL = ["tail","tailstart","tail1","tail2","tail3"];
const SPINE = ["spine0","spine1"];
const NECK  = ["neck0","neck1"];
const EARS  = ["earend","R_earend","earTipL","earTipR"];
const BODY  = ["Hips",...SPINE,"chest",...NECK,"head","headend","tongue",...EARS,...TAIL];
const FWD=[0,0,1], LEFT=[1,0,0], UP=[0,1,0];   // measured from the source Walk

// ── the source Walk sampled to 30fps: per-bone local r/t ────────────────
const walk = json.animations[0];
const wdur = Math.max(...walk.samplers.map((s) => acc[s.input].max[0]));
const FPS = 30, WN = Math.round(wdur*FPS)+1;
// How densely a clip is SAMPLED, as a multiple of FPS.
//
// glTF interpolates LINEARLY between keys, so a clip is reconstructed as a
// polygon through its samples - and the faster something swings, the more
// obviously that polygon shows. The tail wag is the worst case in the set: it
// is a clean 3 Hz swing (measured: exactly 12 direction changes across the two
// second loop, no dropped or duplicated frames, unchanged by compression) but
// at 30 fps it carries only TEN samples per cycle while the tail tip travels
// 167 mm - about one and a half hip heights - from side to side. Ten straight
// segments around that arc, with a hard corner at each turnaround where the tip
// reverses between one frame and the next, is what reads as a shaky wag. The
// data is not wrong; there is not enough of it.
//
// The shake is worse still on paper - 6 Hz, five samples per cycle - so it gets
// the same treatment. Everything else is slow enough that 30 fps is plenty, and
// the key reducer downstream drops whatever the extra density did not buy.
// Tail_Wag ONLY. The shake looks like the same case on paper - 6 Hz, five
// samples per cycle - but doubling its rate widened its stance measurably
// (spread 1.68..1.84 -> 1.30..2.05, outside the source envelope), because the
// leg rate limiter caps degrees PER FRAME and twice the frames lets a planted
// leg travel twice as far per second. Fixing the wag is not worth breaking the
// shake's footing; if the shake ever needs this, the limiter has to become
// rate-aware first.
const RATE = { Tail_Wag: 2 };
let CLIP_FPS = FPS;
const walkLocal = new Map();  // node -> {r:[...frames], t:[...frames]}
for (const ch of walk.channels) {
  if (ch.target.path === "scale") continue;
  const s = walk.samplers[ch.sampler], times = rd(s.input), vals = rd(s.output);
  const pf = [];
  for (let f=0; f<WN; f++){ const tt=Math.min(wdur,f/FPS); let k=0; while(k<times.length-1 && times[k+1]<=tt) k++; const k2=Math.min(times.length-1,k+1); const u=times[k2]===times[k]?0:(tt-times[k])/(times[k2]-times[k]); pf.push(ch.target.path==="rotation"?slerp(vals[k],vals[k2],u):vals[k].map((x,i)=>x+u*(vals[k2][i]-x))); }
  const e = walkLocal.get(ch.target.node) ?? {}; e[ch.target.path==="rotation"?"r":"t"] = pf; walkLocal.set(ch.target.node, e);
}
// FK for a full pose map {node -> {pos,rot}} given local {node->{r,t}}
// The armature node above the root joint carries the model's orientation (a
// 90-degree rotation). Applying it here puts FK in the visual space the
// source Walk was measured in: up +Y, forward +Z, left +X. Scale is left
// off, exactly as the reference did, so positions stay at a readable ~0.14
// rather than 0.0014.
const ARM = parent.get(idByName.Hips);
const ARM_R = ARM != null ? restR(ARM) : [0,0,0,1];
const ARM_T = ARM != null ? restT(ARM) : [0,0,0];
function fk(local) {
  const pos = new Map(), rot = new Map();
  const solve = (i) => {
    if (pos.has(i)) return;
    const lt = local.get(i)?.t ?? restT(i), lr = local.get(i)?.r ?? restR(i);
    const p = parent.get(i);
    if (p == null || !joints.includes(p)) { pos.set(i, vadd(ARM_T, qrot(ARM_R, lt))); rot.set(i, qmul(ARM_R, lr)); return; }
    solve(p); const w = qrot(rot.get(p), lt);
    pos.set(i, vadd(pos.get(p), w)); rot.set(i, qmul(rot.get(p), lr));
  };
  for (const j of joints) solve(j);
  return { pos, rot };
}
// Each joint's rest WORLD rotation and its parent's — for turning a visual-
// space axis into the frame a bone actually rotates in.
const restWorld = new Map();
(function(){ const solve=(i)=>{ if(restWorld.has(i))return; const p=parent.get(i); if(p==null||!joints.includes(p)){restWorld.set(i,qmul(ARM_R,restR(i)));return;} solve(p); restWorld.set(i,qmul(restWorld.get(p),restR(i))); }; for(const j of joints) solve(j); })();
const parentWorld = (i) => { const p=parent.get(i); return (p!=null&&joints.includes(p)) ? restWorld.get(p) : ARM_R; };
// Standing pose = Walk frame 0 local rotations, Hips translation included.
const stand = new Map();
for (const j of joints) {
  const e = walkLocal.get(j);
  stand.set(j, { r: e?.r?.[0] ?? restR(j), t: e?.t?.[0] ?? restT(j) });
}
const standW = fk(new Map([...stand].map(([i,e])=>[i,{r:e.r,t:e.t}])));
const hoofId = { LF: idByName.frontleg2, RF: idByName.R_frontleg2, LB: idByName.backleg2, RB: idByName.R_backleg2 };
const GROUND = Math.min(...Object.values(hoofId).map((h) => standW.pos.get(h)[1]));
// Each leg's fully-extended reach — the sum of its segment lengths. The IK
// target is clamped inside this so a leg never has to straighten out to a
// point it cannot reach (which is what read as "a leg gone up and too long").
const LEG_REACH = {};
for (const k in hoofId) {
  const ch = LEGS[k].map((n) => idByName[n]);
  let r = 0; for (let i = 0; i < ch.length - 1; i++) r += vlen(vsub(standW.pos.get(ch[i + 1]), standW.pos.get(ch[i])));
  LEG_REACH[k] = r;
}
// stance hoof world positions (planted), and the Walk's hoof arcs for locomotion
const walkPose = [];
for (let f=0; f<WN; f++){ const loc = new Map(); for (const j of joints){ const e = walkLocal.get(j); loc.set(j, { r: e?.r?.[f] ?? restR(j), t: e?.t?.[f] ?? restT(j) }); } walkPose.push(fk(loc)); }
const stanceHoof = {}; for (const k in hoofId){ let s=[0,0,0]; for (const p of walkPose) s=vadd(s, p.pos.get(hoofId[k])); stanceHoof[k]=vscale(s,1/WN); stanceHoof[k][1]=GROUND; }
const HIP_H = standW.pos.get(idByName.Hips)[1] - GROUND;
// Where the hind leg ROOT sits when the dog just stands there. The stretch
// raises the rump relative to this rather than to an absolute number, so the
// pose means the same thing on a dog built to different proportions.
const STAND_HIND_ROOT = (standW.pos.get(idByName.backleg)[1] + standW.pos.get(idByName.R_backleg)[1]) / 2;
console.log("  [swing] per-bone caps learned from the source Walk (deg from stand / from rest):");
setTimeout(()=>{},0);
// ── where a STANDING dog actually puts its feet ─────────────────────────
//
// Averaging the Walk gives a usable height but the wrong PLACE. Measured on
// this source, the mean forepaw sits 39-42% of a hip height BEHIND its own
// shoulder and the hind paw 85% behind its hip - so every clip built on it
// stood with its forelegs raked backwards, like a dog leaning away from
// something. It is the base pose for all fourteen authored clips, so the fault
// appeared in every one of them at once and looked like an animation problem.
//
// A standing dog carries the forepaw directly UNDER the shoulder and the hind
// paw a little behind the hip - the hind limb is angled, the fore limb is a
// post. Those are the targets; only the horizontal placement is changed, and
// the measured ground height is kept.
{
  // Corrected PART of the way, not all of it. Taking the forepaw all the way
  // under the shoulder (0%) and the hind to -30% asks for more leg than this
  // puppy has: the solver could not reach those targets from a standing body,
  // folded the limbs to get there, and the whole dog sank towards the floor.
  // These are the placements it can actually stand on while still losing most
  // of the backward rake.
  // MEASURED reach, not assumed: the foreleg spans 135% of a hip height and its
  // root sits at 86%, leaving 105% of horizontal room; the hind spans 167% from
  // a root at 80%, leaving 146%. There was never a reach problem - an earlier
  // note here blamed one for a collapse that had another cause - so the stance
  // can simply be put where a standing dog puts it: the forepaw under the
  // shoulder, the hind paw angled back behind the hip.
  const STANCE_DZ = { LF: -0.04, RF: -0.04, LB: -0.45, RB: -0.45 };  // of hip height
  const before = {};
  for (const k in hoofId) {
    const root = standW.pos.get(idByName[LEGS[k][0]]);
    before[k] = (stanceHoof[k][2] - root[2]) / HIP_H;
    stanceHoof[k][2] = root[2] + STANCE_DZ[k] * HIP_H;
    // ...and keep the paw under its own shoulder laterally too.
    stanceHoof[k][0] = root[0] + (stanceHoof[k][0] - root[0]) * 0.8;
  }
  console.log("  [stance] paw vs its own shoulder/hip, % hip height: " +
    Object.keys(hoofId).map((k) => `${k} ${(before[k]*100).toFixed(0)}->${(STANCE_DZ[k]*100).toFixed(0)}`).join("  "));
}
// ── per-leg PLANTED anchor ──────────────────────────────────────────────
// `stand` is Walk frame 0, and that frame is mid-stride, not a stance: the
// left-hind hoof sits at +0.037 (fully lifted, leg folded) while the right-
// hind is planted at -0.005. Anchoring a leg's IK to its own folded pose is
// what stopped the left-hind extending — the "left backleg up and too long"
// fault, and later its refusal to reach the ground under the rear.
//
// So each leg gets its own anchor: the Walk frame where THAT hoof is lowest,
// i.e. a genuinely planted stance for that leg (LF f12, RF f26, LB f9, RB f24).
const legAnchor = new Map();
// ...and the WORLD rotation the hoof bone has there. The hoof's own rotation
// cannot move its own origin, so this can be restored after the IK solve to
// keep a planted hoof FLAT without disturbing the contact point by a hair.
const anchorHoofW = {};
for (const k in hoofId) {
  let best = 0, bestY = Infinity;
  for (let f = 0; f < WN; f++) { const y = walkPose[f].pos.get(hoofId[k])[1]; if (y < bestY) { bestY = y; best = f; } }
  for (const n of LEGS[k]) { const id = idByName[n]; const e = walkLocal.get(id); legAnchor.set(id, (e?.r?.[best] ?? restR(id)).slice()); }
  anchorHoofW[k] = walkPose[best].rot.get(hoofId[k]).slice();
}
// Which leg a bone belongs to, so the planted anchor can be chosen per limb.
const legOf = new Map();
for (const k in LEGS) for (const n of LEGS[k]) legOf.set(idByName[n], k);
// Opt-in per clip AND per leg. The eleven clips approved in v5 keep the old
// anchor so their data stays byte-identical. Of the corrected clips, the
// rear-stomp opts its FRONT legs out: a planted anchor is a straight standing
// leg, and the deviation limits then stop the forelegs folding into the rear
// tuck (they hung at 99% extension). The hind legs want it — extending into a
// stance is exactly what they must do.
// The animator's own foreleg poses, used to drive the reared forelegs directly.
// `foldR` is the rotation set from the Walk frame where that leg is most folded;
// `standR` is its planted frame. Blending between two poses the animator made
// keeps the limb anatomically correct at every value, and slerp of a smooth
// parameter is smooth by construction — which IK chasing a moving target is not.
const foldR = new Map(), standR = new Map();
for (const k in LEGS) {
  const ch = LEGS[k].map((n) => idByName[n]);
  let bestFold = 0, lo = Infinity, bestStand = 0, hi = -Infinity;
  for (let f = 0; f < WN; f++) {
    const e = vlen(vsub(walkPose[f].pos.get(ch[3]), walkPose[f].pos.get(ch[0]))) / LEG_REACH[k];
    if (e < lo) { lo = e; bestFold = f; }
    if (e > hi) { hi = e; bestStand = f; }
  }
  for (const n of LEGS[k]) {
    const id = idByName[n], e = walkLocal.get(id);
    foldR.set(id, (e?.r?.[bestFold] ?? restR(id)).slice());
    standR.set(id, (e?.r?.[bestStand] ?? restR(id)).slice());
  }
}
// ── the Walk's own joint envelope ───────────────────────────────────────
//
// The approved Walk is the reference for HOW EVERY JOINT MOVES, not just for
// which way a leg folds. Measured here in the body's own frame (so a pitched,
// rolled or toppled body never reads as a bent joint), each leg joint gets the
// [min,max] hinge angle the Walk actually uses. Any authored pose is then held
// inside that envelope, which is what stops the IK inventing elbow and hock
// angles no real animal reaches.
const hingeAngles = (W, k) => {
  const chain = LEGS[k].map((n) => idByName[n]);
  const hid = idByName.Hips;
  const qB = qmul(W.rot.get(hid), qconj(restWorld.get(hid)));
  const fwd = qrot(qB, FWD), up = qrot(qB, UP);
  const ang = [];
  for (let i = 0; i < 3; i++) {
    const v = vsub(W.pos.get(chain[i+1]), W.pos.get(chain[i]));
    ang.push(Math.atan2(vdot(v, fwd), -vdot(v, up)) * 180 / Math.PI);
  }
  const wrap = (d) => { while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  return [wrap(ang[1] - ang[0]), wrap(ang[2] - ang[1])];
};
const WALK_HINGE = {};
for (const k in LEGS) {
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (let f = 0; f < WN; f++) {
    const h = hingeAngles(walkPose[f], k);
    for (let j = 0; j < 2; j++) { lo[j] = Math.min(lo[j], h[j]); hi[j] = Math.max(hi[j], h[j]); }
  }
  WALK_HINGE[k] = [[lo[0], hi[0]], [lo[1], hi[1]]];
}

// ── how far each leg bone swings, measured in the Walk ──────────────────
//
// The IK had hardcoded deviation limits - 45 degrees at the shoulder, 75 and
// 85 below it. The Walk only uses 24 at the shoulder, so the solver was free
// to swing it twice as far, and it did: measured across the library it drove
// the shoulder to 48-58 degrees in Run, both turns, both charges and the hit
// reaction. That is the "primary error" the locomotion literature names -
// a bovid's motion is DISTALLY concentrated, shoulder and hip only 10-30
// degrees, with the carpus and fetlock doing the work. Driving the stride
// from the shoulder is what made the front legs look wrong.
//
// The limits now come from the Walk itself, per bone, which is the reference
// the whole rig is judged against anyway.
const WALK_SWING = new Map();
for (const k in LEGS) for (const n of LEGS[k]) {
  const id = idByName[n];
  const a = legAnchor.get(id) ?? stand.get(id).r;
  let mx = 0;
  for (let f = 0; f < WN; f++) {
    const q = walkLocal.get(id)?.r?.[f] ?? restR(id);
    const d = 2 * Math.acos(Math.min(1, Math.abs(q[0]*a[0]+q[1]*a[1]+q[2]*a[2]+q[3]*a[3]))) * 180 / Math.PI;
    if (d > mx) mx = d;
  }
  WALK_SWING.set(id, mx);
}
// A faster gait reaches further than a walk, but the EXTRA belongs to the
// distal joints, not the shoulder - so the allowance widens down the limb.
const SWING_MARGIN = [1.15, 1.45, 1.60, 1.60];
// The same swing measured from the bone's REST orientation rather than from
// the anchor. This is the one that bites: the Walk's shoulder never gets more
// than 24 degrees from rest, while the solver was reaching 48-58. Measuring
// from the anchor does not catch it, because the anchor sits at one edge of
// the Walk's own range and 37 degrees from THERE is still within bounds.
const WALK_REST_SWING = new Map();
for (const k in LEGS) for (const n of LEGS[k]) {
  const id = idByName[n], r = restR(id);
  let mx = 0;
  for (let f = 0; f < WN; f++) {
    const q = walkLocal.get(id)?.r?.[f] ?? r;
    const d = 2 * Math.acos(Math.min(1, Math.abs(q[0]*r[0]+q[1]*r[1]+q[2]*r[2]+q[3]*r[3]))) * 180 / Math.PI;
    if (d > mx) mx = d;
  }
  WALK_REST_SWING.set(id, mx);
}

let PLANTED_LEGS = new Set();
let SETTLE = false;
// The barrel - what actually takes an animal's weight when it lies on its side.
let TORSO_SET = null;
const planted = (k) => PLANTED_LEGS.has(k);
// Legs allowed to fold freely for this clip. The deviation clamp exists to stop
// a leg flipping to the wrong branch, which is only ambiguous when the target is
// far from the hip. A reared foreleg is tucked close under the shoulder — an
// unambiguous fold — and the clamp there merely froze it at 99% extension. The
// reach clamp still guards against the opposite failure.
let FREE_FOLD = new Set();
// Per-leg cap on how close to full extension the IK may drive a limb, as a
// fraction of that leg's reach. The hind legs of the rear want to be near
// straight (support columns); the suspended forelegs must never lock out.
let REACH_CAP = {};
const walkHoofArc = {}; for (const k in hoofId) walkHoofArc[k] = walkPose.map((p)=>p.pos.get(hoofId[k]));
const LIFT = {}; for (const k in hoofId){ const ys = walkHoofArc[k].map(v=>v[1]); LIFT[k]=Math.max(...ys)-Math.min(...ys); }
const STRIDE = {}; for (const k in hoofId){ const zs = walkHoofArc[k].map(v=>v[2]); STRIDE[k]=Math.max(...zs)-Math.min(...zs); }
console.log(`node-space: ground=${GROUND.toFixed(4)} hipH=${HIP_H.toFixed(4)} lift ${Object.entries(LIFT).map(([k,v])=>k+"="+v.toFixed(3)).join(" ")}`);
console.log(`stride ${Object.entries(STRIDE).map(([k,v])=>k+"="+v.toFixed(3)).join(" ")}`);

// ── CCD IK: solve one leg's 4 local rotations to put its hoof at target ──
const chainOf = (k) => LEGS[k].map((n) => idByName[n]);
  // Hold each joint inside the envelope the Walk uses. Rotating the sub-chain
// about its own root->hoof axis swings the bend plane while leaving the hoof
// EXACTLY where the IK put it (both ends lie on the axis), so the angle can
// be corrected without giving up the ground contact. The needed rotation is
// found by bisection - it is a one-dimensional, monotonic search once the
// direction is known, and the smallest correction that reaches the boundary
// is the one applied.
function clampEnvelope(local, k, i, prefer = 0) {
  const chain = chainOf(k);
  const W0 = fk(local);
  const a = W0.pos.get(chain[i]), hoof = W0.pos.get(chain[3]);
  const span = vsub(hoof, a); const L = vlen(span);
  if (L < 1e-6) return;
  let full = 0; for (let j = 0; j < 3; j++) full += vlen(vsub(W0.pos.get(chain[j+1]), W0.pos.get(chain[j])));
  // A near-straight chain has no meaningful bend plane to swing, and rotating
  // it would spin the limb about its own length for nothing.
  if (vlen(vsub(W0.pos.get(chain[3]), W0.pos.get(chain[0]))) / (full || 1) > 0.995) return;
  const axis = vscale(span, 1 / L);
  const jb = chain[i], parentRot = W0.rot.get(parent.get(jb)) ?? [0,0,0,1];
  const c0 = local.get(jb);
  const setRot = (deg) => {
    const q = qaxis(axis, deg);
    local.set(jb, { r: qnorm(qmul(qmul(qmul(qconj(parentRot), q), parentRot), c0.r)), t: c0.t });
  };
  const [lo, hi] = WALK_HINGE[k][i];
  const M = 2;                                  // stay a little inside the edge
  // How far outside the Walk's envelope this rotation leaves BOTH joints. Both
  // matter: swinging the bend plane to fix joint 1 can throw joint 2 out, and a
  // search that only watched one of them was what produced 180 degree flips.
  const cost = (deg) => {
    setRot(deg);
    const h = hingeAngles(fk(local), k);
    let c = 0;
    for (let j = 0; j < 2; j++) {
      const [l2, h2] = WALK_HINGE[k][j];
      if (h[j] < l2 + M) c += (l2 + M) - h[j];
      else if (h[j] > h2 - M) c += h[j] - (h2 - M);
    }
    return c;
  };
  // Continuity term. The correction rotates about the limb's own axis, which
  // the contact and sliding checks cannot see - so a search run independently
  // per frame is free to pick +85 on one frame and -85 on the next, spinning
  // the bone 170 degrees between them. That is invisible to every positional
  // check and glaring on screen. Measured: it put a ~180 deg single-frame
  // world spin into EVERY clip, against 78 deg worst in the source Walk.
  // The weight is small enough that it only ever breaks ties between rotations
  // that are equally valid, never enough to accept a violation.
  const total = (deg) => cost(deg) + 0.004 * Math.abs(deg - prefer);
  const base = total(prefer);
  if (cost(prefer) <= 0 && Math.abs(prefer) > 1e-9) { setRot(prefer); return prefer; }
  if (cost(0) <= 0 && Math.abs(prefer) <= 1e-9) { setRot(0); return 0; }
  // Coarse sweep then a local refine, over a bounded range: past +-90 the limb
  // is no longer being corrected, it is being turned inside out.
  let bestD = prefer, bestC = base;
  for (let d = -90; d <= 90; d += 3) {
    const c = total(d);
    if (c < bestC - 1e-9) { bestC = c; bestD = d; }
  }
  for (let step = 1.5; step >= 0.2; step /= 2) {
    for (const d of [bestD - step, bestD + step]) {
      if (Math.abs(d) > 90) continue;
      const c = total(d);
      if (c < bestC - 1e-9) { bestC = c; bestD = d; }
    }
  }
  setRot(bestD);
  return bestD;
}


// ── which way each joint folds, measured per leg and per joint ──────────
//
// The fold guard inherited from the buffalo forced EVERY joint of EVERY leg to
// bend backwards - "every leg here folds away from the head". That is true of a
// bovid and false of a dog: a dog's stifle folds FORWARD while its hock folds
// back, so on both hind legs the guard was pushing the joint to the wrong side
// on every frame and fighting the solver that was trying to reach the target.
// It is why the gaits missed their foot placements by well over a hip height
// while a static pose hit them exactly, and why the hind legs splayed.
//
// So the side is measured, not asserted: for each leg and each of the two
// bending joints, the source Walk's own bend direction is averaged, expressed
// in the leg ROOT's local frame so it rotates with the animal instead of being
// pinned to world forward.
const FOLD_DIR = {};
for (const k in LEGS) {
  FOLD_DIR[k] = [null, null, null];
  const chain = LEGS[k].map((n) => idByName[n]);
  for (const i of [1, 2]) {
    let acc = [0, 0, 0], n = 0;
    for (let f = 0; f < WN; f++) {
      const W = walkPose[f];
      const a = W.pos.get(chain[i]), hoof = W.pos.get(chain[3]);
      const span = vsub(hoof, a), L = vlen(span);
      if (L < 1e-6) continue;
      let full = 0;
      for (let jj = 0; jj < 3; jj++) full += vlen(vsub(W.pos.get(chain[jj+1]), W.pos.get(chain[jj])));
      if (vlen(vsub(W.pos.get(chain[3]), W.pos.get(chain[0]))) / (full || 1) > 0.93) continue;
      const axis = vscale(span, 1 / L);
      const v = vsub(W.pos.get(chain[i+1]), a);
      const perp = vsub(v, vscale(axis, vdot(v, axis)));
      if (vlen(perp) < 1e-7) continue;
      // into the ROOT's frame, so it means the same thing when the dog turns
      const local = qrot(qconj(W.rot.get(chain[0])), vnorm(perp));
      acc = vadd(acc, local); n++;
    }
    if (n) FOLD_DIR[k][i] = vnorm(acc);
  }
}
console.log("  [fold] measured bend side per joint (in the leg root's frame):");
for (const k in LEGS) console.log(`    ${k}  j1 ${FOLD_DIR[k][1] ? FOLD_DIR[k][1].map((x)=>x.toFixed(2)).join(",") : "?"}   j2 ${FOLD_DIR[k][2] ? FOLD_DIR[k][2].map((x)=>x.toFixed(2)).join(",") : "?"}`);

function solveLeg(local, k, target) {
  const chain = LEGS[k].map((n) => idByName[n]);
  // Clamp the target into the leg's reachable shell, measured from the CURRENT
  // hip (it moves as the body dips). Below 0.97 of full reach the leg keeps a
  // natural bend; a target past that would force the chain straight — the
  // "leg gone long" artifact — and one too close would fold it inside out.
  {
    const hip = fk(local).pos.get(chain[0]);
    const d = vsub(target, hip); const dist = vlen(d) || 1e-9;
    // Corrected clips keep extra headroom: the leg-smoothing pass can straighten
    // a pose a little past its target, and 0.97 left no room before that read as
    // hyperextension on the rear-stomp descent.
    const maxR = LEG_REACH[k] * (REACH_CAP[k] ?? (planted(k) ? 0.94 : 0.97)), minR = LEG_REACH[k] * 0.45;
    if (dist > maxR) target = vadd(hip, vscale(d, maxR / dist));
    else if (dist < minR) target = vadd(hip, vscale(d, minR / dist));
  }
  // Anatomical fold guard.
  //
  // A quadruped's leg bends to ONE side only — measured in the source Walk,
  // which the animator posed correctly: elbow -52.9 / carpus -31.8 on the
  // foreleg, stifle -42.6 / hock -39.4 on the hind, all BEHIND the root->hoof
  // line. CCD is free to converge with the bend on either side, and on the left
  // limbs it kept choosing the forbidden one (elbow at +0.32, bending forward,
  // which no animal can do).
  //
  // The correction is geometric, not a fudge: rotating a sub-chain about the
  // axis from its own root to the hoof swings the bend to the other side while
  // moving the hoof NOT AT ALL, because both ends lie on that axis. So the
  // ground contact the IK just solved for survives exactly. Applied at joint 1
  // and then joint 2 — the second pass leaves the first joint where it is, so
  // the two do not fight.
  const foldAt = (i) => {
    const W = fk(local);
    const a = W.pos.get(chain[i]), hoof = W.pos.get(chain[3]);
    const span = vsub(hoof, a); const L = vlen(span);
    if (L < 1e-6) return;
    let full = 0; for (let j = 0; j < 3; j++) full += vlen(vsub(W.pos.get(chain[j+1]), W.pos.get(chain[j])));
    const chainExt = vlen(vsub(W.pos.get(chain[3]), W.pos.get(chain[0]))) / (full || 1);
    if (chainExt > 0.93) return;                       // effectively straight: no meaningful side
    const axis = vscale(span, 1 / L);
    const v = vsub(W.pos.get(chain[i+1]), a);
    const perp = vsub(v, vscale(axis, vdot(v, axis)));
    if (vlen(perp) < 1e-7) return;
    const cur = vnorm(perp);
    // The measured side for THIS leg and THIS joint, carried back into world
    // space through the leg root's current orientation.
    const dirLocal = FOLD_DIR[k]?.[i];
    const back = dirLocal ? qrot(W.rot.get(chain[0]), dirLocal) : vscale(FWD, -1);
    let want = vsub(back, vscale(axis, vdot(back, axis)));
    if (vlen(want) < 1e-7) return;
    want = vnorm(want);
    // Correct only as far as is needed to reach the valid side, not all the way
    // to dead-backward. Forcing full alignment moved legs that were already bending
    // acceptably and cost 8-10 sliding frames in Run and Charge_Start.
    const d = Math.max(-1, Math.min(1, vdot(cur, want)));
    const ang = Math.acos(d) * 180 / Math.PI;
    const LIMIT = 66;   // measured: 70 lets Turn_Left drift, 55 costs Run 6 sliding frames                    // anything within 70 deg of "backward" is a valid fold
    if (ang <= LIMIT) return;            // already on the correct side: leave it alone
    const need = ang - LIMIT;            // minimum swing that brings it back inside
    const sgn = vdot(vcross(cur, want), axis) < 0 ? -1 : 1;
    const q = qaxis(vscale(axis, sgn), need);
    const jb = chain[i];
    const parentRot = W.rot.get(parent.get(jb)) ?? [0,0,0,1];
    const c0 = local.get(jb);
    local.set(jb, { r: qnorm(qmul(qmul(qmul(qconj(parentRot), q), parentRot), c0.r)), t: c0.t });
  };
  // The envelope correction rotates the limb about its OWN axis, so it moves no
  // foot and neither contact nor sliding QA can see it. Run with prefer fixed
  // at 0 the search is free to pick +85 on one frame and -85 on the next, which
  // spins the bone 170 degrees between two frames and is glaring on screen
  // while every positional check stays green. Biasing towards zero does not fix
  // that - zero is not where the previous frame was. Feeding each frame the
  // angle the PREVIOUS frame actually chose is what makes the choice continuous.
  const foldGuard = () => {
    if (process.env.NOFOLD) return;
    for (const i of [0, 1]) {
      const key = `${k}:${i}`;
      const got = clampEnvelope(local, k, i, ENV_PREFER.get(key) ?? 0);
      if (typeof got === "number") ENV_PREFER.set(key, got);
    }
  };
  for (let iter=0; iter<60; iter++) {
    const W = fk(local); const end = W.pos.get(chain[chain.length-1]);
    if (vlen(vsub(end, target)) < 2e-5) break;
    for (let b=chain.length-2; b>=0; b--) {   // skip the hoof bone itself; rotate the ones above
      const jb = chain[b]; const Wc = fk(local);
      const jointPos = Wc.pos.get(jb), effPos = Wc.pos.get(chain[chain.length-1]);
      const toEff = vsub(effPos, jointPos), toTgt = vsub(target, jointPos);
      if (vlen(toEff) < 1e-5 || vlen(toTgt) < 1e-5) continue;
      const a = vnorm(toEff), d = vnorm(toTgt);
      let axis = vcross(a, d); const sinA = vlen(axis);
      if (sinA < 1e-6) continue;
      axis = vscale(axis, 1/sinA);
      let ang = Math.acos(Math.max(-1, Math.min(1, vdot(a, d)))) * 180/Math.PI;
      ang = Math.max(-18, Math.min(18, ang));   // small steps keep it stable and anatomical
      const parentRot = Wc.rot.get(parent.get(jb)) ?? [0,0,0,1];
      const localAxis = qrot(qconj(parentRot), axis);
      // PRE-multiply. `localAxis` is the world rotation axis expressed in the
      // PARENT's frame, and a rotation in the parent's frame composes on the
      // left: new = R_parentFrame * old. Post-multiplying applies it in the
      // BONE's own frame instead, so every CCD step went off at an angle that
      // varied with the bone's current orientation. It still converged when the
      // target sat close to where the leg already was - which is why static
      // poses looked fine - and failed whenever the target MOVED: measured, the
      // solve was leaving the paw half a hip height from its mark on the Trot
      // and three quarters on the turns, before any other pass touched it.
      const cur = local.get(jb); let nr = qnorm(qmul(qaxis(localAxis, ang), cur.r));
      // Anchor to the known-good stand pose: a joint may bend well away from it
      // to reach a target, but not so far that the whole leg flips up over the
      // body — the CCD's cross-product solve is handedness-sensitive and drove
      // exactly that on the left-back leg from an almost-correct start. Bounding
      // each joint's deviation from stand keeps every leg down and anatomical.
      const sr = (planted(k) && legAnchor.has(jb)) ? legAnchor.get(jb) : stand.get(jb).r;
      const dev = 2 * Math.acos(Math.min(1, Math.abs(nr[0]*sr[0]+nr[1]*sr[1]+nr[2]*sr[2]+nr[3]*sr[3]))) * 180/Math.PI;
      const base = Math.max(12, (WALK_SWING.get(jb) ?? 45) * (SWING_MARGIN[b] ?? 1.6));
      const lim = FREE_FOLD.has(k) ? base * 2.4 : base;
      if (dev > lim && !process.env.NODEV) nr = qnorm(slerp(sr, nr, lim / dev));
      // ...and a hard cap on how far the bone may leave its REST orientation.
      // This is what keeps the stride distal: the shoulder is held near the
      // 24 degrees the Walk uses while the carpus and fetlock take the extra
      // reach, instead of the whole limb being swung from the top.
      {
        const rr = restR(jb);
        const cap = (WALK_REST_SWING.get(jb) ?? 60) * (SWING_MARGIN[b] ?? 1.6) * (FREE_FOLD.has(k) ? 2.4 : 1);
        const dr = 2 * Math.acos(Math.min(1, Math.abs(nr[0]*rr[0]+nr[1]*rr[1]+nr[2]*rr[2]+nr[3]*rr[3]))) * 180 / Math.PI;
        if (dr > cap && !process.env.NOREST) nr = qnorm(slerp(rr, nr, cap / dr));
      }
      local.set(jb, { r: nr, t: cur.t });
    }
  }
  foldGuard();
  // The fold guard rotates the sub-chain from its ROOT - which is the shoulder
  // - so it can undo the cap the CCD loop just applied. Re-cap afterwards.
  // Measured: without this, Hit_Reaction, Graze and Charge_Start kept their
  // 42-50 degree shoulder swing while every other clip came down to ~28.
  for (let b = 0; b < chain.length - 1; b++) {
    const jb = chain[b], rr = restR(jb), cur = local.get(jb);
    const cap = (WALK_REST_SWING.get(jb) ?? 60) * (SWING_MARGIN[b] ?? 1.6) * (FREE_FOLD.has(k) ? 2.4 : 1);
    const dr = 2 * Math.acos(Math.min(1, Math.abs(cur.r[0]*rr[0]+cur.r[1]*rr[1]+cur.r[2]*rr[2]+cur.r[3]*rr[3]))) * 180 / Math.PI;
    if (dr > cap) local.set(jb, { r: qnorm(slerp(rr, cur.r, cap / dr)), t: cur.t });
  }
}
// ── pose helpers (additive over stand) ──────────────────────────────────
// A visual-space rotation, pre-multiplied in the bone's PARENT frame so
// "pitch the head down" means down in the world, not down in whatever
// orientation this particular bone was modelled with.
function applyVisual(local, name, pitch, yaw, roll) {
  // The base a leg bone is posed FROM must be the same pose freshLocal seeded
  // it with, or the two disagree.
  //
  // `stand` is Walk frame 0, and Walk frame 0 is MID-STRIDE with the left hind
  // lifted and folded. freshLocal already knows this and seeds each planted leg
  // from its own anchor - the Walk frame where THAT foot is lowest - but
  // applyVisual went on using `stand`, so posing the two hind legs by the same
  // angle gave two different results. It is the same left-hind asymmetry that
  // showed up on the buffalo, and it is why solving for a symmetric sitting
  // fold returned 70/-42/-21 on the left against 49/-56/51 on the right.
  const id = idByName[name];
  // ANCHOR_BASE_LEGS extends the same correction to legs a clip poses DIRECTLY.
  // The anchor was only being used for PLANTED legs, so a clip that poses its
  // limbs - a sleep, a stretch - still went through `stand`, i.e. through Walk
  // frame 0 with the left hind lifted and folded. Identical angles on the two
  // sides then produce two different limbs, and no amount of solving for foot
  // HEIGHT fixes it, because height has many solutions and each side settles
  // into a different one: the sleep came out with one foreleg stretched past
  // the nose and the other tucked under the chest.
  const anchored = legAnchor.has(id) && (ANCHOR_BASE_LEGS || planted(legOf.get(id)));
  const st = stand.get(id);
  const base = anchored ? { r: legAnchor.get(id), t: st.t } : st;
  const pw = parentWorld(id), pwi = qconj(pw);
  let q = base.r;
  if (pitch) q = qmul(qaxis(qrot(pwi, LEFT), -pitch), q);
  if (yaw)   q = qmul(qaxis(qrot(pwi, UP), yaw), q);
  if (roll)  q = qmul(qaxis(qrot(pwi, FWD), roll), q);
  local.set(id, { r: qnorm(q), t: base.t });
  return q;
}
const visualOn = (id, base, {pitch=0,yaw=0,roll=0}={}) => {
  const pwi = qconj(parentWorld(id));
  let q = base;
  if (pitch) q = qmul(qaxis(qrot(pwi, LEFT), -pitch), q);
  if (yaw)   q = qmul(qaxis(qrot(pwi, UP), yaw), q);
  if (roll)  q = qmul(qaxis(qrot(pwi, FWD), roll), q);
  return qnorm(q);
};
function poser(local) {
  return {
    body(name, {pitch=0,yaw=0,roll=0}={}) { applyVisual(local, name, pitch, yaw, roll); },
    hips({dz=0,dfwd=0,dleft=0,pitch=0,yaw=0,roll=0}={}) {
      const q = applyVisual(local, "Hips", pitch, yaw, roll);
      const base = stand.get(idByName.Hips);
      // Move the root by a visual-space offset, expressed in its local frame.
      const off = vadd(vadd(vscale(UP,dz), vscale(FWD,dfwd)), vscale(LEFT,dleft));
      const offLocal = qrot(qconj(ARM_R), off);
      local.set(idByName.Hips, { r: q, t: vadd(base.t, offLocal) });
    },
  };
}
function freshLocal() { const m = new Map(); for (const j of joints){ const e = stand.get(j);
  const useP = legAnchor.has(j) && (ANCHOR_BASE_LEGS || planted(legOf.get(j)));
  const r = useP ? legAnchor.get(j).slice() : e.r.slice();
  m.set(j, { r, t: e.t.slice() }); } return m; }

// ── clip builder: returns per-frame local {r,t} for every joint ─────────
// Smoothstep, CLAMPED. Unclamped it turns back on itself past 1 —
// smooth(1.545) = -0.215 — which is what made Death's collapse unwind and
// stand the buffalo back up on its final frame. Saturating is the correct
// behaviour everywhere it is used as a 0..1 ramp.
const smooth = (t)=>{ const u = t < 0 ? 0 : t > 1 ? 1 : t; return u*u*(3-2*u); };
const sin = (x)=>Math.sin(x), PI=Math.PI, TAU=2*PI;

const LEG_BONE_IDS = Object.values(LEGS).flatMap((c) => c.map((n) => idByName[n]));
const qangDeg = (a,b) => 2*Math.acos(Math.min(1, Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3])))*180/Math.PI;
// STRUCTURAL leg joints only - shoulder/hip, upper, lower. The fourth bone in
// each chain is the paw, and its rotation is a by-product of the IK rather than
// a joint anyone poses: it counter-rotates to keep the pad flat and swings
// freely the moment the foot leaves the ground. In this rig's own source Walk
// the paws step up to 94 degrees in a frame while no structural joint passes
// 32, so calibrating a continuity threshold on all four bones hides every real
// flip behind the paw's noise.
const LEG_STRUCT_IDS = Object.values(LEGS).flatMap((c) => c.slice(0,3).map((n) => idByName[n]));
const legStepMax = (poses) => { let m = 0;
  for (let f = 1; f < poses.length; f++) for (const id of LEG_STRUCT_IDS)
    m = Math.max(m, qangDeg(poses[f-1].get(id).r, poses[f].get(id).r));
  return m; };
let FLIP_LOG = "";
let ENV_PREFER = new Map();
const SOLVE_ERR = [];
let DEEP_FOLD = false;
// Legs a clip insists are pressed onto the floor on EVERY frame, not just the
// ones buryGuard disturbed. The stretch needs it for its hind pair: the pose is
// held still for two seconds and the weight-shift secondary quietly floats the
// rump, so without this the hind paws sit a fifth of a hip height in the air
// for the whole hold. It is deliberately NOT the default - see replantGuard.
let REPLANT_FORCE = new Set();
// Pose directly-posed leg bones from each leg's own planted anchor instead of
// from the mid-stride `stand`, so left and right start from mirror poses.
let ANCHOR_BASE_LEGS = false;
// Whether flatLimbGuard replays this clip's flat-limb solves after the guards.
let FLAT_REPLAY = false;
// The IK targets the hoof bone's ORIGIN, so the hoof's own rotation is free —
// it is carried along by whatever the parents did to reach the target, which
// tips the hoof and digs its toe or heel below the floor. Measured against the
// source Walk (which never penetrates), every authored clip sank 2-6% of body
// height this way. Restoring the planted Walk hoof orientation levels the foot
// and cannot move the contact point, because a bone's rotation never moves its
// own origin. Fades out as the hoof leaves the ground so swing legs stay free.
function levelHooves(local, legTargets) {
  const W = fk(local);
  const used = {};
  for (const k in hoofId) {
    const tgt = legTargets[k];
    if (tgt === null) continue;                       // airborne, posed directly
    const t = tgt ?? stanceHoof[k];
    // Eased, and over a WIDE window. Switching the levelling off sharply snapped
    // the hoof bone through 150 degrees in a single frame on the faster gaits -
    // the biggest velocity spike anywhere in the library.
    const lift = LIFT[k] > 1e-9 ? (t[1] - GROUND) / (1.2 * LIFT[k]) : 0;
    const w = 1 - smooth(Math.max(0, Math.min(1, lift)));
    if (w < 1e-4) continue;
    const id = hoofId[k], pid = parent.get(id);
    if (pid == null || !joints.includes(pid)) continue;
    const want = qmul(qconj(W.rot.get(pid)), anchorHoofW[k]);
    local.set(id, { r: qnorm(slerp(local.get(id).r, want, w)), t: local.get(id).t });
    used[k] = w;
  }
  return used;
}
// Re-level after the smoothing pass. The hoof bone's LOCAL rotation is
// deliberately counter-rotating against a swinging parent to hold the foot
// flat, so a 3-tap average of those local quaternions produces a rotation that
// corresponds to no flat hoof at all - measured as a 180 degree world-space
// flip of the hoof on the loop-seam frame of Run. Redoing the levelling from
// the smoothed pose restores the intent, and cannot disturb contact because a
// bone's own rotation never moves its own origin.
function relevelHooves(pose, used) {
  if (!used) return;
  const W = fk(pose);
  for (const k in used) {
    const w = used[k];
    if (!(w > 1e-4)) continue;
    const id = hoofId[k], pid = parent.get(id);
    if (pid == null || !joints.includes(pid)) continue;
    const want = qmul(qconj(W.rot.get(pid)), anchorHoofW[k]);
    pose.get(id).r = qnorm(slerp(pose.get(id).r, want, w));
  }
}
function solveFrame(prev, phaseFrame, period, fn) {
  const local = freshLocal();
  if (prev) for (const id of LEG_BONE_IDS) local.set(id, { r: prev.get(id).r.slice(), t: local.get(id).t });
  const P = poser(local); const legTargets = {};
  globalThis.__flatFrame = phaseFrame;
  fn(phaseFrame, period, P, legTargets, local);
  for (const k in hoofId) {
    if (legTargets[k] === null) continue;   // posed directly (airborne limb); IK would fight it
    // A target further from the leg's root than the leg is LONG cannot be
    // reached, and asking for one is not a harmless over-reach: the solver
    // drives the whole limb out towards it, the reach clamp stops it short, and
    // the paw ends up somewhere between - splayed out, nowhere near the target,
    // and nowhere near where a foot belongs. Measured, the Trot and both turns
    // were asking for placements 1.7 to 2.0 hip heights away on a leg that
    // spans 1.35, and that single fact is most of why the gaits looked wrong.
    //
    // The stride multipliers cause it: STRIDE is measured from the source Walk,
    // which is reachable by construction, and then scaled up by 1.2 to 1.6 for
    // the faster gaits without anything checking the result against the limb.
    const tgt = legTargets[k] ?? stanceHoof[k];
    const W0 = fk(local), root = W0.pos.get(idByName[LEGS[k][0]]);
    const d = vsub(tgt, root), dist = vlen(d);
    const cap = LEG_REACH[k] * 0.96;
    const reachable = dist > cap ? vadd(root, vscale(d, cap / dist)) : tgt;
    if (dist > cap) legTargets[k] = reachable;   // record what was actually asked for
    solveLeg(local, k, reachable);
    if (process.env.SOLVEDBG) {
      const after = fk(local).pos.get(hoofId[k]);
      SOLVE_ERR.push(vlen(vsub(after, reachable)) / HIP_H);
    }
  }
  const lw = levelHooves(local, legTargets);
  const outMap = new Map([...local].map(([i,e])=>[i,{r:e.r,t:e.t}]));
  outMap.__level = lw;
  outMap.__targets = { ...legTargets };
  return outMap;
}


// ── hinge axes, measured from the source Walk ───────────────────────────
//
// A dog's elbow, stifle, carpus and hock are HINGES: one degree of freedom
// each. CCD does not know that. It treats every joint as a ball, so for any
// paw position there is a whole FAMILY of solutions differing only by rotation
// about the limb, and nothing stops it picking a different member of that
// family on adjacent frames. That redundancy is the entire source of the limb
// spin, and rate limiting cannot remove it - it only bounds how fast the
// solver is allowed to wander through it. Measured: the bound held at 105
// degrees of local rotation per frame and the limb still swung 179 degrees in
// world space, because three bounded joints compose.
//
// The axis is not assumed. It is the principal axis of each joint's own motion
// across the source Walk - whatever this rig actually uses - found by power
// iteration on the covariance of the log-mapped rotations. The fraction of the
// motion that axis explains is printed, so the hinge assumption is checked
// against the data rather than taken on faith: if a joint turned out not to be
// hinge-like, projecting it would damage the Walk and the number would say so.
//
// Only joints 1 and 2 are projected. Joint 0 is the shoulder and the hip, which
// really are ball joints and need their extra freedom.
const HINGE_AXIS = {}, HINGE_FIT = {}, HINGE_RANGE = {}, HINGE_RATE = {};
for (const k in LEGS) {
  HINGE_AXIS[k] = [null, null, null]; HINGE_FIT[k] = [0, 0, 0]; HINGE_RANGE[k] = [null, [0,0], [0,0]]; HINGE_RATE[k] = [0, 30, 30];
  for (const i of [1, 2]) {
    const id = idByName[LEGS[k][i]], rest = restR(id), v = [];
    for (let f = 0; f < WN; f++) {
      const q = walkLocal.get(id)?.r?.[f]; if (!q) continue;
      const d = qmul(qconj(rest), q);
      const sn = Math.hypot(d[0], d[1], d[2]); if (sn < 1e-9) continue;
      const ang = 2 * Math.atan2(sn, Math.abs(d[3])) * (d[3] < 0 ? -1 : 1);
      v.push([d[0]/sn*ang, d[1]/sn*ang, d[2]/sn*ang]);
    }
    if (v.length < 3) continue;
    let a = [0, 0, 1];
    for (let it = 0; it < 60; it++) {
      const n = [0, 0, 0];
      for (const x of v) { const dd = x[0]*a[0] + x[1]*a[1] + x[2]*a[2];
        n[0] += x[0]*dd; n[1] += x[1]*dd; n[2] += x[2]*dd; }
      const L = Math.hypot(...n); if (L < 1e-12) break;
      a = [n[0]/L, n[1]/L, n[2]/L];
    }
    let on = 0, all = 0;
    for (const x of v) { const dd = x[0]*a[0] + x[1]*a[1] + x[2]*a[2];
      on += dd*dd; all += x[0]*x[0] + x[1]*x[1] + x[2]*x[2]; }
    HINGE_AXIS[k][i] = a; HINGE_FIT[k][i] = all > 0 ? on/all : 0;
    // ...and the range that axis is actually swung through in the Walk.
    let lo = Infinity, hi = -Infinity;
    for (let f = 0; f < WN; f++) {
      const q = walkLocal.get(id)?.r?.[f]; if (!q) continue;
      const dq = qmul(qconj(rest), q);
      const dd = dq[0]*a[0] + dq[1]*a[1] + dq[2]*a[2];
      let th = 2 * Math.atan2(dd, dq[3]) * 180 / Math.PI;
      while (th > 180) th -= 360; while (th <= -180) th += 360;
      lo = Math.min(lo, th); hi = Math.max(hi, th);
    }
    HINGE_RANGE[k][i] = [lo, hi];
    // ...and the fastest this joint is ever swung, per frame, in that Walk.
    let rate = 0, pv = null;
    for (let f = 0; f < WN; f++) {
      const q = walkLocal.get(id)?.r?.[f]; if (!q) continue;
      const dq = qmul(qconj(rest), q);
      let th = 2 * Math.atan2(dq[0]*a[0] + dq[1]*a[1] + dq[2]*a[2], dq[3]) * 180 / Math.PI;
      while (th > 180) th -= 360; while (th <= -180) th += 360;
      if (pv !== null) rate = Math.max(rate, Math.abs(th - pv));
      pv = th;
    }
    HINGE_RATE[k][i] = Math.max(12, rate * 2.0);
  }
}
console.log("  [hinge] one axis explains: " + Object.keys(LEGS).map((k) =>
  `${k} ${(HINGE_FIT[k][1]*100).toFixed(0)}%/${(HINGE_FIT[k][2]*100).toFixed(0)}%`).join(" "));
console.log("  [hinge] Walk range (deg): " + Object.keys(LEGS).map((k) =>
  `${k} [${HINGE_RANGE[k][1].map((x)=>x.toFixed(0)).join(",")}] [${HINGE_RANGE[k][2].map((x)=>x.toFixed(0)).join(",")}]`).join(" "));
console.log("  [hinge] max rate/frame allowed: " + Object.keys(LEGS).map((k) =>
  `${k} ${HINGE_RATE[k][1].toFixed(0)}/${HINGE_RATE[k][2].toFixed(0)}`).join(" "));

// Project a joint's local rotation onto pure rotation about its hinge axis by
// swing-twist decomposition, discarding the swing. A paw position reachable
// before is still reachable after, because the discarded component is the one
// that does not move it.
function hingeProject(local, k, i) {
  if (process.env.NOHINGE) return;
  const ax = HINGE_AXIS[k][i]; if (!ax) return;
  const id = idByName[LEGS[k][i]], rest = restR(id), e = local.get(id);
  const d = qmul(qconj(rest), e.r);
  const dot = d[0]*ax[0] + d[1]*ax[1] + d[2]*ax[2];
  // Signed rotation about the hinge, wrapped into (-180, 180].
  let th = 2 * Math.atan2(dot, d[3]) * 180 / PI;
  while (th > 180) th -= 360; while (th <= -180) th += 360;
  // Making the joint a hinge removes the spin but not the FLIP: a hinge is
  // perfectly free to swing to the far side of its own axis, which is a legal
  // hinge rotation of 150 degrees in one frame and reads as the knee snapping
  // through the leg. Measured across this rig's source Walk, each hinge uses a
  // narrow, one-sided range - so the range is the constraint, widened by a
  // third to leave the faster authored gaits room the Walk never needed.
  const [lo, hi] = HINGE_RANGE[k][i];
  // A sit, a lie or a bow folds a joint far past anything a walk does, so the
  // range measured from the Walk is the wrong yardstick for them. DEEP_FOLD
  // widens it for exactly those clips rather than loosening it for all.
  const pad = (DEEP_FOLD ? 1.30 : 0.35) * (hi - lo) + 4;
  th = Math.max(lo - pad, Math.min(hi + pad, th));
  const r = th * PI / 360, sn = Math.sin(r);
  const t = [ax[0]*sn, ax[1]*sn, ax[2]*sn, Math.cos(r)];
  local.set(id, { r: qnorm(qmul(rest, t)), t: e.t });
}
// Reading and writing the hinge as a scalar. Once a joint is a true hinge its
// entire state is one number, and a 1-D signal can be median-filtered and
// rate-limited with complete confidence - which is not true of a quaternion,
// where every previous attempt at the same thing either missed the fault or
// introduced a new one.
function hingeGet(pose, k, i) {
  const ax = HINGE_AXIS[k][i]; if (!ax) return null;
  const id = idByName[LEGS[k][i]], d = qmul(qconj(restR(id)), pose.get(id).r);
  let th = 2 * Math.atan2(d[0]*ax[0] + d[1]*ax[1] + d[2]*ax[2], d[3]) * 180 / PI;
  while (th > 180) th -= 360; while (th <= -180) th += 360;
  return th;
}
function hingeSet(pose, k, i, th) {
  const ax = HINGE_AXIS[k][i]; if (!ax) return;
  const id = idByName[LEGS[k][i]], e = pose.get(id);
  const r = th * PI / 360, sn = Math.sin(r);
  pose.set(id, { r: qnorm(qmul(restR(id), [ax[0]*sn, ax[1]*sn, ax[2]*sn, Math.cos(r)])), t: e.t });
}
// Median-of-three, then a hard rate limit, on each hinge's own angle series.
// The median removes a single-frame spike outright - which no amount of
// blending towards a neighbour can, because blending a spike just shares it
// with the frames either side - and the rate limit then bounds what is left to
// what this rig's own Walk does at that joint, with headroom for faster gaits.
function hingeSmooth(poses, loop) {
  if (process.env.NOHINGE) return;
  const N = poses.length, P = loop ? N - 1 : N;
  // Only legs the IK actually solved, on every frame of the clip. A leg posed
  // directly on any frame is left entirely alone.
  const solvedAll = Object.keys(LEGS).filter((k) => poses.every((p) => p.__targets?.[k] !== null));
  for (const k of solvedAll) for (const i of [1, 2]) {
    if (!HINGE_AXIS[k][i]) continue;
    const th = []; for (let f = 0; f < P; f++) th.push(hingeGet(poses[f], k, i));
    const at = (f) => th[loop ? ((f % P) + P) % P : Math.max(0, Math.min(P-1, f))];
    const med = th.map((_, f) => { const a = [at(f-1), at(f), at(f+1)].sort((x,y)=>x-y); return a[1]; });
    const cap = HINGE_RATE[k][i];
    for (let pass = 0; pass < 24; pass++) {
      let any = false;
      for (let f = loop ? 0 : 1; f < P; f++) {
        const pf = loop ? ((f - 1) + P) % P : f - 1;
        const d = med[f] - med[pf];
        if (Math.abs(d) <= cap) continue;
        med[f] = med[pf] + Math.sign(d) * cap; any = true;
      }
      if (!any) break;
    }
    for (let f = 0; f < P; f++) hingeSet(poses[f], k, i, med[f]);
    if (loop) poses[N-1] = poses[0];
  }
}
// NOTE: joint 0 - the shoulder and hip - is deliberately NOT constrained here.
// It was tried: clamping its twist to the range the source Walk uses (only
// [-15, +15] degrees) is far tighter than the authored clips legitimately need,
// and it broke the IK solutions outright - 6 failing clips became 17, and the
// limb spin it was meant to remove got WORSE, because the clamp was fighting
// the solver rather than guiding it. The residual twist that reaches the lower
// bones through joint 0 is the honest cost of leaving it free, and it is small
// next to what constraining it did.
// A leg the CLIP posed directly is exempt from all of it.
//
// The hinge machinery exists to remove the IK's redundancy. A leg that was
// never solved has no redundancy to remove - it is authored, frame by frame,
// from smooth ramps. Worse, the range it is clamped to is measured from the
// WALK, and a sit folds the stifle far beyond anything a walk does. Applied
// blindly, the clamp folded every sit, lie, sleep, beg and bow back out to a
// standing pose - and every mechanical check passed it, because the feet were
// still on the floor and nothing span. It took a side-on render to see that
// the sitting dog was standing up. Sleep and Lie_Down reporting 0 and 3 degrees
// of total joint motion was the same fault, and read as "clean".
const solvedLegs = (p) => Object.keys(LEGS).filter((k) => p.__targets?.[k] !== null);
const hingeProjectAll = (poses) => { for (const p of poses) for (const k of solvedLegs(p)) { hingeProject(p, k, 1); hingeProject(p, k, 2); } };



// ── the trunk carries itself the way the source clips carry it ──────────
//
// Measured across the hand-made Walk, Idle and Run, the hips->chest axis sits
// between +1.8 and +4.6 degrees: this dog ALWAYS holds its chest a little above
// its hips. Every clip authored here tipped it the other way - Idle_Alert to
// -2.6, the turns to -6.4, Bark to -15.8 - and a nose-down trunk is most of
// what made them read as a different, worse-posed animal next to the source.
//
// The cause is that a clip's spine and hip pitches are chosen for what they do
// LOCALLY (drop the forehand for a sniff, lean into a bark) with no view of the
// resulting trunk angle, and they accumulate. So rather than hand-tune each
// one, the finished trunk angle is measured and brought back into range by
// rotating the two spine joints - which is where a dog's trunk angle lives.
//
// The range is per clip: a beg is meant to be near vertical and a bow is meant
// to dive, so those carry their own.
const TRUNK_RANGE = {
  Idle_Alert: [2, 6], Trot: [2, 5], Turn_Left_90: [0, 6], Turn_Right_90: [0, 6],
  Bark: [2, 12], Shake_Off: [1, 6], Tail_Wag: [1, 6], Sniff_Ground: [-9, 4],
  Jump: [-8, 22], Play_Bow: [-30, 6],   // The sit's trunk has to come UP. In the reference photograph the back rises
  // steeply from the rump to the withers - it is the single thing that makes a
  // sit read as a sit rather than a crouch - and a ceiling of 42 degrees left
  // this dog hunched. The floor matters as much as the ceiling: the trunk must
  // be lifted for most of the clip, not just permitted to be.
  Sit: [2, 62], Pee: [0, 8], Lie_Down: [0, 42],
  Beg: [-50, 4], Sleep: [4, 14],
};
let TRUNK = null;
function trunkTiltGuard(poses) {
  if (!TRUNK) return;
  const [lo, hi] = TRUNK;
  const ids = ["spine0", "spine1"].map((n) => idByName[n]).filter((i) => i != null);
  if (!ids.length) return;
  const hipsId = idByName.Hips, chestId = idByName.chest;
  const tiltOf = (p) => {
    const W = fk(p), a = W.pos.get(hipsId), c = W.pos.get(chestId);
    const d = vsub(c, a);
    return Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180 / PI;
  };
  for (const p of poses) {
    const t = tiltOf(p);
    const want = t < lo ? lo : t > hi ? hi : t;
    if (Math.abs(want - t) < 0.05) continue;
    const base = ids.map((id) => p.get(id).r.slice());
    // bisect on the spine pitch that lands the trunk where it should be
    let a = -40, b2 = 40;
    for (let it = 0; it < 14; it++) {
      const mid = (a + b2) / 2;
      ids.forEach((id, i) => p.set(id, { r: visualOn(id, base[i], { pitch: mid / ids.length }), t: p.get(id).t }));
      if (tiltOf(p) < want) a = mid; else b2 = mid;
    }
    const mid = (a + b2) / 2;
    ids.forEach((id, i) => p.set(id, { r: visualOn(id, base[i], { pitch: mid / ids.length }), t: p.get(id).t }));
  }
}



// ── the head is carried the way this dog carries it ─────────────────────
//
// Measured across the hand-made Walk, Idle and Run, the muzzle (head->chin)
// sits between -36 and -43 degrees below horizontal. That is simply where this
// model's head points when the dog is relaxed, and every clip should read as a
// variation on it.
//
// Mine did not. A sit, a beg or a bipedal stand tips the TRUNK towards vertical
// and the clip then adds neck pitch on top of that, so the two compound: the
// muzzle reached +9 on the Sit, +13 on the Beg, +16 on Walk_Two_Legs and +24 on
// the Bark - between 45 and 60 degrees above where this dog ever holds its head,
// which is why they all read as the puppy craning at the ceiling.
//
// The fix has to be stated in WORLD terms, because that is where the fault is:
// the clip says how much to bend the neck, and this says where the muzzle ends
// up regardless of what the body underneath it is doing.
const MUZZLE_RANGE = {
  Idle_Alert: [-38, -22], Trot: [-44, -32], Turn_Left_90: [-46, -26], Turn_Right_90: [-46, -26],
  Sit: [-42, -24], Lie_Down: [-44, -26],   // The head rests on the CHIN, so the muzzle has to lie roughly FLAT - close
  // to this dog's natural carriage. Allowing it down to -95 drove the nose into
  // the floor and the jaw up, which is a dog face-planting, not sleeping.
  Sleep: [-50, -30], Play_Bow: [-46, -26],
  Beg: [-58, -26], Pee: [-46, -24], Jump: [-46, -28], Bark: [-42, -14],
  // A NARROW, STEEP band, and it is this - not the clip's neck pitch - that
  // decides how low the nose gets. muzzleAimGuard re-poses neck0/neck1 to land
  // the muzzle inside this range, so whatever the clip asked the neck for is
  // overwritten: opening the band to [-46,-14] to stop the head tucking left
  // the guard free to pick a shallow aim, and it stood the nose back up at 64%
  // of a hip height. Steep aim plus an EXTENDED head (see sniffGround) gives a
  // nose on the ground with the skull carried properly, which is the posture -
  // the old [-66,-28] got the height by folding the skull under instead.
  Sniff_Ground: [-82, -72], Shake_Off: [-48, -30], Tail_Wag: [-42, -26],
};
let MUZZLE = null;
function muzzleAimGuard(poses) {
  if (!MUZZLE) return;
  // The range may be a FUNCTION of the frame, not just a constant pair. It has
  // to be: this guard re-poses the neck until the muzzle sits inside the band,
  // so a constant band pins the aim to one of its edges and holds it there -
  // which silently deletes any head rhythm the clip wrote. The sniff's 5.8 Hz
  // bob was being cancelled out frame by frame exactly this way.
  const rangeAt = typeof MUZZLE === "function" ? MUZZLE : () => MUZZLE;
  const ids = ["neck0", "neck1"].map((n) => idByName[n]).filter((i) => i != null);
  const hid = idByName.head, cid = idByName.headend;
  if (!ids.length || hid == null || cid == null) return;
  const pitchOf = (p) => {
    const W = fk(p), h = W.pos.get(hid), c = W.pos.get(cid);
    const d = vsub(c, h);
    return Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180 / PI;
  };
  poses.forEach((p, fi) => {
    const [lo, hi] = rangeAt(fi, poses.length);
    const t = pitchOf(p);
    const want = t < lo ? lo : t > hi ? hi : t;
    if (Math.abs(want - t) < 0.05) return;
    const base = ids.map((id) => p.get(id).r.slice());
    let a = -80, b2 = 80;
    for (let it = 0; it < 14; it++) {
      const mid = (a + b2) / 2;
      ids.forEach((id, i) => p.set(id, { r: visualOn(id, base[i], { pitch: mid / ids.length }), t: p.get(id).t }));
      if (pitchOf(p) < want) a = mid; else b2 = mid;
    }
    const mid = (a + b2) / 2;
    ids.forEach((id, i) => p.set(id, { r: visualOn(id, base[i], { pitch: mid / ids.length }), t: p.get(id).t }));
  });
}


// ── the sternum reaches the ground ──────────────────────────────────────
//
// Beaver (Canine Behavior, 2nd edn, ch.9) defines sternal recumbency exactly:
// "the sternum and ventral midline touch the ground. The forelimbs are directly
// in front of the dog and the rear limbs are either flexed directly below its
// normal position or extended behind the dog."
//
// So a lying dog is not simply a low dog - its CHEST is on the floor, and that
// is the single thing that separates lying down from crouching. Dropping the
// whole body to achieve it would bury the folded hind legs, so the forehand is
// lowered on its own, by pitching the spine, until the chest skin reaches the
// ground. The hind end stays where its own fold puts it.
let NOSE_REST = 0;   // datum the chin settles onto, above FLOOR
let CHIN_REST = false;   // rest the head on the forelegs instead of on a flat datum
let CROWN = null;        // target elevation of the top of the skull, degrees
let CROWN_SEED = 0;      // previous frame's answer, so the solve stays in one basin
let STERNUM = 0;   // 0..1, how much of the way down the chest should be
function sternumGuard(poses) {
  if (STERNUM <= 0) return;
  const ids = ["spine0", "spine1"].map((n) => idByName[n]).filter((i) => i != null);
  const chestOnly = new Set(["chest"].map((n) => idByName[n]).filter((i) => i != null));
  if (!ids.length || !chestOnly.size) return;
  for (const p of poses) {
    const gap = () => lowestSkin(p, null, chestOnly).y - FLOOR;
    const g0 = gap();
    if (g0 <= 0) continue;                       // already down
    const base = ids.map((id) => p.get(id).r.slice());
    let lo = 0, hi = 45;
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) / 2;
      ids.forEach((id, i) => p.set(id, { r: visualOn(id, base[i], { pitch: -mid / ids.length }), t: p.get(id).t }));
      if (gap() > 0) lo = mid; else hi = mid;
    }
    const want = hi * STERNUM;
    ids.forEach((id, i) => p.set(id, { r: visualOn(id, base[i], { pitch: -want / ids.length }), t: p.get(id).t }));
  }
}

// ── nothing is buried ───────────────────────────────────────────────────
//
// The ground clamp works on LEGS, and only on legs the IK owns. It cannot see
// a belly, a chin, an elbow or a folded paw the clip posed by hand, so a clip
// can pass every contact check with part of the dog under the floor - which is
// exactly what "partially buried" looks like on screen.
//
// This is the last word: measure the lowest SKIN on every frame and, if it is
// below the floor, raise the whole body by that much. Lift-only, so it can
// never push anything down, and it cannot disturb a frame that was already
// clear. The lift is smoothed across neighbouring frames first, because a
// correction that differs frame to frame reads as the animal twitching
// vertically even when every individual frame is correct.
function buryGuard(poses, loop) {
  const N = poses.length, P = loop ? N - 1 : N;
  // Ears excluded, same reason as the nose guard: they hang lower than anything
  // else on the head, they are soft, and a dog with its nose down rests them on
  // the ground. Lifting the whole animal to keep an ear tip clear is how the
  // sniff ended up standing upright with its nose in the air.
  const earSkip = new Set(EAR_BONES.map((n) => idByName[n]).filter((i) => i != null));
  const need = [];
  for (let f = 0; f < P; f++) {
    const y = lowestSkin(poses[f], earSkip).y;
    need.push(Number.isFinite(y) ? Math.max(0, FLOOR - y) : 0);
  }
  if (!need.some((x) => x > 1e-9)) return 0;
  // widen each correction over its neighbours so the lift changes smoothly
  const sm = need.map((_, f) => {
    let m = 0;
    for (let d = -2; d <= 2; d++) {
      const i = loop ? ((f + d) % P + P) % P : Math.max(0, Math.min(P - 1, f + d));
      m = Math.max(m, need[i] * (1 - Math.abs(d) * 0.12));
    }
    return m;
  });
  let n = 0;
  for (let f = 0; f < P; f++) if (sm[f] > 1e-9) { liftBody(poses[f], sm[f]); n++; }
  if (loop) poses[N - 1] = poses[0];
  globalThis.__buryLift = sm;                 // the re-plant pass undoes exactly this
  return n;
}

// ── how the head is CARRIED ─────────────────────────────────────────────
//
// MUZZLE_RANGE measures the head->headend vector, and headend is the JAW bone.
// That is a usable proxy for most clips and a bad one for a sniff, because the
// muzzle geometry hangs well below the jaw joint: the head can read -48 on that
// measure while the skull itself is rotated past vertical. Measured on the
// sniff, the crown of the head pointed 29 degrees BELOW horizontal for half the
// clip - the head rolled over nose-first, which is exactly the crown-forward
// burial the renders kept showing.
//
// So this guard measures the thing that actually reads on screen: the direction
// the top of the skull points, taken from the head's own skin rather than from
// a bone axis, and solves the HEAD's pitch to carry it at a chosen angle. It
// leaves the neck alone, so height and carriage stop fighting each other -
// the neck puts the head where it goes, this decides which way it faces.
const CROWN_DIR = (() => {
  // The local direction that points WORLD-UP when the dog is simply standing.
  // Taking the topmost skin point instead was tried and is not the same thing -
  // the highest vertex of the head at rest sits well back on the skull, so the
  // vector it gives is tilted and the guard converges on its own definition
  // while the head on screen is still rolled over. Rest-up is unambiguous: if
  // the standing pose carries the head correctly, then "where rest-up now
  // points" IS the carriage.
  const id = idByName.head;
  const r = standW.rot.get(id);
  if (!r) return null;
  return qrot(qconj(r), UP);
})();
function headCarriageGuard(poses, loop) {
  if (CROWN === null || !CROWN_DIR) return 0;
  const id = idByName.head;
  const N = poses.length, P = loop ? N - 1 : N;
  if (!P) return 0;
  // ONE correction, applied to every frame.
  //
  // Solving per frame was tried three ways - cold, seeded from the previous
  // frame, and seeded with a per-frame rate limit - and all three jitter,
  // because Newton is finding the angle that hits the target on THIS frame's
  // base pose and the base moves under it as the neck bobs. The answer swung 59
  // degrees between neighbouring frames against 2.8 for the same bone with the
  // guard off, and rate-limiting the swing just let the seed walk away over 144
  // frames until the head was upside down.
  //
  // None of that work was necessary. The target carriage is a constant, so the
  // correction is very nearly a constant too: solve it once, on the middle of
  // the clip, and add it to every frame. The clip's own head rhythm is in each
  // frame's base pose and survives untouched, because this rotates from that
  // base rather than replacing it. A constant cannot jitter.
  const probe = poses[Math.floor(P / 2)];
  const pbase = probe.get(id).r.slice();
  const elevOf = (p) => {
    const w = qrot(fk(p).rot.get(id), CROWN_DIR);
    return Math.asin(Math.max(-1, Math.min(1, w[1]))) * 180 / PI;
  };
  const setProbe = (deg) => probe.set(id, { r: visualOn(id, pbase, { pitch: deg }), t: probe.get(id).t });
  let deg = 0, best = 0, bestErr = Math.abs(elevOf(probe) - CROWN);
  for (let it = 0; it < 14 && bestErr > 0.2; it++) {
    setProbe(deg);
    const e0 = elevOf(probe) - CROWN;
    setProbe(deg + 3);
    const slope = (elevOf(probe) - CROWN - e0) / 3;
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-6) break;
    let step = Math.max(-30, Math.min(30, -e0 / slope));
    let ok = false;
    for (let bt = 0; bt < 5 && !ok; bt++) {
      const cand = Math.max(-110, Math.min(110, deg + step));
      setProbe(cand);
      const e = Math.abs(elevOf(probe) - CROWN);
      if (e < bestErr) { bestErr = e; best = cand; deg = cand; ok = true; } else step *= 0.4;
    }
    if (!ok) break;
  }
  setProbe(0);
  if (Math.abs(best) < 0.01) return 0;
  for (let f = 0; f < P; f++) {
    const p = poses[f], b0 = p.get(id).r.slice();
    p.set(id, { r: visualOn(id, b0, { pitch: best }), t: p.get(id).t });
  }
  if (loop) poses[N - 1] = poses[0];
  console.log(`    [crown] head carriage corrected by ${best.toFixed(1)} deg (target ${CROWN}, residual ${bestErr.toFixed(1)})`);
  return P;
}

// ── rest the chin ON the forelegs ───────────────────────────────────────
//
// Runs LAST, and it has to, because the two guards above both own the neck for
// other reasons and would undo it: muzzleAimGuard re-poses neck0/neck1 to hit a
// muzzle ANGLE, noseFloorGuard re-poses them to keep the head's skin off a flat
// floor datum. Neither can express "put the underside of the jaw down on top of
// whatever is underneath it", and a flat datum is the wrong shape for the job -
// the thing the head is meant to land on is a leg, and the leg's height is
// whatever the limb solve gave it.
//
// So the foreleg's top surface is MEASURED directly beneath where the chin
// actually is, and the neck is then bent until the head's own lowest skin sits
// on it. Measured on the sleep before this: the chin floated 0.156 above the
// forearm - visibly a dog holding its head up next to its legs rather than
// resting on them.
function chinRestGuard(poses, loop) {
  if (!CHIN_REST) return 0;
  const N = poses.length, P = loop ? N - 1 : N;
  const ids = ["neck0", "neck1"].map((n) => idByName[n]).filter((i) => i != null);
  const head = new Set(HEAD_GROUP.map((n) => idByName[n]).filter((i) => i != null));
  const fore = new Set([...LEGS.LF, ...LEGS.RF].map((n) => idByName[n]).filter((i) => i != null));
  if (!ids.length || !head.size) return 0;
  let n = 0, moved = 0;
  for (let f = 0; f < P; f++) {
    const p = poses[f];
    const base = ids.map((id) => p.get(id).r.slice());
    const setNeck = (deg) => ids.forEach((id, i) =>
      p.set(id, { r: visualOn(id, base[i], { pitch: deg / ids.length }), t: p.get(id).t }));
    const chin = () => lowestSkin(p, null, head).y;
    // The target is MEASURED ONCE and then held. Re-measuring it inside the
    // loop makes it a moving target - the chin's own z is what selects which
    // slice of leg to measure, so every step changed what the step was aiming
    // at, and the solve walked the head backwards up the dog until it was
    // measuring the elbow and sitting 0.9 above it.
    const target = (() => {
      const W = fk(p);
      const top = highestSkin(p, fore, W.pos.get(idByName.headend)[2]);
      // A leg top below the floor is not a leg: it means the window caught
      // nothing useful, and a flat foreleg's thickness is the honest fallback.
      return (Number.isFinite(top) && top > FLOOR + 0.008) ? top : FLOOR + 0.030;
    })();
    let deg = 0, best = 0, bestErr = Math.abs(chin() - target);
    for (let it = 0; it < 10 && bestErr > 0.0008; it++) {
      setNeck(deg);
      const e0 = chin() - target;
      setNeck(deg + 2);
      const slope = (chin() - target - e0) / 2;
      if (!Number.isFinite(slope) || Math.abs(slope) < 1e-7) break;
      let step = Math.max(-25, Math.min(25, -e0 / slope));
      let ok = false;
      for (let bt = 0; bt < 4 && !ok; bt++) {
        const cand = Math.max(-70, Math.min(70, deg + step));
        setNeck(cand);
        const e = Math.abs(chin() - target);
        if (e < bestErr) { bestErr = e; best = cand; deg = cand; ok = true; } else step *= 0.4;
      }
      if (!ok) break;
    }
    setNeck(best);
    if (Math.abs(best) > 0.01) { n++; moved = Math.max(moved, Math.abs(best)); }
  }
  if (loop) poses[N - 1] = poses[0];
  if (n) console.log(`    [chin] rested on the forelegs over ${n} frames (up to ${moved.toFixed(0)} deg of neck)`);
  return n;
}

// ── put the POSED limbs back flat on the floor after the guards ─────────
//
// replantGuard's counterpart, for limbs a clip lays out by angle rather than by
// IK. buryGuard translates the whole root, so a foreleg that was solved flat on
// the floor gets carried up with the body and nothing puts it back - the
// planted legs come down again because replantGuard re-solves them to their
// targets, and a posed leg has no target to be re-solved to.
//
// Measured on the sleep, where the extended hind thigh forces a large lift: the
// forepaws ended up at 131% of a hip height, HIGHER than the hips themselves,
// pointing into the air, with the chin at 77% sitting underneath the legs it is
// supposed to be resting on.
//
// Each frame's solve was recorded as it was authored, so the fix is to run the
// same solves again against the body's final position. The seeds are cleared
// first: they are left pointing at the last frame of the authoring pass, and
// starting a replay at frame 0 from a frame-120 seed is exactly the cold-start
// jump the seeding exists to avoid.
function flatLimbGuard(poses, loop) {
  // SLEEP ONLY. The replay is right for a limb that is meant to lie on the
  // floor for the whole clip and was carried off it by a body-wide lift. It is
  // wrong for the stretch: that clip BLENDS into its pose, the blend is what
  // ramps the limb down, and re-running the solve against the final body folded
  // the forelegs back under the chest - the stretch turned into a crouch.
  if (!FLAT_REPLAY) return 0;
  if (!FLAT_LIMB_LOG.length) return 0;
  const N = poses.length, P = loop ? N - 1 : N;
  FLAT_SEED.clear();
  globalThis.__flatReplay = true;
  let n = 0;
  for (let f = 0; f < P; f++) {
    const specs = FLAT_LIMB_LOG[f];
    if (!specs) continue;
    const p = poses[f], Pz = poser(p);
    for (const sp of specs) { layLimbFlat(p, Pz, sp.chainNames, sp.seeds, sp.extra, sp.blend, sp.range); n++; }
  }
  globalThis.__flatReplay = false;
  if (loop) poses[N - 1] = poses[0];
  if (n) console.log(`    [flat] ${n} posed limb-frames re-laid on the floor after the guards`);
  return n;
}

// ── put the planted paws BACK on the floor after the guards ─────────────
//
// buryGuard lifts the WHOLE animal - it translates the root - and it runs last,
// so any clip whose trunk, chin or elbow dips below the floor has its already
// planted paws carried up into the air with the body. Nothing downstream put
// them back, and the size of it was not small: on the stretch the guard was
// lifting the dog 53% of a hip height, which left all four paws hanging while
// the belly rested on the ground. It read exactly as reported - "back leg is
// not touching ground when stretching".
//
// Each frame already records the targets it solved for, and those targets are
// world-space points on the floor, so re-solving the planted legs to the SAME
// targets after the lift puts the paws back down without disturbing anything
// the guards did to the trunk or the head. A leg that genuinely cannot reach
// its target is left alone by the reach clamp inside solveLeg, as before.
function replantGuard(poses, loop) {
  const N = poses.length, P = loop ? N - 1 : N;
  const lift = globalThis.__buryLift;
  globalThis.__buryLift = null;
  let n = 0, worst = 0;
  for (let f = 0; f < P; f++) {
    // Frames the bury guard lifted, plus whatever legs the clip has asked to be
    // pressed down unconditionally. Running it over EVERY frame was tried and
    // is a menace: on Walk, Trot and both turns it re-solves stance legs that
    // were already right, and the re-solve straightens them enough to put an
    // elbow through the floor on a third of the frames.
    const lifted = lift ? lift[f] > 0.002 : false;
    if (!lifted && !REPLANT_FORCE.size) continue;
    const p = poses[f], tg = p.__targets;
    if (!tg) continue;
    for (const k of PLANTED_LEGS) {
      if (!lifted && !REPLANT_FORCE.has(k)) continue;
      const at = tg[k];
      // ONLY targets that are ON the floor. This filter is what makes the pass
      // safe to run everywhere: a target above the floor belongs to a swinging
      // leg, and a swinging leg is supposed to be in the air. The first version
      // of this had no such test, re-solved every planted leg on every frame,
      // and put toes through the floor on Walk, Trot and both turns - clips
      // that had nothing wrong with them.
      //
      // buryGuard is not the only thing that moves the body after the legs are
      // solved - applySecondary's weight shift and breathing do too - which is
      // what REPLANT_FORCE is for, per clip and per leg.
      if (!at || at[1] > GROUND + 0.002) continue;
      const off = fk(p).pos.get(idByName[LEGS[k][3]])[1] - at[1];
      if (off < 0.0015) continue;
      worst = Math.max(worst, off);
      // ONE pass. Iterating was tried and DIVERGES: the anatomical fold guard
      // inside solveLeg rotates the chain back onto its legal side after each
      // solve, so a second pass starts from a pose the first one has already
      // been corrected out of, and the residual grew 9% -> 33% -> worse.
      solveLeg(p, k, at); n++;
    }
    // the pad has to be put back flat: solveLeg targets the paw bone's ORIGIN
    // and leaves its orientation to whatever the chain happened to produce.
    levelHooves(p, tg);
  }
  if (loop) poses[N - 1] = poses[0];
  if (n) console.log(`    [replant] ${n} paw-frames put back on the floor (worst was ${(100*worst/HIP_H).toFixed(0)}% of hip height up)`);
  return n;
}

// ── the nose stops at the floor ─────────────────────────────────────────
//
// A sniff wants the muzzle as low as it will go. How low that IS cannot be
// written as an angle: `headend` is a JOINT and the muzzle geometry hangs well
// below it, so the chin can read 44% of a hip height up while the nose is 37%
// through the ground. Tuning the neck angle against the joint is measuring the
// wrong thing - the same mistake as the buffalo's phantom headend - and tuning
// it by eye means re-tuning it whenever the body height changes.
//
// So the clip asks for MORE neck bend than can possibly fit, and this takes it
// back to the largest amount that keeps the head's own skin above the floor.
// The nose then rests on the ground by construction, at whatever body height
// the rest of the pose happens to produce.
// The EARS are deliberately not in this list. They are the lowest thing on the
// head - they hang below the muzzle - so including them made the guard raise
// the head until the EAR TIPS cleared the floor, which lifted the nose right
// back up: the sniff stopped reaching the ground at all, with the chin sitting
// at 95% of hip height while the chest was down at 75%. A sniffing dog's ears
// touch the ground, and should.
const HEAD_GROUP = ["head", "headend", "tongue"];
const EAR_BONES = ["earend", "R_earend", "earTipL", "earTipR"];
function noseFloorGuard(poses, loop = false) {
  const only = new Set(HEAD_GROUP.map((n) => idByName[n]).filter((i) => i != null));
  const ids = ["neck0", "neck1"].map((n) => idByName[n]).filter((i) => i != null);
  if (!only.size || !ids.length) return 0;
  const N = poses.length, P = loop ? N - 1 : N;
  const datum = FLOOR + NOSE_REST;
  // MEASURE every frame first, then SMOOTH, then apply.
  //
  // Applying per frame independently makes this an on/off switch: a nose that
  // bobs across the datum - which is exactly what a sniff does, at 5.8 Hz - gets
  // a large correction on one frame and none on the next. Measured on the
  // sniff, that put 28 degree single-frame steps into BOTH cervical joints at
  // once, on the two frames where the bob crossed the line. buryGuard already
  // widens its correction over its neighbours for the same reason; this does
  // the same, so the guard raises the head over several frames instead of
  // snapping it on one.
  const need = new Array(P).fill(0);
  const bases = [];
  for (let f = 0; f < P; f++) {
    const p = poses[f];
    const base = ids.map((id) => p.get(id).r.slice());
    bases.push(base);
    if (lowestSkin(p, null, only).y >= datum) continue;
    let lo = 0, hi = 90;
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) / 2;
      ids.forEach((id, i) => p.set(id, { r: visualOn(id, base[i], { pitch: mid }), t: p.get(id).t }));
      if (lowestSkin(p, null, only).y >= datum) hi = mid; else lo = mid;
    }
    need[f] = hi;
    ids.forEach((id, i) => p.set(id, { r: base[i].slice(), t: p.get(id).t }));  // put it back for now
  }
  if (!need.some((x) => x > 1e-9)) return 0;
  const sm = need.map((_, f) => {
    let m = 0;
    for (let d = -3; d <= 3; d++) {
      const i = loop ? ((f + d) % P + P) % P : Math.max(0, Math.min(P - 1, f + d));
      m = Math.max(m, need[i] * (1 - Math.abs(d) * 0.10));
    }
    return m;
  });
  let fixed = 0;
  for (let f = 0; f < P; f++) {
    if (sm[f] <= 1e-9) continue;
    const p = poses[f];
    ids.forEach((id, i) => p.set(id, { r: visualOn(id, bases[f][i], { pitch: sm[f] }), t: p.get(id).t }));
    fixed++;
  }
  if (loop) poses[N - 1] = poses[0];
  return fixed;
}

// Leg stabilisation: a hard per-frame angular RATE LIMIT on the structural leg
// joints, with the IK re-solved inside the loop.
//
// Two distinct faults showed up in the raw solve, and they need separating
// because only one of them is what it looks like:
//
//   - AXIAL TWIST. Run's backleg0 rotated 167 degrees between two frames while
//     the bone's DIRECTION moved 14. The rest is spin about the bone's own
//     length, which moves no joint - so contact, sliding and penetration checks
//     all stay green - and rotates the skinned limb on screen.
//   - GENUINE FLIPS. Bark's frontleg1 changed DIRECTION by 128 degrees in a
//     frame: the elbow snapping between two IK solutions that reach the same
//     paw position.
//
// Both are bounded by the same thing: no structural leg joint in this rig's own
// source Walk moves more than about 32 degrees in a frame. So each frame is
// pulled back towards the previous one until it is inside that budget, and then
// re-solved - seeded from the limited pose, which keeps the solver in the basin
// the previous frame established rather than letting it re-pick one. Limiting
// alone would drag the paw off target; re-solving alone was tried and does not
// hold, because a warm start still lets CCD leave the basin. The two together
// do, and the result is checked rather than assumed.
function stabiliseLegs(poses, loop, fn, period) {
  if (process.env.NORATE) return;
  const N = poses.length;
  const limit = (f, pf) => {
    let changed = false;
    for (const id of LEG_STRUCT_IDS) {
      const leg = Object.keys(LEGS).find((k) => LEGS[k].includes(nName(id)));
      if (poses[f].__targets?.[leg] === null) continue;
      const a = poses[pf].get(id).r, b = poses[f].get(id).r;
      const d = qangDeg(a, b);
      if (d <= FLIP_DEG) continue;
      poses[f].set(id, { r: qnorm(slerp(a, b, FLIP_DEG / d)), t: poses[f].get(id).t });
      changed = true;
    }
    return changed;
  };
  // In a looping clip the last frame is a MIRROR of the first, not a frame in
  // its own right, so it is excluded and frame 0 is instead constrained against
  // frame N-2 - the frame that actually precedes it around the loop.
  const seq = [];
  for (let f = 1; f < (loop ? N-1 : N); f++) seq.push([f, f-1]);
  if (loop) seq.push([0, N-2]);
  for (let lap = 0; lap < (loop ? 3 : 2); lap++) {
    for (const [f, pf] of seq) {
      for (let it = 0; it < 3; it++) {
        if (!limit(f, pf)) break;
        poses[f] = solveFrame(poses[f], loop ? f % period : f, period, fn);
      }
    }
    if (loop) poses[N-1] = poses[0];
  }
  rateLimitLegs(poses, loop);
}
// Pure limiting, no re-solve, iterated until the bound holds everywhere.
// Constraining frame 0 last means frame 1 was fixed against a value that then
// changed, so one sweep does not converge; limiting only ever moves adjacent
// frames closer together, so iterating it does, and it can never re-introduce a
// flip. This runs LAST in the pipeline because two later passes would otherwise
// undo it: smoothing slerps across frames, and enforceExtension reverts a whole
// frame's leg to its pre-smoothing pose - which reopens a gap the frames either
// side of it do not have. Measured on the Trot, that pair turned a stabilised
// 108 degrees per frame back into 176.
// The cap is a RATE, not a per-frame budget.
//
// FLIP_DEG was learned from the source Walk at 30 fps, so it is "degrees per
// 1/30 s" even though it is spent per frame. Author a clip at 60 fps and the
// same number lets every leg travel twice as far per second - which is not a
// stricter limiter, it is a looser one. Measured when the tail wag was doubled:
// the left foreleg went from 393 to 537 deg/s on a clip where the dog is simply
// standing, and doubling the shake's rate pushed its stance outside the source
// envelope entirely. Scaling by the clip's own sample rate keeps the limit
// meaning the same thing in seconds whatever the clip is sampled at.
function rateLimitLegs(poses, loop, cap = FLIP_DEG) {
  cap *= FPS / CLIP_FPS;
  if (process.env.NORATE) return;
  const N = poses.length;
  const seq = [];
  for (let f = 1; f < (loop ? N-1 : N); f++) seq.push([f, f-1]);
  if (loop) seq.push([0, N-2]);
  for (let pass = 0; pass < 24; pass++) {
    let any = false;
    for (const [f, pf] of seq) {
      for (const k of Object.keys(LEGS)) {
       if (poses[f].__targets?.[k] === null) continue;
       for (const id of LEGS[k].slice(0,3).map((n) => idByName[n])) {
        const a = poses[pf].get(id).r, b = poses[f].get(id).r;
        const d = qangDeg(a, b);
        if (d <= cap) continue;
        poses[f].set(id, { r: qnorm(slerp(a, b, cap / d)), t: poses[f].get(id).t });
        any = true;
       }
      }
    }
    if (loop) poses[N-1] = poses[0];
    if (!any) break;
  }
}

function buildClip(frames, fn, loop) {
  // Cold, history-free solve. The leg IK is a deterministic function of the
  // target and body pose, so two frames at the same gait phase produce the
  // same pose — which makes a loop periodic in pose and velocity with no
  // special seam handling. Warm-starting was tried and rejected: it removed
  // planted-foot jitter but never settled a fast gait onto a clean period.
  const out = []; const period = frames - 1;
  // Sequential, so the envelope guard can see where the previous frame put the
  // limb. A looping clip runs the sweep twice: the first lap starts from a cold
  // envelope state, the second starts from the state the first lap ended in, so
  // frame 0 is solved under the same history as the frame that precedes it.
  ENV_PREFER = new Map();
  for (let lap = 0; lap < (loop ? 2 : 1); lap++) {
    out.length = 0;
    for (let f=0; f<frames; f++) out.push(solveFrame(null, loop ? f % period : f, period, fn));
  }
  // Close the loop exactly. Frame N-1 and frame 0 are the same gait phase, so
  // any difference between them is history, not animation.
  if (loop) out[frames-1] = out[0];
  stabiliseLegs(out, loop, fn, period);
  if (process.env.STAGE) { const w=(p)=>{let m=0,mb="",mf=0;
    for(let f=1;f<p.length;f++) for(const id of LEG_STRUCT_IDS){const d=qangDeg(p[f-1].get(id).r,p[f].get(id).r); if(d>m){m=d;mb=nName(id);mf=f;}}
    return `${m.toFixed(0)}° ${mb}@f${mf}`;};
    console.log(`\n    [stage] after cold solve: ${w(out)}`); globalThis.__w=w; }
  // The cold solve is deterministic but not CONTINUOUS. Near a singularity - a
  // nearly-straight limb, or a target at the edge of reach - two adjacent
  // frames with near-identical targets can converge into different IK basins,
  // and the elbow snaps through 180 degrees in a single frame while the paw
  // stays exactly where it belongs. Contact and sliding QA are blind to it
  // because the foot never moves; it is only visible as a per-frame angular
  // step no real leg makes. Measured in this rig's own source Walk, no leg
  // joint moves more than FLIP_DEG in a frame, so anything past that is the
  // solver, not the animation.
  const preSmooth = out.map((p) => new Map(LEG_BONE_IDS.map((id) => [id, p.get(id).r.slice()])));
  smoothLegRotations(out, loop);
  enforceExtension(out, preSmooth);
  if (process.env.STAGE) console.log(`    [stage] after smoothing   : ${globalThis.__w(out)}`);
  // The final pass runs on a LOOSER cap than the solve-time one. Enforcing the
  // tight bound here means pulling a paw off the target the IK put it on, after
  // the hoof levelling has already committed to that contact - measured, that
  // put 1-3 frames of several fast clips through the floor. The job of this
  // pass is not to hit 70 degrees; it is to guarantee nothing SPINS. At 1.5x
  // the bound it intervenes on a handful of frames instead of hundreds, drags
  // no paw far enough to break contact, and still makes a 180 degree flip
  // impossible.
  // The last two constraints fight each other, so they are alternated rather
  // than applied in sequence.
  //
  //   - the RATE BOUND stops a limb spinning, but holds a frame towards its
  //     neighbour, which drags the paw off the contact the IK committed to;
  //   - the GROUND CLAMP restores that contact by re-solving the leg, which is
  //     free to pick a different IK basin and put the spin straight back.
  //
  // Applied once each, whichever ran last won: clamp-last gave 100% contact and
  // 179 degree limb spins, bound-last gave clean limbs and feet through the
  // floor. Each pass only touches what still violates its own constraint, so
  // both do less work every round and alternating them converges.
  // Level the paws FIRST. relevelHooves rotates the pad flat, and rotating a
  // paw can tip its geometry back under the floor - so running it after the
  // ground clamp reopened, on the turns, exactly the dip the clamp had closed.
  for (const p of out) relevelHooves(p, p.__level);
  // The clamp works on the leg's SKIN, not just on its paw joint.
  //
  // Checking the joint alone leaves the geometry hanging below it - the pads,
  // the fur, and on a swinging limb the forearm - so a leg could sit perfectly
  // on its target and still have 15% of a hip height of dog through the floor.
  // Raising the target by exactly how far the skin is under puts the whole limb
  // above the ground in one step, and it only fires on the legs that need it.
  const groundClamp = () => { let n = 0;
    // A looping clip's last frame is a duplicate of its first, so it is skipped
    // and re-copied at the end. Clamping it as an independent frame is what
    // tore the Walk's seam open by 132 degrees per frame.
    const last = loop ? out.length - 1 : out.length;
    for (let fi = 0; fi < last; fi++) { const p = out[fi];
      for (const k in hoofId) {
        if (p.__targets?.[k] === null) continue;
        const only = new Set(LEGS[k].map((nm) => idByName[nm]).filter((i) => i != null));
        const y = lowestSkin(p, null, only).y;
        // A DEADBAND, and it matters. A planted paw's skin sits within rounding
        // of FLOOR by definition - FLOOR is where the Walk's paws are - so a
        // zero-tolerance test fires on every planted leg on every pass and
        // nudges it up a fraction each time. Iterated five times that walked
        // every foot clear of the ground: contact went from 100% to 0% while
        // the grounding report looked immaculate, because nothing was under the
        // floor any more - it was all above it.
        if (!Number.isFinite(y) || y >= FLOOR - 0.02*HIP_H) continue;
        const at = fk(p).pos.get(hoofId[k]);
        solveLeg(p, k, [at[0], at[1] + (FLOOR - y), at[2]]); n++;
      }
    }
    if (n) { if (loop) out[out.length-1] = out[0]; return n; }
    // ...then the original joint-level guard, for anything the skin pass left.
    for (let fi = 0; fi < last; fi++) { const p = out[fi]; const W = fk(p);
      for (const k in hoofId) {
        // A leg the clip posed DIRECTLY - folded under a sitting, sleeping or
        // begging dog - has no ground target and must not be dragged towards
        // one. Clamping those un-folded the sleeping puppy's legs and took its
        // contact from 100% to 64%.
        if (p.__targets?.[k] === null) continue;
        const at = W.pos.get(hoofId[k]);
        if (at[1] >= GROUND + 0.0008) continue;
        solveLeg(p, k, [at[0], GROUND + 0.0008, at[2]]); n++;
      } }
    if (loop) out[out.length-1] = out[0];
    return n; };
  hingeProjectAll(out); hingeSmooth(out, loop);
  rateLimitLegs(out, loop, FLIP_DEG * 1.5);
  for (let round = 0; round < 6; round++) {
    if (!groundClamp()) break;
    hingeProjectAll(out); hingeSmooth(out, loop);
    rateLimitLegs(out, loop, FLIP_DEG * 1.5);
  }
  // ...and the clamp gets the last word, iterated: raising one leg shifts the
  // body's lowest point to another, so a single pass leaves a frame or two. The alternation above ends on the rate
  // limit, which pulls each frame back towards its neighbour and can drag a paw
  // under the floor again on the very last pass. A foot a millimetre out of
  // continuity is a far smaller fault than a foot through the ground.
  // EVERY clip gets the same final treatment, loops included - exempting loops
  // left the clips resting on different foot planes, which in a game is the dog
  // visibly bobbing on every transition.
  //
  // The two constraints are alternated and the RATE LIMIT gets the last word.
  // Letting the clamp finish was tried: it re-solves a leg from scratch, is free
  // to pick a different IK basin, and put 179-degree single-frame steps back
  // into the Walk - a hind leg spinning right round once per loop, on the clip
  // that plays more than any other. The clamp's own residue is a foot a
  // centimetre low on a handful of frames. A dip that size is invisible; a limb
  // spinning is the first thing anyone sees.
  for (let i = 0; i < 4; i++) {
    if (!groundClamp()) break;
    rateLimitLegs(out, loop, FLIP_DEG * 1.5);
  }
  rateLimitLegs(out, loop, FLIP_DEG);
  // A ONE-SHOT has no loop seam to protect, so the clamp gets the last word
  // there and any paw still under the floor is simply lifted out. A LOOP keeps
  // the rate limit last, because a pop every cycle is worse than a millimetre.
  if (!loop) for (let i = 0; i < 3 && groundClamp(); i++);
  // Re-close the loop. Everything above works frame by frame, and a looping
  // clip's last frame is a DUPLICATE of its first - so processing the two
  // independently lets them drift apart, which reads as a pop at the seam even
  // though each frame is individually correct. Measured on the Walk: a 132
  // degree per-frame velocity gap at backleg0 from nothing else.
  if (loop) out[out.length-1] = out[0];
  applySecondary(out, loop);
  trunkTiltGuard(out);
  sternumGuard(out);
  muzzleAimGuard(out);
  headCarriageGuard(out, loop);
  noseFloorGuard(out, loop);
  // LAST of everything. The body guards above move the trunk and the head after
  // the legs have been grounded, so anything that checks for burial has to run
  // after them - sitting it with the leg passes meant the sternum guard could
  // lower the chest, and the forelegs with it, with nothing left to lift them
  // back out. That put Lie_Down 87% of a hip height into the floor.
  buryGuard(out, loop);
  replantGuard(out, loop);
  flatLimbGuard(out, loop);
  chinRestGuard(out, loop);
  // RE-CLOSE THE LOOP, unconditionally and last.
  //
  // The loop is closed once before the secondary and the guards run, and each
  // guard that touches a looping clip closes it again on its way out - except
  // that buryGuard returns EARLY when nothing needs lifting, before it gets
  // there. So on any looping clip that does not trip the bury guard, every
  // guard after the first closure was free to move frame 0 without frame N-1
  // following. Measured on the sniff: a 93 degree jump in the head between the
  // last frame and the first, once per cycle, on a clip whose largest genuine
  // step is 28.
  if (loop) out[out.length - 1] = out[0];
  if (process.env.STAGE) console.log(`    [stage] after secondary   : ${globalThis.__w(out)}`);
  if (SETTLE) {
    // LIFT-ONLY, and nothing else.
    //
    // What stood here was the buffalo's DEATH settle, which drops the barrel to
    // the floor and then searches for the head roll that lays the cheek on the
    // ground. Inherited unchanged it would have laid the puppy's face flat
    // through a Sit and a Beg. A dog folding its legs needs one thing from the
    // floor: not to go through it. So the body is raised by exactly however far
    // the lowest skin is below the floor and is never pushed down, which cannot
    // disturb a pose that was already clear.
    for (const p of out) {
      const up = FLOOR - lowestSkin(p).y;
      if (up > 1e-9) liftBody(p, up);
    }
  }
  // NOTE: no post-smoothing envelope pass. Re-clamping after smoothing does
  // drive the joint-envelope violations to zero, but the correction rotates the
  // limb about its own root->hoof axis - which moves no hoof, so contact and
  // sliding cannot see it - and choosing that rotation per frame put a ~180 deg
  // single-frame world spin into EVERY clip (source Walk's worst: 78 deg).
  // A continuity term did not fix it: any weight strong enough to hold the
  // rotation steady is strong enough to accept the violation it exists to stop.
  // Leaving the small residual violations is the better trade, and they are
  // reported rather than hidden.
  return out;
}

// The cold solve leaves the LEG joints twitching frame-to-frame: two adjacent
// frames reach the same planted hoof through slightly different knee/elbow
// splits, so the hoof stays put (sliding QA passes) but the bones jerk — a
// visible buzz in real-time playback that a still frame never shows. A light
// loop-aware low-pass on the leg-bone rotations alone removes the single-frame
// spikes while leaving the gait's shape, the body, and foot contact intact.
// The smoothing pass slerps across frames, and an average of two bent poses can
// come out STRAIGHTER than either — enough to push a leg to full extension that
// the per-frame reach clamp had properly prevented. Any frame that ends up over
// its cap is simply given its pre-smoothing rotations back for that leg: those
// already respected the clamp, so the guard can only ever reduce extension.
// The smoothing pass slerps across frames and can nudge a joint back across the
// anatomical line on isolated frames, undoing the guard the solve applied. This
// re-applies the same axis rotation to the finished poses — hoof position is
// preserved exactly, so nothing else can regress.
function enforceFold(poses) {
  for (const p of poses) {
    for (const k in hoofId) {
      const chain = LEGS[k].map((n) => idByName[n]);
      for (let i = 0; i < 2; i++) {
        const W = fk(p);
        const a = W.pos.get(chain[i]), hoof = W.pos.get(chain[3]);
        const span = vsub(hoof, a); const L = vlen(span);
        if (L < 1e-6) continue;
        let full = 0; for (let j = 0; j < 3; j++) full += vlen(vsub(W.pos.get(chain[j+1]), W.pos.get(chain[j])));
        const chainExt = vlen(vsub(W.pos.get(chain[3]), W.pos.get(chain[0]))) / (full || 1);
        if (chainExt > 0.93) continue;   // same gate the anatomy QA uses
        const axis = vscale(span, 1 / L);
        const v = vsub(W.pos.get(chain[i+1]), a);
        const perp = vsub(v, vscale(axis, vdot(v, axis)));
        if (vlen(perp) < 1e-7) continue;
        const cur = vnorm(perp);
        const back = vscale(FWD, -1);
        let want = vsub(back, vscale(axis, vdot(back, axis)));
        if (vlen(want) < 1e-7) continue;
        want = vnorm(want);
        const d = Math.max(-1, Math.min(1, vdot(cur, want)));
        const ang = Math.acos(d) * 180 / Math.PI;
        if (ang < 1) continue;
        const sgn = vdot(vcross(cur, want), axis) < 0 ? -1 : 1;
        const q = qaxis(vscale(axis, sgn), ang);
        const jb = chain[i];
        const parentRot = W.rot.get(parent.get(jb)) ?? [0,0,0,1];
        const c0 = p.get(jb);
        p.set(jb, { r: qnorm(qmul(qmul(qmul(qconj(parentRot), q), parentRot), c0.r)), t: c0.t });
      }
    }
  }
}
function enforceExtension(poses, preSmooth) {
  for (let f = 0; f < poses.length; f++) {
    for (const k in hoofId) {
      const chain = LEGS[k].map((n) => idByName[n]);
      const cap = (REACH_CAP[k] ?? (planted(k) ? 0.94 : 0.97)) + 0.01;
      const W = fk(poses[f]);
      const ext = vlen(vsub(W.pos.get(chain[3]), W.pos.get(chain[0]))) / LEG_REACH[k];
      if (ext > cap) for (const id of chain) poses[f].get(id).r = preSmooth[f].get(id).slice();
    }
  }
}
function smoothLegRotations(poses, loop) {
  const N = poses.length; if (N < 3) return;
  const P = loop ? N - 1 : N;                  // real period (last frame duplicates the first when looping)
  const passes = 1;                            // one gentle 3-tap: kills single-frame spikes without smearing the gait
  for (let pass = 0; pass < passes; pass++) {
    const src = poses.map((p) => new Map(LEG_BONE_IDS.map((id) => [id, p.get(id).r.slice()])));
    const at = (f) => (loop ? ((f % P) + P) % P : Math.max(0, Math.min(N - 1, f)));
    const end = loop ? P : N;
    for (let f = 0; f < end; f++) {
      if (!loop && (f === 0 || f === N - 1)) continue;   // keep one-shot endpoints exact
      for (const id of LEG_BONE_IDS) {
        const a = src[at(f - 1)].get(id), b = src[f].get(id), c = src[at(f + 1)].get(id);
        poses[f].get(id).r = qnorm(slerp(b, slerp(a, c, 0.5), 0.5));  // [0.25, 0.5, 0.25]
      }
    }
    if (loop) for (const id of LEG_BONE_IDS) poses[N - 1].get(id).r = poses[0].get(id).r.slice();
  }
}

// gait: place each hoof on the Walk's own arc, phase-shifted and scaled.
// A locomotion cycle authored in place still has to move its feet the way a
// real one does. Measured on the source Walk: a planted hoof travels BACKWARD
// 0.104 over its 16 stance frames, because the ground is not moving and the
// body is. The previous version pinned the hoof through stance and scooped it
// forward-and-back through swing, which is why the gaits paddled instead of
// driving - the feet never covered any ground.
//
// Stance is therefore linear backward at the body's speed, and swing is a
// cubic Hermite whose end SLOPES match that speed, so the hoof is already
// travelling backward at ground speed the instant it touches down. Matching
// position alone (a cosine ease) leaves a velocity step at every touchdown,
// which is the hitch you see as a stutter in the step.
let STANCE_BIAS = 0.12;
// Measured, not chosen: the largest single-frame rotation any leg joint makes
// in this rig's own source Walk, with headroom for the faster authored gaits.
const FLIP_DEG = (() => { let m = 0;
  for (let f = 1; f < WN; f++) for (const id of LEG_STRUCT_IDS) {
    const a = walkLocal.get(id)?.r?.[f-1], b = walkLocal.get(id)?.r?.[f];
    if (a && b) m = Math.max(m, qangDeg(a, b));
  }
  return Math.max(40, m * 2.2); })();
console.log(`  [flip] source Walk worst leg step /frame -> FLIP_DEG=${FLIP_DEG.toFixed(1)}`);

function gaitTargets(t, phases, duty, strideK, liftK, dir, legTargets) {
  for (const k in phases) {
    let p = (t + phases[k]) % 1.0; if (p < 0) p += 1;
    const base = stanceHoof[k];
    const S = STRIDE[k] * strideK * dir, L = LIFT[k] * liftK;
    let z, up;
    // The sweep is biased FORWARD of the neutral stance point. A leg can only
    // hold the ground within sqrt(reach^2 - hip^2) of its own root; carrying
    // the foot a full half-stride BEHIND that point at the end of stance put it
    // out of reach, the reach clamp lifted it, and the gallop grew a second
    // false suspension where a foot should still have been planted.
    const zA = S * (0.5 + STANCE_BIAS), zB = S * (-0.5 + STANCE_BIAS);
    if (p < duty) {
      up = 0;
      z = zA + (zB - zA) * (p / duty);          // planted: driven straight back
    } else {
      const W = 1 - duty, u = (p - duty) / W;
      const m = (zB - zA) / duty * W;           // ground speed, in swing-u units
      const u2 = u * u, u3 = u2 * u;
      z = (2*u3 - 3*u2 + 1) * zB + (u3 - 2*u2 + u) * m
        + (-2*u3 + 3*u2) * zA   + (u3 - u2) * m;
      // Lift peaks just past mid-swing, as the leg folds under then reaches out.
      // The warp skews the peak later while keeping the ENDS smooth: sin(pi*u^0.85)
      // has an infinite slope at u=0, so the hoof left the ground with unbounded
      // vertical velocity - which showed up as the loop seam jumping to 88 deg
      // per frame.
      const w = u - 0.05 * sin(TAU * u);
      // Exponent 1.0, not 1.5. sin() has a finite non-zero slope at w=0 so the
      // hoof leaves the ground briskly; raising it to 1.5 makes the take-off
      // creep, and the foot then sits under the contact threshold for the whole
      // early swing - which erased the gallop's suspension phase entirely.
      up = L * sin(PI * w);
    }
    legTargets[k] = [base[0], base[1] + up, base[2] + z];
  }
}
// ── the dog ─────────────────────────────────────────────────────────────
//
// Everything below is canine. Where a number came from a published
// measurement it is cited inline; where it did not, it says so, because three
// of these clips have no kinematic literature at all and pretending otherwise
// would be worse than admitting it.

// Lateral-sequence walk: LH, LF, RH, RF. The single most robust fact about
// quadruped walking - every dog, every speed, no exceptions.
const WALK_PH   = { LB:0.00, LF:0.25, RB:0.50, RF:0.75 };
// Trot: diagonal pairs, one suspension.
const TROT_PH   = { LF:0.00, RB:0.00, RF:0.50, LB:0.50 };
// ROTARY gallop with TWO suspension phases - this is where a dog stops
// resembling the buffalo entirely. The bison trots to travel and its gallop
// has one suspension; a dog's fast gallop is rotary (LH, RH, RF, LF - the
// footfalls sweep around the body in one rotational direction) and it leaves
// the ground twice per stride: gathered, with the limbs bunched under the
// body, and extended, with the body stretched flat out.
// Stance windows chosen so the two suspensions actually exist rather than being
// asserted: hind pair on the ground over [0.00,0.40), front pair over
// [0.50,0.90). That leaves [0.40,0.50) with nothing down - the GATHERED
// suspension, limbs bunched under the body - and [0.90,1.00) likewise - the
// EXTENDED one, body stretched flat. Phases that merely looked like a gallop
// left the two stance groups overlapping and produced only one.
const GALLOP_PH = { LB:0.00, RB:0.12, RF:0.50, LF:0.62 };

// Cervical coupling.
//
// A dog cannot bend its neck sideways without rolling it. The caudal cervical
// facets are oriented so that lateral flexion drags axial rotation along with
// it - about 1.7 degrees of ipsilateral roll for each degree of bend. It is
// anatomically obligatory, not a stylistic flourish, and a neck that yaws on a
// clean vertical axis is the most reliable single reason a CG dog reads as a
// puppet rather than an animal. So no clip below is allowed to yaw the neck
// without paying the roll.
const CERV = 1.7;
function neck(P, { yaw=0, pitch=0, roll=0, couple=1 } = {}) {
  // Shared, not stacked. Cervical mobility rises towards the skull, so the
  // cranial segment takes the larger share.
  const y0 = yaw*0.40, y1 = yaw*0.60;
  P.body("neck0", { yaw:y0, pitch:pitch*0.45, roll: roll*0.40 + y0*CERV*couple });
  P.body("neck1", { yaw:y1, pitch:pitch*0.55, roll: roll*0.60 + y1*CERV*couple });
}
const headPose = (P, o={}) => P.body("head", o);
// The chin bone. Small angles only - it opens the jaw, and the tongue hangs
// off it, so every jaw movement swings the tongue for free.
const jaw  = (P, deg) => P.body("headend", { pitch: -deg });
// Ears, as commanded pose. The lag and the flop on top of this are secondary
// motion and are added later, driven by what the head actually did.
function ears(P, { pitch=0, yaw=0, spread=0 } = {}) {
  P.body("earend",   { pitch, yaw: yaw + spread, roll:  spread*0.5 });
  P.body("R_earend", { pitch, yaw: yaw - spread, roll: -spread*0.5 });
}
// Lateral spine bend, shared across the two new lumbar joints, with the
// counter-roll a bending back actually produces.
function spine(P, { bend=0, pitch=0, roll=0 } = {}) {
  P.body("spine0", { yaw: bend*0.45, pitch: pitch*0.5, roll: roll*0.45 });
  P.body("spine1", { yaw: bend*0.55, pitch: pitch*0.5, roll: roll*0.55 });
}
const tailPose = (P, { curl=0, yaw=0, roll=0 } = {}) => {
  const seg = ["tail","tailstart","tail1","tail2","tail3"];
  seg.forEach((n,i) => P.body(n, { pitch: curl*(i===0?1.4:0.9), yaw: yaw*(i===0?0.6:1.0), roll: roll*0.5 }));
};

// ── secondary motion ────────────────────────────────────────────────────
//
// Ears, tongue, tail follow-through, breath and weight shift are NOT keyed per
// clip. They are a pass over the finished animation, driven by what the body
// actually did on each frame, which means they can never disagree with the
// primary motion the way hand-keyed overlap does the moment a clip is retimed.
//
// This is the whole point of having added the joints.

// A critically-under-damped spring, integrated with substeps so it stays
// stable at ear frequencies. Looping clips run it three times over the series
// so the state it starts from is the state it ends at - otherwise every loop
// restarts with the ears hanging dead and settles over the first half-second.
function spring(series, f0, zeta, dt, loop) {
  const w = TAU*f0, sub = 6, h = dt/sub;
  // A looping clip's last frame is a DUPLICATE of its first, so the true period
  // is N-1 samples, not N. Integrating all N per pass advanced the spring one
  // extra frame every pass; after three passes the ears were three frames out
  // of phase with the body at the loop seam, which is where a 66 degree pose
  // gap in a Walk that is otherwise periodic by construction came from.
  const N = series.length, P = loop ? N - 1 : N;
  let x = loop ? 0 : series[0], v = 0, out = [];
  for (let pass = 0; pass < (loop ? 4 : 1); pass++) {
    out = [];
    for (let i = 0; i < P; i++) {
      const tgt = series[i];
      for (let s = 0; s < sub; s++) { const a = w*w*(tgt - x) - 2*zeta*w*v; v += a*h; x += v*h; }
      out.push(x);
    }
  }
  if (loop) out.push(out[0]);
  return out;
}
// A difference of two atan2 angles is only meaningful modulo a full turn. Left
// raw, a head passing through +/-180 degrees reports a 360-degree step, which
// the ear driver faithfully turned into a 100-degree ear snap on a single frame
// of an otherwise smooth Walk. Every angular RATE here goes through this.
const unwrap = (d) => { let x = (d + PI) % TAU; if (x < 0) x += TAU; return x - PI; };

// Add a visual-space rotation ON TOP of whatever the clip already posed,
// rather than replacing it.
function addVisual(pose, name, o) {
  const id = idByName[name]; if (id == null) return;
  const e = pose.get(id); pose.set(id, { r: visualOn(id, e.r, o), t: e.t });
}
let SEC = {};   // per-clip secondary weights, set in the build loop

function applySecondary(poses, loop) {
  const N = poses.length, dt = 1/CLIP_FPS;
  const o = Object.assign({ ear:1, tongue:1, tail:1, breath:1, shift:1, panting:0, micro:1 }, SEC);
  const W = poses.map((p) => fk(p));
  const at = (i) => poses[loop ? ((i % (N-1)) + (N-1)) % (N-1) : Math.max(0, Math.min(N-1, i))];
  const wat = (i) => W[loop ? ((i % (N-1)) + (N-1)) % (N-1) : Math.max(0, Math.min(N-1, i))];

  // What the head did, expressed in the head's own frame. The ear is a
  // pendulum hung off the skull: in that frame it feels a pseudo-force equal
  // and opposite to the skull's acceleration, so it swings BACKWARD when the
  // dog accelerates forward and flies UP when the head drops. This is why
  // ears sell a jump or a head-shake without a single key.
  const hid = idByName.head;
  const accL = [], yawRate = [], rollRate = [];
  for (let f = 0; f < N; f++) {
    const p0 = wat(f-1).pos.get(hid), p1 = wat(f).pos.get(hid), p2 = wat(f+1).pos.get(hid);
    const a = [ (p2[0]-2*p1[0]+p0[0])/(dt*dt), (p2[1]-2*p1[1]+p0[1])/(dt*dt), (p2[2]-2*p1[2]+p0[2])/(dt*dt) ];
    const q = qconj(wat(f).rot.get(hid));
    accL.push(qrot(q, a));
    // Angular rate about the world up / forward axes, from the head's own basis.
    const f0v = qrot(wat(f-1).rot.get(hid), FWD), f1v = qrot(wat(f+1).rot.get(hid), FWD);
    const u0v = qrot(wat(f-1).rot.get(hid), UP),  u1v = qrot(wat(f+1).rot.get(hid), UP);
    yawRate.push(unwrap(Math.atan2(f1v[0], f1v[2]) - Math.atan2(f0v[0], f0v[2])));
    rollRate.push(unwrap(Math.atan2(u1v[0], u1v[1]) - Math.atan2(u0v[0], u0v[1])));
  }
  const DEG = 180/PI, SC = 0.014;     // accel -> degrees, tuned against the Walk
  // Any free-running oscillator has to complete a WHOLE number of cycles across
  // a looping clip or it tears the seam. Snapping the frequency to the nearest
  // whole cycle costs a few percent of rate and makes the loop exact.
  const dur = (N-1)/CLIP_FPS;
  const osc = (hz, ph=0) => {
    if (!loop) return (f) => sin(TAU*(f/CLIP_FPS*hz + ph));
    const cyc = Math.max(1, Math.round(hz*dur));
    return (f) => sin(TAU*(cyc*f/(N-1) + ph));
  };
  const oPant = osc(4.2), oBr = osc(0.5), oBr2 = osc(0.5, -0.08);
  const oS1 = osc(0.23), oS2 = osc(0.37), oS3 = osc(0.19), oS4 = osc(0.31);
  // Attention and tail drift: slower still, and on frequencies that share no
  // factors with the weight shift, so the two never line up into a visible beat.
  const oA1 = osc(0.13, 0.31), oA2 = osc(0.21, 0.62), oA3 = osc(0.17, 0.11), oA4 = osc(0.29, 0.84);
  const oT1 = osc(0.27, 0.45), oT2 = osc(0.41, 0.19);
  // A short raised-cosine bump centred at a fraction of the clip. Used for the
  // things a dog does ONCE in a while rather than continuously - a flick, a
  // lick, a shudder. It wraps across the seam by construction, so it can sit
  // anywhere in a looping clip without tearing it, and it starts and ends at
  // exactly zero with zero slope, so it cannot show up as a step.
  // The WIDTH is given in seconds, not as a fraction of the clip. A flick takes
  // about as long whatever the dog is doing, and sizing it as a fraction made it
  // span one or two frames on the short clips - which is not a flick, it is a
  // pop. Measured: the sit and the two turns picked up 4-8 degrees of extra
  // per-frame step from exactly that, while the long clips were unaffected.
  const bump = (f, c, secs) => {
    const P2 = N - 1;
    const w = Math.min(0.40, secs / Math.max(0.001, dur));
    let u = (f / P2) - c;
    while (u >  0.5) u -= 1;
    while (u < -0.5) u += 1;
    const x = u / w;
    return Math.abs(x) >= 1 ? 0 : 0.5 * (1 + Math.cos(PI * x));
  };
  // Below about a second there is no room for a discrete event and the clip is
  // already busy; the continuous parts of the micro layer still apply.
  const EVENTS = dur >= 1.2;
  // A floppy puppy ear: light, long, and bouncy. ~3.2 Hz, poorly damped.
  const earPitch = spring(accL.map((a) => -a[2]*SC - Math.max(0,a[1])*SC*0.6), 3.2, 0.32, dt, loop);
  const earRoll  = spring(accL.map((a) => -a[0]*SC), 3.6, 0.30, dt, loop);
  const earDrag  = spring(yawRate.map((r) => -r*DEG*0.55), 4.0, 0.40, dt, loop);
  const earLift  = spring(accL.map((a) =>  a[1]*SC*0.9), 3.0, 0.28, dt, loop);
  // The tip is a second joint down the same pendulum: same forcing, lower
  // frequency, later phase. That phase offset IS the flop.
  const tipPitch = spring(earPitch, 2.2, 0.26, dt, loop);
  const tipRoll  = spring(earRoll,  2.4, 0.24, dt, loop);
  // The tongue is heavier and slower, and it swings mostly fore-aft.
  const tonSwing = spring(accL.map((a) => -a[2]*SC*1.7 - a[1]*SC*1.1), 2.6, 0.30, dt, loop);
  const tonSide  = spring(accL.map((a) => -a[0]*SC*1.2), 2.8, 0.28, dt, loop);

  // The springs are driven by real head acceleration, and a bark or a shake
  // accelerates the skull hard enough to swing a passive part right round. The
  // tongue became the LOWEST POINT ON THE DOG during Bark - below its paws -
  // because nothing bounded the arc. These are the limits of the real tissue,
  // not of the maths.
  const cap = (x, lim) => x < -lim ? -lim : x > lim ? lim : x;
  for (let f = 0; f < N; f++) {
    const p = poses[f];
    if (o.ear) {
      const e = o.ear;
      addVisual(p, "earend",   { pitch: cap(earPitch[f]*e,38), roll: cap((earRoll[f]+earLift[f])*e,34), yaw: cap(earDrag[f]*e,30) });
      addVisual(p, "R_earend", { pitch: cap(earPitch[f]*e,38), roll: cap((earRoll[f]-earLift[f])*e,34), yaw: cap(earDrag[f]*e,30) });
      addVisual(p, "earTipL",  { pitch: cap(tipPitch[f]*1.5*e,42), roll: cap(tipRoll[f]*1.4*e,38) });
      addVisual(p, "earTipR",  { pitch: cap(tipPitch[f]*1.5*e,42), roll: cap(tipRoll[f]*1.4*e,38) });
    }
    if (o.tongue) {
      // Panting is its own driver, layered over the physical swing. Dogs pant
      // at 3-5 Hz and it is the single most recognisable idle a dog has.
      const pant = o.panting ? oPant(f)*o.panting : 0;
      addVisual(p, "tongue", { pitch: cap((tonSwing[f] + pant*5)*o.tongue, 18), roll: cap(tonSide[f]*o.tongue, 16) });
      if (o.panting) addVisual(p, "headend", { pitch: -Math.max(0, pant)*4*o.panting });
    }
    if (o.tail) {
      // Follow-through: each segment replays the root's motion a frame or two
      // later, so the tail whips rather than swinging as one rigid stick.
      const seg = ["tailstart","tail1","tail2","tail3"];
      seg.forEach((n, i) => {
        const lag = (i+1)*1.2;
        const a = wat(f - Math.round(lag)).rot.get(idByName.Hips), b = wat(f).rot.get(idByName.Hips);
        const av = qrot(a, FWD), bv = qrot(b, FWD);
        const d = unwrap(Math.atan2(av[0], av[2]) - Math.atan2(bv[0], bv[2]))*DEG;
        addVisual(p, n, { yaw: d*0.35*(i+1)*0.5*o.tail });
      });
    }
    if (o.breath) {
      // ~30 breaths/min at rest. The ribcage lifts and the belly follows, so
      // it is spine0 leading spine1, not both moving as one.
      addVisual(p, "spine0", { pitch: oBr(f)*0.55*o.breath });
      addVisual(p, "spine1", { pitch: oBr2(f)*0.40*o.breath });
    }
    // ── micro-life ─────────────────────────────────────────────────────
    //
    // The difference between a posed dog and a live one is mostly involuntary.
    // The layer above this one is PASSIVE - ears and tongue swinging because
    // the skull moved - so a dog that holds still has nothing happening to it
    // at all. These are the things a dog does whether or not anything moved.
    //
    // All of it is deliberately below the threshold of "an animation": an ear
    // flick you notice is an ear flick that is too big. It is also all on the
    // head, ears, tongue, spine and tail - never on a leg or the root - so it
    // cannot disturb a planted paw or the height the body was settled to.
    if (o.micro) {
      const m = o.micro;
      // EAR FLICK. One ear, suddenly, and back. Dogs flick ears independently
      // and constantly; doing both together reads as a flinch instead.
      const fl = EVENTS ? bump(f, 0.17, 0.30) : 0, fr = EVENTS ? bump(f, 0.63, 0.26) : 0;
      addVisual(p, "earend",   { pitch: -13*fl*m, yaw:  7*fl*m, roll: -5*fl*m });
      addVisual(p, "R_earend", { pitch: -11*fr*m, yaw: -6*fr*m, roll:  4*fr*m });
      addVisual(p, "earTipL",  { pitch:  -9*fl*m });
      addVisual(p, "earTipR",  { pitch:  -8*fr*m });
      // LIP LICK. A quick flick of the tongue with a touch of jaw behind it.
      const lk = EVENTS ? bump(f, 0.42, 0.34) : 0;
      addVisual(p, "headend", { pitch: -6*lk*m });
      addVisual(p, "tongue",  { pitch: -15*lk*m, roll: 6*lk*m });
      // FLANK TWITCH - the shudder a dog gives at a fly on its skin. Brief,
      // small, and through the back rather than the legs.
      const tw = EVENTS ? bump(f, 0.79, 0.22) : 0;
      addVisual(p, "spine0", { roll:  1.7*tw*m, yaw:  0.8*tw*m });
      addVisual(p, "spine1", { roll: -1.3*tw*m, yaw: -0.6*tw*m });
      // ATTENTION. Tiny re-aims of the head, slower and smaller than the weight
      // shift, so the dog reads as looking at things rather than swaying.
      addVisual(p, "neck0", { yaw: oA1(f)*0.7*m, pitch: oA2(f)*0.5*m });
      addVisual(p, "head",  { yaw: oA3(f)*0.9*m, roll: oA4(f)*0.6*m });
      // TAIL DRIFT. A resting tail is never quite still even with no wag on it.
      addVisual(p, "tailstart", { yaw: oT1(f)*2.0*m, pitch: oT2(f)*1.3*m });
    }
    if (o.shift) {
      // Nothing alive stands perfectly still. Two slow incommensurate sines
      // never repeat, so the weight shift never looks keyed.
      const s = oS1(f) + 0.6*oS2(f);
      addVisual(p, "Hips",  { roll: s*0.45*o.shift });
      addVisual(p, "neck1", { yaw:  oS3(f)*0.9*o.shift, pitch: oS4(f)*0.7*o.shift });
    }
  }
}

// Settle the body onto the floor from INSIDE a clip, before the leg IK runs.
//
// A sit, a lie or a bow has no planted-paw anchor to set its height. The animal
// rests on its hocks and rump, and where that puts the hips is a CONSEQUENCE of
// how the legs folded, not a number to guess. Guessing it is what broke the
// sit: the fold sank the rump through the floor, the post-pass settle lifted
// the whole dog to get it out again, and the two cancelled - measured, the hips
// ROSE from 100% to 147% of standing height and the chest more than doubled.
// Every mechanical check passed that, because the feet were on the floor and
// nothing span. It took a side-on render to see the sitting dog standing up.
//
// Done here instead, the body is already at the right height when the front
// legs are solved, so they plant against it rather than being lifted off it.
// The legs that are about to be IK'd are excluded from the search - otherwise a
// foreleg reaching for the floor holds the whole body up and the rump never
// lands.
function settleOn(local, legKeys, extra, w = 1) {
  // Settle onto the SUPPORT, and measure it RELATIVE to how that same support
  // sits when the animal is standing on it.
  //
  // Two things went wrong here in turn, and the second hid behind the first.
  //
  // The original settled onto everything: it sank the body, then lifted it
  // until the lowest skin anywhere reached the floor - but the thing that had
  // sunk WAS the lowest skin, so the lift undid the drop exactly. The sitting
  // dog ended at 197% of standing hip height with its front paws 150% up.
  //
  // Settling onto the support alone fixed that and introduced a subtler fault:
  // FLOOR is the lowest the skin gets ANYWHERE in the Walk, and a subset of the
  // body never reaches it. The hind legs' lowest skin sits 25% of a hip height
  // above FLOOR even with the dog standing squarely on them, so targeting FLOOR
  // dragged the body 25% into the ground on frame zero, before the sit began.
  //
  // The support's own standing height is the honest datum. The settle then says
  // what it should: "the fold changed how far the legs reach below the body, so
  // move the body by that much" - zero on a standing frame, and exactly the
  // fold's depth on a seated one.
  const only = new Set([...(legKeys ?? []).flatMap((k) => LEGS[k]), ...(extra ?? [])]
    .map((n) => idByName[n]).filter((i) => i != null));
  if (!only.size) return;
  // Where that support should END UP, blended by how far into the pose we are.
  //
  // Neither datum is right on its own. Targeting FLOOR - the lowest the skin
  // gets anywhere in the Walk - is correct for a seated dog resting on its
  // hocks, but on a STANDING frame it drags the body a quarter of a hip height
  // into the ground, because a subset of the body never reaches the global
  // minimum. Targeting the support's own standing height is correct on frame
  // zero and leaves the finished sit hovering 21% of a hip height in mid-air,
  // legs folded under a body that never came down. So: standing datum at w=0,
  // the floor at w=1, and the clip says where it is between them.
  const base = lowestSkin(freshLocal(), null, only).y;   // same clip's planted anchors
  const want = base + (FLOOR - base) * Math.max(0, Math.min(1, w));
  const y = lowestSkin(local, null, only).y;
  if (Number.isFinite(y) && Number.isFinite(base)) liftBody(local, want - y);
  if (process.env.SETTLEDBG) {
    const all = lowestSkin(local);
    console.log(`      [settle] moved ${((want-y)/HIP_H*100).toFixed(1)}%  | whole body now ${((all.y-FLOOR)/HIP_H*100).toFixed(1)}% at ${nName(all.joint)}`);
  }
}

// ── the sitting Z, solved rather than reasoned about ────────────────────
//
// A dog's sitting hind leg is a Z: the femur runs forward and down to the
// stifle, the tibia runs back and down to the hock, and the metatarsus lies
// FLAT ALONG THE GROUND pointing forward, with the hock as the rear corner.
// Folding the leg by IK on the paw alone does not produce it - the solver is
// free to leave the metatarsus vertical, which is the collapsed rear this clip
// had - and picking the three angles by hand means picking three signs on a rig
// whose convention is not uniform, which is how the hind legs ended up driven
// through the floor twice.
//
// So the three angles are SEARCHED for, once, at build time: the combination
// that puts the hock and the paw both on the floor with the paw forward of the
// hock. The answer is measured on this rig, not assumed, and the clip then just
// ramps into it.
// Solved once per resting posture: the three hind-leg angles that put the hock
// and the paw on the floor for a GIVEN hip drop and pelvis tip.
//
// A lie is not a deeper sit that has been pushed down. Reusing the sit's fold
// and simply dropping the hips further cannot work, because the settle then
// lifts the body back to exactly the height that fold implies - the two cancel,
// and the dog stands up again however far it is pushed. A lower body needs a
// TIGHTER fold, so the fold is solved again for the posture that is wanted.
// Measured sit geometry, scaled to this rig.
//
// Ellis/Bishop et al. 2018 (Front Bioeng Biotechnol 6:162, greyhounds, 3-D
// kinematics) give the sit-to-stand excursion: HIP 53.4 deg, STIFLE 78.5 deg,
// TARSUS 88.7 deg, over 1.14 s. With the standing baseline from Animals 2022
// (stifle 145.3, tibiotarsal 132.1) that puts a seated greyhound near stifle 67
// and tarsus 43.
//
// Those absolute angles cannot be used here. Measured on THIS rig, standing,
// the hind stifle is 80 deg and the tarsus 50 - this is a stylised puppy and it
// stands far more crouched than a real dog, which is the model's character and
// not something to correct. What does transfer is the RATIO: a sit closes the
// stifle to 46% of its standing angle and the tarsus to 33%. Applied here that
// is roughly 37 and 16 degrees, and those are what the fold is solved against
// alongside the ground contacts.
// Fraction of this rig's STANDING interior angle that the seated joint closes
// to. The greyhound data puts a seated stifle at 46% of standing and the tarsus
// at 33%; on this crouched rig that is stifle ~37 deg and tarsus ~17, which is
// the deep Z a sitting dog folds into. Earlier these were nearly switched off
// because they fought the ground contacts - the answer was not to abandon them
// but to give the fold enough room to satisfy both, so the leg reads as bent
// rather than as a rounded blob beside the body.
const SIT_ANGLE = { j1: 0.46, j2: 0.33 };
function interiorAngles(W, k) {
  const c = LEGS[k].map((n) => idByName[n]);
  const ang3 = (a, b, d) => {
    const u = vnorm(vsub(a, b)), v = vnorm(vsub(d, b));
    return Math.acos(Math.max(-1, Math.min(1, vdot(u, v)))) * 180 / PI;
  };
  return [ang3(W.pos.get(c[0]), W.pos.get(c[1]), W.pos.get(c[2])),
          ang3(W.pos.get(c[1]), W.pos.get(c[2]), W.pos.get(c[3]))];
}
function solveFold(dz, pitchDeg, label, angleTarget) {
  const savedPlanted = PLANTED_LEGS;
  PLANTED_LEGS = new Set(["LF","RF","LB","RB"]);
  // ONE triple, applied to BOTH hind legs, scored on both. Solving each leg
  // independently returned different folds for left and right - the cost
  // landscape has several near-equal minima and the two legs fell into
  // different ones. A dog rests symmetrically, so symmetry is imposed by
  // construction rather than hoped for.
  const cost = (a0, a1, a2) => {
    const l = freshLocal(); const P = poser(l);
    P.hips({ dz, pitch: pitchDeg });
    for (const k of ["LB", "RB"]) {
      const c = LEGS[k];
      P.body(c[0], { pitch: a0 }); P.body(c[1], { pitch: a1 }); P.body(c[2], { pitch: a2 });
    }
    const W = fk(l);
    let c = 0;
    for (const k of ["LB", "RB"]) {
      const ch = LEGS[k];
      const hip = W.pos.get(idByName[ch[0]]), stifle = W.pos.get(idByName[ch[1]]);
      const hock = W.pos.get(idByName[ch[2]]), paw = W.pos.get(idByName[ch[3]]);
      // hock and paw both ON the floor - what makes the metatarsus lie flat
      // rather than stand vertical, which is the difference between a Z and a
      // collapsed crouch;
      c += Math.abs(hock[1] - GROUND) * 60 + Math.abs(paw[1] - GROUND) * 60;
      // the paw FORWARD of the hock, so the hock is the rear corner;
      c += Math.max(0, 0.020 - (paw[2] - hock[2])) * 40;
      // and the stifle carried forward of the hip, under the belly.
      c += Math.max(0, 0.004 - (stifle[2] - hip[2])) * 25;
      // ...and, where the literature gives one, the measured joint geometry.
      if (angleTarget) {
        const [j1, j2] = interiorAngles(W, k);
        // Weighted as a TIE-BREAKER, not a driver. At a weight that actually
        // steered the solve, the measured angles fought the ground contacts -
        // the residual went from 0.165 to 0.296 and the sit flattened out -
        // because this rig's standing crouch is nothing like the greyhounds the
        // angles were measured on. Contacts win; the angles only choose between
        // folds that satisfy them equally well.
        c += Math.abs(j1 - angleTarget[0]) * 0.00018;
        c += Math.abs(j2 - angleTarget[1]) * 0.00018;
      }
      // ...and the whole folded limb kept OUT at the side of the body rather
      // than driven through it. Without this the solver is free to put the
      // stifle and hock inside the torso - the hind legs simply disappear and
      // the dog's rear reads as a featureless blob with a tail on it, which is
      // what both the Sit and the Beg were doing. A sitting dog's hind leg is
      // clearly visible alongside its belly.
      const outward = Math.abs(hip[0]) * 0.92;
      c += Math.max(0, outward - Math.abs(stifle[0])) * 45;
      c += Math.max(0, outward - Math.abs(hock[0])) * 45;
    }
    return c;
  };
  let bestC = Infinity, bestA = [0, 0, 0];
  for (let a0 = -80; a0 <= 80; a0 += 5)
    for (let a1 = -80; a1 <= 80; a1 += 5)
      for (let a2 = -80; a2 <= 80; a2 += 5) {
        const c = cost(a0, a1, a2);
        if (c < bestC) { bestC = c; bestA = [a0, a1, a2]; }
      }
  for (let step = 2.5; step >= 0.25; step /= 2)
    for (let i = 0; i < 3; i++) for (const d of [-step, step]) {
      const t = bestA.slice(); t[i] += d;
      const c = cost(t[0], t[1], t[2]);
      if (c < bestC) { bestC = c; bestA = t; }
    }
  PLANTED_LEGS = savedPlanted;
  console.log(`  [fold] ${label}: ${bestA.map((x)=>x.toFixed(1)).join(" / ")}  residual ${bestC.toFixed(4)}`);
  return bestA;
}
const STAND_ANG = (() => {
  const savedP = PLANTED_LEGS;
  PLANTED_LEGS = new Set(["LF","RF","LB","RB"]);
  const W = fk(freshLocal());
  const a = interiorAngles(W, "LB"), b = interiorAngles(W, "RB");
  PLANTED_LEGS = savedP;
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
})();
console.log(`  [angles] this rig stands at stifle ${STAND_ANG[0].toFixed(0)} / tarsus ${STAND_ANG[1].toFixed(0)} deg`);
// The sit fold is SET, not solved.
//
// The optimiser kept trading the joint angles against the ground contacts and
// settling on a fold whose tarsus OPENED from 25 degrees standing to 80 seated
// - the hock straightening instead of closing, which is exactly why the hind
// leg read as a rounded mass beside the body rather than a bent leg. Weighting
// the measured angles hard enough to prevent that broke the contacts instead
// (residual 0.21 -> 0.26, and the sit flattened).
//
// Both ends of that trade are wrong, so the fold is stated directly: hip
// flexed to carry the stifle forward and down, stifle CLOSED, hock CLOSED so
// the metatarsus lies along the ground. settleOn then puts the body on it.
const SIT_Z = (process.env.SITZ ? process.env.SITZ.split(",").map(Number) : [46, -64, 54]);
console.log(`  [fold] sit (set): ${SIT_Z.join(" / ")}`);
// -0.086 put the hips at 14% of standing - the belly flat on the floor and the
// limbs splayed out from under it, which reads as a dog that has collapsed
// rather than one lying down. A sphinx lie rests the CHEST on the ground and
// still carries the hips, so the pelvis stays around half height.
const LIE_Z = solveFold(-0.054, 6, "lie  (hips -0.054, pelvis near level)");

// ── clips ───────────────────────────────────────────────────────────────

function idle(f,T,P){
  const t=f/T;
  // A resting dog is never still: the weight rocks, the head drifts, and every
  // few seconds an ear swivels on its own. The ear twitch is deliberately
  // aperiodic - it fires once, off-centre, so a 4s loop does not tick.
  const sway = sin(TAU*t);
  P.hips({ dz: sway*0.0015, roll: sway*0.8, yaw: sin(TAU*t+1.1)*0.6 });
  spine(P, { bend: sin(TAU*t+0.4)*1.6, pitch: -sway*0.5 });
  neck(P, { yaw: sin(TAU*t)*3.5, pitch: 2 + sin(TAU*t+2.0)*1.8 });
  // Dogs tilt to ONE preferred side. Published: the side is consistent per
  // dog and does not alternate, so alternating it reads as a tic.
  const tilt = Math.max(0, sin(TAU*(t-0.55)))**3;
  headPose(P, { pitch: -3 + sin(TAU*t*2+0.9)*2.2, roll: tilt*11, yaw: tilt*4 });
  const tw = Math.max(0, sin(TAU*(t-0.28)*4))**8;
  ears(P, { pitch: -4 + tw*16, spread: 3 - tw*7 });
  tailPose(P, { curl: -14 + sin(TAU*t)*5, yaw: sin(TAU*t*2)*9 });
}

function idleAlert(f,T,P){
  const t=f/T;
  // A LOOPING alert, so the dog is already alert on frame 0. Authored as a ramp
  // into the pose it snapped back to neutral at the seam, because a loop wraps
  // its last frame onto its first. What loops here is the SCANNING - the body
  // stays locked up and forward over the front feet and only the survey moves.
  //
  // Ears lead. Measured at about 35 ms ahead of the eyes and head, which is one
  // frame at 30fps, so the ear sweep is phase-shifted one frame EARLIER than the
  // head that follows it. Wrong order is the most reliable way to make a CG
  // animal look dead behind the face, and it costs one term to get right.
  const lead = 1/T;
  const scan = (ph) => sin(TAU*(t + ph));
  P.hips({ dz: 0.004, dfwd: 0.003, pitch: -3, roll: scan(0)*0.7 });
  spine(P, { pitch: -4, bend: scan(0.10)*2.0 });
  neck(P, { pitch: 20, yaw: scan(0)*7.0 });
  headPose(P, { pitch: 7, yaw: scan(0.06)*5.0, roll: scan(0.12)*3.0 });
  ears(P, { pitch: -26, spread: -9, yaw: sin(TAU*(t + lead))*5.0 });
  // Tail up and STILL. A wag here would turn an alert into a greeting.
  tailPose(P, { curl: 26, yaw: sin(TAU*t*2)*2.5 });
}

function walkClip(f,T,P,LT){
  const t=f/T; gaitTargets(t,WALK_PH,0.62,1.00,1.00,1,LT);
  // Axial rotation is LARGER at the walk than at the trot - 12.1 deg against
  // 6.1. Animators routinely get this backwards and give the fast gait the big
  // hip roll, which is exactly wrong: at the trot the diagonal pairs cancel.
  P.hips({ roll: sin(TAU*t)*6.0, yaw: sin(TAU*t+0.5)*3.0, dz: sin(TAU*t*2)*0.0018 });
  spine(P, { bend: sin(TAU*t+0.3)*3.2, roll: sin(TAU*t)*2.0 });
  // The head nods once per stride, out of phase with the shoulders.
  neck(P, { pitch: sin(TAU*t*2+0.8)*2.6, yaw: sin(TAU*t)*2.2 });
  headPose(P, { pitch: -sin(TAU*t*2+0.8)*1.8, yaw: sin(TAU*t+0.4)*2.6 });
  ears(P, { pitch: -6, spread: 2 });
  tailPose(P, { curl: -8, yaw: sin(TAU*t)*7 });
}

function trot(f,T,P,LT){
  const t=f/T; gaitTargets(t,TROT_PH,0.48,0.92,0.95,1,LT);
  // Diagonal pairs cancel: half the walk's roll, twice the frequency.
  P.hips({ roll: sin(TAU*t*2)*3.0, dz: sin(TAU*t*2)*0.0014, pitch: -1.5 });
  spine(P, { bend: sin(TAU*t*2)*1.6, pitch: -2 });
  neck(P, { pitch: -7 + sin(TAU*t*2)*1.8 });
  headPose(P, { pitch: 4 - sin(TAU*t*2)*1.2 });
  ears(P, { pitch: -10, spread: 1 });
  tailPose(P, { curl: 4, yaw: sin(TAU*t*2)*5 });
}

function run(f,T,P,LT){
  const t=f/T;   // Bias the whole sweep well forward and keep stance SHORT.
  //
  // The complaint was that the legs trail backwards and turn over too slowly.
  // Both come from the same place: at duty 0.28 the foot spends 28% of the
  // cycle on the ground being driven back, and with only the standing bias the
  // end of that sweep leaves the limb a long way behind the body. A galloping
  // dog carries its feet FORWARD under itself and flicks them back through a
  // short, fast stance - so the bias goes up and the stance comes down, which
  // also makes the swing occupy more of the cycle and look quicker.
  STANCE_BIAS = 0.34;
  gaitTargets(t,GALLOP_PH,0.24,1.28,2.4,1,LT);
  // The FORELEGS need their own boost. gaitTargets scales every leg by the lift
  // measured in the source Walk, and this rig's forelegs lift 0.026 against the
  // hind's 0.045 - so a single multiplier that gives the hind a gallop leaves
  // the front skimming the floor. Measured before this: the forepaw peaked at
  // 34% of a hip height and was in contact for 8 frames of 14, a longer stance
  // than the WALK has, which is exactly what "the front legs need refining"
  // looks like. Raising the swing arc on the front pair alone fixes it without
  // throwing the hind legs over the dog's back.
  for (const k of ["LF", "RF"]) {
    if (!LT[k]) continue;
    const h = LT[k][1] - GROUND;
    if (h > 1e-6) LT[k] = [LT[k][0], GROUND + h*1.85, LT[k][2]];
  }
  STANCE_BIAS = 0.12;
  // The spine is the engine, not the legs. In a rotary gallop the back flexes
  // and extends through a full cycle each stride, and the two suspensions ARE
  // those two extremes: gathered (back rounded, limbs bunched) and extended
  // (back arched, body stretched). Animating the legs without the spine is
  // what makes a CG gallop look like a pantomime horse.
  const flex = sin(TAU*t);
  P.hips({ dz: 0.004 + flex*0.010, pitch: flex*9, roll: sin(TAU*t+0.7)*2.5 });
  spine(P, { pitch: -flex*13, bend: sin(TAU*t+0.4)*2.5 });
  neck(P, { pitch: -12 - flex*5 });
  headPose(P, { pitch: 8 + flex*3 });
  ears(P, { pitch: -16, spread: -4 });      // pinned back by the airflow
  tailPose(P, { curl: 12 + flex*8, yaw: sin(TAU*t)*4 });
}

// ── the turns ───────────────────────────────────────────────────────────
//
// The buffalo turned by yawing. A dog does not, and this is the correction
// the whole spine-joint addition was for.
//
// A turning dog does three things, in this order of magnitude:
//   1. it BANKS - about 10 degrees of inward roll, like a cyclist;
//   2. it OVER-ROTATES - the body axis ends up pointing roughly 16 degrees
//      INSIDE the heading, so the dog is crabbing slightly through the turn;
//   3. it bends laterally - a dog has 3-4 degrees of lateral flexion per
//      intervertebral joint across ~20 joints, so a 60-80 degree C-curve is
//      available, where a horse gets that much for its ENTIRE back.
//
// Roll matters more than yaw, which is the opposite of the intuition. And the
// INNER hind foot contacts before the outer - the inside of the body is
// shorter through the arc, so it has less ground to cover.
//
// Honest gap: I could not find published footfall timing for a dog turning 90
// degrees in place. The footfall pattern below is the walk sequence with the
// inner pair advanced, which is consistent with the arc geometry and with the
// contact order that IS reported, but it is inference, not measurement.
function turn(sign){ return (f,T,P,LT)=>{
  const t=f/T, s=smooth(t);
  const yaw = 90*sign*s;
  const lean = Math.sin(PI*t);            // banks in, comes back level
  // Inner limbs advanced in phase: they travel a shorter arc.
  const ph = sign > 0
    ? { LB:0.00, LF:0.22, RB:0.50, RF:0.78 }
    : { RB:0.00, RF:0.22, LB:0.50, LF:0.78 };
  gaitTargets(t*2.0, ph, 0.58, 0.62, 1.0, 1, LT);
  // The feet have to travel WITH the turning body. gaitTargets builds every
  // target around the STANDING foot position, which is fixed in world space -
  // so while the body yawed through 90 degrees the planted feet stayed pointing
  // where the dog used to face, and by mid-turn they were simply out of reach.
  // The reach clamp then lifted them, which is why a turn had all four feet off
  // the ground for several frames. Rotating the targets with the body is what
  // stepping around an arc actually is.
  const rotY = (p, deg) => { const a = deg*PI/180, c = Math.cos(a), sn = Math.sin(a);
    return [p[0]*c + p[2]*sn, p[1], -p[0]*sn + p[2]*c]; };
  for (const key in LT) if (LT[key]) LT[key] = rotY(LT[key], yaw);
  // Crouching into the turn is not decoration: banking 10 degrees and yawing 16
  // inside the heading carries the body away from the planted feet, and at
  // standing height the reach clamp was lifting them - all four off the ground
  // for five frames of a turn, which no dog does. Dropping the hips gives the
  // legs the bend they need to stay down, and a dog lowers its centre of mass
  // through a turn regardless.
  P.hips({ yaw: yaw + 16*sign*lean, roll: -10*sign*lean, dz: -lean*0.003, pitch: lean*2 });
  // The C-curve. Bending INTO the turn, distributed, not hinged at one joint.
  spine(P, { bend: 26*sign*lean, roll: -6*sign*lean, pitch: -lean*2 });
  // The head leads the turn and gets there first - it is pointing where the
  // dog is going well before the body arrives, which is what makes a turn
  // read as intent rather than as a sliding prop.
  // The lead has to COME BACK. smooth(t/0.55) saturates at 1 and stays there,
  // so the clip ended with the neck still yawed 30 degrees and the skull
  // another 14 - the dog finishing a 90 degree turn looking 44 degrees past
  // where it now faces, and holding it. The head leads while the body is
  // turning and the body then catches up to the head, which is the whole point
  // of a lead; by the last frame the two are aligned again and the clip can
  // hand over to a stand or a walk without the head snapping straight.
  const hs = smooth(t/0.45) - smooth((t-0.55)/0.45);
  neck(P, { yaw: 30*sign*hs - 16*sign*lean, pitch: -6*lean });
  headPose(P, { yaw: 14*sign*hs, roll: 8*sign*lean, pitch: 3*lean });
  ears(P, { pitch: -8, yaw: 6*sign*hs, spread: 2 });
  // The tail is the counterweight and swings OUT, against the bank.
  tailPose(P, { curl: 6 + lean*10, yaw: -22*sign*lean, roll: 5*sign*lean });
}; }

function sit(f,T,P,LT,local){
  const t=f/T, ts=t*1.6;                   // 1.6s clip; the transition is 1.14s
  // Sit-to-stand and stand-to-sit both run about 1.14 s in healthy dogs, and
  // the fold is DISTAL FIRST: the hock closes before the stifle, and the whole
  // descent is braked at the end rather than dropped.
  const s = smooth(ts/1.14);
  const brake = smooth((ts-0.85)/0.45);
  const d = s - brake*0.05;                // the settle at the bottom
  //
  // The hind legs are FOLDED BY THE IK, not by hand-picked joint angles.
  //
  // A sit is a geometric fact: the feet stay where they are and the hips come
  // down and back, and the legs have no choice but to fold. Posing the three
  // joints directly means picking three signs, and the measured convention on
  // this rig is not uniform - negative pitch folds the hip and the stifle
  // upward but positive folds the hock upward. Two of the three were inverted,
  // which drove the hind legs DOWN through the floor; the settle then lifted
  // the whole dog to get them out, and the result was a rear that passed every
  // contact and penetration check. Letting the solver do it removes the sign
  // question completely, and it is the same solver that keeps all four feet
  // planted through the gaits.
  LT.LB = null; LT.RB = null;
  for (const k of ["LB", "RB"]) {
    const z = SIT_Z, chain = LEGS[k];
    // ABDUCTED as it folds, so the leg finishes clearly OUTSIDE the body rather
    // than tucked inside it. Measured on the previous version, the folded hock
    // sat 28% of a hip height from the midline - inside this puppy's own fur -
    // so the whole hind leg vanished into the silhouette and the rear read as a
    // rounded mass. Rolling the hip out as it closes puts the stifle and hock
    // proud of the flank where they belong, and a sitting dog's hind legs are
    // plainly visible from the side.
    const out = k === "LB" ? 1 : -1;
    // Distal first: the hock closes ahead of the stifle, which is what the
    // sit-to-stand literature reports and what stops it reading as a drop.
    P.body(chain[0], { pitch: z[0]*d, roll: 26*d*out, yaw: -6*d*out });
    P.body(chain[1], { pitch: z[1]*d, roll: 10*d*out });
    P.body(chain[2], { pitch: z[2]*smooth(ts/0.75) });
  }
  // Front paws placed directly UNDER their own shoulders - vertical posts, the
  // way the reference photograph has them. Measured on the previous version the
  // paw sat 15% of a hip height forward of the shoulder and 17% inward of it,
  // which splays the forelegs in and forward and is most of why the front end
  // looked wrong. The shoulder position is read live, because it moves as the
  // dog sits back.
  {
    const W = fk(local);
    for (const k of ["LF", "RF"]) {
      const sh = W.pos.get(idByName[LEGS[k][0]]);
      LT[k] = [sh[0], stanceHoof[k][1], sh[2] - 0.004*d];
    }
  }
  // Hips down to a little under half standing height, tipped back onto the
  // rump. This is the ONLY height instruction in the clip, and nothing settles
  // afterwards to fight it.
  P.hips({ dz: -0.052*d, dfwd: -0.020*d, pitch: 62*d, roll: sin(TAU*t*0.5)*0.8 });
  spine(P, { pitch: -30*d, bend: sin(TAU*t*0.4)*1.5 });
  // Sitting tall: the neck comes UP as the hips go down.
  neck(P, { pitch: 16*d, yaw: sin(TAU*t*0.5)*3 });
  headPose(P, { pitch: 8*d, yaw: sin(TAU*t*0.6)*4, roll: sin(TAU*t*0.45)*3 });
  ears(P, { pitch: -6 - 6*d, spread: 3 });
  // Tail comes out from under and sweeps the floor - a sitting dog's tail does
  // not hang, it lies.
  tailPose(P, { curl: -20*d, yaw: sin(TAU*t*0.8)*12*d });
  // LAST, and it must be last: P.hips() SETS the root translation outright, so a
  // settle applied before it is silently discarded.
  //
  // SIT_Z is solved against JOINT positions; the paw's geometry hangs below its
  // joint, and lying the metatarsus flat exposes more of it than standing on the
  // pad does. So the fold alone leaves the pose a few centimetres low and the
  // settle closes that - measured, it lands the support within half a percent of
  // a hip height of the floor.
  settleOn(local, ["LB","RB"], ["Hips","tail","tailstart","tail1","tail2","tail3"], d);
}

// The measured sign convention on this rig, established by probe rather than
// assumed: NEGATIVE pitch lifts the paw on the hip, stifle, shoulder, elbow and
// carpus - and POSITIVE lifts it on the hock. That one exception is what the
// first version of every clip below got wrong, driving the hind legs down
// through the floor; the settle then hauled the whole dog up to get them out.
// Where a paw belongs ON the ground the legs are left to the IK instead, which
// removes the question entirely.
const LIFT_HIND = (P, up, side) => {
  P.body(side[0], { pitch: -up*0.42 });    // hip: negative lifts
  P.body(side[1], { pitch: -up*0.78 });    // stifle: negative lifts
  P.body(side[2], { pitch:  up*0.86 });    // hock: POSITIVE lifts
};
const LIFT_FORE = (P, up, side, curl = 1) => {
  P.body(side[0], { pitch: -up*0.55 });    // shoulder
  P.body(side[1], { pitch: -up*0.70*curl });// elbow
  P.body(side[2], { pitch: -up*0.45*curl });// carpus
};

function lieDown(f,T,P,LT,local){
  const t=f/T, ts=t*2.2;
  const sitS = smooth(ts/1.0);                    // through a sit
  const down = smooth((ts-0.85)/0.9);             // then the forehand slides out
  // The sphinx lie is a SIT that then slides its forehand forward, so the hind
  // legs use the same solved Z fold - posed, not solved.
  //
  // Leaving them on the IK looked reasonable and put the hocks 70% of a hip
  // height through the floor: the solver only owns the paw, so as the hips came
  // down it folded the leg by driving the hock DOWN rather than tucking it
  // alongside. The paw stayed obediently on its target the whole time, which is
  // why contact QA saw nothing wrong.
  LT.LB = null; LT.RB = null;
  // Through the sit's fold, then on into the lie's - each solved for the hip
  // height it belongs to, so the settle below confirms the pose rather than
  // fighting it.
  for (const k of ["LB", "RB"]) {
    const chain = LEGS[k];
    for (let i = 0; i < 3; i++) {
      const sitPart = SIT_Z[i] * (i === 2 ? smooth(ts/0.75) : sitS);
      P.body(chain[i], { pitch: sitPart + (LIE_Z[i] - SIT_Z[i]) * down });
    }
  }
  // The forepaws go back on the IK and SLIDE FORWARD along the floor.
  //
  // Posing them by hand was tried and is the wrong tool: a posed leg exerts no
  // constraint, so the body floated free of it and the clip read as a rear. A
  // planted paw that the body then travels forward over has no choice but to
  // fold the elbow - that is what a sphinx lie is, and the solver already does
  // it for nothing.
  // Further forward than it looks like it needs. Measured on the previous
  // version the paw ended up HIGHER than its own wrist - 23% of a hip height
  // against 11% - which is the foot curled back under rather than lying flat in
  // front. Reaching the target further out straightens the forearm along the
  // floor and puts the paw ahead of the carpus, where it belongs.
  const fwd = down*0.058;
  LT.LF = [stanceHoof.LF[0], stanceHoof.LF[1], stanceHoof.LF[2] + fwd];
  LT.RF = [stanceHoof.RF[0], stanceHoof.RF[1], stanceHoof.RF[2] + fwd];
  // The seated drop has to be here too. SIT_Z was SOLVED with the hips at
  // -0.052, and applying the fold without the drop it was solved against gives
  // a standing dog with its hind legs tucked up - which is exactly what this
  // clip was doing: every grounding check passed, the skin sat on the floor,
  // and the render showed a puppy standing about with folded legs.
  // Level the pelvis right out as it goes down. A sitting dog's pelvis is tipped
  // back 46 degrees; a lying one's is flat, and leaving any of that tip in is
  // what kept the silhouette reading as a dog sitting up rather than lying down.
  P.hips({ dz: -0.052*sitS - 0.018*down, dfwd: -0.020*sitS + 0.014*down,
           pitch: 46*sitS - 42*down });
  spine(P, { pitch: -20*sitS + 30*down, bend: 6*down });
  neck(P, { pitch: 16*sitS - 10*down });
  headPose(P, { pitch: 8*sitS - 5*down + sin(TAU*t*0.5)*2, yaw: sin(TAU*t*0.4)*5 });
  ears(P, { pitch: -8 - 4*down, spread: 4 });
  tailPose(P, { curl: -24*sitS - 10*down, yaw: 16*down + sin(TAU*t*0.7)*8 });
  // Settled on the HIND legs, the rump and the ribcage - NOT the forelegs.
  //
  // Including them looks right and is exactly wrong: a folded foreleg's paw
  // dangles, becomes the lowest point of the support set, and the settle
  // faithfully raises the entire dog to stand that paw on the floor. The animal
  // ends up hanging in the air off one toe. What actually carries a lying dog is
  // its hindquarters and its chest.
  settleOn(local, ["LB","RB"],
           ["Hips","chest","spine0","spine1","tail","tailstart","tail1","tail2","tail3"],
           Math.max(sitS, down));
}

function sleep(f,T,P,LT,local){
  const t=f/T;
  // Flat out, and specifically: HIND LEGS EXTENDED BEHIND, FORELEGS EXTENDED IN
  // FRONT AND FLAT, HEAD RESTING ON THE FORELEGS.
  //
  // The hind legs stretched straight out behind is the posture Beaver records
  // as a variant of sternal recumbency - "the rear limbs are... extended behind
  // the dog" - and it is the only formal capture of what is popularly called a
  // sploot. It reads instantly as a dog flat out asleep in a way that folded
  // hind legs never do, because folded legs still look ready to stand up.
  //
  // REBUILT: the four legs used to be posed at written-down angles and three of
  // them did not reach the floor. Measured on the held pose, with the body
  // settled onto its belly: the left forepaw lay on the ground, the right sat
  // 273% of the body's own height above it, the left hind 69% and the right
  // 16%. The belly was the only thing in contact - which is exactly what it
  // looked like, a dog bulging onto the floor with its legs in the air.
  //
  // The right-left split is the giveaway. applyVisual poses an unplanted leg
  // from `stand`, and `stand` is Walk frame 0 - mid-stride, left hind lifted -
  // so identical angles on the two sides were never going to give identical
  // limbs. Angles measured against the floor do not care what the base pose was.
  const br = sin(TAU*t*2);   // 2 breaths across the 4s loop = 30/min

  // ── the body first, and it SETTLES first ──────────────────────────────
  // The legs have to be laid down against a floor the body has already found;
  // solving them before the settle measures them against a body that is about
  // to move out from under them.
  //
  // No roll. Any roll tips the ribcage onto one side, so the belly stops being
  // the thing in contact with the floor and the dog reads as lying half on its
  // side. Flat means flat: pelvis level, no twist.
  P.hips({ dz: -0.104, dfwd: -0.002, pitch: 0, roll: br*0.5 });
  spine(P, { pitch: -8 + br*2.2, bend: 0, roll: 0 });
  // Neck stretched out along the ground. Deliberately over-bent: the nose guard
  // takes it back up to whatever it actually lands on, and for this clip that
  // datum is raised to the thickness of a foreleg so the chin comes to rest ON
  // the legs rather than passing through them into the floor.
  // Deliberately over-bent so the nose guard is what lands the chin. Asking for
  // just enough means landing short, because the guard only ever takes bend away.
  neck(P, { pitch: -62, yaw: 9, couple: 0.35 });
  headPose(P, { pitch: 8, roll: -12, yaw: 4 });
  jaw(P, 1.5 + br*1.2);
  ears(P, { pitch: 16, spread: 8 });
  tailPose(P, { curl: -30, yaw: 26 + br*3 });
  // HEIGHT IS SET BY THE HIP JOINT, not by settling the torso.
  //
  // settleOn supports the torso only - Hips, chest, the two lumbar joints - and
  // knows nothing about the legs, which are solved after it. So the femur ended
  // up wherever the belly happened to put it, which measured 55% of a hip
  // height THROUGH the floor. buryGuard then lifted the whole animal to dig the
  // thigh out, and the posed forelegs went up with it: forepaws at 131% of hip
  // height, higher than the hips themselves, with the chin underneath them
  // instead of resting on them.
  //
  // A splooting dog's femur lies flat ON the ground, so the hip joint sits
  // about a femur's radius up - which on this rig is GROUND, the height a
  // standing paw's joint sits at, since both are "one limb thickness above the
  // floor". Setting that directly costs one measurement and leaves nothing for
  // the bury guard to correct.
  {
    const W = fk(local);
    const rootY = (W.pos.get(idByName.backleg)[1] + W.pos.get(idByName.R_backleg)[1]) / 2;
    liftBody(local, (GROUND + 0.004) - rootY);
  }

  // ── then lay the limbs out on that floor ──────────────────────────────
  //
  // The HIND pair goes on the IK with a real target POINT, not on the flat
  // solve. A one-DOF solve can only ask for HEIGHT, and "paw on the floor" has
  // more than one answer: the solver's preferred one folds the leg straight
  // down under the hip, which is on the floor, is perfectly stable, and is a
  // dog kneeling rather than splooting. Measured, the hind paw came out at the
  // same z as its own hip. Only a target point can say "behind".
  //
  // The SPLAY is load-bearing, not decoration. Run the legs straight astern and
  // the thigh presses down through the floor, buryGuard lifts the whole animal
  // to get it out, and the belly comes off the ground - swapping one complaint
  // for its mirror image. The pelvis is resting ON the floor, so the hip joint
  // sits lower than a flat thigh wants it; abducting the limb puts the thigh
  // BESIDE the body instead of under it, which is what a real sploot does and
  // what lets both the belly and the legs touch at once. Measured: 0.012 of
  // splay left the dog floating 12.7% of a hip height, 0.030 left 9.7%, 0.045
  // lands it.
  LT.LF = null; LT.RF = null;
  {
    const W = fk(local);
    for (const k of ["LB","RB"]) {
      const out = k === "LB" ? 1 : -1;
      const hip = W.pos.get(idByName[LEGS[k][0]]);
      LT[k] = [hip[0] + out*0.045, GROUND, hip[2] - LEG_REACH[k]*0.86];
    }
  }
  // Fore: extended straight out in FRONT along the floor, for the chin to rest on.
  for (const k of ["LF","RF"]) {
    const out = k === "LF" ? 1 : -1;
    layLimbFlat(local, P, LEGS[k], [138, -12, 8], { roll: 8*out, yaw: -4*out }, 1, [60, 200]);
  }

  // REM twitches. Beaver, ch.9: in active sleep there are "phasic movements of
  // the distal digital, facial, extraocular, and tail muscles" and "dogs appear
  // to paddle with all four limbs". Tiny, irregular, extremities only - and on
  // the PAW bones, which layLimbFlat does not touch, so a twitch rotates the
  // foot about its own origin and cannot lift the limb off the floor.
  const tw = Math.max(0, sin(TAU*t*7 - 1.1))**9 + Math.max(0, sin(TAU*t*11 + 2.3))**11;
  P.body("frontleg2",   { pitch: tw*3.5 });
  P.body("R_frontleg2", { pitch: tw*2.5 });
  P.body("backleg2",    { pitch: -tw*3 });
  tailPose(P, { curl: -30, yaw: 26 + br*3 + tw*4 });
}

function playBow(f,T,P,LT){
  const t=f/T, ts=t*1.4;
  // THE correction that matters here: a play bow lasts 0.31-0.38 s.
  // Measured in beagle pups, coyote pups, wolf pups and free-ranging adults
  // alike. Held for a second or two - which is the intuitive reading, and what
  // most game dogs do - it stops being a play signal and becomes a stretch.
  // So: a still moment, a fast drop, a brief hold, an explosive release.
  const drop = smooth((ts-0.25)/0.14);
  const rel  = smooth((ts-0.66)/0.18);
  const b = drop - rel;
  // Forehand down, hindquarters UP - the defining shape. The elbows go to the
  // floor and the hind legs stay straight. The forepaws never leave the ground,
  // so they stay on the solver: dropping the chest over planted paws folds the
  // elbows by itself.
  const k = 0.008*b;
  LT.LB = [stanceHoof.LB[0], stanceHoof.LB[1], stanceHoof.LB[2] - k];
  LT.RB = [stanceHoof.RB[0], stanceHoof.RB[1], stanceHoof.RB[2] - k];
  LT.LF = [stanceHoof.LF[0], stanceHoof.LF[1], stanceHoof.LF[2] + 0.016*b];
  LT.RF = [stanceHoof.RF[0], stanceHoof.RF[1], stanceHoof.RF[2] + 0.016*b];
  P.hips({ dz: 0.010*b, pitch: -22*b, roll: sin(TAU*t*0.7)*1.5 });
  spine(P, { pitch: 34*b, bend: sin(TAU*t)*4*b });
  // Head stays UP and forward, eyes on the playmate. A bow with the head down
  // reads as a stretch or a sniff; the raised head is what makes it a signal.
  neck(P, { pitch: 16*b, yaw: sin(TAU*t*1.2)*7*b });
  headPose(P, { pitch: -30*b, yaw: sin(TAU*t*1.4)*8*b, roll: sin(TAU*t*0.9)*6*b });
  jaw(P, 10*b);
  ears(P, { pitch: -12*b, spread: -5*b });
  // The tail wags hard through the bow - the two together are the invitation.
  tailPose(P, { curl: 26*b, yaw: sin(TAU*ts*5.5)*34*b + 8 });
}


// ── lay a limb FLAT on the floor, measured rather than guessed ──────────
//
// Used by every pose where a limb is stretched out along the ground - the
// sleep's four, the stretch's forelegs. It exists because posing those by a
// written-down angle cannot work on this rig, for two separate reasons:
//
//  1. THE ANGLE DEPENDS ON THE TRUNK. A shoulder pitch of 138 lays the foreleg
//     flat when the back is level and drives the elbow through the floor when
//     it is pitched 38 degrees nose-down. One number cannot serve both.
//  2. THE BASE POSE IS ASYMMETRIC. applyVisual poses an unplanted leg from
//     `stand`, which is Walk frame 0 - MID-STRIDE, with the left hind lifted
//     and folded. So the same angle on the left and the right gives two
//     different limbs. Measured on the sleep: the left forepaw lay on the floor
//     while the right sat 273% of the body's own height above it.
//
// Both go away if the angles are measured instead. Each joint is solved in turn
// against the joint BELOW it - the shoulder until the elbow is on the floor,
// the elbow until the carpus is, the carpus until the paw is - by Newton's
// method on that joint's own measured height. Three one-DOF solves. A single
// rotation cannot flip the way CCD can, and solving the whole chain makes the
// limb lie flat rather than merely touch at one end.
//
// SEEDED FROM THE PREVIOUS FRAME, which is the other half of it. Solved cold
// every frame the answer can jump between basins: the stretch's right shoulder
// moved 179 degrees in a single frame that way, against 12.6 for the worst bone
// in the hand-made Walk, and it read as the foreleg flickering. Frames are
// built in order, so carrying the last answer forward keeps the solver in one
// basin and the result continuous.
const FLAT_SEED = new Map();
// Every flat-limb solve a clip performs, recorded per frame so the same solve
// can be REPLAYED after the guards have finished moving the body. See
// flatLimbGuard: without the replay a posed limb is laid onto the floor and
// then carried off it again by buryGuard, with nothing to put it back. The
// planted limbs already get this from replantGuard; this is its counterpart for
// the limbs a clip poses directly.
let FLAT_LIMB_LOG = [];
function layLimbFlat(local, P, chainNames, seeds, extra, blend = 1, range = [-60, 210]) {
  if (!globalThis.__flatReplay) {
    const f = globalThis.__flatFrame ?? 0;
    (FLAT_LIMB_LOG[f] ??= []).push({ chainNames, seeds, extra, blend, range });
  }
  const ids = chainNames.map((n) => idByName[n]);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const key = chainNames[i];
    const watch = ids[i + 1];
    const set = (d) => P.body(chainNames[i], { pitch: d, ...(i === 0 ? extra : {}) });
    // The clamp is a guard against absurdity, NOT a shape for the answer, and
    // it only belongs on the ROOT joint - where it stops the solver reaching the
    // floor by swinging a hind leg forwards under the belly instead of back.
    // Applying the root's range to the whole chain pinned backleg1, R_backleg0
    // and R_backleg1 at their limits and left 76mm of residual: a limb bent in
    // the air because it had been forbidden from straightening.
    const lim = i === 0 ? range : [-200, 200];
    let deg = FLAT_SEED.get(key) ?? seeds[i];
    // Joint ORIGINS onto GROUND. Solving each joint's own lowest SKIN onto
    // FLOOR was tried and is worse: a bone's skin extent depends on how the
    // bone is pointing, and the shoulder's skinned vertices run up into the
    // chest, so "the shoulder's lowest skin" is really the ribcage and driving
    // it to the floor tips the whole forequarter. Origins are orientation-free.
    const errAt = (d) => { set(d); return Math.abs(fk(local).pos.get(watch)[1] - GROUND); };
    // DAMPED, with a backtracking line search, so the error can only ever go
    // down. Plain Newton is not safe here: the height of a joint is not
    // monotonic in its parent's angle, and where the slope flips sign the step
    // points the wrong way and grows. R_backleg0 ran itself to 200 degrees that
    // way, 75mm further from the floor than it started. Capping the step keeps
    // it from jumping across a singularity; keeping the best answer seen means
    // a solve that cannot converge degrades to "as close as it got" instead of
    // to nonsense.
    let best = deg, bestErr = errAt(deg);
    for (let it = 0; it < 8 && bestErr > 0.0004; it++) {
      set(deg);
      const y = fk(local).pos.get(watch)[1] - GROUND;
      set(deg + 2);
      const slope = (fk(local).pos.get(watch)[1] - GROUND - y) / 2;
      if (!Number.isFinite(slope) || Math.abs(slope) < 1e-7) break;
      let step = Math.max(-40, Math.min(40, -y / slope));
      let improved = false;
      for (let bt = 0; bt < 4 && !improved; bt++) {
        const cand = Math.max(lim[0], Math.min(lim[1], deg + step));
        const e = errAt(cand);
        if (e < bestErr) { bestErr = e; best = cand; deg = cand; improved = true; }
        else step *= 0.4;
      }
      if (!improved) break;
    }
    deg = best; set(deg);
    FLAT_SEED.set(key, deg);
    if (process.env.FLATDBG === String(globalThis.__flatFrame ?? -1))
      console.log(`      [flat] ${key} deg ${deg.toFixed(1)} residual ${((fk(local).pos.get(watch)[1]-GROUND)*1000).toFixed(2)}mm`);
    out.push(deg);
  }
  // Apply the whole chain at once, blended. The solve above runs at FULL
  // extension so the recorded angles are the ones that actually lie flat; the
  // blend is what ramps into the pose, and because it scales a continuous
  // solution it stays continuous - which the old `push > 0.02` gate did not,
  // since it switched the solver on between one frame and the next.
  for (let i = 0; i < 3; i++) {
    P.body(chainNames[i], { pitch: out[i] * blend,
      ...(i === 0 ? Object.fromEntries(Object.entries(extra ?? {}).map(([k2, v]) => [k2, v * blend])) : {}) });
  }
  return out;
}

function beg(f,T,P,LT,local){
  const t=f/T;
  // THE GREETING STRETCH. Forequarters flat on the floor with the chin resting
  // on the extended forelegs; hindquarters UP, hind legs straight and carried a
  // little forward under the raised rump.
  //
  // REBUILT, because the previous version left three of four paws in the air.
  // It posed the forelegs at a fixed shoulder angle, exactly as Sleep does -
  // but Sleep's trunk is level and this one pitches 46 degrees nose-down, so
  // the SAME local angle points the limb down into the floor instead of forward
  // along it. The elbow ended half a hip height underground, buryGuard lifted
  // the whole animal by 53% of a hip height to rescue it, and the planted hind
  // paws went up with the body: from the raised hips the floor sat at 100-102%
  // of the hind leg's reach, so no amount of IK could bring them back down.
  //
  // Two changes fix it at the source rather than patching the symptom:
  //
  //  1. ALL FOUR legs go on the solver, with targets ON the floor. A posed leg
  //     is only correct for one trunk angle; a solved one is correct for any.
  //  2. The rump height is MEASURED and then set, instead of being whatever a
  //     guessed `dz` happens to produce. The trunk is pitched first, the hind
  //     leg roots are read back out of the FK, and the body is moved by exactly
  //     the difference between that and the height a stretch wants. Because
  //     moving the root translates the whole skeleton one-for-one, a single
  //     correction lands it exactly - no iteration, and nothing to re-tune if
  //     the pitch ever changes.
  const up   = smooth(t/0.22);
  const hold = smooth((t-0.20)/0.16) - smooth((t-0.82)/0.16);
  const push = up * (0.60 + 0.40*hold);
  const sway = sin(TAU*t*2)*0.5 + sin(TAU*t*3)*0.3;

  // ── trunk: front DOWN onto the floor, rump UP ──────────────────────────
  // The hips carry the nose-down pitch and the spine adds only a little back
  // arch. The old pair (-44 hips against +30 spine) very nearly cancelled, so
  // the front never actually got down to the floor and the elbow reached it
  // only by being driven through it.
  // 60 degrees was tried and is a somersault, not a stretch: the pitch pivots
  // about the Hips node, which sits above and behind the shoulder, so past
  // about 40 degrees the whole forequarter swings BACKWARDS as it comes down -
  // measured, the shoulder travelled 0.28 units aft, folding the dog in half.
  // A real stretch keeps the body's length on the ground and gets the front
  // down by sliding the forepaws forward, which is what the targets below do.
  P.hips({ dz: 0, dfwd: -0.004*push, pitch: -38*push, roll: sway*0.7 });
  spine(P, { pitch: 10*push, bend: sway*1.6, roll: -sway*0.6 });

  // ── set the rump to the height a stretch reaches ───────────────────────
  // Expressed as a fraction of the way from standing towards a straight hind
  // leg, so it means the same thing on a dog with different proportions.
  {
    const W = fk(local);
    const rootY = (W.pos.get(idByName.backleg)[1] + W.pos.get(idByName.R_backleg)[1]) / 2;
    const straight = GROUND + LEG_REACH.LB * 0.95;
    // 0.42 of the way to straight put the root at 102-105% of the leg's own
    // reach above the floor once buryGuard had had its say - a height the leg
    // cannot get down from however it is solved. 0.30 leaves real headroom.
    // The hind paws have to be able to REACH the floor from wherever this puts
    // the rump, and "within the leg's reach" is not the binding constraint -
    // the fold guard and the hinge limits give out well before the leg runs out
    // of length. Measured: at 0.30 the paws hung 8-9% of a hip height up and no
    // amount of re-solving would close it.
    const wantY = STAND_HIND_ROOT + (straight - STAND_HIND_ROOT) * 0.26 * push;
    liftBody(local, wantY - rootY);
  }

  // ── forelegs: stretched straight out in front, LYING ON the floor ──────
  //
  // POSED, not solved, and the angle is MEASURED rather than written down.
  //
  // The IK was tried twice here and flips. Laying a near-straight foreleg flat
  // from a shoulder a finger's width off the floor is the worst case CCD has:
  // the target sits at the very edge of the reachable shell, where two very
  // different chain configurations are almost equally good, and the solver
  // picks whichever one it drifts into. On the held frames it chose the wrong
  // one and stood the left forepaw up beside the chest.
  //
  // A single rotation cannot flip. So the shoulder carries ONE degree of
  // freedom - its pitch - and that pitch is found by Newton's method against
  // the paw's own measured height: pose, read the paw, probe three degrees,
  // take the slope, step. It converges in two or three passes and lands the paw
  // on the floor at whatever angle the trunk happens to be sitting, which is
  // exactly the thing a hard-coded 132 could never do.
  LT.LF = null; LT.RF = null;
  for (const [k, side] of [["LF",["frontleg","frontleg0","frontleg1","frontleg2"]],
                           ["RF",["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"]]]) {
    void k;
    const out = side[0].startsWith("R_") ? -1 : 1;
    layLimbFlat(local, P, side, [138, -12, 8], { roll: 8*out, yaw: -4*out }, push);
  }
  // ── hind legs: planted, straight, carried slightly FORWARD under the rump ──
  // That forward carry is what makes it a stretch and not a bow.
  for (const k of ["LB","RB"]) LT[k] = [stanceHoof[k][0], GROUND, stanceHoof[k][2] + 0.014*push];

  // Head DOWN onto the forelegs. Deliberately over-bent; the nose guard lands
  // the chin on the legs rather than through them.
  neck(P, { pitch: -30*push, yaw: sway*2.0 });
  headPose(P, { pitch: 4*push, yaw: sway*1.6, roll: sway*1.2 });
  jaw(P, 6*hold);                               // the yawn that goes with it
  ears(P, { pitch: 10*push, spread: 4*push });
  tailPose(P, { curl: 26*push, yaw: sway*5 });
}

function pee(f,T,P,LT,local){
  const t=f/T, ts=t*3.4;
  // Raised-leg urination, the posture everyone pictures when they picture a dog
  // peeing. Measured on this rig: YAW on the hip swings the paw sideways by
  // 45-51% of a hip height per 50 degrees and barely changes its height, while
  // PITCH lifts it and barely moves it sideways - so the lift is yaw for the
  // abduction and pitch for the flexion, not one or the other.
  //
  // The sequence is the behaviour, not just the pose: a brief sniff at the spot,
  // the weight shifting onto the three legs that will carry it, the leg coming
  // up and OUT, a hold, then down. Dogs also over-mark - they aim slightly
  // upward at whatever they are marking - so the lifted leg goes above
  // horizontal rather than just out.
  const sniff = smooth(ts/0.5) - smooth((ts-0.7)/0.4);      // a look at the spot first
  const up    = smooth((ts-1.0)/0.45) - smooth((ts-2.7)/0.5);
  const wob   = sin(TAU*t*3.1)*up;                          // three-legged balance hunting
  // The LEFT hind lifts; the other three stay planted and take the weight.
  LT.LB = null;
  // Weight shifts AWAY from the lifted leg, onto the opposite hip.
  P.hips({ dz: -0.012*up, roll: -11*up + wob*1.1, yaw: 5*up, pitch: 2*up + 4*sniff });
  spine(P, { bend: -8*up, roll: -4*up, pitch: 3*sniff });
  // hip: out to the side AND up; stifle and hock fold as it comes.
  // Measured on the first attempt: -62 yaw only carried the paw 30% of a hip
  // height sideways, which does not read as a leg-lift from any angle - it
  // looks like the dog is limping. A real raised-leg urination takes the thigh
  // out towards horizontal, so the paw ends up roughly as far out to the side
  // as the hip is high.
  // ABDUCTION IS ROLL, not yaw. Yaw swings the whole limb about the vertical
  // axis, and past about 60 degrees that carries the thigh straight through the
  // pelvis - the render showed back-facing polygons where the leg was inside
  // the body. Roll swings it out in the frontal plane, which is what abduction
  // actually is; measured on this rig it takes the paw out AND up together
  // (+50 roll -> +18% sideways, +17% higher). Yaw is kept only as a small
  // component, for the slight backward cast a dog gives the lifted leg.
  P.body("backleg",  { roll: 96*up, yaw: -26*up, pitch: -20*up });
  P.body("backleg0", { roll: 26*up, pitch: -30*up });
  P.body("backleg1", { pitch:  34*up });
  // the planted hind takes the load and braces a little wider
  P.body("R_backleg", { yaw: 6*up });
  // head turns back towards what it is marking, then away
  neck(P, { yaw: -14*up - 10*sniff, pitch: -26*sniff + 6*up, couple: 0.6 });
  headPose(P, { yaw: -8*up, pitch: -10*sniff + 3*up, roll: -5*up });
  ears(P, { pitch: -4 + 8*sniff, spread: 3 });
  // tail lifts and holds clear - it has to, and a raised tail is part of the
  // marking display rather than incidental
  tailPose(P, { curl: 16 + 22*up, yaw: 10*up + wob*4 });
  jaw(P, 2*sniff);
}

function jump(f,T,P,LT){
  const t=f/T, ts=t*1.1;
  // Crouch, drive, FLIGHT, land.
  //
  // The flight pose is the part that was wrong: the body was pitched nose-up
  // with all four legs trailing behind it, which is a dog being thrown rather
  // than one jumping. In the air a dog REACHES - the forelegs swing forward
  // ahead of the chest and the hind legs extend straight back behind the hips,
  // the body stretched between them. Measured on this rig, a shoulder pitch
  // near +90 carries the forepaw 74% of a hip height forward of the shoulder,
  // and a hip pitch near -30 carries the hind paw 69% behind the hip - those
  // are the two ends of the stretch.
  const crouch = smooth(ts/0.22) - smooth((ts-0.22)/0.12);
  const air    = smooth((ts-0.30)/0.10) - smooth((ts-0.72)/0.14);
  const land   = smooth((ts-0.74)/0.10) - smooth((ts-0.90)/0.20);
  const fly    = Math.sin(PI*Math.min(1,Math.max(0,(ts-0.30)/0.46)));
  // THE DRIVE. There was no such phase: the clip went straight from a coiled
  // crouch to a flight pose, so the one instant that makes a jump read as
  // powered rather than thrown - the hind legs straightening hard against the
  // ground while the front reaches up - never happened. It sits between them.
  const drive  = Math.max(0, smooth((ts-0.19)/0.09) - smooth((ts-0.33)/0.09));
  // Reach is strongest at the top of the arc and folds away on the descent.
  const reach  = air * fly;
  if (air > 0.25) { LT.LB=null; LT.RB=null; LT.LF=null; LT.RF=null; }
  for (const side of [["backleg","backleg0","backleg1","backleg2"],
                      ["R_backleg","R_backleg0","R_backleg1","R_backleg2"]]) {
    // crouch coils the hind, the drive extends it, flight trails it straight BACK
    // The drive STRAIGHTENS the limb: the hip swings back, and the stifle and
    // hock come back out of their coil towards zero rather than deeper into it.
    // In flight the whole leg trails straight out behind the hip.
    P.body(side[0], { pitch:  36*crouch - 38*drive - 42*reach - 10*land });
    P.body(side[1], { pitch: -52*crouch + 30*drive -  4*reach + 24*land });
    P.body(side[2], { pitch:  40*crouch - 22*drive +  2*reach - 18*land });
  }
  for (const side of [["frontleg","frontleg0","frontleg1","frontleg2"],
                      ["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"]]) {
    // forelegs tuck in the crouch, then REACH forward through the flight and
    // stay reaching into the landing, which is what takes the impact
    // -26 at the elbow folded the forearm back under the reaching shoulder, so
    // the limb read as a stub however far the shoulder swung. A reaching foreleg
    // is very nearly ONE straight line from shoulder to toe.
    P.body(side[0], { pitch: -34*crouch + 40*drive + 92*reach + 62*land });
    P.body(side[1], { pitch:  46*crouch - 20*drive -  8*reach - 34*land });
    P.body(side[2], { pitch: -20*crouch +  6*drive +  4*reach + 16*land });
  }
  // The trunk stays close to level in the air - it is stretched, not tipped.
  P.hips({ dz: -0.020*crouch + 0.012*drive + 0.098*fly - 0.014*land, dfwd: fly*0.026,
           pitch: 12*crouch + 16*drive - 4*fly + 14*land });
  spine(P, { pitch: -16*crouch - 6*drive + 8*fly - 12*land });
  neck(P, { pitch: 8*crouch + 10*reach + 6*land });
  headPose(P, { pitch: -4*crouch + 2*reach - 6*land });
  ears(P, { pitch: -6 - 16*air, spread: -5*air });
  tailPose(P, { curl: -16*crouch + 30*fly, yaw: sin(TAU*ts*3)*7 });
}

function bark(f,T,P,LT){
  const t=f/T, ts=t*1.2;
  // Two barks. Each one is a whole-body event: the chest drives it, the
  // forehand lifts, the head snaps forward and the ears go back on the bark
  // and forward again in the gap between.
  const pulse = (c) => { const d=(ts-c)/0.10; return d<0||d>1?0:Math.sin(PI*d); };
  const b = Math.max(pulse(0.16), pulse(0.52))
          + 0.5*Math.max(pulse(0.16), pulse(0.52));
  const lean = smooth(ts/0.14) - smooth((ts-0.85)/0.25);
  P.hips({ dz: 0.0015*b, dfwd: 0.002*b + 0.002*lean, pitch: -3*b - 2*lean });
  spine(P, { pitch: -13*b - 6*lean, bend: sin(TAU*ts*1.3)*2 });
  neck(P, { pitch: 14*lean + 12*b, yaw: sin(TAU*ts*0.8)*4 });
  headPose(P, { pitch: 6*lean + 14*b, yaw: sin(TAU*ts*0.9)*5 });
  jaw(P, 17*b);
  ears(P, { pitch: -22*b + 8*(1-b)*lean, spread: -10*b + 4*lean });
  tailPose(P, { curl: 20*lean, yaw: sin(TAU*ts*4)*16*lean });
}

function sniffGround(f,T,P,LT){
  const t=f/T;
  // Dogs sniff at about 5.8 Hz - fast, small, and utterly characteristic. The
  // whole head bobs with it, the nostrils lead, and the head tracks side to
  // side across the scent line rather than sitting in one spot.
  const s = sin(TAU*t*14);   // 14 cycles / 2.4s = 5.83 Hz
  // NO RAMP. The clip is a LOOP of a dog already working a scent line, so every
  // frame should be in the sniffing pose and the only motion should be the two
  // things that are genuinely periodic over the clip - the 5.8 Hz nose bob and
  // the one-cycle cast. A ramp that rises and stays put a head-down frame next
  // to a head-up one at the seam, because the loop is closed by forcing the last
  // frame equal to the first: a 57 degree step at the head every single cycle.
  // Ramping back down fixed the head and moved the problem to the legs, which
  // then had to stand the dog up and lower it again inside one loop - 102
  // degrees in a frame at the shoulder. Holding the pose removes both. The
  // mixer cross-fades into this clip, so it needs no ramp of its own.
  const dn = 1;
  const cast = sin(TAU*t);
  const fwd = 0.016*dn;
  // Posed from each leg's own planted anchor - see FOLDED above.
  LT.LF = null; LT.RF = null;
  // The forehand DROPS. Positive pitch here raises the chin 142% of a hip
  // height per 40 degrees - four times the neck's authority - so a positive
  // body pitch simply overrode the neck and sent the nose skyward however far
  // the neck was bent down. The body has to go with it, not against it.
  // The body stays STANDING. -0.016 was a crouch, and with the trunk tilt and
  // the nose guard on top of it the dog ended up down on its belly with its
  // legs buried in its own coat - which is not what a tracking dog does. A dog
  // working a scent line stands at very nearly its normal height and puts its
  // head down; the lowering is all neck.
  // The BODY stays quiet and the HEAD does the casting. Swinging the spine 8
  // degrees and rolling the hips with it made the whole dog sway, which reads
  // as an animal losing its balance rather than one quartering a scent line.
  // The dog STANDS. Crouching to help the nose reach was tried at three depths
  // and all of them cost more than they bought: dropping the shoulder from 1.17
  // to 0.90 hides most of the foreleg behind the lowered head, so the front of
  // the dog reads as a huddle with two stumps under it rather than an animal
  // standing over a scent. The neck can reach the ground from a standing
  // shoulder on this rig - it was doing so before the crouch was added.
  P.hips({ dz: -0.001*dn, pitch: -2*dn, yaw: cast*5 });
  spine(P, { pitch: -3*dn, bend: cast*11 });
  // NEGATIVE lowers the chin - measured on this rig, not assumed. Positive
  // here sent the nose to the sky: the chin doubled in height, from 99% to
  // 205% of hip height, while the clip was called Sniff_GROUND.
  // Sized from the MEASURED leverage on this rig, not guessed: per 40 degrees
  // the chin moves 36% of a hip height at neck0, 26% at neck1, 30% at the head.
  // Reaching the ground from a standing 99% needs most of the neck's range, and
  // the earlier -22 and -30 only ever got it half way down - a dog peering at
  // the grass rather than sniffing it.
  // THE NECK REACHES FORWARD, it does not just bend down.
  //
  // neck() shares its pitch 0.45/0.55 between the two cervical joints, giving
  // the CRANIAL segment the larger share - which is right for a dog looking
  // around, and wrong here. The larger share at the tip curls the end of the
  // neck under, so the head came down onto the chest instead of out in front of
  // it, and with the muzzle aimed steeply down the crown of the skull ended up
  // facing forward: the render showed the back of the head for a third of the
  // clip, a dog burying its face in its own ruff rather than tracking a scent.
  //
  // A dog working a scent line extends the neck forward AND down in close to a
  // straight line, so the proximal joint takes most of the angle and the distal
  // one stays comparatively straight, carrying the head out ahead of the chest.
  // NO ROLL on the neck. With the neck pitched 70 degrees down, a roll about
  // its own axis is very nearly a world-space PITCH, so the small cosmetic roll
  // that came with the cast was tipping the head nose-over at the extremes -
  // crown carriage measured +40 through most of the clip and +7 at full cast,
  // which is the head rolling face-first into the ground once a cycle.
  // The CAST lives in the body, not the neck.
  //
  // Yawing a neck that is already pitched 50 degrees down does not swing the
  // head sideways - it tips it, and asymmetrically: measured, the crown sat at
  // a steady +40 for the half-cycle where the cast was positive and fell to +7
  // for the half where it was negative, i.e. the head rolled face-first into
  // the ground once per loop. With the cast switched off entirely the carriage
  // held +40 on every frame, which is what identified it.
  //
  // A dog quartering a scent line swings its whole forehand across the line
  // anyway; the neck barely twists. So the cast is spent on the spine and the
  // pelvis, and the neck keeps only a token amount.
  P.body("neck0", { pitch: -46*dn + s*1.2, yaw: cast*1.5 });
  P.body("neck1", { pitch: -18*dn + s*0.8, yaw: cast*2 });
  // The head EXTENDS at the base of the skull, so the muzzle points forward and
  // down along the scent line instead of being folded under the neck. Without
  // this line the skull simply follows the curled neck and ends up crown-first,
  // nose pointing back between the forelegs - measured, the muzzle line sat at
  // -65 degrees where a tracking dog carries it near -35.
  // Roll kept small. It is roll, not yaw, that turns the crown towards the
  // viewer at the extremes of the cast - a dog quartering a scent line swings
  // its head across the line, it does not tip it over.
  headPose(P, { pitch: 60*dn + s*2.4, yaw: cast*2 });
  jaw(P, 2 + s*1.6);
  // Ears fall forward over the face as the head goes down - gravity, not pose.
  ears(P, { pitch: 12*dn, spread: 5*dn });
  tailPose(P, { curl: -6, yaw: sin(TAU*t*3)*12 });
}

function shakeOff(f,T,P,LT){
  const t=f/T, ts=t*1.3;
  // The most-misanimated dog action there is.
  //
  // The famous ~90 degrees of amplitude is the SKIN. Loose dermal tissue
  // contributes roughly 60 of those degrees on its own; the SKELETON rotates
  // only about 30. Animating the spine to 90 gives a dog being wrung out like
  // a towel. So: 30 degrees of skeleton, and the read comes from frequency and
  // from the ears and tongue, which is precisely what the new joints buy.
  //
  // Frequency scales with body size; a ~5 kg puppy shakes at about 6 Hz, and
  // the motion is close to pure simple harmonic. And ALL FOUR PAWS STAY DOWN -
  // the feet do not leave the ground, the body counter-rotates above them.
  const env = smooth(ts/0.18) - smooth((ts-0.95)/0.30);
  const w = sin(TAU*ts*6.0)*env;
  // Travelling wave, head to tail: the shake starts at the head and runs back.
  const wAt = (lagS) => sin(TAU*(ts-lagS)*6.0)*env;
  P.hips({ roll: wAt(0.10)*6.5, yaw: wAt(0.10)*3, dz: Math.abs(w)*0.001 });
  spine(P, { roll: wAt(0.055)*10, bend: wAt(0.055)*5 });
  // The head leads and swings furthest - the skeleton's 30 degrees, no more.
  neck(P, { roll: w*9, yaw: w*6, couple: 0.35 });
  headPose(P, { roll: w*5, yaw: -w*5, pitch: -4*env });
  jaw(P, 6*env + Math.abs(w)*5);
  // Ears are the whole effect. They are unweighted flaps on the end of a
  // 6 Hz driver, so they slap right around the skull - the secondary pass
  // does that on its own from the head's acceleration and needs no key here.
  ears(P, { pitch: -6*env, spread: 4*env });
  tailPose(P, { curl: -6*env, yaw: wAt(0.16)*30 });
}

function tailWag(f,T,P,LT){
  const t=f/T;
  // Published, and replicated: a happy dog's wag is RIGHT-BIASED. Left-biased
  // wagging signals the opposite. Amplitude and speed encode AROUSAL, not
  // happiness - so a big fast wag is not automatically a friendly one, and the
  // bias is what actually carries the valence.
  //
  // So the sweep is offset to the dog's right rather than centred, which is a
  // one-line change almost nothing implements and which is the difference
  // between a happy dog and an agitated one.
  const BIAS = -12;                       // negative yaw = the dog's right
  const w = sin(TAU*t*6);    // 6 cycles / 2.0s = 3 Hz
  // A real wag moves the whole rear end. The tail is heavy relative to a puppy
  // and the hips counter-swing against it - the classic "wagging the dog".
  // The rear end swings with the tail - subtle, because the feet are planted -
  // and the head swings the OTHER way, as a counterweight, with a small bob on
  // the double frequency. A dog wagging with a dead head reads as a toy with a
  // motor in it; the head is most of what makes it look pleased.
  P.hips({ yaw: -w*2.6, roll: w*1.6, dz: Math.abs(w)*0.0008 });
  spine(P, { bend: -w*3.0, roll: w*1.2 });
  // SUBTLE. The head joins in, it does not conduct: a wag is the tail's
  // business and a head swinging as hard as the tail reads as the whole dog
  // being shaken rather than wagging. Roughly half the previous amplitude, and
  // the little bob on the double frequency is what carries most of the life.
  neck(P, { yaw: w*1.2, pitch: 4 + sin(TAU*t*12)*0.4 });
  headPose(P, { yaw: w*0.8, pitch: 3 + sin(TAU*t*12)*0.45, roll: w*0.9 });
  // ears swing with the head; the secondary pass adds the lag on top
  ears(P, { pitch: -6, spread: 2, yaw: w*0.5 });
  tailPose(P, { curl: 22, yaw: BIAS + w*42, roll: w*8 });
}


if (process.env.PROBE) {
  {
    // with all four legs on their planted anchors, or this measures Walk frame
    // zero, which is mid-stride and wildly asymmetric left to right
    const savedP = PLANTED_LEGS;
    PLANTED_LEGS = new Set(["LF","RF","LB","RB"]);
    const W0p = fk(freshLocal());
    const ang3 = (a,b,c) => { const u=vnorm(vsub(a,b)), v=vnorm(vsub(c,b));
      return Math.acos(Math.max(-1,Math.min(1,vdot(u,v))))*180/Math.PI; };
    console.log("  [angles] standing INTERIOR joint angles (vet convention):");
    for (const k of ["LB","RB","LF","RF"]) {
      const c = LEGS[k].map((n) => idByName[n]);
      console.log(`    ${k}  joint1 ${ang3(W0p.pos.get(c[0]),W0p.pos.get(c[1]),W0p.pos.get(c[2])).toFixed(0)} deg   joint2 ${ang3(W0p.pos.get(c[1]),W0p.pos.get(c[2]),W0p.pos.get(c[3])).toFixed(0)} deg`);
    }
    PLANTED_LEGS = savedP;
  }
  // Which way does a positive pitch actually swing each hind-leg bone? The sign
  // convention is the single thing that went wrong twice on the buffalo, so it
  // is measured here rather than assumed.
  const base = freshLocal(), W0 = fk(base);
  for (const k of ["LF","RF","LB","RB"]) {
    const c = LEGS[k].map((n) => idByName[n]);
    let reach = 0;
    for (let i = 0; i < 3; i++) reach += vlen(vsub(W0.pos.get(c[i+1]), W0.pos.get(c[i])));
    const rootY = W0.pos.get(c[0])[1] - GROUND;
    console.log(`    ${k} straight-leg reach ${(reach/HIP_H*100).toFixed(0)}% of hip height, its root sits at ${(rootY/HIP_H*100).toFixed(0)}%  -> horizontal room ${(Math.sqrt(Math.max(0,reach*reach-rootY*rootY))/HIP_H*100).toFixed(0)}%`);
  }
  console.log("  [probe] STANCE: paw position relative to its own shoulder/hip, % of hip height");
  console.log("           (+z = paw FORWARD of the shoulder, -z = trailing behind it)");
  for (const k of ["LF","RF","LB","RB"]) {
    const root = W0.pos.get(idByName[LEGS[k][0]]);
    const paw  = stanceHoof[k];
    console.log(`    ${k}  dz=${((paw[2]-root[2])/HIP_H*100).toFixed(0).padStart(5)}%   dx=${((paw[0]-root[0])/HIP_H*100).toFixed(0).padStart(5)}%  <- lateral`);
  }
  console.log("  [probe] standing joint heights, % of hip height:");
  for (const k of ["LB","RB","LF","RF"]) console.log("    " + k.padEnd(3) +
    LEGS[k].map((n) => `${n}=${((W0.pos.get(idByName[n])[1] - GROUND)/HIP_H*100).toFixed(0)}%`).join("  "));
  console.log(`    GROUND=${GROUND.toFixed(4)}  HIP_H=${HIP_H.toFixed(4)}  hipY=${((W0.pos.get(idByName.Hips)[1]-GROUND)/HIP_H*100).toFixed(0)}%`);
  const yB = W0.pos.get(idByName.backleg2)[1], zB = W0.pos.get(idByName.backleg2)[2];
  const yF = W0.pos.get(idByName.frontleg2)[1], zF = W0.pos.get(idByName.frontleg2)[2];
  const yH = W0.pos.get(idByName.headend)[1], zH = W0.pos.get(idByName.headend)[2];
  // where does the hind paw go, relative to its own HIP, for a range of hip
  // pitch? Needed for the sploot: the leg has to end up BEHIND the hip (-z).
  {
    const hipP = W0.pos.get(idByName.backleg);
    const row = [];
    for (const deg of [-90,-60,-30,0,30,60,90]) {
      const l = freshLocal(); poser(l).body("backleg", { pitch: deg });
      const W = fk(l); const p = W.pos.get(idByName.backleg2), h = W.pos.get(idByName.backleg);
      row.push(`${deg}:z${((p[2]-h[2])/HIP_H*100).toFixed(0)}/y${((p[1]-h[1])/HIP_H*100).toFixed(0)}`);
    }
    console.log("  [sploot] hip pitch -> paw (z=forward+, y=up+) rel. hip: " + row.join("  "));
    void hipP;
  }
  // front leg: which pitch lays the paw FORWARD and level, for the sleep stretch
  {
    const row = [];
    for (const deg of [-30,0,30,60,90,120]) {
      const l = freshLocal(); poser(l).body("frontleg", { pitch: deg });
      const W = fk(l); const p = W.pos.get(idByName.frontleg2), h = W.pos.get(idByName.frontleg);
      row.push(`${deg}:z${((p[2]-h[2])/HIP_H*100).toFixed(0)}/y${((p[1]-h[1])/HIP_H*100).toFixed(0)}`);
    }
    console.log("  [fore] shoulder pitch -> paw (z=fwd+, y=up+) rel. shoulder: " + row.join("  "));
  }
  // which axis swings a hind leg OUT to the side (abduction), for the leg-lift
  {
    const y0 = W0.pos.get(idByName.backleg2)[1], x0 = W0.pos.get(idByName.backleg2)[0];
    for (const ax of ["pitch","yaw","roll"]) {
      const out2 = [];
      for (const deg of [-50, 50]) {
        const l = freshLocal(); poser(l).body("backleg", { [ax]: deg });
        const p = fk(l).pos.get(idByName.backleg2);
        out2.push(`${deg>0?"+":""}${deg}: dx=${((p[0]-x0)/HIP_H*100).toFixed(0)}% dy=${((p[1]-y0)/HIP_H*100).toFixed(0)}%`);
      }
      console.log(`  [abduct] backleg ${ax.padEnd(5)} -> paw ${out2.join("   ")}`);
    }
  }
  for (const bone of ["Hips","spine0","spine1","chest","neck0","neck1","head"]) {
    const out = [];
    for (const deg of [-40, 40]) {
      const l = freshLocal(); poser(l).body(bone, { pitch: deg });
      const p = fk(l).pos.get(idByName.headend);
      const y0 = yH, z0 = zH;
      out.push(`${deg > 0 ? "+" : ""}${deg}: dy=${((p[1]-y0)/HIP_H*100).toFixed(0)}% dz=${((p[2]-z0)/HIP_H*100).toFixed(0)}%`);
    }
    console.log(`  [probe] ${bone.padEnd(9)} CHIN moves  ${out.join("   ")}`);
  }
  process.exit(0);
}

// ── build all clips ─────────────────────────────────────────────────────
const CLIPS = [
  // Idle IS authored. The source Idle is a frozen pose - measured, its trunk
  // tilt runs 3.85..3.85 and its hip height 1.00..1.00 across the whole clip,
  // which is to say nothing moves at all. That reads as the game having paused.
  // A standing dog breathes, shifts its weight and flicks an ear.
  ["Idle",          4.0, idle,        true ],
  // Walk is NOT authored. They ship exactly as the
  // model came, and the reason is worth recording: they were re-authored here
  // on the theory that a hand-made Walk sitting next to seventeen solver-made
  // clips would stand out. It did stand out - because the solver's Walk was
  // WORSE. The source clips were made by hand for this mesh and read correctly;
  // running them back through an IK solver, a rate limiter and a ground clamp
  // could only cost quality, and did. The pipeline's value is the fourteen
  // clips that did not exist before, not re-doing four that already worked.
  ["Idle_Alert",    3.0, idleAlert,   true ],
  ["Trot",          0.66, trot,       true ],
  // Authored, not preserved. The source Running reads as the limbs trailing
  // backwards and turning over too slowly for a gallop.
  ["Run",           0.42, run,        true ],
  ["Turn_Left_90",  1.2, turn(1),     false],
  ["Turn_Right_90", 1.2, turn(-1),    false],
  ["Sit",           1.6, sit,         false],
  ["Lie_Down",      2.2, lieDown,     false],
  ["Sleep",         4.0, sleep,       true ],
  ["Play_Bow",      1.4, playBow,     false],
  ["Beg",           3.0, beg,         true ],
  ["Pee",           3.4, pee,         false],
  ["Jump",          1.1, jump,        false],
  ["Bark",          1.2, bark,        false],
  ["Sniff_Ground",  2.4, sniffGround, true ],
  ["Shake_Off",     1.3, shakeOff,    false],
  // Authored after all, unlike the other three source clips. The source wag
  // moves all four legs - which is not what a wagging dog does standing still -
  // and barely moves the head. Here the feet stay planted (no gait targets are
  // set, so every leg simply solves to its own standing spot), the rear end
  // swings with the tail, and the head actually joins in.
  ["Tail_Wag",      2.0, tailWag,     true ],
];
// Per-clip secondary weights. The default is 1 across the board; these are the
// clips where the physics needs a different amount of the same effect rather
// than a different effect.
const SECONDARY = {
  Idle:          { panting: 0.30, breath: 1.6 },
  Idle_Alert:    { panting: 0, tongue: 0.4, shift: 0.6 },
  Walk:          { panting: 0.20, shift: 0.4 },
  Trot:          { panting: 0.55, shift: 0.2 },
  // A 0.47s gallop cycle has no room for an ear flick and does not need one.
  Run:           { panting: 0.85, shift: 0, breath: 0, micro: 0 },  // the gallop IS the breath
  Turn_Left_90:  { shift: 0.3, panting: 0.3 },
  Turn_Right_90: { shift: 0.3, panting: 0.3 },
  Sit:           { panting: 0.45 },
  Lie_Down:      { panting: 0.35, shift: 0.5 },
  // Asleep: no panting, no weight shift, but the breath is the whole point and
  // is keyed directly in the clip, so the generic breath layer comes off.
  // A sleeping dog still flicks an ear, but it is not looking around: the
  // attention re-aims and the lick come right down.
  Sleep:         { panting: 0, breath: 0, shift: 0, ear: 0.35, tail: 0.3, micro: 0.45 },
  Play_Bow:      { panting: 0.70, shift: 0 },
  Beg:           { panting: 0.55, shift: 0.25 },
  Pee:           { panting: 0.35, shift: 0.5 },
  Jump:          { panting: 0.3, shift: 0, breath: 0, ear: 1.35, micro: 0.35 },  // ears fly
  Bark:          { panting: 0.25, shift: 0.3, ear: 1.15, micro: 0.55 },
  Sniff_Ground:  { panting: 0, tongue: 0.5, shift: 0.4 },
  // The shake is entirely carried by ears and tongue. Let them off the leash.
  Shake_Off:     { panting: 0, breath: 0, shift: 0, ear: 1.6, tongue: 1.8, tail: 1.3, micro: 0.3 },
  // The EARS were the problem, not the head. The head was already down to 7.6
  // degrees peak-to-peak while the ears were swinging 91 - the secondary layer
  // drives them from head acceleration, and a 3 Hz wag shakes the skull enough
  // to set them flying. Big ear motion on a small head reads as the head
  // itself moving, which is why this kept coming back after the head was
  // already quiet.
  Tail_Wag:      { panting: 0.65, shift: 0.2, ear: 0.18, tongue: 0.45, micro: 0.6 },
};

const FLOOR = (() => { let lo = Infinity;
  for (let f = 0; f < WN; f++) { const W = walkPose[f];
    for (const [id, pts] of SHAPE) { const p = W.pos.get(id), r = W.rot.get(id);
      if (!p) continue;
      for (const o of pts) { const y = p[1] + qrot(r, o)[1]; if (y < lo) lo = y; } } }
  return lo; })();
function liftBody(local, dy) {
  const id = idByName.Hips, e = local.get(id);
  local.set(id, { r: e.r, t: vadd(e.t, qrot(qconj(ARM_R), vscale(UP, dy))) });
}
{ const l = freshLocal(); const r = lowestSkin(l);
  console.log(`  [shape] joints with skin: ${SHAPE.size}, standing lowest skin y=${r.y.toFixed(5)} vs GROUND=${GROUND.toFixed(5)} (delta ${(r.y-GROUND).toFixed(5)}, HIP_H=${HIP_H.toFixed(4)})`); }

const authored = [];
for (const [name, secs, fn, loop] of CLIPS) {
  // Which feet the IK is allowed to plant. A clip that folds a limb under the
  // body must pose it directly - planting it drags it back to the floor.
  // Which legs the clip poses DIRECTLY, i.e. deliberately off the ground. This
  // has to match what each clip actually does: Sit, Lie_Down and Play_Bow were
  // rewritten to keep every paw on the solver, and leaving them listed here
  // denied their hind legs a planted anchor - Beg dropped to 11% contact purely
  // because this table still described the version before the rewrite.
  const FOLDED = {
    Sleep:         ["LF","RF"],
    Jump:          ["LF","RF","LB","RB"],

    // The sniff's forelegs are STANDING STILL, so they are posed from their own
    // planted anchors rather than solved. Their targets never moved and the body
    // barely does, yet the left foreleg was stepping 70 degrees in a frame with
    // a 40 degree reversal while the right sat at 0.8 - the solver wandering
    // between equally good answers. A leg that is not asked to go anywhere
    // should not be handed to an IK solver at all.
    Sniff_Ground:  ["LF","RF"],
    Sit:           ["LB","RB"],
    Lie_Down:      ["LB","RB"],
    Pee:           ["LB"],
  }[name] ?? [];
  PLANTED_LEGS = new Set(["LF","RF","LB","RB"].filter((k) => !FOLDED.includes(k)));
  FREE_FOLD = new Set(FOLDED);
  // Settle the body onto the floor by its own skin for every clip whose
  // support changes shape - a sit, a lie or a bow has no planted-hoof anchor
  // to hold it at the right height, so it must find the floor geometrically.
  SETTLE = false;   // height is set inside each clip now, never by a post-pass that fights it
  // Walk_Two_Legs and Jump are NOT deep folds - a dog balancing upright stands
  // on nearly straight hind legs. Widening their hinge range let the stifle
  // invert and put the hock half a hip height through the floor while the paw
  // sat obediently on its target.
  DEEP_FOLD = /^(Sit|Lie_Down|Sleep|Beg|Play_Bow)$/.test(name);
  // Only the HIND pair on the stretch. Forcing the forelegs down too drives the
  // elbow 21% of a hip height under, because a foreleg lying flat out in front
  // already has its paw on the floor and the extra pull just straightens it
  // past where the shoulder can follow.
  REPLANT_FORCE = new Set(name === "Beg" ? ["LB","RB"] : []);
  FLAT_SEED.clear();   // a seed from the previous clip is meaningless in this one
  FLAT_LIMB_LOG = [];
  ANCHOR_BASE_LEGS = /^(Sleep|Beg|Sniff_Ground)$/.test(name);
  FLAT_REPLAY = name === "Sleep";
  if (TORSO_SET == null) {
    TORSO_SET = new Set(["Hips","chest","spine0","spine1",
      ...Object.values(LEGS).flat()].map((n)=>idByName[n]).filter((i)=>i!=null));
  }
  // A galloping limb is near-straight at the extremes of stance; holding it to
  // the standing cap makes the reach clamp lift a planted foot and tears a
  // false suspension into the stride.
  REACH_CAP = /^(Run|Trot|Jump)$/.test(name)
    ? { LF: 0.985, RF: 0.985, LB: 0.985, RB: 0.985 }
    // A stretch is the one pose where the legs ARE meant to be near-straight;
    // the standing 0.94 cap pulled the paws up off their floor targets.
    : name === "Beg" ? { LF: 0.98, RF: 0.98, LB: 0.98, RB: 0.98 } : {};
  SEC = SECONDARY[name] ?? {};
  TRUNK = TRUNK_RANGE[name] ?? null;
  MUZZLE = MUZZLE_RANGE[name] ?? null;
  // The sternum guard is OFF for the lying clips. It fights settleOn, which
  // already puts the chest on the floor as part of the support set: the guard
  // pushed the chest through the floor, buryGuard then lifted the whole dog to
  // get it out, and the two cancelled into a standing animal with a dropped
  // head - hips at 104% of standing height in a clip called Lie_Down.
  STERNUM = 0;
  // asleep, the chin comes to rest ON the extended forelegs, not on the floor
  // Sleep: the chin rests ON the forelegs, so the datum is a foreleg thick.
  // Sniff_Ground: the nose stops just SHORT of the ground. Craven, Paterson &
  // Settles (2010) put the working standoff at about 1 cm - "the distance
  // within which dogs have been observed to hold their noses from the ground
  // during scent tracking" - and on this model 1 cm is roughly 0.004. Landing
  // the nose exactly on FLOOR let the muzzle's own fur dip through it.
  // Sniff_Ground's datum is NOT the 1 cm working standoff it looks like. The
  // guard measures the lowest skin of the whole head GROUP, and that group
  // includes the TONGUE - which is hanging out, is the lowest thing on the head
  // by some margin, and was therefore the thing being rested on the floor. The
  // nose sat above it and the mouth dragged. The datum has to clear the tongue,
  // not the nose.
  //
  // Sleep and Beg rest the chin ON the extended forelegs, so the datum is a
  // whole foreleg's thickness up, not the 0.013 that was there: measured, the
  // chin sat 0.048 above the floor while the forearm's top surface is near
  // 0.030, so the head was hovering a centimetre clear of the legs it is
  // supposed to be lying on. The guard can only ever RAISE the head, so this
  // number is what actually decides where the chin comes to rest.
  NOSE_REST = /^(Sleep|Beg)$/.test(name) ? 0.030 : name === "Sniff_Ground" ? 0.018 : 0;
  void 0;
  // OFF. The measured chin-on-leg solve rotated the neck the WRONG WAY - it
  // applied 54 degrees and put the muzzle in the air - and a guard that can do
  // that is worse than the 0.156 gap it was meant to close. Kept because the
  // measurement (highestSkin under the chin) is the right idea, but it does not
  // ship until the sign and the basin are proven.
  CHIN_REST = false;
  // A sniffing dog carries the top of its skull at roughly 45 degrees, with a
  // little rhythm on it at the sniff frequency. Nothing else needs this yet.
  CROWN_SEED = 0;
  CROWN = name === "Sniff_Ground" ? 46 : null;
  CLIP_FPS = FPS * (RATE[name] ?? 1);
  const frames = Math.round(secs*CLIP_FPS) + 1;
  process.stdout.write(`  ${name} ${frames}f${CLIP_FPS !== FPS ? `@${CLIP_FPS}` : ""}… `);
  FLIP_LOG = "";
  const poses = buildClip(frames, fn, loop);
  authored.push({ name, frames, poses, fps: CLIP_FPS });
  {
    // The honest grounding number: where the SKIN sits relative to the floor.
    // The QA measures paw JOINTS against the Walk's own minimum, which a folded
    // pose beats simply by laying the foot flat - so it cannot tell a dog
    // resting on a flat metatarsus from one sinking through the floor.
    // Ears excluded, as in buryGuard: they are soft, they hang lower than the
    // muzzle, and a dog with its nose down rests them on the ground.
    const earIds = new Set(["earend","R_earend","earTipL","earTipR"].map((n) => idByName[n]).filter((i) => i != null));
    let lo = Infinity, hi = -Infinity, who = null;
    for (const p of poses) { const r = lowestSkin(p, earIds); const y = r.y - FLOOR;
      if (y < lo) { lo = y; who = r.joint; } hi = Math.max(hi, y); }
    let nBad = 0; for (const p of poses) if (lowestSkin(p, earIds).y - FLOOR < -0.02*HIP_H) nBad++;
    // How far each paw ends from the target it was solved to, and how far it
    // ends from its own root laterally. The first says whether the solver hit
    // its mark; the second says whether the LEG is splayed out sideways, which
    // the source clips never do by more than 0.16 of a hip height.
    let missMax = 0, latMax = 0, latSum = 0, latN = 0;
    for (const p of poses) {
      const W = fk(p);
      for (const k in hoofId) {
        const tgt = p.__targets?.[k];
        const paw = W.pos.get(hoofId[k]);
        if (tgt) missMax = Math.max(missMax, vlen(vsub(paw, tgt)) / HIP_H);
        const root = W.pos.get(idByName[LEGS[k][0]]);
        const lat = Math.abs(paw[0] - root[0]) / HIP_H;
        latMax = Math.max(latMax, lat); latSum += lat; latN++;
      }
    }
    if (process.env.SOLVEDBG && SOLVE_ERR.length) {
      const mx = Math.max(...SOLVE_ERR), mean = SOLVE_ERR.reduce((a,b)=>a+b,0)/SOLVE_ERR.length;
      console.log(`       SOLVE error (immediately after solveLeg): mean ${mean.toFixed(3)} max ${mx.toFixed(3)}  over ${SOLVE_ERR.length} solves`);
      SOLVE_ERR.length = 0;
    }
    if (process.env.LEGDBG) console.log(`       target miss max ${missMax.toFixed(3)}   lateral mean ${(latSum/latN).toFixed(3)} max ${latMax.toFixed(3)}`);
    if (process.env.MISSDUMP === name) {
      const p0 = poses[0], W0b = fk(p0);
      for (const k in hoofId) {
        const tgt = p0.__targets?.[k]; if (!tgt) continue;
        const hip = W0b.pos.get(idByName[LEGS[k][0]]);
        const paw = W0b.pos.get(hoofId[k]);
        console.log(`         ${k}: hip->target ${(vlen(vsub(tgt,hip))/HIP_H).toFixed(2)}  hip->paw ${(vlen(vsub(paw,hip))/HIP_H).toFixed(2)}  reach ${(LEG_REACH[k]/HIP_H).toFixed(2)}  |paw-tgt| ${(vlen(vsub(paw,tgt))/HIP_H).toFixed(2)}`);
      }
    }
    if (false) {
      for (let f = 0; f < poses.length; f++) {
        const W = fk(poses[f]); const row = [];
        for (const k in hoofId) {
          const tgt = poses[f].__targets?.[k];
          if (!tgt) { row.push(`${k} -`); continue; }
          const paw = W.pos.get(hoofId[k]);
          row.push(`${k} ${(vlen(vsub(paw,tgt))/HIP_H).toFixed(2)}`);
        }
        if (f % 3 === 0) console.log(`         f${String(f).padStart(2)}  ${row.join("  ")}`);
      }
    }
    console.log(`ok   floor ${(lo/HIP_H*100).toFixed(1).padStart(6)}%..${(hi/HIP_H*100).toFixed(0).padStart(3)}%  under on ${String(nBad).padStart(3)}/${poses.length} frames  lowest=${who != null ? nName(who) : "?"}`);
  }
}

// ── encode ──────────────────────────────────────────────────────────────
const extra = []; let cursor = bin.length;
function addFloatAccessor(arr, type) {
  const flat = type === "SCALAR" ? arr : arr.flat();
  const buf = Buffer.alloc(flat.length * 4); flat.forEach((v, i) => buf.writeFloatLE(v, i*4));
  const pad = (4 - (cursor % 4)) % 4; if (pad){ extra.push(Buffer.alloc(pad)); cursor += pad; }
  json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length });
  extra.push(buf); cursor += buf.length;
  const a = { bufferView: json.bufferViews.length-1, componentType: 5126, count: arr.length, type };
  if (type === "SCALAR"){ a.min=[Math.min(...arr)]; a.max=[Math.max(...arr)]; }
  json.accessors.push(a); return json.accessors.length-1;
}
// The source's own takes are KEPT, renamed to the library's convention. Only
// the authored clips are appended after them.
const KEEP = { Walking: "Walk" };
json.animations = json.animations.filter((a) => KEEP[a.name] != null);
for (const a of json.animations) a.name = KEEP[a.name];
console.log(`  preserved from source, untouched: ${json.animations.map((a) => a.name).join(", ")}`);
for (const clip of authored) {
  const times = Array.from({length: clip.frames}, (_, f) => f/(clip.fps ?? FPS));
  const tAcc = addFloatAccessor(times, "SCALAR");
  const samplers = [], channels = [];
  for (const j of joints) {
    const rot = clip.poses.map((p)=>p.get(j).r);
    const rAcc = addFloatAccessor(rot, "VEC4");
    channels.push({ sampler: samplers.length, target:{ node:j, path:"rotation" }});
    samplers.push({ input:tAcc, output:rAcc, interpolation:"LINEAR" });
    if (nName(j) === "Hips") {
      const tr = clip.poses.map((p)=>p.get(j).t);
      const trAcc = addFloatAccessor(tr, "VEC3");
      channels.push({ sampler: samplers.length, target:{ node:j, path:"translation" }});
      samplers.push({ input:tAcc, output:trAcc, interpolation:"LINEAR" });
    }
  }
  json.animations.push({ name: clip.name, samplers, channels });
}

// ── no clip scales the root ─────────────────────────────────────────────
//
// The source Walk animates Hips.scale to a constant 0.8999 while the node's own
// rest scale is 1.0, and no other source take touches scale at all. A mixer
// only writes the properties a clip animates, so the puppy was 11% bigger on
// the authored clips than on the Walk, and which size you got depended on which
// clip had played last.
//
// Copying Walk's value onto every clip was tried first and fixes the
// inconsistency at the WRONG END. Scale on the Hips node scales its children
// about the Hips ORIGIN, and this pipeline computes GROUND and FLOOR from
// forward kinematics, which ignores scale - so every authored clip is grounded
// for scale 1.0 by construction. Shrinking to 0.8999 lifts each paw 11% of its
// hip-distance towards the hips. Measured in Blender, which does apply node
// scale: with 0.8999 on everything, Walk's lowest vertex sat at +0.045 while
// Idle's sat at -0.103 - the clips no longer shared a floor, and the whole dog
// was a tenth smaller than it had been.
//
// So the scale comes OFF instead. Every clip then renders at the node's rest
// scale of 1.0, which is the frame the grounding was solved in, and all
// eighteen sit on the same plane at the size the model was built at.
for (const a of json.animations) {
  const before = a.channels.length;
  a.channels = a.channels.filter((c) => c.target.path !== "scale");
  if (a.channels.length !== before) console.log(`  root scale: dropped from ${a.name}`);
}

// Drop the accessors and bufferViews the deleted source takes used? No - the
// glTF spec allows orphans and the meshopt pass prunes them. Rewriting indices
// here would risk the skin and mesh accessors for no size win before
// compression.


// ── the material must not glow ──────────────────────────────────────────
//
// The raw Meshy export ships the ALBEDO as an emissive texture at full
// strength (emissiveFactor [1,1,1]) with specularColorFactor [2,2,2]. That
// makes the model self-illuminated: it ignores the scene lighting, washes out
// flat, and reads as a glowing toy rather than a dog standing in the world.
//
// The Puppy that was already deployed had this stripped - emissiveFactor
// [0,0,0], no emissive texture - and rebuilding from the raw export silently
// threw that fix away. Doing it here means it cannot be lost again by
// rebuilding from source. (The shipped Buffalo has the same fault.)
for (const m of json.materials ?? []) {
  m.emissiveFactor = [0, 0, 0];
  delete m.emissiveTexture;
  delete m.extensions?.KHR_materials_emissive_strength;
  const sp = m.extensions?.KHR_materials_specular;
  if (sp?.specularColorFactor) sp.specularColorFactor = sp.specularColorFactor.map((x) => Math.min(1, x));
  // ...and set the PBR factors, which is the half of this that matters.
  //
  // The export leaves metallicFactor and roughnessFactor UNDEFINED, and glTF
  // defaults both to 1.0 - fully metallic. A fully metallic surface with no
  // environment map to reflect renders BLACK, and the emissive texture was the
  // only thing making the model visible at all. Strip the emissive without
  // fixing this and the animal turns into a silhouette, which is exactly what
  // happened to the buffalo the first time.
  //
  // Fur is a dielectric: metallic 0, and rough, so it takes the scene light
  // diffusely instead of glinting.
  const pbr = (m.pbrMetallicRoughness ??= {});
  pbr.metallicFactor = 0;
  pbr.roughnessFactor = 0.9;
}

const newBin = Buffer.concat([bin, ...extra]);
json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(json), "utf8"); const jp=(4-(jb.length%4))%4; const jc=Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp=(4-(newBin.length%4))%4; const bc=Buffer.concat([newBin, Buffer.alloc(bp)]);
const chunk=(l,t)=>{const h=Buffer.alloc(8);h.writeUInt32LE(l,0);h.writeUInt32LE(t,4);return h;};
const total = 12 + 8 + jc.length + 8 + bc.length;
const hdr = Buffer.alloc(12); hdr.write("glTF",0); hdr.writeUInt32LE(2,4); hdr.writeUInt32LE(total,8);
writeFileSync(outPath, Buffer.concat([hdr, chunk(jc.length,0x4e4f534a), jc, chunk(bc.length,0x004e4942), bc]));
console.log(`\nwrote ${outPath}  ${total.toLocaleString()} bytes, ${json.animations.length} clips`);
