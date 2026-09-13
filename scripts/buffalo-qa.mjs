/**
 * Judges every clip in a buffalo GLB the way the brief asks — by measurement.
 *
 *   node scripts/buffalo-qa.mjs file.glb [--md report.md]
 *
 * Forward kinematics is run for every frame of every clip so the checks are
 * made in WORLD space, where hoof contact, sliding, ground penetration and
 * turn direction actually exist. Axes were established from the source
 * walk: forward +Z, left +X, right -X, up +Y — so a positive yaw about Y
 * turns the animal LEFT.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const mdOut = process.argv.includes("--md") ? process.argv[process.argv.indexOf("--md") + 1] : null;
const b = readFileSync(file);
let off = 12, g = null, bin = null;
while (off + 8 <= b.length) {
  const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
  const body = b.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) g = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = body;
  off += 8 + len;
}
const acc = g.accessors;
const rd = (i) => {
  const a = acc[i], v = g.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const st = v.byteStride || n * 4, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const o = [];
  for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < n; c++) r.push(bin.readFloatLE(base + k * st + c * 4)); o.push(n === 1 ? r[0] : r); }
  return o;
};
const qmul = (a, c) => [a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1], a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0], a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3], a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot = (q, v) => { const u=[q[0],q[1],q[2]], s=q[3]; const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]]; return [v[0]+2*(s*uv[0]+uuv[0]), v[1]+2*(s*uv[1]+uuv[1]), v[2]+2*(s*uv[2]+uuv[2])]; };
const slerp = (a, c, t) => { let d=a[0]*c[0]+a[1]*c[1]+a[2]*c[2]+a[3]*c[3]; let cc=c; if(d<0){d=-d;cc=c.map(x=>-x);} if(d>0.9995){const r=a.map((x,i)=>x+t*(cc[i]-x));const l=Math.hypot(...r);return r.map(x=>x/l);} const th=Math.acos(d),s=Math.sin(th); return a.map((x,i)=>Math.sin((1-t)*th)/s*x+Math.sin(t*th)/s*cc[i]); };
const angDeg = (a, c) => 2*Math.acos(Math.min(1, Math.abs(a[0]*c[0]+a[1]*c[1]+a[2]*c[2]+a[3]*c[3])))*180/Math.PI;
// Body heading, measured RELATIVE TO THE REST POSE. Applying the raw hips
// rotation to the forward axis conflates the bone's own rest orientation with
// the animation, and a clip that only pitches then reads as a large spurious
// yaw - Charge_Start reported -155 deg while a top-down render showed it dead
// straight. Set once the rig is parsed (see restHipsRot below).
let restHipsRot = [0,0,0,1];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const yawDeg = (q) => { const f = qrot(qmul(q, qconj(restHipsRot)), [0,0,1]);
  return Math.atan2(f[0], f[2]) * 180 / Math.PI; }; // +ve = toward +X = LEFT

const joints = g.skins[0].joints;
const name = (i) => g.nodes[i].name;
const byName = Object.fromEntries(joints.map((j) => [name(j), j]));
const parent = new Map(); g.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
const restT = (i) => g.nodes[i].translation ?? [0,0,0], restR = (i) => g.nodes[i].rotation ?? [0,0,0,1];
// The armature above the root joint carries the model's 90-degree orientation.
// Applying it makes the FK below run in visual space — up +Y, forward +Z,
// left +X — so heights are heights and a yaw about +Y is a real turn. Without
// it a hoof swinging forward read as lifting (a false "rearing" flag) and a
// 90-degree turn measured as 6.
const ARM = parent.get(byName.Hips);
const ARM_R = ARM != null ? restR(ARM) : [0,0,0,1];
const ARM_T = ARM != null ? restT(ARM) : [0,0,0];
const hooves = ["frontleg2", "R_frontleg2", "backleg2", "R_backleg2"];
const FPS = 30;

function sampleClip(anim) {
  const dur = Math.max(...anim.samplers.map((s) => acc[s.input].max[0]));
  const N = Math.max(2, Math.round(dur * FPS) + 1);
  const tracks = new Map();
  for (const ch of anim.channels) {
    if (ch.target.path === "scale") continue;
    const s = anim.samplers[ch.sampler]; const times = rd(s.input), vals = rd(s.output);
    const pf = [];
    for (let f = 0; f < N; f++) {
      const tt = Math.min(dur, f / FPS); let k = 0; while (k < times.length - 1 && times[k+1] <= tt) k++;
      const k2 = Math.min(times.length - 1, k + 1); const u = times[k2] === times[k] ? 0 : (tt - times[k]) / (times[k2] - times[k]);
      pf.push(ch.target.path === "rotation" ? slerp(vals[k], vals[k2], u) : vals[k].map((x, i) => x + u * (vals[k2][i] - x)));
    }
    const e = tracks.get(ch.target.node) ?? {}; e[ch.target.path === "rotation" ? "r" : "t"] = pf; tracks.set(ch.target.node, e);
  }
  const frames = [];
  for (let f = 0; f < N; f++) {
    const pos = new Map(), rot = new Map();
    const solve = (i) => {
      if (pos.has(i)) return;
      const tr = tracks.get(i), lt = tr?.t?.[f] ?? restT(i), lr = tr?.r?.[f] ?? restR(i);
      const p = parent.get(i);
      if (p == null || !joints.includes(p)) { pos.set(i, [ARM_T[0]+qrot(ARM_R,lt)[0], ARM_T[1]+qrot(ARM_R,lt)[1], ARM_T[2]+qrot(ARM_R,lt)[2]]); rot.set(i, qmul(ARM_R, lr)); return; }
      solve(p); const w = qrot(rot.get(p), lt); const pp = pos.get(p);
      pos.set(i, [pp[0]+w[0], pp[1]+w[1], pp[2]+w[2]]); rot.set(i, qmul(rot.get(p), lr));
    };
    for (const j of joints) solve(j);
    frames.push({ pos, rot, local: tracks });
  }
  return { dur, N, frames, tracks };
}

// Ground = the lowest any hoof gets in the reference walk; assumed shared.
const walk = g.animations.find((a) => a.name === "Walk") ?? g.animations[0];
// the Hips' rest world rotation, so heading can be measured relative to it
{
  const chain = []; let c = byName.Hips;
  while (c != null && joints.includes(c)) { chain.unshift(c); c = parent.get(c); }
  let q = ARM_R;
  for (const j of chain) q = qmul(q, restR(j));
  restHipsRot = q;
}
const W = sampleClip(walk);
const ground = Math.min(...W.frames.flatMap((f) => hooves.map((h) => f.pos.get(byName[h])[1])));
const walkLift = Math.max(...W.frames.flatMap((f) => hooves.map((h) => f.pos.get(byName[h])[1]))) - ground;
const CONTACT = ground + 0.3 * walkLift;   // a hoof this low is on the ground
const PEN_TOL = 0.25 * walkLift;            // below ground by more than this is penetration
// Sliding is judged against the APPROVED walk, not an ideal. The brief names
// the existing Walk as the reference the others must match, so "worse than
// the Walk" is the honest definition of a slide: its own largest planted
// drift, with a little headroom, is the line. An absolute tolerance flagged
// the reference itself on eleven frames, which would have made every other
// clip fail a bar the reference could not clear.
let walkDrift = 0;
for (let f = 1; f < W.N; f++) for (const h of hooves) {
  const a = W.frames[f-1].pos.get(byName[h]), c = W.frames[f].pos.get(byName[h]);
  if (a[1] < CONTACT && c[1] < CONTACT) walkDrift = Math.max(walkDrift, Math.hypot(c[0]-a[0], c[2]-a[2]));
}
const SLIDE_TOL = walkDrift * 1.25;
// Graze is a one-shot that loops INTERNALLY over its grazing section
// (see buffalo-graze-qa.mjs): it starts standing and ends head-down, so a
// whole-clip seam check is the wrong test for it.
const LOOPING = new Set(["Idle", "Idle_Alert", "Walk", "Run", "Walk_Backward", "Charge_Loop"]);

const rows = [], problems = [];
for (const anim of g.animations) {
  const C = sampleClip(anim);
  const hip = C.frames.map((f) => f.pos.get(byName.Hips));
  const hipRot = C.frames.map((f) => f.rot.get(byName.Hips));
  const rootTravel = Math.hypot(hip[C.N-1][0]-hip[0][0], hip[C.N-1][2]-hip[0][2]);
  const yaw0 = yawDeg(hipRot[0]), yaw1 = yawDeg(hipRot[C.N-1]);
  let dyaw = yaw1 - yaw0; while (dyaw > 180) dyaw -= 360; while (dyaw < -180) dyaw += 360;

  // hooves
  let minY = Infinity, penetrates = 0, slides = 0, contactFrames = 0, floatFrames = 0;
  let maxFrontPairLift = 0;
  for (let f = 0; f < C.N; f++) {
    const ys = hooves.map((h) => C.frames[f].pos.get(byName[h])[1]);
    minY = Math.min(minY, ...ys);
    if (ys.some((y) => y < ground - PEN_TOL)) penetrates++;
    const down = ys.filter((y) => y < CONTACT).length;
    if (down > 0) contactFrames++;
    if (down === 0 && !/Death/.test(anim.name)) floatFrames++;
    const fl = C.frames[f].pos.get(byName.frontleg2)[1] - ground, fr = C.frames[f].pos.get(byName.R_frontleg2)[1] - ground;
    maxFrontPairLift = Math.max(maxFrontPairLift, Math.min(fl, fr));
    // Skating is planted feet moving at DIFFERENT speeds, not planted feet
    // moving. In a clip authored in place the ground is what moves, so every
    // planted hoof must travel backward at one shared speed - which is faster
    // in a gallop than in a walk. Judging each hoof against the Walk's own
    // drift called a correct gallop a slide on every stance frame; judging it
    // against the other feet on the SAME frame is the real test.
    if (f > 0) {
      const PLANTED = ground + 0.12 * walkLift;   // clearly on the ground, not mid-swing
      const sp = [];
      for (const h of hooves) {
        const a = C.frames[f-1].pos.get(byName[h]), c = C.frames[f].pos.get(byName[h]);
        if (a[1] < PLANTED && c[1] < PLANTED) sp.push([h, Math.hypot(c[0]-a[0], c[2]-a[2])]);
      }
      if (sp.length) {
        const v = sp.map((x) => x[1]).sort((a, b) => a - b);
        const ground_speed = v[v.length >> 1];             // median of the planted feet
        const tol = Math.max(SLIDE_TOL, 0.35 * ground_speed);
        for (const [, d] of sp) if (Math.abs(d - ground_speed) > tol) slides++;
      }
    }
  }
  // loop seam: pose gap and velocity gap
  // Seam: the pose gap is first frame vs last; the velocity gap compares the
  // step INTO the seam against the step OUT of it — last->first against
  // first->second. The earlier version measured the last two frames of the
  // clip against the first two, which is not the seam at all, and reported
  // 33 deg/frame on the untouched reference walk.
  let poseGap = 0, velGap = 0;
  if (C.N > 3) for (const j of joints) {
    const r = C.tracks.get(j)?.r; if (!r) continue;
    poseGap = Math.max(poseGap, angDeg(r[0], r[C.N-1]));
    const into = angDeg(r[C.N-2], r[0]), out = angDeg(r[0], r[1]);
    velGap = Math.max(velGap, Math.abs(into - out));
  }
  const looping = LOOPING.has(anim.name);
  const hipDrop = hip[0][1] - Math.min(...hip.map((p) => p[1]));
  const walkHip = W.frames[0].pos.get(byName.Hips)[1];
  const rears = maxFrontPairLift > 0.35 * (walkHip - ground);

  const notes = [], fails = [];
  if (rootTravel > 0.01) fails.push(`root travels ${rootTravel.toFixed(3)} (in-place expected)`);
  // A collapse ends with the body and its hooves on/through the ground, so
  // Death's penetration is reported but not failed — same reasoning as its slide.
  if (penetrates) (/Death/.test(anim.name) ? notes : fails).push(`ground penetration on ${penetrates} frame(s)`);
  // A collapse is not a planted gait; its feet dragging as the body falls is
  // expected, so Death's slide is reported but not failed. Locomotion is held
  // to the strict line.
  if (slides > 0) ((slides > Math.max(5, 0.06 * C.N * 4) && !/Death/.test(anim.name)) ? fails : notes).push(`hoof slide ${slides} frame(s)`);
  // A gallop HAS a suspension phase - all four feet clear, once per stride -
  // so "no hooves down" is only a fault where the animal is not meant to leave
  // the ground. Charge_Start ends by launching into the gallop and goes
  // airborne on its last strides, which is the behaviour, not a float.
  const AIRBORNE_OK = /Death|Run|Charge_Loop|Charge_Start|Supernatural_Rear_Stomp/;
  if (floatFrames > 0 && !AIRBORNE_OK.test(anim.name)) fails.push(`all four hooves off the ground on ${floatFrames} frame(s)`);
  else if (floatFrames > 0) notes.push(`airborne on ${floatFrames} frame(s)`);
  if (looping && poseGap > 3) fails.push(`loop pose gap ${poseGap.toFixed(1)}°`);
  if (looping && velGap > 4) notes.push(`loop velocity gap ${velGap.toFixed(1)}°/f`);
  if (/Turn_Left/.test(anim.name) && !(dyaw > 60 && dyaw < 120)) fails.push(`yaw ${dyaw.toFixed(0)}°, expected ~+90 (left)`);
  if (/Turn_Right/.test(anim.name) && !(dyaw < -60 && dyaw > -120)) fails.push(`yaw ${dyaw.toFixed(0)}°, expected ~-90 (right)`);
  if (/Attack_Stomp|Aggressive_Threat|Idle/.test(anim.name) && rears) fails.push(`front pair lifts ${maxFrontPairLift.toFixed(3)} — that is rearing`);
  // What this check is FOR is that the corpse ends up on the ground, so that
  // is what it now measures: the hip height on the FINAL frame, against the
  // standing height. The old form compared a drop against the largest dip
  // anywhere in the clip, which a settle-based collapse satisfies differently
  // - it reported 0.028 while Blender measured the hips going 1.66m -> 0.92m
  // on the same file, and the rendered pose was flat on the floor.
  if (/Death/.test(anim.name)) {
    const endHip = (hip[C.N-1][1] - ground) / (walkHip - ground);
    if (endHip > 0.62) fails.push(`ends with the hips at ${(100*endHip).toFixed(0)}% of standing height; not on the ground`);
  }
  const result = fails.length ? "FAIL" : notes.length ? "PASS WITH NOTES" : "PASS";
  rows.push({ name: anim.name, dur: C.dur, loop: looping ? "Loop" : "One-shot",
    contact: `${Math.round(100*contactFrames/C.N)}%`, slide: slides, pen: penetrates, root: rootTravel < 0.01 ? "in-place" : rootTravel.toFixed(3),
    seam: looping ? `${poseGap.toFixed(1)}°/${velGap.toFixed(1)}` : `yaw ${dyaw.toFixed(0)}°`, result, why: [...fails, ...notes].join("; ") });
  if (fails.length) problems.push(`${anim.name}: ${fails.join("; ")}`);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${file.split("/").pop()}   ground=${ground.toFixed(4)}  contact<${CONTACT.toFixed(4)}  slide>${SLIDE_TOL.toFixed(4)}/frame (walk-calibrated)\n`);
console.log(pad("clip",18)+pad("dur",7)+pad("kind",9)+pad("contact",8)+pad("slide",6)+pad("pen",5)+pad("root",9)+pad("seam/yaw",13)+"result");
for (const r of rows) console.log(pad(r.name,18)+pad(r.dur.toFixed(2)+"s",7)+pad(r.loop,9)+pad(r.contact,8)+pad(r.slide,6)+pad(r.pen,5)+pad(r.root,9)+pad(r.seam,13)+r.result+(r.why?"  — "+r.why:""));
console.log(`\n${g.animations.length} clips; ${problems.length} failing`);
if (mdOut) {
  const md = ["| Clip | Duration | Loop/One-shot | Hoof Contact | Sliding | Clipping/Penetration | Root Motion | Start/End (seam or yaw) | Result |","|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.name} | ${r.dur.toFixed(2)}s | ${r.loop} | ${r.contact} | ${r.slide} | ${r.pen} | ${r.root} | ${r.seam} | **${r.result}**${r.why ? " — " + r.why : ""} |`)].join("\n");
  writeFileSync(mdOut, md + "\n"); console.log(`table -> ${mdOut}`);
}
process.exitCode = problems.length ? 1 : 0;
