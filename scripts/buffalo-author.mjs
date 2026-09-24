/**
 * Authors the buffalo's game clips directly in glTF node space — the space
 * the file ships in and the QA measures in — and appends them to the
 * ORIGINAL GLB untouched.
 *
 * Why not Blender: the rig carries a baked ~45deg orientation under a
 * 0.01-scale armature, so "up" in Blender world space is neither +Y nor +Z
 * and every height measurement there was wrong. Node space is clean: the
 * source Walk passes QA in it with sane numbers (hip 0.14, hooves 0.03-0.05,
 * ground -0.076, forward +Z, left +X, up +Y).
 *
 * Legs are never posed by hand. A hoof gets a world target — planted on the
 * ground, or on the Walk's own arc — and CCD inverse kinematics solves the
 * four leg-bone rotations to reach it. Contact is therefore a property of
 * the solve, not a hope. The body (hips, chest, head, tail, ears) is posed
 * additively over the Walk's standing frame so every clip is unmistakably
 * the same animal.
 *
 *   node scripts/buffalo-author.mjs original.glb out.glb
 */
import { readFileSync, writeFileSync } from "node:fs";

const [origPath, outPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
// `--cattle` authors the cow's own Walk in place of the source take, and a
// cattle-shaped Idle and Graze; `--calf` makes those a calf's. The buffalo
// runs without either and is authored exactly as before.
const CATTLE = process.argv.includes("--cattle") || process.argv.includes("--calf");
const CALF = process.argv.includes("--calf");
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
const BODY = ["Hips","chest","head","earend","R_earend", ...TAIL];
const FWD=[0,0,1], LEFT=[1,0,0], UP=[0,1,0];   // measured from the source Walk

// ── the source Walk sampled to 30fps: per-bone local r/t ────────────────
const walk = json.animations[0];
const wdur = Math.max(...walk.samplers.map((s) => acc[s.input].max[0]));
const FPS = 30, WN = Math.round(wdur*FPS)+1;
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
let LEVEL_LIFT = null;
let DEV_SLACK = 1;
let NO_ENVELOPE = false;
let SETTLE = false;
let SETTLE_HEAD = false;
// The barrel - what actually takes an animal's weight when it lies on its side.
let TORSO_SET = null;
let BARREL_SET = null;
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
    else if (dist < minR) {
      // A LEG THAT CANNOT FOLD ANY FURTHER STEPS OUT. IT DOES NOT PUSH
      // THROUGH THE FLOOR.
      //
      // This used to scale the target along the hip->target direction, which
      // for a foot on the ground points mostly DOWN — so the moment a
      // descending body brought its own ground contact inside the leg's
      // minimum fold, the clamp drove the target below the floor and the IK
      // dutifully followed. Measured on the grazing cow with her pelvis
      // pitched 26 degrees nose-down: 125 frames of penetration, the front
      // hooves and pasterns up to 0.0006 under, which is 39% of her hip
      // height. It is also why lowering the forehand to reach the grass
      // always had to be abandoned.
      //
      // A real animal in that position takes its forefeet FORWARD and stands
      // over them — which is exactly what a grazing bovid does. So the
      // target stays on the ground plane and slides horizontally out to the
      // distance the leg can actually hold.
      const h = hip[1] - target[1];                      // how far the root is above it
      const flat = Math.hypot(d[0], d[2]);
      if (minR > Math.abs(h) && flat > 1e-9) {
        const want = Math.sqrt(minR * minR - h * h);
        const kx = want / flat;
        target = [hip[0] + d[0] * kx, target[1], hip[2] + d[2] * kx];
      } else {
        // The root is lower than the leg can fold to at all; nothing on the
        // ground plane is reachable, so fall back to the old behaviour and
        // let the reporting pick it up rather than pretending otherwise.
        target = vadd(hip, vscale(d, minR / dist));
      }
    }
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
    const back = vscale(FWD, -1);                       // every leg here folds away from the head
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
  const foldGuard = () => { if (NO_ENVELOPE) return; clampEnvelope(local, k, 0); clampEnvelope(local, k, 1); };
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
      const cur = local.get(jb); let nr = qnorm(qmul(cur.r, qaxis(localAxis, ang)));
      // Anchor to the known-good stand pose: a joint may bend well away from it
      // to reach a target, but not so far that the whole leg flips up over the
      // body — the CCD's cross-product solve is handedness-sensitive and drove
      // exactly that on the left-back leg from an almost-correct start. Bounding
      // each joint's deviation from stand keeps every leg down and anatomical.
      const sr = (planted(k) && legAnchor.has(jb)) ? legAnchor.get(jb) : stand.get(jb).r;
      const dev = 2 * Math.acos(Math.min(1, Math.abs(nr[0]*sr[0]+nr[1]*sr[1]+nr[2]*sr[2]+nr[3]*sr[3]))) * 180/Math.PI;
      const base = Math.max(12, (WALK_SWING.get(jb) ?? 45) * (SWING_MARGIN[b] ?? 1.6));
      const lim = (FREE_FOLD.has(k) ? base * 2.4 : base) * DEV_SLACK;
      if (dev > lim) nr = qnorm(slerp(sr, nr, lim / dev));
      // ...and a hard cap on how far the bone may leave its REST orientation.
      // This is what keeps the stride distal: the shoulder is held near the
      // 24 degrees the Walk uses while the carpus and fetlock take the extra
      // reach, instead of the whole limb being swung from the top.
      {
        const rr = restR(jb);
        const cap = (WALK_REST_SWING.get(jb) ?? 60) * (SWING_MARGIN[b] ?? 1.6) * (FREE_FOLD.has(k) ? 2.4 : 1) * DEV_SLACK;
        const dr = 2 * Math.acos(Math.min(1, Math.abs(nr[0]*rr[0]+nr[1]*rr[1]+nr[2]*rr[2]+nr[3]*rr[3]))) * 180 / Math.PI;
        if (dr > cap) nr = qnorm(slerp(rr, nr, cap / dr));
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
    const cap = (WALK_REST_SWING.get(jb) ?? 60) * (SWING_MARGIN[b] ?? 1.6) * (FREE_FOLD.has(k) ? 2.4 : 1) * DEV_SLACK;
    const dr = 2 * Math.acos(Math.min(1, Math.abs(cur.r[0]*rr[0]+cur.r[1]*rr[1]+cur.r[2]*rr[2]+cur.r[3]*rr[3]))) * 180 / Math.PI;
    if (dr > cap) local.set(jb, { r: qnorm(slerp(rr, cur.r, cap / dr)), t: cur.t });
  }
}
// ── pose helpers (additive over stand) ──────────────────────────────────
// A visual-space rotation, pre-multiplied in the bone's PARENT frame so
// "pitch the head down" means down in the world, not down in whatever
// orientation this particular bone was modelled with.
function applyVisual(local, name, pitch, yaw, roll) {
  const id = idByName[name], base = stand.get(id);
  // A BONE THIS RIG DOES NOT HAVE IS NOT AN ERROR.
  //
  // The clip authoring here is written against bone NAMES, and the names are
  // shared across this pack's quadrupeds — which is what lets the cow and the
  // calf be authored by the same tool. They are not identical rigs though:
  // the buffalo carries `neck0` and `neck1`, the cattle do not, so posing the
  // neck threw on a rig that is otherwise a perfect match. Skipping the bone
  // leaves that part of the pose to the bones which DO exist (here, the
  // chest and the head between them), which is the right answer and the only
  // one that keeps this usable for the next animal in the pack.
  if (id == null || base == null) { return null; }
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
      if (q == null) { return; }
      const base = stand.get(idByName.Hips);
      // Move the root by a visual-space offset, expressed in its local frame.
      const off = vadd(vadd(vscale(UP,dz), vscale(FWD,dfwd)), vscale(LEFT,dleft));
      const offLocal = qrot(qconj(ARM_R), off);
      local.set(idByName.Hips, { r: q, t: vadd(base.t, offLocal) });
    },
  };
}
function freshLocal() { const m = new Map(); for (const j of joints){ const e = stand.get(j);
  const useP = legAnchor.has(j) && planted(legOf.get(j));
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
    // Faded over THIS clip's lift when it sets one. The source's lift is
    // 0.29 hip heights; the cattle Walk lifts a third of that, and measured
    // against the source's the levelling never let go — the hoof stayed
    // flat through the whole swing.
    const L = LEVEL_LIFT?.[k] ?? LIFT[k];
    const lift = L > 1e-9 ? (t[1] - GROUND) / (1.2 * L) : 0;
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
  fn(phaseFrame, period, P, legTargets, local);
  for (const k in hoofId) {
    if (legTargets[k] === null) continue;   // posed directly (airborne limb); IK would fight it
    solveLeg(local, k, legTargets[k] ?? stanceHoof[k]);
  }
  const lw = levelHooves(local, legTargets);
  const outMap = new Map([...local].map(([i,e])=>[i,{r:e.r,t:e.t}]));
  outMap.__level = lw;
  return outMap;
}
function buildClip(frames, fn, loop) {
  // Cold, history-free solve. The leg IK is a deterministic function of the
  // target and body pose, so two frames at the same gait phase produce the
  // same pose — which makes a loop periodic in pose and velocity with no
  // special seam handling. Warm-starting was tried and rejected: it removed
  // planted-foot jitter but never settled a fast gait onto a clean period.
  const out = []; const period = frames - 1;
  for (let f=0; f<frames; f++) out.push(solveFrame(null, loop ? f % period : f, period, fn));
  const preSmooth = out.map((p) => new Map(LEG_BONE_IDS.map((id) => [id, p.get(id).r.slice()])));
  smoothLegRotations(out, loop);
  enforceExtension(out, preSmooth);
  for (const p of out) relevelHooves(p, p.__level);
  if (SETTLE) {
    const HEAD_GROUP = new Set(["head","headend","earend","R_earend"]
      .map((n) => idByName[n]).filter((i) => i != null));
    const TORSO = new Set(["Hips","chest"].map((n) => idByName[n]).filter((i) => i != null));
    for (let f = 0; f < out.length; f++) {
      const p = out[f];
      // Settle on the BARREL. Whatever hangs lowest holds the carcass up if it
      // is included: with the head in, the nose jacked it 7% of its height off
      // the ground; with the legs in, a limb reaching for the floor stopped the
      // hips dropping at all. What actually takes an animal's weight when it
      // lies on its side is the ribcage and hips, so that is what is put on the
      // floor. The head and the limbs then land beside it, which is right.
      // ...and only ONCE IT IS GOING OVER. Applied from frame 0 this dragged
      // the barrel down to the floor while the animal was still standing, and
      // took the legs with it - they never folded, they were just pushed
      // through the ground. The legs are solved against the body where the
      // animation puts it, so the body must not move under them until the
      // topple is what is putting it there.
      // A final LIFT-ONLY correction. The body settle happens inside death()
      // before the legs are solved - which is what stopped it dragging them
      // under - but that also means it cannot see where the legs ended up. So
      // once everything is posed, if anything except the head is still below
      // the floor the whole body is raised by exactly that much. It can only
      // ever push up, so it cannot re-create the burying it was split up to
      // avoid, and the correction is small enough not to disturb the pose.
      {
        const up = FLOOR - lowestSkin(p, HEAD_GROUP).y;
        if (up > 1e-9) liftBody(p, up);
      }
      // THE NECK GIVING OUT IS DEATH'S, AND ONLY DEATH'S.
      //
      // `SETTLE` bundled two unrelated things: a lift-only floor correction,
      // which any pose that ends up on the ground wants, and this — the head
      // dropping until the cheek is on the floor, which is what dying looks
      // like and nothing else. Turning the flag on for `Rest` to get the
      // first quietly brought the second: the resting cow held her head up
      // for half the loop and then slowly laid it down in the dirt, never
      // lifting it again, so the clip did not even close on itself. Measured
      // at -21 degrees of head pitch at frame 0 against -8 at the end.
      if (!SETTLE_HEAD) continue;
      // The neck gives out and the head falls until the cheek is on the
      // ground - found by search on the roll angle, since after a 78 degree
      // topple the way down is across the body, not along its pitch axis.
      const w = smooth(Math.max(0, Math.min(1, (f / period - 0.52) / 0.34)));
      if (w <= 1e-4) continue;
      const hid = idByName.head, base = p.get(hid).r;
      const gapAt = (deg) => {
        p.set(hid, { r: visualOn(hid, base, { roll: deg }), t: p.get(hid).t });
        return lowestSkin(p, null, HEAD_GROUP).y - FLOOR;
      };
      let want = 0;
      if (gapAt(0) > 0) {
        want = -110;
        for (let deg = -2; deg >= -110; deg -= 2) if (gapAt(deg) <= 0) { want = deg; break; }
      }
      p.set(hid, { r: visualOn(hid, base, { roll: want * w }), t: p.get(hid).t });
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
const WALK_PH = { LB:0.0, LF:0.25, RB:0.5, RF:0.75 };
// TROT, not a gallop — diagonal pairs.
//
// Dagg 1973 is explicit that large ungulates trot rather than gallop at speed:
// the trot is less tiring, more stable, and the centre of gravity moves far
// less than in a gallop, which matters enormously when you have a ~50kg head
// to throw up on every stride. Bison trot to travel, to move as a herd, in
// alarm and in sustained flight; the gallop is a short burst only, and a
// LOOPING gallop reads wrong for exactly that reason.
//
// It also answers why the gallop looked so unlike the Walk: a walk is a
// symmetrical four-beat gait and a gallop is asymmetric bounding. A trot is
// symmetrical too, so it reads as a faster, springier version of the Walk
// rather than as a different animal.
//
// McHugh's bison trot: 1-4, 2-3 — LF with RH, then RF with LH — and all four
// feet leave the ground twice per stride, so the duty factor sits below 0.5.
const RUN_PH  = { LF:0.0, RB:0.0, RF:0.5, LB:0.5 };

// ── the horns ───────────────────────────────────────────────────────────
//
// `R_earend` is not an ear. It drives the HORNS - 378 vertices at the top of
// the skull - and `earend` drives nothing at all (zero vertices weighted to
// it). Proven by rotating R_earend alone: both horns tilt, the face does not
// move.
//
// Every clip here used to flick the two as if they were ears, which rotated
// the HORNS independently of the head. That is why the head could go down to
// charge while the horns stayed pointing up. All of it is gone; the horns now
// simply follow the skull, which is what horns do.
//
// The bone is still useful, but only deliberately: `hornTip` aims the horns
// relative to the head, and nothing else touches it.
const hornTip = (P, deg) => { P.body("R_earend", { pitch: deg }); };

// ── the animation functions ─────────────────────────────────────────────
function idle(f,T,P){ const t=f/T, br=0.5-0.5*Math.cos(TAU*t);
  // deeper breathing + a slow weight sway; the barrel visibly rises and falls
  P.hips({dz:0.017*HIP_H*(br-0.5), dleft:0.016*HIP_H*sin(TAU*t), pitch:0.9*br, roll:1.2*sin(TAU*t)});
  P.body("chest",{pitch:-1.8*br});
  // a slow look-around: head sweeps side to side and dips to graze once per loop
  const graze=Math.max(0,sin(TAU*t-1.2))**3;
  P.body("head",{pitch:2.4*sin(TAU*t+0.8)+9*graze, yaw:7*sin(TAU*t)});
  // The neck does the looking, not just the skull. A slow scan carried by the
  // whole neck reads as an animal watching its surroundings; the head alone
  // swivelling on a fixed neck reads as a puppet. Breathing rides up it too -
  // cattle at rest breathe 20-44/min, and this loop is 4s, so one deep cycle.
  P.body("neck0",{ pitch: 2.2*br, yaw: 5*sin(TAU*t - 0.35), roll: 1.6*sin(TAU*t - 0.5) });
  P.body("neck1",{ pitch: 1.6*br, yaw: 4*sin(TAU*t - 0.6),  roll: 1.2*sin(TAU*t - 0.8) });
  // two crisp ear flicks per loop
  const fl=Math.max(0,sin(TAU*2*t-0.6))**6;
  const fr=Math.max(0,sin(TAU*2*t+1.4))**6;
  TAIL.forEach((n,i)=>P.body(n,{yaw:(6+i*2.2)*sin(TAU*t-i*0.6), pitch:-2.6*sin(TAU*t)})); }
// ── the cattle's Idle: looking, not sweeping ────────────────────────────
//
// The shared `idle` swings the head on a sine, side to side, for ever. That
// is the one thing an animal standing in a field never does: it LOOKS —
// turns to something, holds on it, turns back — and between looks it is
// nearly still. Continuous motion reads as a machine; move-and-hold reads as
// attention. So this is a sequence of held poses with eased moves between
// them, over a loop long enough (8s) that the pattern is not the first
// thing you notice.
//
// Each key: [time, neck yaw, head yaw, head pitch (+ up), neck pitch, head roll].
// The HEAD LEADS: it arrives at each pose a beat before the neck, the way an
// animal's eyes and ears go first and the weight of the neck follows.
const COW_LOOK = [
  [0.00,   0,   0,  0,   0,  0],
  [0.10,   0,   0,  0,   0,  0],
  [0.19,  11,   9,  3,   1,  2.5],   // something off to the left
  [0.38,  12,  10,  2,   1,  2.5],
  [0.47,   2,   1, -7,  -7,  0],     // back round, and down to sniff the grass
  [0.57,   1,   0, -8,  -8,  0],
  [0.66, -10, -12,  5,   2, -3],     // up and right: a sound
  [0.83, -11, -12,  4,   2, -3],
  [0.93,   0,   0,  0,   0,  0],
  [1.00,   0,   0,  0,   0,  0],
];
function lookAt(t) {
  let u = ((t % 1) + 1) % 1, i = 0;
  while (i < COW_LOOK.length - 2 && COW_LOOK[i + 1][0] <= u) i++;
  const a = COW_LOOK[i], b = COW_LOOK[i + 1];
  const w = smooth((u - a[0]) / Math.max(1e-6, b[0] - a[0]));
  return a.map((x, j) => x + (b[j] - x) * w);
}
function cowIdle(f, T, P) {
  const t = f / T;
  // Breathing: three breaths across 8s, about 22 a minute, which is a cow at
  // rest. The barrel rises; the withers follow a little.
  const br = 0.5 - 0.5 * Math.cos(TAU * 3 * t);
  // Weight moves once across the loop, from one side to the other and back.
  P.hips({ dz: 0.012 * HIP_H * (br - 0.5), dleft: 0.012 * HIP_H * sin(TAU * t), pitch: 0.6 * br, roll: 0.9 * sin(TAU * t) });
  P.body("chest", { pitch: -1.2 * br, roll: -0.5 * sin(TAU * t) });
  const head = lookAt(t), neck = lookAt(t - 0.035);
  // A held pose is not a frozen one: a tiny drift, at whole-number rates so
  // the loop still closes, keeps the head alive through each hold.
  const drift = 0.6 * sin(TAU * 5 * t + 0.4) + 0.4 * sin(TAU * 7 * t + 1.9);
  P.body("neck0", { yaw: 0.55 * neck[1], pitch: 0.6 * neck[4] + 1.2 * br, roll: 0.3 * neck[5] });
  P.body("neck1", { yaw: 0.45 * neck[1], pitch: 0.4 * neck[4] + 0.8 * br });
  P.body("head",  { yaw: head[2] + 0.5 * drift, pitch: head[3] + 0.6 * drift, roll: head[5] });
  TAIL.forEach((n, i) => P.body(n, { yaw: (3 + i * 1.6) * sin(TAU * 2 * t - i * 0.6), pitch: -1.5 * sin(TAU * 2 * t) }));
}
function idleAlert(f,T,P){ const t=f/T, br=0.5-0.5*Math.cos(TAU*t);
  // The alarm response is documented directly: bison "stop and stared for
  // several seconds with ears brought forwards and head directed towards the
  // disturbance". The operative word is STARED - it is a freeze, a long
  // statue-still hold, not a continuous nervous fidget. So the clip snaps into
  // the pose, holds it almost motionless for the middle two thirds, and only
  // then eases. `hold` is 1 through the stare and 0 at the ends; everything
  // that would otherwise oscillate is multiplied down by it.
  const snapIn = smooth(Math.min(1, t/0.12));
  const hold = snapIn * (1 - smooth(Math.max(0, (t-0.80)/0.20)));
  const stir = 1 - hold;                       // motion is allowed only outside the stare
  P.hips({dz:0.005*HIP_H*br*stir, dfwd:0.012*HIP_H*snapIn, pitch:-2.2*snapIn,
          roll:0.9*sin(TAU*2*t)*stir});
  // The withers come up with the head, for the same reason and the same sign.
  P.body("chest",{pitch:(7.0+0.5*br)*snapIn});
  // Head carried clearly HIGHER than the calm idle — that raised, oriented
  // head is the whole read of "something has its attention". Restrained
  // otherwise: this is alertness, not aggression, so no pawing or rearing.
  // Head up and squarely ON the disturbance, and it STAYS there. The head-up
  // carriage is the alert signal; a swinging head would read as scanning, which
  // is a different behaviour.
  // SIGN CORRECTED. This read `-21`, and on this rig a negative pitch LOWERS
  // the muzzle — the graze function documents that explicitly, having been
  // caught by the same thing from the other direction. So the alert pose did
  // the exact opposite of the paragraph above it: an alarmed animal dropped
  // its head 21 degrees. Measured against the calm idle, the alert muzzle sat
  // BELOW it, which is the posture of an animal going back to eating.
  P.body("head",{pitch:21*snapIn + 1.2*sin(TAU*2*t)*stir, yaw:9*sin(TAU*t)*stir});
  // Even a frozen animal is not inert: the neck holds tension and trembles
  // slightly. Tiny amplitude on purpose - enough that the silhouette is alive
  // without breaking the stare that the alarm response is built on.
  P.body("neck0",{ pitch: 9*snapIn + 0.5*sin(TAU*7*t)*hold, yaw: 4*sin(TAU*t)*stir });
  P.body("neck1",{ pitch: 7*snapIn + 0.4*sin(TAU*7.6*t)*hold, yaw: 3*sin(TAU*t)*stir });
  // Both ears rotate forward and lock - forward/above the neckline is the
  // high-arousal posture. The twitching is damped out through the stare too.
  // a sharp tail flick once per loop
  // Tail elevation tracks postural tonus - readiness to move - so an alerted
  // animal carries it up. It is NOT a charge signal; it fires in play, herd
  // movement and flight too, which is why it belongs here on a clip that
  // resolves either way.
  const flick=Math.max(0,sin(TAU*t-3.0))**2;
  TAIL.forEach((n,i)=>P.body(n,{yaw:((3+i*1.5)*sin(TAU*1.5*t-i*0.5)+18*flick*(0.5+0.5*i/4))*stir,
                                pitch:-4-9*snapIn})); }
const NECK0_G = -55, NECK1_G = -12;
// How far the forehand comes down to graze. On the cattle this is the whole
// reach: their neck is 0.31 hip heights from withers to poll and is already
// past vertical at NECK0_G — bending it further RAISES the nose (measured,
// -55 to -80 lifted it 0.04) — and aiming the head changes the nose height by
// under 0.05. So the body pitch is the one number that puts the mouth in
// the grass. -20 did (nose 0.01 above the floor) at the cost of fore legs
// folded to half their reach, which read as a bull dropping to charge; -16
// keeps the nose in the grass at 0.07 and straightens them. Anything lighter
// needs a longer neck in the rig, not a different number here.
const GRAZE_PITCH = CATTLE ? -16 : -20;
const HEAD_AIM = -52;   // nose angled 38 deg below level, reaching forward into the grass   // degrees below level that the nose points while feeding
function graze(f,T,P,LT,local){ const t=f/T; const ts = t*6.0;   // seconds within the 6s clip
  // ── Phase 1 (0.0-1.2s): lower the head to the grass ─────────────────────
  // The skull and horns are heavy, so this is not one neck joint rotating:
  // the chest pitches down and the hips give a little as the head reaches out
  // and down. Once the muzzle is at the grass it STAYS there — the clip never
  // returns the head to standing carriage.
  const down = Math.pow(Math.min(1, ts / 1.2), 1.9);
  // ── Phase 2 (1.2-6.0s): sustained feeding ──────────────────────────────
  // Every beat below is a whole number of cycles over g, so the pose AND its
  // velocity at g=1 match g=0: the game can loop [1.2s, 6.0s] head-down
  // indefinitely without a snap, which is 80% of the clip spent feeding.
  const g = Math.max(0, Math.min(1, (ts - 1.2) / 4.8));
  // Wrap-aware: g is a loop, so a beat centred at 0 or 1 must be the SAME beat
  // seen from either end. Without this a chew landing on the boundary appears
  // at full height on the last frame and not at all on the first, which opened
  // a 3deg pose gap in the sub-loop.
  const bump=(c,w)=>{ let d = g - c; while (d > 0.5) d -= 1; while (d < -0.5) d += 1;
    if (Math.abs(d) >= w) return 0; return 0.5 - 0.5*Math.cos(TAU*((d + w)/(2*w))); };
  // Cadence and direction are both taken from the grazing literature rather
  // than invented. A bovid has no upper incisors: the tongue wraps a bunch of
  // grass against the dental pad and the stems are SEVERED BY A HEAD JERK.
  // That jerk is fore-aft, not a lateral sweep — accelerometer work on grazing
  // cattle shows gravity transferring from the vertical axis to the fore-aft
  // axis at each bite. The earlier version swept the head sideways, which is
  // the tongue's job, not the neck's.
  //
  // Rate: one jaw event per ~0.9s (modal inter-event interval 0.84-0.98s;
  // 30-70 bites/min, median 45). Over the 4.8s feeding loop that is FIVE
  // events, not the three it had. Five is also a whole number of cycles, so
  // the loop still closes on pose and velocity.
  const NB = 5;
  let tear = 0, rip = 0;
  for (let i = 0; i < NB; i++) {
    const b = bump((i + 0.5) / NB, 0.055);
    tear = Math.max(tear, b);
    rip += b;                                  // every bite jerks the same way
  }
  // Chews fall BETWEEN the bites and happen with the head still down — cattle
  // interleave bite / chew / chew-bite continuously and do not lift to chew.
  let chew = 0;
  for (let i = 0; i < NB; i++) chew = Math.max(chew, bump((i + 1.0) / NB, 0.06));
  // No head lift at all: chewing head-down is the documented behaviour.
  const feed = down;
  // body stays quiet: a shallow settle, a slow weight shift, no bobbing
  // NOTE ON DIRECTION: the head pitch here is NEGATIVE. Positive pitch on this
  // bone raises the muzzle, and this clip used to run at +40 - which lifted the
  // muzzle from 1.65m standing to 2.45m. It read as grazing in QA only because
  // the QA was tracking `headend`, a leaf bone that sits at z=-0.01 in the rest
  // pose with a degenerate tail and NO vertices weighted to it. It is not the
  // muzzle and never was. The real muzzle is a head-weighted vertex, and it is
  // what every number here is measured against now.
  //
  // The whole forequarter comes down, not just the neck. Measured: rotating
  // the head alone bottoms out with the muzzle 0.31m off the ground and then
  // RISES again past about 40 degrees, because the head tucks under instead of
  // reaching further. This animal's neck simply is not long enough to put the
  // mouth in the grass on its own, so the body lowers to meet it - which is
  // what a grazing bovid does anyway. At -0.21 hip heights the muzzle sits
  // 0.01m above the floor: actually eating, rather than nodding at the grass.
  // Pelvis pitched NOSE-DOWN, and this is the whole trick. It lowers the
  // withers (chest 2.09 -> 1.43) while the HIPS STAY PUT at 1.68, so the
  // hindquarters remain standing and the back legs stay straight - which is
  // exactly how a grazing bovid does it, and what dropping the root instead
  // got wrong (that bent all four).
  P.hips({ dz:-0.02*HIP_H*down + 0.006*HIP_H*sin(TAU*g)*down,
           dfwd: 0.014*HIP_H*down,
           dleft: 0.012*HIP_H*sin(TAU*g)*down,
           pitch: GRAZE_PITCH*down, roll: 1.4*sin(TAU*g)*down });
  P.body("chest",{ pitch: 0*down });
  // THE NECK does the work now, not the skull. Two neck joints were added to
  // the rig (scripts/buffalo-add-neck.mjs) precisely because this clip could
  // not be made right without them: with the head pivoting straight off the
  // withers the muzzle could only swing an arc, and every degree that bought
  // height cost forward reach until the mouth was tucked under the chest.
  // Bending the neck instead carries the mouth DOWN AND FORWARD together.
  P.body("neck0", { pitch: NECK0_G * down });
  P.body("neck1", { pitch: NECK1_G * down });
  // A slow drift across the patch — the animal works a sward, but one bite
  // clears only about a 13cm square, so the head barely translates within a
  // bite and the drift belongs BETWEEN them.
  const crop = (7*sin(TAU*g) + 2.5*sin(TAU*2*g)) * down;
  // The sever: a sharp fore-aft jerk. Up-and-back, then released.
  const jerk = -15 * rip;
  // Rumination-style grinding is LATERAL and slower than the tear - a real,
  // visible distinction from the bite, so the two do not read as one motion.
  const chewSway = 6*chew*sin(TAU*11*g);
  // Aim the head in WORLD space, not relative to its parent.
  //
  // `P.body` builds its rotation axis from the bone's REST parent orientation.
  // That is fine while the parent is near rest, and wrong the moment the neck
  // bends: the head's "pitch" axis has rotated with the neck, so asking for
  // more pitch stopped lifting the nose and started swinging it sideways -
  // measured, the nose angle sat at -58 to -65 degrees no matter what was
  // asked for. Setting the head's world orientation directly makes the nose
  // angle mean what it says, whatever the neck underneath is doing.
  {
    const hid = idByName.head, pid = parent.get(hid);
    const W = fk(local);
    const aim = qmul(qaxis(LEFT, -HEAD_AIM * feed), restWorld.get(hid));
    let r = qnorm(qmul(qconj(W.rot.get(pid)), aim));
    // the tear and the chew ride on top of the aimed pose
    r = visualOn(hid, r, { pitch: jerk - 3 * chew, yaw: crop + chewSway,
                           roll: 3.5 * chew * sin(TAU * 11 * g) });
    local.set(hid, { r, t: local.get(hid).t });
  }
  // Forefeet: a real grazing bovid splays and staggers them to lower its
  // forehand. Tried and reverted - with the pelvis already pitched 16 degrees
  // nose-down the front legs sit near their reach limit, and ANY widening
  // (even 0.10 hip-heights) put hooves through the ground. The stance stays
  // narrow, and the carpus carries the lowering at 85 degrees against the
  // Walk's 61. Widening it needs the forehand raised, which costs muzzle
  // height - the trade is stated rather than hidden.
  const splay = 0.02 * HIP_H * down;      // outward, away from the midline
  const stagger = 0.0 * HIP_H * down;    // the left fore steps forward
  LT.LF = [stanceHoof.LF[0] + LEFT[0]*splay, GROUND,
           stanceHoof.LF[2] + FWD[2]*(0.06*HIP_H*down + stagger)];
  LT.RF = [stanceHoof.RF[0] - LEFT[0]*splay, GROUND,
           stanceHoof.RF[2] + FWD[2]*(0.06*HIP_H*down - stagger*0.55)];
  const fe=Math.max(0,sin(TAU*g-1.8))**6;
  const fr=Math.max(0,sin(TAU*g+0.9))**6;
  const fly = bump(0.36,0.055) + bump(0.86,0.055);
  TAIL.forEach((n,i)=>P.body(n,{yaw:(5+i*1.8)*sin(TAU*g-i*0.5) + 20*fly*(0.4+0.15*i), pitch:-2*sin(TAU*g)})); }
// FAST but HEAVY. Same cycle length, but the body barely rises and the hooves
// stay low: a half-tonne animal does not float between strides. The bounce and
// the hoof lift are what read as "horse" if they are allowed to grow, so both
// are held down and the speed comes from stride length instead.
function run(f,T,P,LT){ const t=f/T; gaitTargets(t,RUN_PH,0.42,1.15,1.00,1,LT);
  // A gallop rises ONCE per cycle, not twice: the body is thrown up as the
  // fore pair leaves and is at its highest through the suspension, then takes
  // the landing on the hind pair.
  //
  // The peak must sit INSIDE the airborne window or it lifts a planted hoof off
  // the ground. With duty 0.34 the stance windows are RB [.00-.34] LB [.90-.24]
  // RF [.58-.96] LF [.48-.86], whose union leaves exactly one gap: [.38-.48].
  // The rise is centred on that gap. It was peaking at .93 - squarely on RF's
  // stance - and was dragging that foot 0.12m into the air.
  // A trot rises TWICE per stride — once as each diagonal pair leaves — where
  // a gallop rises once. That doubled beat is a large part of what reads as
  // "trotting" rather than "running".
  const air = 0.5 - 0.5*Math.cos(2*TAU*(t - 0.21));
  const bob = 0.075*HIP_H*(air - 0.5);
  // The spine gathers and extends with the cycle - the single biggest reason a
  // four-legged gallop reads as heavy rather than as a trotting toy.
  // Spine travel is capped by anatomy, not taste. Horses manage only 9.8-11.4
  // degrees of thoracolumbar flexion/extension at a gallop, and large robust
  // artiodactyls (bison, cattle) have 2-3x SMALLER sagittal range than other
  // artiodactyls - they sit at the bottom of the order. Cheetah-style spinal
  // coiling is flatly wrong for this animal. Hips +-2.5 against chest -+1.5 is
  // 8 degrees peak-to-peak, at the top of what the anatomy allows.
  P.hips({dz:bob, pitch:-3 + 2.5*sin(TAU*t - 1.1)});
  P.body("chest",{pitch:2 - 1.5*sin(TAU*t - 1.1)});
  // A FLEEING gallop carries the head raised toward the hump line - it is the
  // charge that runs with the head down. The hump is a nuchal-ligament crane
  // built to hold a ~50kg skull up cheaply, and it is used here. The head still
  // lags the body's rise and fall rather than tracking it.
  P.body("head",{pitch:-12 - 3.5*sin(TAU*t - 1.7)});
  // Neck inertia. A ~50kg head on a long neck cannot track the body exactly;
  // it answers a beat late, which is most of what separates a heavy animal
  // from a light one at speed. The lag deepens down the neck.
  P.body("neck0",{ pitch: -2.5*sin(TAU*t - 1.9), yaw: 2.2*sin(TAU*t - 2.1) });
  P.body("neck1",{ pitch: -2.0*sin(TAU*t - 2.2), yaw: 1.8*sin(TAU*t - 2.4) });
  TAIL.forEach((n,i)=>P.body(n,{yaw:7*sin(TAU*t-i*0.5)*(1+i*0.25), pitch:5-3.5*sin(TAU*t-1.1-i*0.4)})); }
// The CHARGE is not just a faster run: the head is carried down and forward on
// a committed body line so the horns lead, and it stays there rather than
// bobbing back up to a running carriage.
function chargeLoop(f,T,P,LT){ const t=f/T; gaitTargets(t,RUN_PH,0.50,1.55,1.5,1,LT);
  // Pelvis pitch +2, not -3. A charging bull ARCHES its back - the topline
  // rises - so tipping the pelvis nose-down was doubly wrong: it contradicted
  // the behaviour AND dropped the hump 6.9% below the Walk, the largest size
  // mismatch in the library. The committed low line is carried by the head and
  // chest, which is where the research puts it.
  const bob=0.022*HIP_H*(-0.5*Math.cos(4*PI*t)); P.hips({dz:bob,pitch:2+0.9*sin(4*PI*t)}); P.body("chest",{pitch:3});
  // Head/neck inertia: the forequarters accept weight and the heavy head
  // answers a beat later (lagged), plus a slow lateral drift from the
  // shoulder roll.
  //
  // AGGRESSION. This was deliberately restrained - "small on purpose, the
  // horns must stay on the target" - and it read as a bull jogging rather
  // than charging. The sources are unambiguous that a charging bison is
  // violent about it: head-shaking side to side and head-tossing are listed
  // by the NPS among the direct pre-charge signals, the head is CANTED so one
  // horn leads ("his head inclined, his left horn pointed to its mark"), and
  // the tail is ERECT AND QUIVERING through the run.
  //
  // The neck joints carry most of it - that is what they were added for. The
  // shake runs at three times the stride so it reads as fury rather than as
  // part of the gait, and the head counter-swings against the neck so the
  // skull whips rather than sliding.
  // Dialled back from the first attempt, which overshot: a charging bull is
  // furious but its horns still have to stay on the line, and a 13-degree
  // neck yaw at three times the stride read as thrashing rather than intent.
  // The CANT is kept at full strength - that is the part that reads as aim.
  // DEFENSIVE CARRIAGE, HORNS TO THE FRONT.
  //
  // The head is dropped and the chin drawn in - that chin-tuck is the thing
  // that levels the horns and presents both tips at whatever is in front,
  // which is the posture a bull actually charges in. The earlier version
  // carried a constant 6-degree cant so one horn led; that is real in
  // eyewitness accounts of a strike, but it aims the horns off the line of
  // travel and looks wrong on a sustained charge. The cant is gone and only a
  // small residual sway is left on top of the tuck.
  const shake = sin(6*PI*t), toss = sin(4*PI*t - 0.7);
  // NEGATIVE pitch is DOWN on this rig, for the head and the neck alike.
  // Measured: the previous positive values put the charging muzzle at 2.44m
  // against the Walk's 1.68m - the head was nearly a metre ABOVE standing
  // when it should have been driving low with the horns out front.
  P.body("neck0", { yaw: 4*shake, roll: 2*shake, pitch: -22 + 2*toss });
  P.body("neck1", { yaw: 3*shake, roll: 2*shake, pitch: -16 + 1.5*toss });
  P.body("head",  { pitch: -20 + 2.4*sin(4*PI*t-1.15) + 3*toss,  // chin in, horns level
                    yaw: -3*shake,
                    roll: -2*shake });
  // erect and quivering, not swinging loosely
  TAIL.forEach((n,i)=>P.body(n,{ yaw: 3*sin(9*PI*t - i*0.6), pitch: -16 - 3*sin(7*PI*t - i) })); }
function walkBack(f,T,P,LT){ const t=f/T; gaitTargets(t,{LF:0.13,RB:0.38,RF:0.63,LB:0.88},0.70,0.8,1.0,-1,LT);
  // stronger sway and a backward-leaning weight as it steps back
  // Height matched to the Walk. Backing up leans the weight back, but a
  // nose-up lean RAISES the hump, and this clip was standing 12cm (+4.4%)
  // taller than every other one - the buffalo appeared to change size when the
  // clip changed. The lean is kept (reduced 2.6 -> 1.2) and the residual is
  // taken out at the root, landing within +0.8% of the Walk.
  P.hips({dz:-0.045*HIP_H + 0.016*HIP_H*(-0.5*Math.cos(4*PI*t)), dleft:0.012*HIP_H*sin(2*PI*t), pitch:1.2, roll:1.6*sin(2*PI*t)});
  P.body("chest",{pitch:0.8});
  // head up and wary, scanning with a nervous toss on each step (periodic)
  // No periodic head bob. In cattle a regular head nod at the walk is a SCORED
  // LAMENESS SIGN, not normal locomotion - healthy cows show only a 2-10cm
  // irregular movement. The wary side-to-side scan stays; the nod goes.
  P.body("head",{pitch:-11, yaw:8*sin(2*PI*t)+4*sin(4*PI*t)});
  // Backing up is a stress response, so the neck is up and working - the scan
  // is carried by the neck, with the head adding the quicker second beat.
  P.body("neck0",{ pitch: -6, yaw: 5*sin(2*PI*t - 0.3) });
  P.body("neck1",{ pitch: -4, yaw: 4*sin(2*PI*t - 0.5) });
  TAIL.forEach((n,i)=>P.body(n,{yaw:5*sin(2*PI*t-i*0.5)})); }

// ── the cattle's own Walk ────────────────────────────────────────────────
//
// THE SOURCE TAKE IS NOT A COW WALKING. It is the one clip the cattle arrived
// with, and every other clip here is judged against it — but watched side-on
// it has three faults no amount of layering on top can hide. The hind hooves
// are thrown up almost to the hock on every step (0.29 hip heights of lift;
// a cow clears the ground by a hand's breadth, nearer 0.08). The hind legs
// cross under the body, so on two frames in eight they read as one knotted
// limb. And the head and neck are rigid for the whole cycle, the body a plank
// carried along by the legs. It reads as a prance.
//
// So the cattle walk is authored here like every other clip: hooves on
// ground targets, legs solved with IK, the body posed on top. The source
// stays the REFERENCE — the stance points, the joint envelope and the ground
// speed are all still measured from it — it just no longer ships.
//
// LATERAL SEQUENCE, which `WALK_PH` is not. Read through `gaitTargets`, whose
// phase is `t + phase`, that table puts the touchdowns in the order
// LH, RF, RH, LF — a diagonal-sequence walk, which is a primate's and not a
// bovid's. Cattle set the fore foot down just after the hind on the SAME
// side: LH, LF, RH, RF, a quarter-cycle apart. That ordering is why a cow's
// walk reads as a rolling side-to-side sway rather than a trot slowed down.
const COW_TD = { LB: 0.0, LF: 0.25, RB: 0.5, RF: 0.75 };
// GROUND SPEED IS A CONTRACT WITH THE GAME, not a property of the source.
//
// A planted hoof must travel backward at exactly the speed the game carries
// the animal forward, or it skates. The game moves cattle at
// `CATTLE_PACE × height` per second (world.ts, where a cow gives way to the
// buffalo), and the source take's hooves travelled at 3.3 times that — so
// in the village every step slid backward under her, the treadmill look, on
// top of everything wrong with the take itself. The two numbers are now the
// same number, stated here in the rig's own units and there in the world's.
// Change one and change the other.
const CATTLE_PACE = 0.32;
// Body height as the game measures it: the standing skin, top to bottom.
const SKIN_H = (() => { const W = fk(freshLocal()); let lo = Infinity, hi = -Infinity;
  for (const [id, pts] of SHAPE) { const p = W.pos.get(id), r = W.rot.get(id); if (!p) continue;
    for (const o of pts) { const y = p[1] + qrot(r, o)[1]; lo = Math.min(lo, y); hi = Math.max(hi, y); } }
  return hi - lo; })();
const COW_SPEED = CATTLE_PACE * SKIN_H;
function cowWalkTargets(t, LT, { duty, liftF, liftH, speed, dur }) {
  const stride = speed * dur * duty;             // stance travel at ground speed
  const hoofCurl = {};
  for (const k in COW_TD) {
    let p = (t - COW_TD[k]) % 1; if (p < 0) p += 1;
    const fore = k[1] === "F";
    const base = stanceHoof[k];
    // Centred a little forward of the stance point, as `gaitTargets` does,
    // so the leg is never asked to hold the ground behind its own reach.
    // The FORE window sits further back than the hind. The source take's
    // fore stance point is where its over-reaching fore legs landed, and a
    // shoulder held inside the envelope that take itself uses cannot hold a
    // hoof that far forward: measured, the fore hooves fell 0.2 hip heights
    // short of target through stance and hovered instead of planting.
    const c = fore ? -0.1 : 0.08;
    const zA = stride * (0.5 + c), zB = stride * (-0.5 + c);
    let z, up = 0, curl = 0;
    if (p < duty) {
      z = zA + (zB - zA) * (p / duty);
    } else {
      const W = 1 - duty, u = (p - duty) / W;
      const m = (zB - zA) / duty * W;
      const u2 = u * u, u3 = u2 * u;
      z = (2*u3 - 3*u2 + 1) * zB + (u3 - 2*u2 + u) * m + (-2*u3 + 3*u2) * zA + (u3 - u2) * m;
      // A FORE hoof breaks over and lifts early, as the knee folds, then
      // reaches forward low and straight to land; a HIND hoof is carried
      // lower and more evenly, the hock doing less. Skewing the peak is what
      // separates the two, and the ends stay smooth so touchdown and
      // lift-off carry no vertical velocity spike.
      const w = fore ? u + 0.10 * sin(TAU * u) : u + 0.03 * sin(TAU * u);
      up = (fore ? liftF : liftH) * HIP_H * sin(PI * w);
      // The fetlock flexes through swing — the sole turns to face backward
      // and the toe trails. A hoof held flat through swing reads as a foot
      // on a stick.
      curl = sin(PI * Math.min(1, u * 1.15)) ** 1.4;
    }
    LT[k] = [base[0], GROUND + up, base[2] + z];
    hoofCurl[k] = curl;
  }
  return hoofCurl;
}
const HOOF_BONE = { LF: "frontleg2", RF: "R_frontleg2", LB: "backleg2", RB: "R_backleg2" };
function cowWalk(f, T, P, LT, local) {
  const t = f / T;
  const calf = CALF;
  const curl = cowWalkTargets(t, LT, {
    duty: calf ? 0.60 : 0.64,
    liftF: calf ? 0.15 : 0.11,
    liftH: calf ? 0.12 : 0.085,
    speed: COW_SPEED,
    dur: WALK_SECS,
  });
  // NEGATIVE pitch curls the toe back on this rig's hoof bones. Positive
  // was tried first and turned the hind toe FORWARD through swing, which with
  // the hock flexed laid the whole lower leg flat along the floor.
  //
  // Curled FROM THE PLANTED POSE, and set on every frame including the ones
  // where the curl is zero. `P.body` starts from `stand`, which is the source
  // take's frame 0 — mid-stride, left hind folded — so a curl that began
  // there jumped from the planted hoof to a folded one the instant the foot
  // left the ground: measured, the left hind hoof spun 83 degrees in one
  // frame at every lift-off.
  for (const k in curl) {
    const id = hoofId[k];
    local.set(id, { r: visualOn(id, legAnchor.get(id), { pitch: -(k[1] === "F" ? 38 : 30) * curl[k] }), t: local.get(id).t });
  }
  // EACH END OF THE BODY VAULTS OVER ITS OWN LEGS. A walking quadruped is
  // two inverted pendulums, fore and hind, a quarter-cycle apart: the
  // withers are highest as a fore leg passes vertical under them (t = 0.07,
  // 0.57, mid-stance of RF and LF) and the croup as a hind leg does (0.32,
  // 0.82). So the body does not so much bob as ROCK, fore and aft, twice per
  // stride. Moving the whole body up and down instead — which is what this
  // first did — put the withers at their LOWEST exactly when each fore leg
  // was straightest, and the fore hooves could not stay planted under them.
  const rock = Math.cos(TAU * 2 * (t - 0.07));   // +1 withers up, -1 croup up
  const vault = Math.cos(TAU * 2 * (t - 0.20));                  // what little the whole body lifts
  // THE SWAY IS THE WALK. With a lateral sequence, the weight moves over
  // each side in turn as that side's two feet are down together, so the
  // pelvis rolls and shifts once per stride. The hip on the side of the
  // swinging hind leg drops (hind swing LB 0.64-1.0, RB 0.14-0.5).
  const side = sin(TAU * (t - 0.07));
  P.hips({
    dz: WALK_DZ * HIP_H + (calf ? 0.010 : 0.006) * HIP_H * vault,
    dleft: 0.012 * HIP_H * side,
    roll: 2.2 * side,
    yaw: 1.6 * sin(TAU * (t + 0.18)),
    pitch: WALK_PITCH + (calf ? 2.6 : 2.0) * rock,
  });
  // The shoulders roll AGAINST the pelvis — the spine twists between them —
  // and lag it by a quarter, following the fore feet.
  P.body("chest", { roll: -1.4 * sin(TAU * (t - 0.32)), yaw: -1.2 * sin(TAU * (t - 0.07)) });
  // THE NECK AND HEAD. Carried a little lower than standing — a walking cow
  // leads with her head near withers height — and moving as a chain:
  //
  //  * a small symmetric nod, twice per stride, just after each FORE foot
  //    lands (t = 0.25, 0.75) and the forehand accepts the weight. It must be
  //    even on both beats: an ASYMMETRIC head nod is the scored sign of a
  //    lame cow, so the two dips are deliberately identical;
  //  * a lateral swing once per stride, carried by the neck and following
  //    the shoulders, and the head turning slightly AGAINST it so the eyes
  //    stay on the path — animals stabilise gaze, a rigid head on a swinging
  //    neck reads as a toy;
  //  * the calf's head higher and busier, the adult's steady.
  const nod = -Math.cos(TAU * 2 * (t - 0.30));
  const swing = sin(TAU * (t - 0.36));
  P.body("neck0", { pitch: (calf ? -1 : -5) + (calf ? 1.6 : 1.2) * nod, yaw: 3.2 * swing, roll: 1.2 * swing });
  P.body("neck1", { pitch: (calf ? 0 : -2.5) + (calf ? 1.4 : 1.0) * nod, yaw: 2.4 * sin(TAU * (t - 0.42)) });
  P.body("head", { pitch: (calf ? 2 : 4.5) - (calf ? 1.2 : 0.8) * nod, yaw: -2.6 * sin(TAU * (t - 0.40)),
                   roll: -1.0 * swing });
  // The tail swings with the pelvis as a pendulum, each joint lagging the one
  // above it; the runtime layer adds the swats.
  TAIL.forEach((n, i) => P.body(n, { yaw: (2.4 + i * 1.6) * sin(TAU * (t + 0.18) - 0.7 - i * 0.55),
                                    pitch: 1.5 * rock * (i / 4) }));
}
const WALK_SECS = 1.2;
// Where the hips ride relative to the standing frame, in hip heights, and
// the nose-up carriage of the body in degrees. Found by sweeping both against
// the stance error the probe reports (PROBE=Walk): lower, and the fore legs
// could not stay straight enough to hold the ground; higher or more nose-up,
// and the fore legs locked out at their 0.94 reach cap and lifted instead.
// At these values every hoof holds its mark within 0.01 hip heights through
// stance and the stance legs sit at 0.83-0.93 of reach — straight, not
// locked, which is how a cow walks.
const WALK_DZ = CALF ? 0 : 0.02;
const WALK_PITCH = CALF ? 0 : 1;
// How far past the source take's own joint ranges the walk's legs may go.
// Those ranges were measured on a take whose left and right fore legs were
// planted at different points of their strides, so the left fore inherited
// a narrower window than the right: held to it, it could not stay on its
// mark and hovered through a third of every stance. 1.3 gives both the same
// working room; measured stance error is then under 0.01 hip heights on all
// four.
const WALK_SLACK = 1.3;
if (CATTLE) console.log(`  cattle walk: ${WALK_SECS}s cycle, ground speed ${(COW_SPEED/HIP_H).toFixed(2)} hip heights/s, stride ${(COW_SPEED*WALK_SECS/HIP_H).toFixed(2)} hip heights`);

// A cow or buffalo does not pivot on sliding feet. It shuffles: a foot is set
// down, the body turns AROUND it while it stays put, then that foot is picked
// up and replanted further round the arc. The previous version rotated every
// planted foot's target continuously with the body, so all four skated through
// the whole turn - which is what made the side movement read as wrong.
//
// Each foot now holds a FIXED world spot between steps and only moves during
// its own lift window. Two steps per foot, 45 degrees each, eight steps in
// sequence across the clip: LF RB RF LB, then round again.
function turn(sign){ return (f,T,P,LT)=>{ const t=f/T, s=smooth(t), yaw=90*sign*s;
  const wt = sin(PI*t);                       // one weight cycle across the turn
  // The hips trace a short arc through the turn rather than spinning about a
  // fixed point - a bulge that returns, so the clip still ends in-place.
  P.hips({yaw, dz:-0.022*HIP_H*wt, roll:sign*3.2*wt,
          dleft:sign*0.075*HIP_H*wt, dfwd:0.055*HIP_H*sin(PI*smooth(t)),
          pitch:1.5*wt});
  P.body("head",{yaw:sign*18*sin(PI*Math.min(1,t*1.7)), roll:sign*2.5*wt});
  // Cattle turn the HEAD first and let the body follow - stockmanship
  // literature is explicit about it, and it is the difference between an
  // animal deciding to turn and a model being rotated. The neck leads the
  // head, which leads the shoulders, which lead the hips.
  P.body("neck0",{ yaw: sign*14*sin(PI*Math.min(1, t*1.85)), roll: sign*2*wt });
  P.body("neck1",{ yaw: sign*10*sin(PI*Math.min(1, t*1.75)), roll: sign*1.6*wt });
  P.body("chest",{yaw:sign*7*sin(PI*Math.min(1,t*1.4)), roll:sign*2.0*wt});
  P.body("tailstart",{yaw:sign*8*s}); P.body("tail1",{yaw:sign*6*s});
  const pivot=standW.pos.get(idByName.Hips);
  const rotTo=(v,ang)=>{ const c=Math.cos(ang*PI/180), sn=Math.sin(ang*PI/180); const rel=vsub(v,pivot); const x=vdot(rel,FWD), y=vdot(rel,LEFT); return [pivot[0]+ (FWD[0]*(x*c-y*sn)+LEFT[0]*(x*sn+y*c)), GROUND, pivot[2]+(FWD[2]*(x*c-y*sn)+LEFT[2]*(x*sn+y*c))]; };
  // step schedule: foot -> the two moments it picks up, in clip time
  const seq = sign>0 ? ["LF","RB","RF","LB"] : ["RF","LB","LF","RB"];
  const WIN = 0.115;
  for (let i=0;i<4;i++){
    const k = seq[i];
    const starts = [0.02 + i*0.115, 0.50 + i*0.115];
    let held = 0, lift = 0, from = 0, to = 0, u = -1;
    for (let j=0;j<2;j++){
      const a = starts[j], b = a + WIN;
      if (t >= b) held = (j+1) * 45 * sign;              // step finished
      else if (t > a) { u = (t-a)/WIN; from = j*45*sign; to = (j+1)*45*sign; }
    }
    let ang = held, y = GROUND;
    if (u >= 0) {                                        // mid-step
      const e = 0.5 - 0.5*Math.cos(PI*u);
      ang = from + (to-from)*e;
      lift = LIFT[k]*0.9*sin(PI*u);
      y = GROUND + lift;
    }
    const pnt = rotTo(stanceHoof[k], ang);
    // CROSSOVER on the forelegs. A quadruped does not turn by walking each
    // foot round its own little arc - the OUTSIDE foreleg swings across in
    // front of the inside one, which is what actually carries the shoulders
    // round. Rotating every plant point about a common pivot, as this did,
    // moved the feet to the right places by the end of each step but with the
    // wrong path between them: the front legs passed through each other's
    // lanes instead of stepping over.
    //
    // The cross is applied only to the FRONT feet, only while that foot is in
    // the air, and peaks at mid-swing - so it changes the path and leaves
    // every plant position exactly where the step schedule put it.
    let cross = 0;
    if (u >= 0 && k[1] === "F") {
      const outside = (k[0] === "R") === (sign > 0);     // outside of the turn
      cross = (outside ? 1 : -0.35) * sign * 0.30 * HIP_H * sin(PI * u);
    }
    LT[k] = [pnt[0] + LEFT[0] * cross, y, pnt[2] + LEFT[2] * cross];
  }
}; }

function chargeStart(f,T,P,LT){ const t=f/T;
  if (t<0.50){ const u=t/0.50; const c=smooth(u);
    // sink back and coil, head lowering to aim the horns
    P.hips({dz:-0.085*HIP_H*c, dfwd:-0.06*HIP_H*c, pitch:5*c});
    P.body("chest",{pitch:6*c});
    // AGGRESSION in the wind-up. The NPS warning list is explicit that what
    // comes before a charge is "bluff charging, HEAD BOBBING, pawing,
    // bellowing, or snorting", and head-shaking side to side is named as a
    // direct pre-charge signal. A quiet coil with a 6-degree head sway was
    // not that. The neck joints do the work; the shake builds as the coil
    // tightens, so the animal visibly winds itself up rather than shaking
    // from a standstill.
    const rage = c;                                  // grows through the coil
    const sh = sin(TAU*3.2*u), bob = sin(TAU*2.2*u - 0.5);
    // Same defensive carriage the loop uses: chin drawn in, horns levelled to
    // the front. The coil is where it takes that shape, so by the time it
    // launches the horns are already on the line - and the two clips chain
    // without the head having to snap into position at the handover.
    P.body("neck0", { yaw: 4*sh*rage, roll: 2*sh*rage, pitch: (-18 + 2.5*bob)*rage });
    P.body("neck1", { yaw: 3*sh*rage, roll: 2*sh*rage, pitch: (-13 + 2*bob)*rage });
    P.body("head",  { pitch: -17*c + 3.5*bob*rage,   // chin in, horns level
                      yaw: -3*sh*rage,
                      roll: -2.5*sh*rage });
    // paw the ground twice with the right foreleg — a low buffalo scrape,
    // the hoof barely clearing the dirt it is dragging back
    // The scrape is the tell, so it is made to read. Forelimb only, and the
    // stroke goes DOWN then BACKWARD - a rearward drag under the body, which
    // is what the trauma and ethology sources describe. It was travelling
    // 0.10 hip-heights, which is 15cm and easy to miss; at 0.30 it throws its
    // foot back far enough to see, with the hoof still barely off the dirt.
    const paw=Math.max(0,sin(TAU*2*u-0.4)); const scr=paw*paw;
    LT.RF=[stanceHoof.RF[0], stanceHoof.RF[1]+LIFT.RF*0.55*scr, stanceHoof.RF[2]-0.30*HIP_H*scr];
    // the shoulder digs in with it, and the body rocks back over the hind legs
    P.body("R_frontleg", { pitch: -9*scr });
  } else { const u=(t-0.50)/0.50; const e=smooth(Math.min(1,u*1.35));
    // Explosive launch, but the mass shows: the body drives FORWARD rather
    // than up, and the head stays down on the charge line with the horns out.
    P.hips({dz:-0.085*HIP_H*(1-e)+0.028*HIP_H*e*(0.5-0.5*Math.cos(2*PI*Math.min(1,u*1.2))), dfwd:(-0.06*(1-e)+0.04*e)*HIP_H, pitch:5-3*e});   // hands over to Charge_Loop at ITS pelvis pitch, so the pair chains without a step
    P.body("chest",{pitch:6-1*e});
    // hand over at Charge_Loop's own carriage so the pair chains seamlessly
    P.body("neck0",{pitch:-18-4*e}); P.body("neck1",{pitch:-13-3*e});
    P.body("head",{pitch:-17-3*e});
    // Ease the gait in over the first fifth of the launch. Cutting straight
    // from the pawing pose to a running stride put a step discontinuity at the
    // handover - 3 frames of hoof slide, all of them on that seam.
    const gt=u*0.6; const G={}; gaitTargets(gt,RUN_PH,0.42,1.8,1.35,1,G);
    const bl=smooth(Math.min(1,u/0.20));
    for (const k in G){ const a=stanceHoof[k], b=G[k];
      LT[k]=[a[0]+(b[0]-a[0])*bl, a[1]+(b[1]-a[1])*bl, a[2]+(b[2]-a[2])*bl]; } }
  // tail up and quivering - postural tonus, the readiness-to-move signal
  TAIL.forEach((n,i)=>P.body(n,{ pitch:-17*smooth(t), yaw:3.5*sin(TAU*4.5*t-i*0.6) })); }

function attackHorn(f,T,P,LT){ const t=f/T;
  // 0.00–0.28 wind-up: drop the head, coil weight back — aim the horns low
  if (t<0.28){ const u=smooth(t/0.28); P.hips({dz:-0.03*HIP_H*u,dfwd:-0.06*HIP_H*u,pitch:5*u}); P.body("chest",{pitch:7*u}); P.body("head",{pitch:28*u,yaw:-10*u}); }
  // The surgical description of goring is precise about the mechanic: the
  // neck FLEXES, then EXTENDS explosively to drive the horn up. That is a neck
  // action, and until now this clip only had a skull.
  if (t<0.28){ const u=smooth(t/0.28); P.body("neck0",{pitch:13*u, yaw:-6*u}); P.body("neck1",{pitch:10*u, yaw:-4*u}); }
  // 0.28–0.42 the TOSS: a violent upward hook of the horns + hard forward lunge
  else if (t<0.42){ const u=smooth((t-0.28)/0.14); P.hips({dz:-0.03*HIP_H*(1-u)+0.03*HIP_H*u,dfwd:(-0.06+0.24*u)*HIP_H,pitch:5-13*u}); P.body("chest",{pitch:7-21*u}); P.body("head",{pitch:28-44*u,yaw:-10+26*u}); }
  else if (t<0.42){ const u=smooth((t-0.28)/0.14); P.body("neck0",{pitch:13-30*u, yaw:-6+14*u}); P.body("neck1",{pitch:10-23*u, yaw:-4+10*u}); }
  // 0.42-0.66 follow-through: the CIRCULAR TOSS. Surgical descriptions of goring
  // are unusually precise about this - the neck extends to drive the horn
  // upward, then "the horn acts as a fixed axis while the circular movement of
  // the bull's head turns the victim on its horn". So the head does not simply
  // decay back to neutral: it describes an ARC, pitch and yaw and roll turning
  // together about the horn tip. That arc is the whole point of the attack, and
  // it was the one beat missing.
  else if (t<0.66){ const u=smooth((t-0.42)/0.24);
    const arc = TAU*u*0.75;                        // three quarters of a turn
    P.hips({dz:0.03*HIP_H*(1-u),dfwd:0.18*HIP_H*(1-0.25*u),pitch:-8+5*u});
    P.body("chest",{pitch:-14+9*u, roll:5*sin(arc)});
    P.body("head",{pitch:-16+11*u - 7*Math.cos(arc)+7,
                   yaw:16-8*u + 13*sin(arc),
                   roll:-15*sin(arc)}); }
  // 0.66–1.0 recover to neutral
  else { const u=smooth((t-0.66)/0.34); P.hips({dfwd:0.135*HIP_H*(1-u),pitch:-3*(1-u)}); P.body("chest",{pitch:-4*(1-u)}); P.body("head",{pitch:-10*(1-u)+6*u,yaw:10*(1-u)}); }
  // front hooves re-plant forward through the lunge; body stays over them
  const fwdShift=(t<0.28)?-0.06*HIP_H*smooth(t/0.28):(t<0.66)?(-0.06+0.24*smooth((t-0.28)/0.38))*HIP_H:0.135*HIP_H*(1-smooth((t-0.66)/0.34));
  LT.LF=[stanceHoof.LF[0],stanceHoof.LF[1]+(0.30<t&&t<0.46?LIFT.LF*0.8*sin(PI*(t-0.30)/0.16):0),stanceHoof.LF[2]+fwdShift];
  LT.RF=[stanceHoof.RF[0],stanceHoof.RF[1]+(0.32<t&&t<0.48?LIFT.RF*0.8*sin(PI*(t-0.32)/0.16):0),stanceHoof.RF[2]+fwdShift];
  TAIL.forEach((n,i)=>P.body(n,{pitch:-10*sin(PI*t),yaw:7*sin(8*t-i)})); }

function attackStomp(f,T,P,LT){ const t=f/T;
  // A BUFFALO stamp, not a horse's paw: the hoof breaks the ground by about a
  // fetlock, scrapes back, and is driven down again. Anything approaching
  // chest height reads as the wrong animal, so the lift is held near a sixth
  // of hip height and the body stays square over the other three legs.
  // The lift was 0.85 of the Walk's own swing - about 0.165 hip-heights, which
  // is a PAW, not a strike, and it barely read. A stomp picks the foot up to
  // roughly knee height and drives it down. Still well under chest height:
  // that is the line that separates a buffalo's stamp from a horse's rear,
  // and it is not crossed here.
  const lift=0.46*HIP_H;
  if (t<0.20){ const u=smooth(t/0.20); P.hips({dz:-0.02*HIP_H*u,dleft:0.035*HIP_H*u,pitch:2*u,roll:-1.5*u}); P.body("head",{pitch:16*u,yaw:-7*u}); LT.RF=[stanceHoof.RF[0],stanceHoof.RF[1]+lift*u*0.7,stanceHoof.RF[2]]; }
  else if (t<0.48){ const u=(t-0.20)/0.28; P.hips({dz:-0.02*HIP_H,dleft:0.035*HIP_H,pitch:2,roll:-1.5}); P.body("head",{pitch:16+4*sin(6*PI*u),yaw:-7});
    // paw/scrape: the hoof stays low and drags back toward the body
    LT.RF=[stanceHoof.RF[0],stanceHoof.RF[1]+lift*(0.7+0.3*Math.sqrt(Math.max(0,sin(PI*u)))),stanceHoof.RF[2]+0.07*HIP_H*(sin(PI*u)-1.2*u)]; }
  else if (t<0.56){ const u=smooth((t-0.48)/0.08);
    // THE DRIVE. The whole forequarter goes down with the foot - that is what
    // makes it a stomp and not a step - and the hoof accelerates rather than
    // easing down, so it arrives hard.
    P.hips({dz:-0.02*HIP_H-0.075*HIP_H*u,dleft:0.035*HIP_H*(1-0.6*u),pitch:2+11*u,roll:-1.5+1.5*u});
    P.body("chest",{pitch:9*u});
    P.body("head",{pitch:16+20*u,yaw:-7+3*u});
    LT.RF=[stanceHoof.RF[0],stanceHoof.RF[1]+lift*Math.pow(1-u,2.2),stanceHoof.RF[2]]; }
  else { const u=smooth((t-0.56)/0.44); const jolt=Math.exp(-7*u)*Math.sin(TAU*1.7*u);
    // The strike lands. Half a tonne arriving on one foot shakes the whole
    // animal, so the shudder is roughly tripled and rings a little longer.
    P.hips({dz:-0.095*HIP_H*(1-u)+0.032*HIP_H*jolt, dleft:0.02*HIP_H*(1-u), pitch:13*(1-u)+9*jolt, roll:5*jolt});
    P.body("head",{pitch:36*(1-u)+4*u+20*jolt,yaw:-4*(1-u)});
    P.body("neck0",{pitch:-8*(1-u)+9*jolt});
    P.body("neck1",{pitch:-6*(1-u)+7*jolt});
    P.body("chest",{pitch:10*(1-u)+6*jolt}); LT.RF=stanceHoof.RF; }
  TAIL.forEach((n,i)=>P.body(n,{pitch:-6*sin(PI*t),yaw:7*sin(7*t-i)})); }

const commitArch = (t) => sin(PI*Math.min(1, t*1.15));
function threat(f,T,P,LT){ const t=f/T;
  P.hips({dz:-0.03*HIP_H*Math.sqrt(Math.max(0,sin(PI*t))), dfwd:0.05*HIP_H*(t>0.55?smooth(Math.min(1,(t-0.55)/0.2))*(t>0.80?1-smooth((t-0.80)/0.20)*0.6:1):0), pitch:4*sin(PI*t)});
  // a hard horn-shake in the middle; snort heaves throughout
  const shake = 22*sin(TAU*3.5*t)*(0.15<t&&t<0.58?sin(PI*(t-0.15)/0.43):0);
  const snort = Math.max(0,sin(TAU*2.5*t-1.2))**3;
  // Bulls ARCH THE BACK during display and during battles - it is part of
  // maximising the lateral silhouette that the hump already exaggerates. The
  // chest lifting against a slightly dropped pelvis is that arch.
  P.body("chest",{pitch:9*sin(PI*Math.min(1,t*1.4))-4*snort - 6*commitArch(t)});
  // McHugh 1958 on bison agonistic encounters: the head is LOWERED AND CARRIED
  // SLIGHTLY TO ONE SIDE. The cock is a sustained offset, not part of the toss
  // - it is what aims one horn at the opponent, and eyewitness accounts of
  // charges describe exactly that ("his head inclined, his left horn pointed to
  // its mark"). The chin also draws in toward the body, which is the tell that
  // separates a committed threat from mere alertness.
  const commit = sin(PI*Math.min(1,t*1.15));
  P.body("head",{pitch:30*commit+6, yaw:shake - 14*commit, roll:0.4*shake - 7*commit});
  // The head-toss of a threat display is a NECK movement - a head swinging on
  // a rigid neck reads as a nod, not a threat.
  P.body("neck0",{ pitch: 11*commit, yaw: 0.55*shake - 6*commit, roll: 0.3*shake });
  P.body("neck1",{ pitch: 8*commit,  yaw: 0.4*shake - 4*commit,  roll: 0.2*shake });
  // Two heavy ground-digs with the left foreleg. The hoof barely clears the
  // ground and does its work by DRAGGING backward — a buffalo scraping up
  // dirt. A high, near-vertical foreleg is a horse's gesture and is exactly
  // what this display must not do, so the lift is kept under a sixth of hip
  // height and the scrape carries the aggression instead.
  for (const [a,b] of [[0.56,0.72],[0.74,0.90]]) if (a<=t&&t<=b){ const u=(t-a)/(b-a);
    LT.LF=[stanceHoof.LF[0], stanceHoof.LF[1]+LIFT.LF*0.65*Math.max(0,sin(PI*u*1.15)), stanceHoof.LF[2]+0.11*HIP_H*(sin(PI*u)-1.25*u)]; }
  TAIL.forEach((n,i)=>P.body(n,{pitch:-13*sin(PI*t),yaw:(8+2.5*i)*sin(TAU*2.5*t-i*0.6)})); }

function hit(f,T,P,LT){ const t=f/T;
  // sharp impact spike (0–0.22), then a damped stagger that settles
  // fast rise to a peak at t=0.22, then settle back to zero by the end (a pulse, not a step)
  const imp = t<0.22 ? Math.sin(PI*(t/0.22)*0.5) : Math.cos(PI*0.5*(t-0.22)/0.78);
  const after=Math.max(0,t-0.22)/0.78; const stg=Math.exp(-3.5*after)*Math.sin(TAU*1.6*after);  // damped stagger
  P.hips({dz:-0.05*HIP_H*imp+0.02*HIP_H*stg, dfwd:-0.08*HIP_H*imp+0.03*HIP_H*stg, pitch:-9*imp+5*stg, roll:6*imp+5*stg});
  P.body("chest",{pitch:-13*imp*(1-0.4*t)+3*stg, roll:4*stg});
  P.body("head",{pitch:-28*imp+9*stg, yaw:12*imp+10*stg, roll:-8*imp+6*stg});
  // A blow whips the neck before it moves the head. Same impulse, larger and
  // a fraction earlier at the base, so the motion travels outward.
  P.body("neck0",{ pitch: -13*imp + 4*stg, yaw: 6*imp + 4*stg, roll: -4*imp });
  P.body("neck1",{ pitch: -10*imp + 3*stg, yaw: 5*imp + 3*stg, roll: -3*imp });
  // a bracing stagger-step with the near foreleg to catch the weight
  if (0.18<t&&t<0.46){ const u=(t-0.18)/0.28; LT.LF=[stanceHoof.LF[0]-0.05*HIP_H*sin(PI*u), stanceHoof.LF[1]+LIFT.LF*0.7*sin(PI*u), stanceHoof.LF[2]-0.06*HIP_H*sin(PI*u)]; }
  TAIL.forEach((n,i)=>P.body(n,{pitch:10*sin(PI*t)+6*stg,yaw:6*stg})); }

// Rotate a chain, segment by segment, until no joint in it sits below the
// floor. Each correction is the smallest rotation about the horizontal axis
// perpendicular to the segment that brings its far end back up to GROUND.
function liftChainAboveGround(local, names) {
  for (let pass = 0; pass < 3; pass++) {
    const W = fk(local);
    let worst = 0;
    for (let i = 0; i < names.length - 1; i++) {
      const a = idByName[names[i]], b = idByName[names[i + 1]];
      const pa = W.pos.get(a), pb = W.pos.get(b);
      if (pb[1] >= GROUND) continue;
      const v = vsub(pb, pa), L = vlen(v);
      if (L < 1e-9) continue;
      const need = GROUND - pb[1];
      worst = Math.max(worst, need);
      // angle that raises the far end by `need`, about the horizontal normal
      const flat = Math.hypot(v[0], v[2]);
      if (flat < 1e-9) continue;
      const cur = Math.asin(Math.max(-1, Math.min(1, v[1] / L)));
      const tgt = Math.asin(Math.max(-1, Math.min(1, (v[1] + need) / L)));
      const axis = vnorm(vcross(v, UP));
      const q = qaxis(axis, -(tgt - cur) * 180 / Math.PI);
      const pw = W.rot.get(a);
      local.set(a, { r: qnorm(qmul(qmul(qconj(pw), qmul(q, pw)), local.get(a).r)),
                     t: local.get(a).t });
    }
    if (worst < 1e-5) break;
  }
}

// ── Death ────────────────────────────────────────────────────────────────
//
// A buffalo does not just sink where it stands. It goes down the way one lies
// down: the front knees buckle first and the FORELEGS FOLD BACK under the
// chest, the HIND LEGS FOLD FORWARD under the belly, and it comes to rest on
// its brisket with all four tucked. Only then does it topple sideways — and
// once it is over, the legs let go and unfold straight out. Three beats, in
// that order.
//
// The legs are posed directly for the whole clip, blending between two poses
// the animator made in the source Walk: the frame where that leg is most
// folded, and the frame where it is most extended. A folding limb is not
// reaching for a ground contact, so IK has nothing to solve here and would
// only fight the tuck.
const DEATH_ROLL = 78;      // degrees over onto its side
const DEATH_TUCK = 0.44;    // hips once the brisket is down, legs still tucked
const DEATH_SIDE = 0.60;    // hips once it is lying on its side
const DEATH_PIVOT = 0.24;
const DEATH_DROOP = 0.75;   // how far gravity takes the limbs toward world-down once it is over   // lift over the roll, pivoting on the down-side ribs
function death(f, T, P, LT, local) {
  const t = f / T;
  const S = (a, b) => smooth(Math.max(0, Math.min(1, (t - a) / (b - a))));
  const jolt   = S(0.00, 0.08);   // the blow lands
  const front  = S(0.08, 0.32);   // front knees give first
  const rear   = S(0.18, 0.46);   // hindquarters follow it down
  const topple = S(0.46, 0.70);   // over onto its side
  const unfold = S(0.64, 0.92);   // the legs let go
  const still  = S(0.88, 1.00);   // last settle
  const sway   = sin(TAU * 1.1 * t) * (1 - S(0.0, 0.30)) * 2.2;

  // Rolling over pivots on the ribs that are already touching, not on the body's
  // own centreline, so the hips ride UP over the midpoint of the roll. Without
  // this the far side digs a third of a body height into the floor.
  const dz = -HIP_H * (DEATH_TUCK * rear + (DEATH_SIDE - DEATH_TUCK) * topple)
             + HIP_H * DEATH_PIVOT * sin(PI * topple);
  P.hips({ dz, pitch: 7 * front - 5 * topple, roll: DEATH_ROLL * topple + sway, yaw: -6 * rear });
  P.body("chest", { pitch: -15 * front + 7 * topple, roll: 13 * topple });
  // The head is the last thing to give up: it drops until the cheek is on the
  // ground and stays there. Measured - the earlier sign LIFTED the muzzle 10%
  // of body height on the final frames, which read as the animal looking up.
  P.body("head",  { pitch: -9 * jolt - 27 * front + 26 * still, yaw: -14 * still, roll: -20 * still });
  TAIL.forEach((n, i) => P.body(n, { pitch: 8 * rear + 7 * still,
                                     yaw: 4 * sin(3 * t - i) * (1 - topple) }));

  // Put the body where it belongs BEFORE the legs are solved.
  //
  // This used to happen afterwards, as a rigid lift applied to the finished
  // pose - and it moved the legs with it, so limbs solved against the old body
  // height ended up 0.7-1.3m under the floor. Doing it here means the IK sees
  // the body where it will actually be, and nothing shifts underneath it.
  //
  // One-sided while it is still buckling (the body may come down only as far
  // as its own barrel resting on the floor), two-sided once it is going over
  // (then the ground really is what holds it).
  {
    const raw = FLOOR - lowestSkin(local, null, TORSO_SET).y;
    const dd = raw > 0 ? raw : raw * topple;
    if (Math.abs(dd) > 1e-9) liftBody(local, dd);
  }
  // The legs fold because the BODY comes down on them - which means the IK
  // solves them, with the hooves told to stay on the ground while the hips
  // drop. That is the only thing that produces a real buckle.
  //
  // Posing the fold by hand cannot do it: blending toward the Walk's most
  // folded pose lifts the hoof by 0.027, while the body descends 0.064, so
  // even fully folded the legs fall short and get pushed through the floor.
  //
  // The catch is the topple. A ground target for a limb hanging off a body
  // lying on its side is ill-conditioned - the solver flipped branches and
  // spun a foreleg 177 degrees between two frames. So the target ROLLS WITH
  // THE BODY once it goes over: a point down-and-out from the leg's own root
  // in the body's frame, always within reach and always in a sensible
  // direction, which on its side is a leg lying extended on the ground.
  {
    const W0 = fk(local);
    const hid = idByName.Hips;
    const qB = qmul(W0.rot.get(hid), qconj(restWorld.get(hid)));
    for (const k in LEGS) {
      const isFront = k[1] === "F";
      const out = k[0] === "L" ? 1 : -1;
      const g = stanceHoof[k];
      // buckle: the feet gather slightly IN under the descending body, which
      // is what makes the legs tuck rather than splay as weight comes off them
      const gather = (isFront ? front : rear) * 0.16 * HIP_H;
      const groundTgt = [g[0], GROUND, g[2] - FWD[2] * gather];
      // Once over, the limb RIDES THE ROLL rather than chasing a target through
      // it. The foot's offset from its own root is simply carried round by the
      // same rotation the topple applies to the body, so the leg holds the pose
      // it finished the buckle in and goes over with the animal - which is what
      // a limb with no muscle tone does. Solving to a target that moved
      // independently through the roll is what let the IK flip branches and
      // spin the right foreleg 168 degrees between two frames.
      const rootPos = W0.pos.get(idByName[LEGS[k][0]]);
      const relGround = vsub(groundTgt, rootPos);
      const qRoll = qaxis(FWD, DEATH_ROLL * topple);
      const carried = vadd(rootPos, qrot(qRoll, relGround));
      // Then it LETS GO. Carrying the buckled pose through the roll is right
      // for the fall itself, but it left the legs still tucked under the body
      // at the end - a carcass on its side has them out, roughly straight,
      // lying along the ground. So as `unfold` ramps, the target slides from
      // the carried position to a point ON THE FLOOR, out at nearly full leg
      // length in the direction the limb already points.
      const rel = vsub(carried, rootPos);
      const horiz = Math.hypot(rel[0], rel[2]) || 1;
      const drop = Math.max(0.02, rootPos[1] - GROUND);
      const outReach = Math.sqrt(Math.max(1e-6,
        Math.pow(0.92 * LEG_REACH[k], 2) - drop * drop));
      const laid = [rootPos[0] + (rel[0] / horiz) * outReach, GROUND,
                    rootPos[2] + (rel[2] / horiz) * outReach];
      const bodyTgt = [
        carried[0] + (laid[0] - carried[0]) * unfold,
        carried[1] + (laid[1] - carried[1]) * unfold,
        carried[2] + (laid[2] - carried[2]) * unfold,
      ];
      const w = topple;
      LT[k] = [
        groundTgt[0] + (bodyTgt[0] - groundTgt[0]) * w,
        // never below the floor: a dead leg lies ON the ground, and a target
        // under it digs the hoof in and gives the settle something lower than
        // the barrel to hoist the whole carcass off.
        Math.max(GROUND, groundTgt[1] + (bodyTgt[1] - groundTgt[1]) * w),
        groundTgt[2] + (bodyTgt[2] - groundTgt[2]) * w,
      ];
    }
  }
  // The tail hangs from a body that has dropped most of its height, so it
  // trails through the floor. Lift each segment just clear of it.
  liftChainAboveGround(local, TAIL);
  // ...and again on the SKIN, not the joints. The tail's fur hangs well below
  // its bones, so a chain lifted to put every JOINT above the floor still
  // trails 0.49m of tail through it - which was the single worst penetration
  // left in this clip, and nothing to do with the legs.
  {
    const TAIL_SET = new Set(TAIL.map((n) => idByName[n]).filter((i) => i != null));
    const base = idByName[TAIL[0]];
    for (let pass = 0; pass < 4; pass++) {
      const under = FLOOR - lowestSkin(local, null, TAIL_SET).y;
      if (under <= 1e-4) break;
      const W = fk(local);
      const a = W.pos.get(base), t = W.pos.get(idByName[TAIL[TAIL.length - 1]]);
      const v = vsub(t, a), L = vlen(v);
      if (L < 1e-6) break;
      const deg = Math.asin(Math.max(-1, Math.min(1, under / L))) * 180 / PI;
      const ax = vnorm(vcross(vscale(v, 1 / L), UP));
      if (vlen(ax) < 1e-6) break;
      const q = qaxis(ax, deg);
      const pw = W.rot.get(parent.get(base)) ?? [0,0,0,1];
      const cur = local.get(base);
      local.set(base, { r: qnorm(qmul(qmul(qmul(qconj(pw), q), pw), cur.r)), t: cur.t });
    }
  }
}

// ── the signature: Supernatural_Rear_Stomp ───────────────────────────────
//
// A horse-style rear onto the hind legs, an impossible elevated hold with
// front-leg pawing, then a fast heavy crash back down. The rear is NOT a
// root rotation: the hind feet stay IK-planted on the ground while the hips
// pitch back and sit, the chest pitches the whole front torso up, and the
// front feet lift free to paw. All the impossibility lives in the range of
// the spine and the length of the hold — no bone is stretched or scaled.
const worldOf = (local, name) => fk(local).pos.get(idByName[name]);
function rearStomp(f, period, P, LT, local) {
  const T = 6.0, ts = (f / period) * T;
  const bodyH = 0.27;
  const seg = (a, b) => Math.max(0, Math.min(1, (ts - a) / (b - a)));
  const eo = (u) => 1 - (1 - u) * (1 - u);            // ease-out
  const ei = (u) => u * u;                             // ease-in
  const es = (u) => u * u * (3 - 2 * u);               // smoothstep

  // Elevation as a function of time, so the head and tail can read it late
  // (overlap / follow-through — the hallmark of hand-keyed motion).
  const Eat = (tv) => {
    if (tv < 1.5) return 0;
    if (tv < 2.35) { const u = (tv - 1.5) / 0.85; return eo(u) * 1.04 - 0.04 * es(u); } // small settle at the top
    if (tv < 3.9) return 1.0;
    if (tv < 4.45) return 1 - ei((tv - 3.9) / 0.55);   // accelerating drop
    return 0;
  };
  const E = Eat(ts);
  const Ehead = Eat(ts - 0.13);                        // head trails the body
  const Etail = Eat(ts - 0.20);                        // tail trails further
  // Anticipation: a distinct crouch/coil just before the push.
  const coil = Math.sin(PI * seg(0.9, 1.5)) * (ts < 1.6 ? 1 : 0);
  const sit = smooth(seg(1.0, 1.55)) * (1 - smooth(seg(4.45, 5.6)));
  const drive = seg(3.9, 4.5);
  const impact = Math.sin(PI * seg(4.45, 4.68));       // sharp compression pulse
  const settleN = Math.sin(PI * seg(4.68, 5.0)) * 0.4; // a single small settle, no bounce
  const recov = smooth(seg(4.7, 5.6));
  const prep = seg(0.0, 1.0) * (1 - seg(1.0, 1.5));

  // ── the rear: the hind legs PUSH, they do not swing ─────────────────────
  //
  // This was previously a rigid rotation of the whole body about the planted
  // hind hooves. That is a pendulum, and a pendulum necessarily LOWERS the
  // pelvis: a 0.146 strut leaned back 40 degrees puts the hips at
  // 0.146·cos40 = 0.112 — the 0.77 body-units the QA measured, 23% BELOW
  // standing, with the hind legs folded at 0.70 extension. It read exactly as
  // "torso rotated up while the rear legs stay crouched".
  //
  // A real rear works the other way round: the hind feet first STEP BACK to
  // build a support base, then the hind legs EXTEND and drive the pelvis up
  // and back over that base. So the pelvis is placed explicitly here and the
  // leg IK is left to extend to the planted hooves, which is what turns them
  // into the standing support columns the silhouette needs.
  // Rear angle vs pelvis height is a DIRECT trade on this rig, and the pelvis
  // wins. The hind leg attaches at `backleg`, which sits 0.018 BELOW the Hips
  // when standing — but that offset rotates with the body pitch, so the more the
  // torso is pitched back the higher the leg root climbs relative to the pelvis,
  // and the same leg length then holds the pelvis LOWER. Measured ceiling with a
  // hoof on the ground: 1.19x standing at 0 degrees, 1.04x at 40, 1.00x at 52.
  //
  // v7 ran 52 degrees and could therefore only reach a 1.06 pelvis, which read
  // as a torso rotated up around a low, drooping waist. 34 degrees buys a 1.12
  // pelvis with both hooves still planted — the waist rises, the hind legs
  // become real support columns, and the rear stops drooping.
  const theta = 34 * E;
  // Hind feet reposition during the COIL, before any rise — support first.
  const hindStep = smooth(seg(0.85, 1.5)) * (1 - smooth(seg(4.6, 5.6)));
  P.hips({
    // up on the extending hind legs; down on the coil and on the landing
    dz:   0.12*HIP_H*E - 0.13*HIP_H*coil - 0.05*HIP_H*impact + 0.02*HIP_H*settleN,
    // back over the new hind support base, then forward as it commits down
    dfwd: -0.42*HIP_H*E - 0.03*HIP_H*coil + 0.055*HIP_H*drive,
    pitch: theta + 3*coil + 5*impact,
  });
  // The chest sits the front torso up a touch more than the body pivot, and
  // trails slightly so the spine reads as flexing rather than rigid.
  P.body("chest", { pitch: 16 * Eat(ts - 0.05) + 5*impact - 3*coil });
  // Head: presents the horns low in prep, TRAILS the body up (lag), lifts to
  // fill the silhouette at the apex, drives down through the stomp a beat
  // after the hooves land, then settles low and aggressive.
  // Drives the head down with the descent, but not so far that the muzzle
  // is buried in the ground at the slam.
  const headDrive = 19 * seg(4.0, 4.62) * (1 - recov);
  const headPitch = 15*prep - 12*Ehead*(1 - seg(3.85, 4.4)) + headDrive + 13*recov - 6*impact;
  // A REARING ANIMAL WORKS ITS HEAD.
  //
  // Measured, the head was frozen relative to the body through the whole hold:
  // muzzle-above-chest sat at exactly +0.69 from 2.5s to 4.0s. It rose only
  // because the body did. A horse going up arches its neck into the rise,
  // throws its head at the top, bobs it with every strike of the forelegs, and
  // whips it down with the crash. The two neck joints make that possible.
  const arch  = Ehead;                                  // follows the rise, lagged
  const strkR = Math.max(0, sin(PI * seg(3.05, 3.90) * 2));
  const strkL = Math.max(0, sin(PI * seg(3.28, 4.13) * 2));
  const paw   = Math.max(strkR, strkL);                 // each foreleg strike
  const whip  = seg(4.0, 4.62) * (1 - recov);           // the crash down
  const sway  = sin(TAU * 1.55 * ts);
  // Amplitudes chosen by measurement, not feel: at the first pass the head
  // moved only 0.16m relative to the chest across the whole 1.8s hold, which
  // is technically not frozen and visually still is. The neck now works with
  // the head rather than just carrying it.
  P.body("neck0", { pitch: 24*arch - 30*whip + 9*sin(TAU*1.05*ts)*arch,
                    yaw: 9*sway*arch, roll: 4.5*sway*arch });
  P.body("neck1", { pitch: 18*arch - 22*whip + 7*sin(TAU*1.05*ts - 0.5)*arch,
                    yaw: 7*sway*arch, roll: 4*sway*arch });
  P.body("head", { pitch: headPitch + 20*paw*arch + 13*sin(TAU*2.1*ts)*arch - 14*impact,
                   yaw: 3.5*Math.sin(2.2*ts)*(1 - E) + 9*sway*arch,
                   roll: -6*sway*arch });
  // Ears pin back aggressively through the whole threat.
  const alert = Math.max(prep, E, recov, impact);
  // Tail: heavy in prep, counter-balances high, whips through on the impact
  // and settles — each segment lagging the one before it.
  TAIL.forEach((n, i) => {
    const lag = Etail;
    const whip = -14 * Math.sin(PI * seg(4.45, 4.9)) * (1 - i/6);
    P.body(n, { pitch: -7*lag + whip, yaw: (4 + i*2) * Math.sin(2.2*ts - i*0.6) * (0.4 + 0.6*Math.max(prep, lag)) });
  });

  // ── hind legs: the support base, planted throughout ─────────────────────
  // Both hooves step back together during the coil and then do not move again
  // until the recovery, so the animal is standing on TWO planted feet through
  // the whole high hold rather than balancing on one.
  const hindBack = 0.18*HIP_H*hindStep;
  LT.LB = [stanceHoof.LB[0], GROUND, stanceHoof.LB[2] - hindBack];
  LT.RB = [stanceHoof.RB[0], GROUND, stanceHoof.RB[2] - hindBack];

  // ── front legs ─────────────────────────────────────────────────────────
  // While the buffalo is up, the forelegs carry no weight, so IK was the wrong
  // tool for them: chasing a near-static target froze them dead at 0.74
  // extension for a full second, then chasing the paw target made them thrash
  // (0.90 -> 0.43 -> 0.72 in three frames). Both read as broken limbs.
  //
  // Airborne limbs are posed DIRECTLY instead, by slerping between two poses the
  // animator actually made — the Walk's most-folded foreleg and its planted one.
  // Every blend between them is anatomically valid (elbow and carpus can only
  // close backward), and a smooth parameter gives smooth motion by construction.
  // At E=0 the blend IS the planted pose, so it meets the grounded IK cleanly.
  {
    const airborne = E > 0.001;
    // two deliberate, heavy strikes; the right leads and the left follows
    const strikeR = Math.max(0, Math.sin(PI * seg(3.05, 3.90) * 2));
    const strikeL = Math.max(0, Math.sin(PI * seg(3.28, 4.13) * 2));
    for (const k of ["LF", "RF"]) {
      const lead = k === "RF" ? strikeR : strikeL;
      const fold = Math.max(0, Math.min(1, E * (0.88 - 0.44 * lead)));
      for (const n of LEGS[k]) {
        const id = idByName[n];
        const a = standR.get(id), b = foldR.get(id);
        if (!a || !b) continue;
        local.set(id, { r: qnorm(slerp(a, b, fold)), t: local.get(id).t });
      }
      // the limb also swings from the shoulder: drawn back, then out on the strike
      P.body(k === "LF" ? "frontleg" : "R_frontleg", { pitch: -14 * E + 32 * lead * E });
      if (airborne) LT[k] = null;                 // posed above — keep IK off it
      else {
        const g = stanceHoof[k];
        LT[k] = [g[0], GROUND, g[2] + 0.07 * bodyH * FWD[2] * seg(4.0, 4.65)];
      }
    }
  }
}
// ── LYING DOWN ──────────────────────────────────────────────────────────
//
// A looping clip of the animal already down and chewing, not the act of
// getting there — the village wants a field of cattle that are resting at
// two in the morning, and the going-down is a cross-fade into this.
//
// AUTHORED THE SAME WAY `death` IS, AND FOR THE SAME REASON. The first
// attempt at this posed the fold by hand: a fixed angle per bone applied
// additively at runtime, four legs jackknifed by numbers tuned by eye. It
// cannot work, and failed in three separate ways before this replaced it.
// The hind profile is not the mirror of the front, because a hock bends the
// opposite way to a knee — mirroring it straightened the hind legs and left
// the animal kneeling with its rump in the air. The body's drop cannot be a
// fraction of its height, because what it has to equal is how much room
// folding actually frees, which is a property of the rig. And nothing in a
// hand-posed fold knows where the floor is, so the brisket hung above it or
// sank through it depending on the animal.
//
// Here the body comes down FIRST, is planted on the floor by its own skin,
// and the legs are then solved by IK against ground targets gathered in
// under the barrel. Contact is a result, not a hope — which is the whole
// argument of this file, and it applies to an animal lying down at least as
// much as to one walking.
const REST_DROP = 0.52;     // how far the hips come down, in hip heights
const REST_GATHER = 0.30;   // how far the hooves gather in under the body
function lieDown(f, T, P, LT, local) {
  const t = f / T;
  // Breathing is the only large motion: a resting animal's barrel is the
  // thing that moves. Slow — about five seconds a breath.
  const br = 0.5 - 0.5 * Math.cos(TAU * t);
  // Chewing the cud, and it never stops: this is the single most
  // recognisable thing a cow does lying down. Roughly a jaw cycle a second,
  // which at this clip length is several per loop.
  // `T` here is the clip's length in FRAMES, not seconds — so the original
  // `t * T * 0.9` asked for 136 chew cycles per loop, far above the frame
  // rate. It aliased into a value that jumped about frame to frame and never
  // closed on itself. Eight cycles over a five-second loop is a real jaw
  // rhythm and divides the loop exactly.
  const chew = sin(TAU * t * 8);
  P.hips({ dz: -HIP_H * REST_DROP + 0.010 * HIP_H * br, pitch: 2.5 + 1.1 * br });
  P.body("chest", { pitch: -4.5 - 2.0 * br });
  // The head stays UP. A cow resting is not a cow collapsed — the neck is
  // raised and the jaw is working, and dropping the muzzle to the floor here
  // is what reads as a dead animal.
  // Held level, jaw working. Positive pitch here LIFTS the muzzle — the same
  // sign that had to be corrected in `death` — and a big positive value
  // points a resting cow's nose at the sky.
  // Held up and steady. The wander was large enough that the muzzle swung
  // down to the floor on a third of the loop, which reads as an animal
  // nodding off rather than one chewing.
  // MEASURED, NOT CHOSEN. These pitches are relative to the standing pose,
  // and this rig stands with its head already 29 degrees nose-down — so a
  // plausible-looking `+8` still left the resting cow staring at the floor
  // in front of her. +27 puts the muzzle within a couple of degrees of
  // level, which is where a cow chewing her cud holds it.
  // EVERY OSCILLATOR HERE COMPLETES A WHOLE NUMBER OF CYCLES PER LOOP.
  //
  // The head's yaw ran at half a cycle and the tail's at seven tenths. Both
  // return to the same POSE at the seam — sin(0) and sin(PI) are both zero,
  // so the loop-pose check reads a clean 0.0 degrees — while arriving there
  // travelling the opposite way. QA caught it as a 41 deg/frame loop
  // VELOCITY gap, which on screen is the resting cow twitching once every
  // five seconds, forever.
  P.body("head", { pitch: 27 + 1.6 * chew + 0.8 * sin(TAU * t), yaw: 2.5 * sin(TAU * t) });
  // The tail curls along the flank rather than hanging: from a body this low
  // a hanging tail is buried to the dock.
  // THE TAIL BARELY MOVES, AND THE ANGLES DO NOT COMPOUND.
  //
  // This ran 7 degrees of yaw on EVERY segment of a five-bone chain, and a
  // chain multiplies: measured, the tail TIP travelled 0.00146 against a hip
  // height of 0.00157 — it swept 93% of the animal's own height, five times
  // what the calm idle does, on an animal that is lying down asleep. Read
  // from across the field that is not a tail, it is the whole rear end
  // apparently thrashing.
  //
  // So the swing is divided down the chain rather than repeated along it,
  // and it is small: a resting cow's tail lies against her flank and twitches
  // occasionally. The pitch that lifts it clear of the ground stays.
  TAIL.forEach((n, i) => P.body(n, {
    pitch: 27 - i * 4,
    yaw: (0.9 / (1 + i)) * sin(TAU * t - i * 0.5),
  }));

  // THE LEGS ARE FOLDED, NOT SOLVED.
  //
  // The first version of this gave each hoof a target on the floor and let
  // IK solve for it, the way every standing and walking clip here does. It
  // is the wrong tool for this pose and produced exactly the artefact the
  // header of `death` warns about: a limb that is folding is not reaching
  // for a ground contact, so IK has nothing to solve and only fights the
  // tuck. Told to reach the floor from a body half a hip-height lower, each
  // leg stayed near-straight and became a PROP — the cow knelt on four stiff
  // legs with her brisket driven down between them and her rump in the air,
  // which is what "the rest is awful" was looking at.
  //
  // A cow in sternal recumbency is not held up by her legs at all. Her
  // weight is on her sternum and her belly; the legs are folded away
  // underneath, carrying nothing. So they are posed directly, by blending
  // toward the most-folded pose the ANIMATOR made in the source Walk —
  // `foldR`, the frame where that leg is most collapsed. Blending between
  // two poses a person authored keeps the limb anatomically correct at every
  // value, which is the same argument this file already makes for the
  // rear-stomp's forelegs.
  for (const k in LEGS) {
    const isFront = k[1] === "F";
    // The forelegs fold further than the hind: a cow's carpus comes right up
    // under her chest, while the hind leg tucks alongside the flank with the
    // hock still open.
    // PAST THE ANIMATOR'S FOLD, DELIBERATELY. `foldR` is the most-collapsed
    // frame of the source WALK, and a walking leg at its tightest is nowhere
    // near as folded as a lying animal's — a cow at rest has her carpus
    // under her chest and her hock against her flank. Slerp extrapolates
    // cleanly past 1, and it stays on the same arc the animator drew, so the
    // limb is still anatomically correct; it is simply further along.
    const fold = isFront ? 1.34 : 1.26;
    for (const n of LEGS[k]) {
      const id = idByName[n];
      const a = standR.get(id), b = foldR.get(id);
      if (!a || !b) continue;
      local.set(id, { r: qnorm(slerp(a, b, fold)), t: local.get(id).t });
    }
    // Drawn in under the body from the shoulder and the hip, so the folded
    // limb sits beneath the barrel rather than out beside it.
    //
    // POSITIVE PITCH SWINGS THE LIMB FORWARD here — the same sign the
    // rear-stomp uses to throw a foreleg out on the strike. The first values
    // had it backwards on both ends: +26 on the shoulder shot the forelegs
    // straight out in front like a stretching dog, and -20 on the hip threw
    // the hind legs up and back so the hocks stood in the air behind the
    // rump. A resting cow's forelegs stay under her chest and her hind legs
    // come FORWARD alongside her flank.
    P.body(k === "LF" ? "frontleg" : k === "RF" ? "R_frontleg"
           : k === "LB" ? "backleg" : "R_backleg",
           { pitch: isFront ? 4 : 16 });
    LT[k] = null;                       // posed above — keep IK off it
  }

  // Now put the barrel on the floor, with the legs already where they will
  // be. This is deliberately AFTER the fold and not before it: the body has
  // to settle onto the shape the folded animal actually is, and the legs are
  // no longer holding it up.
  {
    const raw = FLOOR - lowestSkin(local, null, BARREL_SET).y;
    if (Math.abs(raw) > 1e-9) liftBody(local, raw);
  }

  // THE LIFT IS NOT RE-SOLVED EVERY FRAME.
  //
  // `liftChainAboveGround` and the skin pass under it both SEARCH for a
  // correction, and a search run independently on each frame of an
  // essentially static pose returns slightly different answers each time.
  // That showed up as the resting tail tip travelling 0.00073 against a hip
  // height of 0.00157 — a twitch with no cause, on an animal asleep, and the
  // larger half of what looked like the whole rear end moving.
  //
  // The pose above now carries the tail clear of the ground on its own, so
  // there is nothing left for a search to correct and it is simply not run.
  // If a future change lowers the body far enough to bury the tail again,
  // the QA's penetration check is what will say so.
}

// ── build all clips ──────────────────────────────────────────────────────
const CLIPS = [
  ["Idle", 4.0, idle, true], ["Idle_Alert", 3.0, idleAlert, true], ["Graze", 6.0, graze, false], ["Run", 0.62, run, true],
  ["Turn_Left_90", 1.4, turn(1), false], ["Turn_Right_90", 1.4, turn(-1), false],
  ["Walk_Backward", 1.6, walkBack, true], ["Charge_Start", 0.9, chargeStart, false],
  ["Charge_Loop", 0.6, chargeLoop, true], ["Attack_Horn", 1.3, attackHorn, false],
  ["Attack_Stomp", 1.5, attackStomp, false], ["Aggressive_Threat", 2.6, threat, false],
  ["Hit_Reaction", 0.8, hit, false], ["Death", 4.0, death, false],
  ["Rest", 5.0, lieDown, true],
  ["Supernatural_Rear_Stomp", 6.0, rearStomp, false],
];
// The cattle get their own Walk, authored like the rest, in place of the
// source take (which is kept in the file only as `Walk_Source`, for the
// build to drop — see the rename below).
if (CATTLE) {
  CLIPS.unshift(["Walk", WALK_SECS, cowWalk, true]);
  CLIPS[CLIPS.findIndex((c) => c[0] === "Idle")] = ["Idle", 8.0, cowIdle, true];
}
// The true floor: the lowest the SKIN ever gets in the approved Walk. Joint-
// level GROUND sits 0.02 above it, which is the hoof geometry hanging below
// the last joint - the exact amount every authored clip was sinking by.
const FLOOR = (() => { let lo = Infinity;
  for (let f = 0; f < WN; f++) { const W = walkPose[f];
    for (const [id, pts] of SHAPE) { const p = W.pos.get(id), r = W.rot.get(id);
      if (!p) continue;
      for (const o of pts) { const y = p[1] + qrot(r, o)[1]; if (y < lo) lo = y; } } }
  return lo; })();
// Raising the root translates every joint rigidly, so the skin moves with it
// one-for-one - no iteration needed to land a pose exactly on the floor.
function liftBody(local, dy) {
  const id = idByName.Hips, e = local.get(id);
  local.set(id, { r: e.r, t: vadd(e.t, qrot(qconj(ARM_R), vscale(UP, dy))) });
}
{ // sanity: where does the skin sit in the standing pose?
  const l = freshLocal();
  const r = lowestSkin(l);
  console.log(`  [shape] joints with skin: ${SHAPE.size}, standing lowest skin y=${r.y.toFixed(5)} vs GROUND=${GROUND.toFixed(5)} (delta ${(r.y-GROUND).toFixed(5)}, HIP_H=${HIP_H.toFixed(4)})`);
}
// What the tuning numbers above are tuned AGAINST: per leg, how straight the
// limb is (hoof-to-root over its full reach) and how high its hoof rises; and
// where the muzzle is — the lowest head-weighted skin — above the floor.
// The nose tip: of the skin the head carries, the point furthest forward in
// the standing pose. "Lowest head skin" is not it — on the cattle that is
// the jaw and dewlap, which barely move when the head goes down.
const NOSE = (() => { const id = idByName.head, W = fk(freshLocal());
  let best = null, bz = -Infinity;
  for (const o of SHAPE.get(id) ?? []) { const z = W.pos.get(id)[2] + qrot(W.rot.get(id), o)[2]; if (z > bz) { bz = z; best = o; } }
  return best; })();
const noseY = (W) => { const id = idByName.head; return NOSE ? W.pos.get(id)[1] + qrot(W.rot.get(id), NOSE)[1] : NaN; };
function reportPose(name, poses) {
  const HEADS = new Set(["head"].map((n) => idByName[n]).filter((i) => i != null));
  const ext = {}, clr = {};
  let mzLo = Infinity, mzHi = -Infinity, hipLo = Infinity, hipHi = -Infinity;
  for (const p of poses) {
    const W = fk(p);
    for (const k in hoofId) {
      const ch = chainOf(k);
      const e = vlen(vsub(W.pos.get(ch[3]), W.pos.get(ch[0]))) / LEG_REACH[k];
      (ext[k] ??= [Infinity, -Infinity]); ext[k][0] = Math.min(ext[k][0], e); ext[k][1] = Math.max(ext[k][1], e);
      clr[k] = Math.max(clr[k] ?? 0, (W.pos.get(ch[3])[1] - GROUND) / HIP_H);
    }
    const m = noseY(W);
    mzLo = Math.min(mzLo, m); mzHi = Math.max(mzHi, m);
    const h = (W.pos.get(idByName.Hips)[1] - GROUND) / HIP_H;
    hipLo = Math.min(hipLo, h); hipHi = Math.max(hipHi, h);
  }
  const f2 = (x) => x.toFixed(2);
  console.log(`\n    [${name}] ext ${Object.entries(ext).map(([k, v]) => `${k} ${f2(v[0])}-${f2(v[1])}`).join("  ")}`
    + `\n    [${name}] hoof clearance (hip heights) ${Object.entries(clr).map(([k, v]) => `${k} ${f2(v)}`).join("  ")}`
    + `\n    [${name}] hips ${f2(hipLo)}-${f2(hipHi)} hip heights; nose ${f2((mzLo - FLOOR) / HIP_H)}-${f2((mzHi - FLOOR) / HIP_H)} above floor`);
}
const authored = [];
const CORRECTING = new Set(["Graze","Charge_Loop","Turn_Left_90","Turn_Right_90"]);
for (const [name, secs, fn, loop] of CLIPS) {
  // EVERY leg starts from its own planted anchor, in every clip.
  //
  // The fallback was the `stand` pose, which is Walk frame 0 - and Walk frame 0
  // is MID-STRIDE with the left hind lifted and folded. So in every clip that
  // used it, the left hind began from a swinging pose and the IK dragged it to
  // the ground by a contorted route. Measured across the standing clips, the
  // left hind sat 55/73 degrees from rest while the right hind sat at 19/27 -
  // an identical offset in Idle, Idle_Alert, Attack_Horn, Attack_Stomp,
  // Aggressive_Threat and Hit_Reaction, which is the signature of a constant
  // base-pose error rather than anything in the animation.
  //
  // This was originally scoped to a few clips to keep the v5-approved ones
  // byte-identical. That constraint is long gone.
  PLANTED_LEGS = name === "Supernatural_Rear_Stomp" ? new Set(["LB","RB"])   // forelegs must fold
    : new Set(["LF","RF","LB","RB"]);
  FREE_FOLD = name === "Supernatural_Rear_Stomp" ? new Set(["LF","RF"]) : new Set();
  SETTLE = name === "Death" || name === "Rest";
  SETTLE_HEAD = name === "Death";
  if (TORSO_SET == null) {
    // Barrel AND legs. A body that falls on its side comes to rest ON its own
    // down-side legs, not through them - settling on the barrel alone drove
    // the right fore and hind 0.38m into the floor as it rolled onto them.
    // The head stays out: the muzzle would jack the whole carcass up.
    TORSO_SET = new Set(["Hips","chest",
      ...Object.values(LEGS).flat()].map((n)=>idByName[n]).filter((i)=>i!=null));
  }
  if (BARREL_SET == null) {
    // The barrel on its own, for a pose that settles onto its BELLY with the
    // legs folded beneath it. No legs, and no head: the muzzle would jack the
    // whole animal back up off the ground.
    BARREL_SET = new Set(["Hips","chest"].map((n)=>idByName[n]).filter((i)=>i!=null));
  }
  // A galloping leg is near-straight at the extremes of its stance - that is
  // what reaching and driving look like. Holding it to the standing 0.97 cap
  // made the reach clamp lift the planted hoof at the end of stance, tearing a
  // second false suspension into the stride.
  REACH_CAP = name === "Supernatural_Rear_Stomp" ? { LF: 0.90, RF: 0.90, LB: 0.965, RB: 0.965 }
            : /^(Run|Charge_)/.test(name) ? { LF: 0.985, RF: 0.985, LB: 0.985, RB: 0.985 } : {};
  DEV_SLACK = name === "Walk" && CATTLE ? WALK_SLACK : 1;
  // THE CATTLE WALK IS NOT HELD TO THE SOURCE'S JOINT ENVELOPE. That
  // envelope was measured on the take this walk replaces, and correcting a
  // leg into it rotates the limb about its own root-to-hoof axis — which
  // moves no hoof, so no contact check can see it, and is chosen afresh
  // every frame. On the left fore it chose differently from one frame to the
  // next: measured, the shoulder twisted 10-29 degrees a frame, a visible
  // twitch through every swing. The fold guard still keeps every knee and
  // hock bending the right way; without the envelope the worst leg bone
  // turns 12 degrees a frame and every hoof holds its target within 0.01.
  NO_ENVELOPE = name === "Walk" && CATTLE;
  LEVEL_LIFT = name === "Walk" && CATTLE
    ? { LF: 1.6 * (CALF ? 0.15 : 0.11) * HIP_H, RF: 1.6 * (CALF ? 0.15 : 0.11) * HIP_H,
        LB: 1.6 * (CALF ? 0.12 : 0.085) * HIP_H, RB: 1.6 * (CALF ? 0.12 : 0.085) * HIP_H }
    : null;
  const frames = Math.round(secs*FPS) + 1;
  process.stdout.write(`  ${name} ${frames}f… `);
  const poses = buildClip(frames, fn, loop);
  authored.push({ name, frames, poses });
  if (CATTLE && (name === "Walk" || name === "Graze" || name === "Idle")) reportPose(name, poses);
  // PROBE=Walk prints how far each hoof is from its target, stance and swing
  // separately, in hip heights — the number the walk's constants are tuned to.
  if (process.env.PROBE === name && name === "Walk") {
    const st = {}, sw = {};
    for (let f = 0; f < poses.length - 1; f++) {
      const W = fk(poses[f]); const LT = {};
      cowWalkTargets(f / (frames - 1), LT, { duty: CALF ? 0.60 : 0.64, liftF: CALF ? 0.15 : 0.11, liftH: CALF ? 0.12 : 0.085, speed: COW_SPEED, dur: WALK_SECS });
      for (const k in hoofId) {
        const e = vlen(vsub(W.pos.get(hoofId[k]), LT[k])) / HIP_H;
        const b = LT[k][1] <= GROUND + 1e-9 ? st : sw;
        (b[k] ??= []).push(e);
      }
    }
    const sm = (a) => a ? `${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3)}/${Math.max(...a).toFixed(2)}` : "-";
    console.log(`PROBE stance ${Object.keys(hoofId).map((k) => k + " " + sm(st[k])).join("  ")} | swing ${Object.keys(hoofId).map((k) => k + " " + sm(sw[k])).join("  ")}`);
  }

  console.log("ok");
}

// ── encode: append accessors + animations onto the original bin ──────────
const extra = []; let cursor = bin.length;
function addFloatAccessor(arr, type, comps) {
  const flat = type === "SCALAR" ? arr : arr.flat();
  const buf = Buffer.alloc(flat.length * 4); flat.forEach((v, i) => buf.writeFloatLE(v, i*4));
  const pad = (4 - (cursor % 4)) % 4; if (pad){ extra.push(Buffer.alloc(pad)); cursor += pad; }
  json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length });
  extra.push(buf); cursor += buf.length;
  const a = { bufferView: json.bufferViews.length-1, componentType: 5126, count: arr.length, type };
  if (type === "SCALAR"){ a.min=[Math.min(...arr)]; a.max=[Math.max(...arr)]; }
  json.accessors.push(a); return json.accessors.length-1;
}
for (const clip of authored) {
  const times = Array.from({length: clip.frames}, (_, f) => f/FPS);
  const tAcc = addFloatAccessor(times, "SCALAR");
  const samplers = [], channels = [];
  for (const j of joints) {
    // rotation
    const rot = clip.poses.map((p)=>p.get(j).r);
    const rAcc = addFloatAccessor(rot, "VEC4");
    channels.push({ sampler: samplers.length, target:{ node:j, path:"rotation" }}); samplers.push({ input:tAcc, output:rAcc, interpolation:"LINEAR" });
    if (nName(j) === "Hips") {
      const tr = clip.poses.map((p)=>p.get(j).t);
      const trAcc = addFloatAccessor(tr, "VEC3");
      channels.push({ sampler: samplers.length, target:{ node:j, path:"translation" }}); samplers.push({ input:tAcc, output:trAcc, interpolation:"LINEAR" });
    }
  }
  const anim = { name: clip.name, samplers, channels };
  if (clip.name === "Supernatural_Rear_Stomp") {
    // Measured, not assumed: frame 134 is where BOTH front hooves reach the
    // ground together (LF and RF both at ground level; 132 is still 19-20% up).
    const impactSec = 134 / FPS, dur = clip.frames > 1 ? (clip.frames-1)/FPS : 1;
    anim.extras = { marker: "REAR_STOMP_IMPACT", time: impactSec, normalized: +(impactSec/dur).toFixed(4) };
  }
  json.animations.push(anim);
}
// rename the original take
for (const a of json.animations) if (a.name === walk.name && a !== json.animations[json.animations.length-1]) { }
json.animations[0].name = CATTLE ? "Walk_Source" : "Walk";

// ── repair the source Walk ──────────────────────────────────────────────
// Walk was the ONLY clip in the file carrying scale tracks, and it pinned the
// ROOT joint (Hips) to a constant 0.9032. A mixer writes only what a clip
// animates, so playing Walk shrank the whole animal by ~10% and — since no
// other clip ever writes Hips.scale — left it shrunk for the rest of the
// session. Scaling about the Hips also lifted its hooves ~0.014 clear of the
// ground the other fifteen clips stand on, so Walk both mismatched them in
// size and floated relative to them.
//
// Nothing is lost by removing it: every scale key is CONSTANT, and every one
// except Hips is already identity, so no motion changes — only the shrink
// goes. The same pass drops the 26 translation tracks that never vary and
// hold exactly their node's rest value (verified), which leaves Walk with the
// same 28-channel shape as every authored clip. The Hips translation, the one
// that actually moves, is kept.
{
  const w = json.animations[0];
  const varies = (s) => {
    const a = json.accessors[s.output], v = json.bufferViews[a.bufferView];
    const st = v.byteStride || 12, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    for (let c = 0; c < 3; c++) {
      let mn = Infinity, mx = -Infinity;
      for (let k = 0; k < a.count; k++) { const x = bin.readFloatLE(base + k*st + c*4); mn = Math.min(mn,x); mx = Math.max(mx,x); }
      if (mx - mn > 1e-6) return true;
    }
    return false;
  };
  const keep = w.channels.filter((c) =>
    c.target.path === "rotation" ||
    (c.target.path === "translation" && varies(w.samplers[c.sampler])));
  const used = [...new Set(keep.map((c) => c.sampler))].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  const dropped = w.channels.length - keep.length;
  w.samplers = used.map((i) => w.samplers[i]);
  w.channels = keep.map((c) => ({ ...c, sampler: remap.get(c.sampler) }));
  console.log(`  Walk repaired: dropped ${dropped} inert channel(s) (Hips scale 0.9032 shrink + constant tracks); ${w.channels.length} remain`);
}

const newBin = Buffer.concat([bin, ...extra]);
json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(json), "utf8"); const jp=(4-(jb.length%4))%4; const jc=Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp=(4-(newBin.length%4))%4; const bc=Buffer.concat([newBin, Buffer.alloc(bp)]);
const head=(l,t)=>{const h=Buffer.alloc(8);h.writeUInt32LE(l,0);h.writeUInt32LE(t,4);return h;};
const rest=Buffer.concat([head(jc.length,0x4e4f534a),jc,head(bc.length,0x004e4942),bc]);
const hdr=Buffer.alloc(12);hdr.writeUInt32LE(0x46546c67,0);hdr.writeUInt32LE(2,4);hdr.writeUInt32LE(12+rest.length,8);
writeFileSync(outPath, Buffer.concat([hdr, rest]));
console.log(`\n${authored.length} clips authored in node space + Walk preserved -> ${outPath}`);
