/**
 * Extracts the existing Walk as the anatomical reference for every clip
 * that has to look like the same buffalo.
 *
 * Forward kinematics is run over the whole cycle so the reference carries
 * WORLD-space hoof positions, not just bone angles — hoof contact, sliding
 * and ground height are the things the brief asks to be verified, and they
 * only exist in world space.
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2], out = process.argv[3];
const b = readFileSync(src);
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
// ── quaternion / transform helpers ──────────────────────────────────────
const qmul = (a, c) => [
  a[3]*c[0] + a[0]*c[3] + a[1]*c[2] - a[2]*c[1],
  a[3]*c[1] - a[0]*c[2] + a[1]*c[3] + a[2]*c[0],
  a[3]*c[2] + a[0]*c[1] - a[1]*c[0] + a[2]*c[3],
  a[3]*c[3] - a[0]*c[0] - a[1]*c[1] - a[2]*c[2],
];
const qrot = (q, v) => {
  const u = [q[0], q[1], q[2]], s = q[3];
  const uv = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
  const uuv = [u[1]*uv[2]-u[2]*uv[1], u[2]*uv[0]-u[0]*uv[2], u[0]*uv[1]-u[1]*uv[0]];
  return [v[0] + 2*(s*uv[0] + uuv[0]), v[1] + 2*(s*uv[1] + uuv[1]), v[2] + 2*(s*uv[2] + uuv[2])];
};
const slerp = (a, c, t) => {
  let dot = a[0]*c[0]+a[1]*c[1]+a[2]*c[2]+a[3]*c[3];
  let cc = c; if (dot < 0) { dot = -dot; cc = c.map((x) => -x); }
  if (dot > 0.9995) { const r = a.map((x, i) => x + t*(cc[i]-x)); const l = Math.hypot(...r); return r.map((x)=>x/l); }
  const th = Math.acos(dot), s = Math.sin(th);
  const wa = Math.sin((1-t)*th)/s, wb = Math.sin(t*th)/s;
  return a.map((x, i) => wa*x + wb*cc[i]);
};

const anim = g.animations[0];
const joints = g.skins[0].joints;
const name = (i) => g.nodes[i].name;
const parent = new Map();
g.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));

// Sample every channel onto a common 30fps timeline.
const dur = Math.max(...anim.samplers.map((s) => acc[s.input].max[0]));
const FPS = 30, N = Math.round(dur * FPS) + 1;
const tracks = new Map(); // node -> { t: [...], r: [...] } per frame
for (const ch of anim.channels) {
  if (ch.target.path === "scale") continue;
  const s = anim.samplers[ch.sampler];
  const times = rd(s.input), vals = rd(s.output);
  const perFrame = [];
  for (let f = 0; f < N; f++) {
    const tt = Math.min(dur, f / FPS);
    let k = 0; while (k < times.length - 1 && times[k + 1] <= tt) k++;
    const k2 = Math.min(times.length - 1, k + 1);
    const u = times[k2] === times[k] ? 0 : (tt - times[k]) / (times[k2] - times[k]);
    perFrame.push(ch.target.path === "rotation" ? slerp(vals[k], vals[k2], u) : vals[k].map((x, i) => x + u * (vals[k2][i] - x)));
  }
  const e = tracks.get(ch.target.node) ?? {};
  e[ch.target.path === "rotation" ? "r" : "t"] = perFrame;
  tracks.set(ch.target.node, e);
}
// Rest pose for any joint without a track.
const restT = (i) => g.nodes[i].translation ?? [0,0,0];
const restR = (i) => g.nodes[i].rotation ?? [0,0,0,1];

// FK: world position of every joint per frame.
const world = []; // frame -> Map(node -> [x,y,z])
for (let f = 0; f < N; f++) {
  const pos = new Map(), rot = new Map();
  const solve = (i) => {
    if (pos.has(i)) return;
    const tr = tracks.get(i);
    const lt = tr?.t?.[f] ?? restT(i), lr = tr?.r?.[f] ?? restR(i);
    const p = parent.get(i);
    if (p == null || !joints.includes(p)) {
      // Include the non-joint parents (Armature) as identity-ish: use their rest.
      let pr = [0,0,0,1], pp = [0,0,0];
      if (p != null) { pr = restR(p); pp = restT(p); }
      pos.set(i, [pp[0]+qrot(pr, lt)[0], pp[1]+qrot(pr, lt)[1], pp[2]+qrot(pr, lt)[2]]);
      rot.set(i, qmul(pr, lr));
      return;
    }
    solve(p);
    const pr = rot.get(p), pp = pos.get(p);
    const wv = qrot(pr, lt);
    pos.set(i, [pp[0]+wv[0], pp[1]+wv[1], pp[2]+wv[2]]);
    rot.set(i, qmul(pr, lr));
  };
  for (const j of joints) solve(j);
  world.push(pos);
}
const byName = Object.fromEntries(joints.map((j) => [name(j), j]));
const hooves = ["frontleg2", "R_frontleg2", "backleg2", "R_backleg2"];
const groundY = Math.min(...world.flatMap((m) => hooves.map((h) => m.get(byName[h])[1])));
const hoofY = Object.fromEntries(hooves.map((h) => [h, world.map((m) => +(m.get(byName[h])[1] - groundY).toFixed(4))]));
const hoofZ = Object.fromEntries(hooves.map((h) => [h, world.map((m) => +m.get(byName[h])[2].toFixed(4))]));
const hipsY = world.map((m) => +m.get(byName.Hips)[1].toFixed(4));
const headY = world.map((m) => +m.get(byName.head)[1].toFixed(4));

// Contact phases: a hoof is "down" when within 15% of its own lift range of the ground.
const contact = {};
for (const h of hooves) {
  const ys = hoofY[h], lift = Math.max(...ys);
  contact[h] = ys.map((y) => y < 0.15 * lift + 1e-4 ? 1 : 0);
}
// Per-bone rotation extent from rest (deg) — joint range reference.
const extent = {};
for (const j of joints) {
  const tr = tracks.get(j); if (!tr?.r) continue;
  const r0 = restR(j); let mx = 0;
  for (const q of tr.r) { const d = Math.min(1, Math.abs(q[0]*r0[0]+q[1]*r0[1]+q[2]*r0[2]+q[3]*r0[3])); mx = Math.max(mx, 2*Math.acos(d)*180/Math.PI); }
  extent[name(j)] = +mx.toFixed(1);
}
const hoofX = Object.fromEntries(hooves.map((h) => [h, world.map((m) => +m.get(byName[h])[0].toFixed(4))]));
const jointWorld = Object.fromEntries(joints.map((j) => [name(j), world.map((m) => m.get(j).map((v) => +v.toFixed(4)))]));
const ref = {
  hoofZ, hoofX, hoofY, jointWorld,
  fps: FPS, frames: N, duration: dur, groundY: +groundY.toFixed(4),
  hipsY: { min: Math.min(...hipsY), max: Math.max(...hipsY) },
  headY: { min: Math.min(...headY), max: Math.max(...headY) },
  hoofLift: Object.fromEntries(hooves.map((h) => [h, Math.max(...hoofY[h])])),
  hoofStrideZ: Object.fromEntries(hooves.map((h) => [h, +(Math.max(...hoofZ[h]) - Math.min(...hoofZ[h])).toFixed(4)])),
  contactPhase: contact,
  jointExtentDeg: extent,
  rest: Object.fromEntries(joints.map((j) => [name(j), { t: restT(j), r: restR(j) }])),
  walkTracks: Object.fromEntries([...tracks].map(([i, e]) => [name(i), e])),
  hierarchy: Object.fromEntries(joints.map((j) => [name(j), parent.has(j) ? name(parent.get(j)) : null])),
};
writeFileSync(out, JSON.stringify(ref));
console.log(`ground y=${ref.groundY}  hips y ${ref.hipsY.min}..${ref.hipsY.max}  head y ${ref.headY.min}..${ref.headY.max}`);
console.log("hoof lift  :", Object.entries(ref.hoofLift).map(([k,v])=>`${k}=${v.toFixed(3)}`).join("  "));
console.log("stride (z) :", Object.entries(ref.hoofStrideZ).map(([k,v])=>`${k}=${v}`).join("  "));
console.log("contact    :");
for (const h of hooves) console.log(`  ${h.padEnd(12)} ${contact[h].join("")}`);
console.log("joint extent (deg):", Object.entries(extent).filter(([,v])=>v>1).map(([k,v])=>`${k}=${v}`).join("  "));
console.log(`\nreference -> ${out}`);
