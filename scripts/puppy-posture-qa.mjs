/**
 * Posture QA: judge every authored clip against the SOURCE clips' own envelope.
 *
 *   node scripts/puppy-posture-qa.mjs file.glb [--ref Walk,Idle,Run]
 *
 * The source Walk, Idle and Run were made by hand for this mesh and read
 * correctly. That makes them the only trustworthy definition of "looks like
 * this dog" available, and a far better bar than any absolute number I could
 * invent: if an authored clip stands, tips or splays outside the range the
 * hand-made clips use, it is wrong in a way a viewer will see.
 *
 * Five measurements, all skeleton-derived and all normalised by hip height so
 * they mean the same thing on any dog:
 *
 *   TILT    trunk pitch, hips->chest, degrees above horizontal
 *   RISE    hip height above the lowest paw
 *   FORE    fore paw offset from its own shoulder (+ forward)
 *   HIND    hind paw offset from its own hip
 *   SPREAD  fore-to-hind paw distance: how stretched out the stance is
 *
 * Clips that are SUPPOSED to leave the envelope are exempted by name - a beg
 * is meant to tip the trunk vertical, a jump is meant to leave the ground.
 * Everything else is expected to stay inside it.
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const refNames = (args.includes("--ref") ? args[args.indexOf("--ref") + 1] : "Walk,Idle").split(",");
if (!file) { console.error("usage: puppy-posture-qa.mjs file.glb [--ref Walk,Idle,Run]"); process.exit(2); }

const b = readFileSync(file);
let o = 12, j = null, bin = null;
while (o < b.length) {
  const L = b.readUInt32LE(o), T = b.readUInt32LE(o + 4), s = b.subarray(o + 8, o + 8 + L);
  if (T === 0x4e4f534a) j = JSON.parse(s);
  if (T === 0x004e4942) bin = Buffer.from(s);
  o += 8 + L;
}
const rd = (i, n) => {
  const a = j.accessors[i], v = j.bufferViews[a.bufferView];
  const sz = { 5121: 1, 5122: 2, 5123: 2, 5126: 4 }[a.componentType];
  const st = v.byteStride || n * sz, off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const r = [];
    for (let c = 0; c < n; c++) r.push(bin.readFloatLE(off + k * st + c * 4));
    out.push(n === 1 ? r[0] : r);
  }
  return out;
};
const qmul = (a, c) => [a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1], a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0],
                        a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3], a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot = (q, v) => {
  const t = [2*(q[1]*v[2]-q[2]*v[1]), 2*(q[2]*v[0]-q[0]*v[2]), 2*(q[0]*v[1]-q[1]*v[0])];
  return [v[0]+q[3]*t[0]+q[1]*t[2]-q[2]*t[1], v[1]+q[3]*t[1]+q[2]*t[0]-q[0]*t[2], v[2]+q[3]*t[2]+q[0]*t[1]-q[1]*t[0]];
};
const par = new Map(); j.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => par.set(c, i)));
const by = {}; j.nodes.forEach((n, i) => { if (n.name && !(n.name in by)) by[n.name] = i; });
const PAWS = ["frontleg2", "R_frontleg2", "backleg2", "R_backleg2"];
const FORE = [["frontleg", "frontleg2"], ["R_frontleg", "R_frontleg2"]];
const HIND = [["backleg", "backleg2"], ["R_backleg", "R_backleg2"]];

function frames(anim) {
  const tr = new Map();
  for (const ch of anim.channels) {
    const e = tr.get(ch.target.node) ?? {};
    e[ch.target.path] = rd(anim.samplers[ch.sampler].output, ch.target.path === "rotation" ? 4 : 3);
    e[ch.target.path + "_t"] = rd(anim.samplers[ch.sampler].input, 1);
    tr.set(ch.target.node, e);
  }
  const dur = Math.max(...anim.samplers.map((s) => j.accessors[s.input].max[0]));
  const N = Math.round(dur * 30) + 1;
  const out = [];
  for (let f = 0; f < N; f++) {
    const t = Math.min(dur, f / 30);
    const pos = new Map(), rot = new Map();
    const pick = (e, path) => {
      const vals = e?.[path], times = e?.[path + "_t"];
      if (!vals) return null;
      let k = 0; while (k < times.length - 1 && times[k + 1] <= t) k++;
      return vals[k];
    };
    const so = (i) => {
      if (pos.has(i)) return;
      const e = tr.get(i);
      const lt = pick(e, "translation") ?? j.nodes[i].translation ?? [0, 0, 0];
      const lr = pick(e, "rotation") ?? j.nodes[i].rotation ?? [0, 0, 0, 1];
      const p = par.get(i);
      if (p == null) { pos.set(i, lt); rot.set(i, lr); return; }
      so(p);
      pos.set(i, qrot(rot.get(p), lt).map((x, k2) => x + pos.get(p)[k2]));
      rot.set(i, qmul(rot.get(p), lr));
    };
    j.nodes.forEach((_, i) => so(i));
    out.push(pos);
  }
  return out;
}

function measure(anim) {
  const F = frames(anim);
  const hipH = (() => {
    const p = F[0];
    return p.get(by.Hips)[1] - Math.min(...PAWS.map((n) => p.get(by[n])[1]));
  })();
  const acc = { tilt: [], rise: [], fore: [], hind: [], spread: [], ext: [] };
  // How EXTENDED each leg is: root-to-paw distance as a fraction of the leg's
  // own fully-straight length. This is the measurement that was missing. Hip
  // height says how tall the dog stands; extension says whether it is standing
  // on legs or crouching on folded ones, and a crouched dog reads as a
  // different animal even when its hips are at exactly the right height.
  const CH = { LF: ["frontleg","frontleg0","frontleg1","frontleg2"], RF: ["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"],
               LB: ["backleg","backleg0","backleg1","backleg2"], RB: ["R_backleg","R_backleg0","R_backleg1","R_backleg2"] };
  const REACH = {};
  for (const k of Object.keys(CH)) {
    let r = 0;
    for (let i = 0; i < 3; i++) {
      const a = F[0].get(by[CH[k][i]]), c = F[0].get(by[CH[k][i+1]]);
      r += Math.hypot(c[0]-a[0], c[1]-a[1], c[2]-a[2]);
    }
    REACH[k] = r;
  }
  for (const p of F) {
    const hips = p.get(by.Hips), chest = p.get(by.chest);
    const d = [chest[0] - hips[0], chest[1] - hips[1], chest[2] - hips[2]];
    acc.tilt.push(Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180 / Math.PI);
    const lowest = Math.min(...PAWS.map((n) => p.get(by[n])[1]));
    acc.rise.push((hips[1] - lowest) / hipH);
    for (const [r, w] of FORE) acc.fore.push((p.get(by[w])[2] - p.get(by[r])[2]) / hipH);
    for (const [r, w] of HIND) acc.hind.push((p.get(by[w])[2] - p.get(by[r])[2]) / hipH);
    const fz = (p.get(by.frontleg2)[2] + p.get(by.R_frontleg2)[2]) / 2;
    const bz = (p.get(by.backleg2)[2] + p.get(by.R_backleg2)[2]) / 2;
    acc.spread.push(Math.abs(fz - bz) / hipH);
    for (const k of Object.keys(CH)) {
      const a = p.get(by[CH[k][0]]), c = p.get(by[CH[k][3]]);
      acc.ext.push(Math.hypot(c[0]-a[0], c[1]-a[1], c[2]-a[2]) / REACH[k]);
    }
  }
  const stat = (a) => ({ lo: Math.min(...a), hi: Math.max(...a), mean: a.reduce((x, y) => x + y, 0) / a.length });
  return { tilt: stat(acc.tilt), rise: stat(acc.rise), fore: stat(acc.fore), hind: stat(acc.hind), spread: stat(acc.spread), ext: stat(acc.ext) };
}

const M = {};
for (const a of j.animations) M[a.name] = measure(a);

// the envelope the hand-made clips actually use, widened by a quarter of its
// own width so a clip is only flagged for leaving it clearly
const env = {};
for (const k of ["tilt", "rise", "fore", "hind", "spread", "ext"]) {
  let lo = Infinity, hi = -Infinity;
  for (const n of refNames) { if (!M[n]) continue; lo = Math.min(lo, M[n][k].lo); hi = Math.max(hi, M[n][k].hi); }
  const pad = (hi - lo) * 0.25 + 0.02;
  env[k] = [lo - pad, hi + pad];
}
// clips that are MEANT to leave it
const EXEMPT = {
  tilt: /^(Beg|Pee|Play_Bow|Jump|Sit|Lie_Down|Sleep|Sniff_Ground|Turn_Left_90|Turn_Right_90|Run)$/,
  rise: /^(Beg|Pee|Jump|Sit|Lie_Down|Sleep|Play_Bow|Run|Sniff_Ground)$/,
  fore: /^(Beg|Pee|Jump|Lie_Down|Sleep|Play_Bow|Turn_Left_90|Turn_Right_90|Sit)$/,
  hind: /^(Beg|Pee|Jump|Sit|Lie_Down|Sleep|Turn_Left_90|Turn_Right_90|Run)$/,
  spread: /^(Beg|Pee|Jump|Lie_Down|Sleep|Play_Bow|Run|Turn_Left_90|Turn_Right_90|Sit|Sniff_Ground)$/,
  ext: /^(Beg|Pee|Jump|Sit|Lie_Down|Sleep|Play_Bow)$/,
};
const fmt = (v) => (v >= 0 ? " " : "") + v.toFixed(2);
console.log(`\n${file.split("/").pop()}   reference: ${refNames.join(", ")}`);
console.log(`envelope  tilt ${env.tilt.map((x)=>x.toFixed(0)).join("..")}°   rise ${env.rise.map((x)=>x.toFixed(2)).join("..")}   spread ${env.spread.map((x)=>x.toFixed(2)).join("..")}   EXTENSION ${env.ext.map((x)=>x.toFixed(2)).join("..")}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("clip", 16) + pad("tilt°", 15) + pad("rise", 13) + pad("spread", 13) + pad("EXTENSION", 15) + "verdict");
let bad = 0;
for (const a of j.animations) {
  const m = M[a.name], out = [];
  const cell = (k, scale = 1) => {
    const lo = m[k].lo * scale, hi = m[k].hi * scale;
    const [e0, e1] = env[k].map((x) => x * scale);
    const off = lo < e0 - 1e-6 || hi > e1 + 1e-6;
    if (off && !(EXEMPT[k] ?? /$^/).test(a.name)) out.push(k);
    return pad(`${fmt(lo)}..${fmt(hi)}${off ? "*" : " "}`, k === "tilt" ? 15 : k === "ext" ? 15 : 13);
  };
  const row = pad(a.name, 16) + cell("tilt") + cell("rise") + cell("spread") + cell("ext");
  cell("fore"); cell("hind");
  const isRef = refNames.includes(a.name);
  if (out.length && !isRef) bad++;
  console.log(row.slice(0, 72) + (isRef ? "reference" : out.length ? `OUTSIDE: ${out.join(", ")}` : "ok"));
}
console.log(`\n${j.animations.length} clips; ${bad} outside the source envelope on something they should not be`);
