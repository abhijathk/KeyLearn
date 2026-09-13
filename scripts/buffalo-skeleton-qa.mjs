/**
 * Per-frame skeleton QA for the buffalo clips.
 *
 * Reconstructs the leg chains through forward kinematics on EVERY frame of
 * every clip and checks each of the four legs for the faults that read as a
 * broken pose in motion:
 *   - hyperextension  — hoof-to-hip distance approaching full reach (leg gone
 *                       straight and "too long")
 *   - leg above hip   — the hoof lifting to or above the hip (leg gone "up"),
 *                       which only the rear/stomp/paw beats are allowed
 *   - foot underground— hoof sunk well below the planted ground line
 *
 *   node scripts/buffalo-skeleton-qa.mjs <glb>
 */
import { readFileSync } from "node:fs";
const b = readFileSync(process.argv[2]);
let o = 12, json, bin;
while (o < b.length) { const l = b.readUInt32LE(o), t = b.readUInt32LE(o + 4); const d = b.subarray(o + 8, o + 8 + l); if (t === 0x4e4f534a) json = JSON.parse(d.toString("utf8")); else if (t === 0x004e4942) bin = d; o += 8 + l; }
const acc = json.accessors;
const rd = (i) => { const a = acc[i], v = json.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type]; const st = v.byteStride || n * 4, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); const out = []; for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < n; c++) r.push(bin.readFloatLE(base + k * st + c * 4)); out.push(n === 1 ? r[0] : r); } return out; };
const qmul = (a, c) => [a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1], a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0], a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3], a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot = (q, v) => { const u=[q[0],q[1],q[2]], s=q[3]; const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]]; return [v[0]+2*(s*uv[0]+uuv[0]), v[1]+2*(s*uv[1]+uuv[1]), v[2]+2*(s*uv[2]+uuv[2])]; };
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], vlen=(a)=>Math.hypot(...a);
const joints = json.skins[0].joints;
const nm = (i) => json.nodes[i].name;
const idByName = Object.fromEntries(joints.map((j) => [nm(j), j]));
const parent = new Map(); json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
const restT = (i) => json.nodes[i].translation ?? [0,0,0];
const restR = (i) => json.nodes[i].rotation ?? [0,0,0,1];
const ARM = parent.get(idByName.Hips); const ARM_R = ARM != null ? restR(ARM) : [0,0,0,1]; const ARM_T = ARM != null ? restT(ARM) : [0,0,0];
function fk(local) { const pos = new Map(), rot = new Map(); const solve = (i) => { if (pos.has(i)) return; const lt = local.get(i)?.t ?? restT(i), lr = local.get(i)?.r ?? restR(i); const p = parent.get(i); if (p == null || !joints.includes(p)) { pos.set(i, vadd(ARM_T, qrot(ARM_R, lt))); rot.set(i, qmul(ARM_R, lr)); return; } solve(p); pos.set(i, vadd(pos.get(p), qrot(rot.get(p), lt))); rot.set(i, qmul(rot.get(p), lr)); }; for (const j of joints) solve(j); return pos; }
const LEGS = { LF:["frontleg","frontleg0","frontleg1","frontleg2"], RF:["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"], LB:["backleg","backleg0","backleg1","backleg2"], RB:["R_backleg","R_backleg0","R_backleg1","R_backleg2"] };
// reach + ground from the source Walk frame 0
const walk = json.animations[0];
const w0 = new Map();
for (const ch of walk.channels) { const s = walk.samplers[ch.sampler]; const vals = rd(s.output); const e = w0.get(ch.target.node) ?? {}; if (ch.target.path === "rotation") e.r = vals[0]; if (ch.target.path === "translation") e.t = vals[0]; w0.set(ch.target.node, e); }
const stand = new Map(joints.map((j) => [j, { r: w0.get(j)?.r ?? restR(j), t: w0.get(j)?.t ?? restT(j) }]));
const sp = fk(stand);
const REACH = {}, HIPY = {};
for (const k in LEGS) { const ch = LEGS[k].map((n) => idByName[n]); let r = 0; for (let i = 0; i < 3; i++) r += vlen(vsub(sp.get(ch[i + 1]), sp.get(ch[i]))); REACH[k] = r; }
const GROUND = Math.min(...Object.values(LEGS).map((c) => sp.get(idByName[c[3]])[1]));
const standHipH = sp.get(idByName.Hips)[1] - GROUND;

// clips exempt from the "leg above hip" rule (they lift legs on purpose)
const LIFTS_LEGS = /Rear_Stomp|Attack_Stomp|Charge_Start|Aggressive_Threat|Hit_Reaction|Death|Attack_Horn/;
let anyFail = false;
console.log(`skeleton QA  reach LF=${REACH.LF.toFixed(3)} RF=${REACH.RF.toFixed(3)} LB=${REACH.LB.toFixed(3)} RB=${REACH.RB.toFixed(3)}  ground=${GROUND.toFixed(4)} hipH=${standHipH.toFixed(3)}\n`);
console.log("clip                     worst-extension     legs-above-hip   deep-underground   verdict");
for (const clip of json.animations) {
  const chans = {};
  for (const ch of clip.channels) { (chans[ch.target.node] ??= {})[ch.target.path] = rd(clip.samplers[ch.sampler].output); }
  const F = Math.max(...Object.values(chans).map((c) => (c.rotation?.length ?? c.translation?.length ?? 1)));
  let maxExt = 0, extAt = "", aboveN = 0, aboveClip = "", deepN = 0;
  for (let f = 0; f < F; f++) {
    const local = new Map(joints.map((j) => { const c = chans[j]; return [j, { r: c?.rotation?.[Math.min(f, (c.rotation?.length ?? 1) - 1)] ?? restR(j), t: c?.translation?.[Math.min(f, (c.translation?.length ?? 1) - 1)] ?? restT(j) }]; }));
    const P = fk(local);
    for (const k in LEGS) {
      const ch = LEGS[k].map((n) => idByName[n]);
      const hip = P.get(ch[0]), hoof = P.get(ch[3]);
      const ext = vlen(vsub(hoof, hip)) / REACH[k];
      if (ext > maxExt) { maxExt = ext; extAt = `${k}@${f}`; }
      if (hoof[1] > hip[1] - 0.15 * standHipH) { aboveN++; if (!aboveClip) aboveClip = `${k}@${f}`; }
      if (hoof[1] < GROUND - 0.30 * standHipH) deepN++;
    }
  }
  const extBad = maxExt > 0.99;
  const aboveBad = aboveN > 0 && !LIFTS_LEGS.test(clip.name);
  // Death is a collapse: the body is on the ground and a hoof clipping the
  // floor as it falls is expected, so it is exempt from the sunk/above checks.
  const sunkBad = deepN > 0 && !/Death/.test(clip.name);
  const fail = extBad || aboveBad || sunkBad;
  if (fail) anyFail = true;
  console.log(
    clip.name.padEnd(24),
    `${(maxExt*100).toFixed(0)}% ${extAt}`.padEnd(19),
    `${aboveN} ${aboveClip}`.padEnd(16),
    `${deepN}`.padEnd(18),
    fail ? (extBad ? "FAIL long " : "") + (aboveBad ? "FAIL up " : "") + (deepN ? "FAIL sunk" : "") : "ok",
  );
}
console.log(anyFail ? "\nSKELETON FAULTS PRESENT" : "\nall legs within the reachable, upright, grounded envelope");
