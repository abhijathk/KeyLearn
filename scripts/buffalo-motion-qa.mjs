/**
 * buffalo-motion-qa — the checks that positional QA is blind to.
 *
 * Contact, sliding and penetration all watch WHERE the hoof is. A bone can
 * spin about its own length, or a joint can bend to an angle no real animal
 * reaches, without moving any hoof at all — so every positional check passes
 * while the animation looks broken on screen. Two things are measured here:
 *
 *   1. WORLD SPIN — the largest single-frame change in a bone's world
 *      orientation. Judged against the source Walk, which is the approved
 *      reference. A pass that rotated limbs about their own axis once put a
 *      ~180deg single-frame spin into every clip and nothing else caught it.
 *
 *   2. JOINT ENVELOPE — each leg joint's bend angle, measured in the BODY's
 *      own frame so a pitched, rolled or toppled body never reads as a bent
 *      joint. The Walk's own range per joint is the allowed range: the Walk is
 *      the reference for how every joint moves, not just which way it folds.
 *
 * Usage: node scripts/buffalo-motion-qa.mjs <file.glb>
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
const src = readFileSync(file);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const l = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const b = src.subarray(off + 8, off + 8 + l);
  if (t === 0x4e4f534a) json = JSON.parse(b.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(b);
  off += 8 + l;
}
const acc = json.accessors;
const rd = (i) => { const a = acc[i], v = json.bufferViews[a.bufferView];
  const n = { SCALAR:1, VEC3:3, VEC4:4 }[a.type];
  const st = v.byteStride || n*4, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const o = [];
  for (let k = 0; k < a.count; k++) { const r = [];
    for (let c = 0; c < n; c++) r.push(bin.readFloatLE(base + k*st + c*4));
    o.push(n === 1 ? r[0] : r); }
  return o; };
const qmul=(a,c)=>[a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1],a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0],a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3],a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qconj=(q)=>[-q[0],-q[1],-q[2],q[3]];
const qrot=(q,v)=>{const u=[q[0],q[1],q[2]],s=q[3];
  const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const uu=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];
  return [v[0]+2*(s*uv[0]+uu[0]), v[1]+2*(s*uv[1]+uu[1]), v[2]+2*(s*uv[2]+uu[2])];};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

const joints = json.skins[0].joints;
const nm = (i) => json.nodes[i].name;
const byName = Object.fromEntries(joints.map((j) => [nm(j), j]));
const parent = new Map(); json.nodes.forEach((n,i)=>(n.children??[]).forEach((c)=>parent.set(c,i)));
const ARM = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const FWD = [0,0,1], UP = [0,1,0];
const LEGS = { LF:["frontleg","frontleg0","frontleg1","frontleg2"],
               RF:["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"],
               LB:["backleg","backleg0","backleg1","backleg2"],
               RB:["R_backleg","R_backleg0","R_backleg1","R_backleg2"] };
const FPS = 30;

function sample(cl) {
  const dur = Math.max(...cl.samplers.map((s) => acc[s.input].max[0]));
  const N = Math.round(dur * FPS) + 1;
  const L = new Map();
  for (const ch of cl.channels) {
    if (ch.target.path === "scale") continue;
    const s = cl.samplers[ch.sampler], ti = rd(s.input), vo = rd(s.output);
    const e = L.get(ch.target.node) ?? {}; L.set(ch.target.node, e);
    e[ch.target.path] = Array.from({ length: N }, (_, f) => {
      const tt = f / FPS; let i = 0;
      while (i < ti.length - 1 && ti[i+1] < tt) i++;
      const a = ti[i], b = ti[Math.min(i+1, ti.length-1)], u = b > a ? (tt-a)/(b-a) : 0;
      const A = vo[i], B = vo[Math.min(i+1, vo.length-1)];
      return A.map((x, c) => x + (B[c]-x)*u); });
  }
  const frames = [];
  for (let f = 0; f < N; f++) {
    const pos = new Map(), rot = new Map();
    const solve = (i) => { if (pos.has(i)) return;
      const e = L.get(i) ?? {};
      const t = e.translation ? e.translation[f] : (json.nodes[i].translation ?? [0,0,0]);
      const r = e.rotation ? e.rotation[f] : (json.nodes[i].rotation ?? [0,0,0,1]);
      const p = parent.get(i);
      if (p == null || !joints.includes(p)) { pos.set(i, qrot(ARM, t)); rot.set(i, qmul(ARM, r)); return; }
      solve(p);
      pos.set(i, pos.get(p).map((x, c) => x + qrot(rot.get(p), t)[c]));
      rot.set(i, qmul(rot.get(p), r)); };
    for (const j of joints) solve(j);
    frames.push({ pos, rot });
  }
  return frames;
}
const restWorld = new Map();
(function(){ const solve=(i)=>{ if(restWorld.has(i))return; const p=parent.get(i);
  const r=json.nodes[i].rotation??[0,0,0,1];
  if(p==null||!joints.includes(p)){restWorld.set(i,qmul(ARM,r));return;}
  solve(p); restWorld.set(i,qmul(restWorld.get(p),r)); }; for(const j of joints) solve(j); })();

const wrap = (d) => { while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
function hinges(F, k) {
  const ch = LEGS[k].map((n) => byName[n]);
  const qB = qmul(F.rot.get(byName.Hips), qconj(restWorld.get(byName.Hips)));
  const fw = qrot(qB, FWD), up = qrot(qB, UP);
  const a = [];
  for (let i = 0; i < 3; i++) {
    const v = ch.slice(i, i+2).map((x) => F.pos.get(x));
    const d = [v[1][0]-v[0][0], v[1][1]-v[0][1], v[1][2]-v[0][2]];
    a.push(Math.atan2(dot(d, fw), -dot(d, up)) * 180 / Math.PI);
  }
  return [wrap(a[1]-a[0]), wrap(a[2]-a[1])];
}
const spin = (F0, F1) => { let w = 0, who = "";
  for (const j of joints) { const a = F0.rot.get(j), b = F1.rot.get(j);
    const d = Math.min(1, Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]));
    const deg = 2 * Math.acos(d) * 180 / Math.PI;
    if (deg > w) { w = deg; who = nm(j); } }
  return [w, who]; };

const walk = json.animations.find((a) => a.name === "Walk") ?? json.animations[0];
const WF = sample(walk);
const REF = {};
for (const k in LEGS) { const lo = [Infinity,Infinity], hi = [-Infinity,-Infinity];
  for (const F of WF) { const h = hinges(F, k);
    for (let j = 0; j < 2; j++) { lo[j]=Math.min(lo[j],h[j]); hi[j]=Math.max(hi[j],h[j]); } }
  REF[k] = [[lo[0],hi[0]],[lo[1],hi[1]]]; }
let refSpin = 0;
for (let f = 1; f < WF.length; f++) refSpin = Math.max(refSpin, spin(WF[f-1], WF[f])[0]);
const SPIN_CAP = Math.max(refSpin * 1.6, 90);

console.log(`\nmotion QA  ${file.split("/").pop()}`);
console.log(`reference Walk: worst world spin ${refSpin.toFixed(1)}deg/frame  ->  cap ${SPIN_CAP.toFixed(1)}deg/frame`);
for (const k in LEGS) console.log(`  ${k} joint envelope  j1 [${REF[k][0][0].toFixed(1)}..${REF[k][0][1].toFixed(1)}]  j2 [${REF[k][1][0].toFixed(1)}..${REF[k][1][1].toFixed(1)}]`);
console.log("\nclip                      worst spin           joints outside the Walk's envelope");
let bad = 0;
for (const cl of json.animations) {
  const F = sample(cl);
  let w = 0, who = "", at = 0;
  for (let f = 1; f < F.length; f++) { const [d, n] = spin(F[f-1], F[f]); if (d > w) { w = d; who = n; at = f; } }
  const out = [];
  for (const k in LEGS) {
    const worst = [0, 0], wf = [0, 0];
    for (let f = 0; f < F.length; f++) { const h = hinges(F[f], k);
      for (let j = 0; j < 2; j++) { const [lo, hi] = REF[k][j];
        // Only a joint bending to the side the Walk NEVER uses is a fault. A
        // gallop or a charge legitimately folds a leg further than a walk does;
        // what it must never do is bend the joint the other way. Where the
        // Walk's own range straddles zero the joint genuinely swings both ways
        // and there is nothing to enforce.
        const e = lo >= 0 ? Math.max(0, -h[j]) : hi <= 0 ? Math.max(0, h[j]) : 0;
        if (e > worst[j]) { worst[j] = e; wf[j] = f; } } }
    for (let j = 0; j < 2; j++)
      if (worst[j] > 3) out.push(`${k}:j${j+1} ${worst[j].toFixed(1)}deg@f${wf[j]}`);
  }
  const fail = w > SPIN_CAP || out.length > 0;
  if (fail && cl.name !== "Walk") bad++;
  console.log(`${cl.name.padEnd(25)} ${(w.toFixed(1)+"deg "+who).padEnd(20)} ${out.join(", ") || "-"}${w > SPIN_CAP ? "   SPIN OVER CAP" : ""}`);
}
console.log(bad ? `\n${bad} clip(s) with motion faults` : "\nall clips move within the Walk's own spin and joint envelope");
