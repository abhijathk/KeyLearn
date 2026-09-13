/**
 * Find the BAD FRAME in a clip: the one the eye sees as a flicker.
 *
 * A flicker in a skinned character is almost never the renderer. It is a
 * single keyframe whose pose does not belong to the ones on either side of
 * it, so the skeleton snaps there and back inside two frames — too fast to
 * read as movement and exactly fast enough to read as a flash.
 *
 * That is a measurable thing, and this measures it: every joint is resolved
 * to world space at 60 samples a second, and each frame is scored by how far
 * the skeleton moved since the previous one. A clip's own median step is the
 * yardstick, because a Run legitimately moves further per frame than a Graze
 * — what matters is a frame that jumps many times further than the rest of
 * its OWN clip, and then comes straight back.
 *
 *   node scripts/glb-frame-outliers.mjs file.glb [--ratio 6]
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const RATIO = args.includes("--ratio") ? parseFloat(args[args.indexOf("--ratio") + 1]) : 6;
if (!file) { console.error("usage: glb-frame-outliers.mjs file.glb [--ratio n]"); process.exit(2); }

const b = readFileSync(file);
let o = 12, j = null, bin = null;
while (o < b.length) {
  const L = b.readUInt32LE(o), T = b.readUInt32LE(o + 4), s = b.subarray(o + 8, o + 8 + L);
  if (T === 0x4e4f534a) j = JSON.parse(s);
  if (T === 0x004e4942) bin = Buffer.from(s);
  o += 8 + L;
}
if (j.extensionsRequired?.includes("EXT_meshopt_compression")) {
  console.error("this file is meshopt-compressed; run glb-decompress.mjs first");
  process.exit(2);
}
const rd = (i, n) => {
  const a = j.accessors[i], v = j.bufferViews[a.bufferView];
  const sz = { 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
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

function poses(anim) {
  const tr = new Map();
  for (const ch of anim.channels) {
    const e = tr.get(ch.target.node) ?? {};
    e[ch.target.path] = rd(anim.samplers[ch.sampler].output, ch.target.path === "rotation" ? 4 : 3);
    e[ch.target.path + "_t"] = rd(anim.samplers[ch.sampler].input, 1);
    tr.set(ch.target.node, e);
  }
  const dur = Math.max(...anim.samplers.map((s) => j.accessors[s.input].max[0]));
  const N = Math.max(2, Math.round(dur * 60) + 1);
  const out = [];
  for (let f = 0; f < N; f++) {
    const t = (dur * f) / (N - 1);
    const pos = new Map(), rot = new Map();
    // INTERPOLATED, not snapped to the previous key.
    //
    // Reading the nearest earlier keyframe is what a STEP sampler does, and
    // glTF clips are almost all LINEAR: authored at a handful of keys and
    // played as a smooth blend between them. Sampled the step way, every
    // frame between two keys is identical and every frame that lands on one
    // jumps the whole gap — so a perfectly smooth clip measures as a median
    // step of zero with enormous spikes, which is a description of the
    // sampler rather than of the animation. Quaternions are slerped, with
    // the neighbourhood check, or a 180-degree pair blends the long way and
    // invents a spin nothing in the file asked for.
    const pick = (e, path) => {
      const vals = e?.[path], times = e?.[path + "_t"];
      if (!vals) return null;
      if (t <= times[0]) return vals[0];
      if (t >= times[times.length - 1]) return vals[times.length - 1];
      let k = 0; while (k < times.length - 1 && times[k + 1] <= t) k++;
      const t0 = times[k], t1 = times[k + 1];
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      const a = vals[k], c = vals[k + 1];
      if (path !== "rotation") return a.map((x, i) => x + (c[i] - x) * u);
      let d = a[0]*c[0] + a[1]*c[1] + a[2]*c[2] + a[3]*c[3];
      const e2 = d < 0 ? c.map((x) => -x) : c;
      d = Math.abs(d);
      if (d > 0.9995) {
        const q = a.map((x, i) => x + (e2[i] - x) * u);
        const n = Math.hypot(...q) || 1;
        return q.map((x) => x / n);
      }
      const th = Math.acos(d), s0 = Math.sin((1 - u) * th) / Math.sin(th), s1 = Math.sin(u * th) / Math.sin(th);
      return a.map((x, i) => x * s0 + e2[i] * s1);
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
    out.push({ t, pos });
  }
  return out;
}

const joints = j.skins?.[0]?.joints ?? j.nodes.map((_, i) => i);
let flagged = 0;
console.log(`\n${file.split("/").pop()}  — ${j.animations?.length ?? 0} clips, ${joints.length} joints\n`);
for (const anim of j.animations ?? []) {
  const P = poses(anim);
  const step = [];
  for (let f = 1; f < P.length; f++) {
    let worst = 0;
    for (const ji of joints) {
      const a = P[f - 1].pos.get(ji), c = P[f].pos.get(ji);
      if (!a || !c) continue;
      worst = Math.max(worst, Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
    }
    step.push(worst);
  }
  const sorted = [...step].sort((x, y) => x - y);
  const med = sorted[Math.floor(sorted.length / 2)] || 1e-9;
  const bad = [];
  for (let i = 0; i < step.length; i++) {
    const r = step[i] / med;
    // A SPIKE, not a fast passage: big against the clip's own median AND
    // followed by a step back the other way. A genuine acceleration keeps
    // going; a bad frame returns.
    const back = i + 1 < step.length ? step[i + 1] / med : 0;
    if (r > RATIO && back > RATIO * 0.5) {
      bad.push({ frame: i + 1, t: P[i + 1].t.toFixed(3), ratio: r.toFixed(1), back: back.toFixed(1) });
    }
  }
  const tag = bad.length ? `${bad.length} SPIKE${bad.length > 1 ? "S" : ""}` : "ok";
  console.log(
    `${anim.name.padEnd(26)} ${String(P.length).padStart(4)} frames  median step ${med.toFixed(4)}  max ${Math.max(...step).toFixed(4)}  ${tag}`,
  );
  for (const s of bad.slice(0, 6)) {
    console.log(`    frame ${String(s.frame).padStart(4)} @ ${s.t}s   ${s.ratio}x the clip's median, ${s.back}x back`);
  }
  flagged += bad.length;
}
console.log(`\n${flagged} spike${flagged === 1 ? "" : "s"} across all clips (ratio > ${RATIO})`);
