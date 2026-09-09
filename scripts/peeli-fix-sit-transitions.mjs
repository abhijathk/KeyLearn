#!/usr/bin/env node
/**
 * Welds Peeli's cross-legged transitions onto the seated pose.
 *
 * The merged export carries a stand-to-sit and a sit-to-stand clip whose ends
 * do not meet the seated idle: measured on the source, stand-to-sit finishes
 * 25.2° (mean per bone) away from the seated pose, and sit-to-stand begins
 * 30.3° away and 0.022 above it. Played in sequence that is a snap, a foot
 * slide and a hop of the root.
 *
 * `Sit_Cross_Legged_on_Floor` is authoritative and is not touched. The two
 * transitions are re-authored so that:
 *
 *   · the LAST frame of stand-to-sit is exactly the seated pose;
 *   · the FIRST frame of sit-to-stand is exactly the seated pose;
 *   · the frames leading in and out of those are eased, not cut, so the
 *     velocity matches at the join as well as the position.
 *
 * ── How, and why this way ────────────────────────────────────────────────
 *
 * The correction is a weighted blend toward the seated pose across a window at
 * the boundary, with a smoothstep weight. Smoothstep rather than linear
 * because its derivative is zero at both ends: a linear ramp removes the
 * position snap and leaves a velocity snap, which reads as a twitch rather
 * than a jump but is just as visible.
 *
 * Rotations are slerped on the shortest arc, never lerped componentwise — the
 * latter is what produces the leg twisting this is meant to remove, since two
 * quaternions a long way apart pass through a shorter, wronger path. Hips
 * translation is lerped so the root settles onto the seated height instead of
 * dropping onto it.
 *
 * Everything else in the file — mesh, materials, textures, skin, skeleton,
 * and every other clip — is copied through untouched.
 *
 *   node scripts/peeli-fix-sit-transitions.mjs <in.glb> <out.glb>
 */
import { readFileSync, writeFileSync } from "node:fs";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;

/** The seated pose every join is welded to. */
const SEATED = "Sit_Cross_Legged_on_Floor";
/** Resampling rate for the two rebuilt clips. */
const FPS = 30;
/** How long the eased blend lasts at the boundary, in seconds. */
const BLEND = 0.6;

const parseGlb = (path) => {
  const buf = readFileSync(path);
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString("utf8"));
    else if (type === BIN_CHUNK) bin = Buffer.from(data);
    off += 8 + len;
  }
  return { json, bin };
};

const qDot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
const qSlerp = (a, b, t) => {
  let d = qDot(a, b), e = b;
  // Shortest arc. Without this the blend can travel the long way round, which
  // is exactly the "leg twisting" being removed.
  if (d < 0) { e = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) {
    const r = [0,1,2,3].map((i) => a[i] + (e[i] - a[i]) * t);
    const n = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
    return r.map((v) => v / n);
  }
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [0,1,2,3].map((i) => a[i] * wa + e[i] * wb);
};
const vLerp = (a, b, t) => [0,1,2].map((i) => a[i] + (b[i] - a[i]) * t);
/** Zero derivative at both ends, so velocity matches at the join too. */
const smoothstep = (t) => t * t * (3 - 2 * t);
const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(qDot(a, b)))) * 180 / Math.PI;

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: peeli-fix-sit-transitions.mjs <in.glb> <out.glb>");
  process.exit(2);
}
const { json, bin } = parseGlb(inPath);

const readAcc = (i) => {
  const a = json.accessors[i], v = json.bufferViews[a.bufferView];
  if (a.componentType !== FLOAT) throw new Error(`accessor ${i}: not float`);
  const per = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < per; c++) row.push(bin.readFloatLE(base + k * per * 4 + c * 4));
    out.push(row);
  }
  return out;
};

const par = new Array(json.nodes.length).fill(-1);
json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (par[c] = i)));
const order = [];
{ const seen = new Set();
  const visit = (i) => { if (seen.has(i)) return; if (par[i] !== -1) visit(par[i]); seen.add(i); order.push(i); };
  json.nodes.forEach((_, i) => visit(i)); }
const nameOf = (i) => json.nodes[i].name ?? `#${i}`;
const hipsI = json.nodes.findIndex((n) => /^hips$/i.test(n.name ?? ""));

const tracksOf = (anim) => {
  const rot = new Map(), pos = new Map();
  let dur = 0;
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler];
    const t = readAcc(s.input).map((r) => r[0]);
    const v = readAcc(s.output);
    dur = Math.max(dur, t[t.length - 1]);
    if (ch.target.path === "rotation") rot.set(ch.target.node, { t, v });
    else if (ch.target.path === "translation") pos.set(ch.target.node, { t, v });
    // scale tracks are carried through untouched below
  }
  return { rot, pos, dur };
};
/** Interpolated sample, so a resample never quantises to the nearest key. */
const sampleRot = (tr, time) => {
  const { t, v } = tr;
  let i = 0; while (i < t.length - 1 && t[i + 1] < time) i++;
  const j = Math.min(i + 1, t.length - 1);
  const f = t[j] > t[i] ? Math.max(0, Math.min(1, (time - t[i]) / (t[j] - t[i]))) : 0;
  return qSlerp(v[i], v[j], f);
};
const samplePos = (tr, time) => {
  const { t, v } = tr;
  let i = 0; while (i < t.length - 1 && t[i + 1] < time) i++;
  const j = Math.min(i + 1, t.length - 1);
  const f = t[j] > t[i] ? Math.max(0, Math.min(1, (time - t[i]) / (t[j] - t[i]))) : 0;
  return vLerp(v[i], v[j], f);
};
const poseAt = (tk, time) => {
  const rot = [], pos = [];
  for (let i = 0; i < json.nodes.length; i++) {
    rot[i] = tk.rot.has(i) ? sampleRot(tk.rot.get(i), time) : (json.nodes[i].rotation ?? [0,0,0,1]);
    pos[i] = tk.pos.has(i) ? samplePos(tk.pos.get(i), time) : (json.nodes[i].translation ?? [0,0,0]);
  }
  return { rot, pos };
};

const byName = new Map(json.animations.map((a) => [a.name, a]));
const seatedTk = tracksOf(byName.get(SEATED));
const seatedPose = poseAt(seatedTk, 0);

// Identify the two transitions from the hips, not from their names — the
// merged export names them with UUIDs.
const candidates = json.animations.filter((a) => !/^(Sit_|Walk|Run|Punch|Step|Sweep|Standard|rest|run_)/i.test(a.name));
let toSit = null, toStand = null;
for (const a of candidates) {
  const tk = tracksOf(a);
  const y0 = poseAt(tk, 0).pos[hipsI][1], y1 = poseAt(tk, tk.dur).pos[hipsI][1];
  const seatY = seatedPose.pos[hipsI][1];
  if (y0 - y1 > 0.3 && Math.abs(y1 - seatY) < 0.15) toSit = { anim: a, tk };
  if (y1 - y0 > 0.3 && Math.abs(y0 - seatY) < 0.15) toStand = { anim: a, tk };
}
if (!toSit || !toStand) throw new Error("could not identify both transitions from hips height");

/** Rebuild one clip, resampled, with the boundary blended onto the seated pose. */
function weld(entry, side) {
  const { tk } = entry;
  const frames = Math.max(2, Math.round(tk.dur * FPS) + 1);
  const times = Array.from({ length: frames }, (_, i) => (tk.dur * i) / (frames - 1));
  const rot = new Map(), pos = new Map();
  for (const [nodeI] of tk.rot) rot.set(nodeI, []);
  for (const [nodeI] of tk.pos) pos.set(nodeI, []);
  for (const time of times) {
    const p = poseAt(tk, time);
    // Blend weight: 0 = the clip's own pose, 1 = the seated pose.
    const dFromEdge = side === "end" ? tk.dur - time : time;
    const w = dFromEdge >= BLEND ? 0 : smoothstep(1 - dFromEdge / BLEND);
    for (const [nodeI, arr] of rot) arr.push(w === 0 ? p.rot[nodeI] : qSlerp(p.rot[nodeI], seatedPose.rot[nodeI], w));
    for (const [nodeI, arr] of pos) arr.push(w === 0 ? p.pos[nodeI] : vLerp(p.pos[nodeI], seatedPose.pos[nodeI], w));
  }
  // The boundary frame is set outright rather than left to the ramp, so the
  // join is exact and not merely close.
  const edge = side === "end" ? frames - 1 : 0;
  for (const [nodeI, arr] of rot) arr[edge] = seatedPose.rot[nodeI].slice();
  for (const [nodeI, arr] of pos) arr[edge] = seatedPose.pos[nodeI].slice();
  return { times, rot, pos };
}

const welded = new Map([
  [toSit.anim.name, weld(toSit, "end")],
  [toStand.anim.name, weld(toStand, "start")],
]);

// ── write out ──
const chunks = [bin];
let length = bin.length;
const addAccessor = (floats, type, count, minmax) => {
  const pad = (4 - (length % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad, 0)); length += pad; }
  const arr = Float32Array.from(floats);
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: buf.length });
  chunks.push(buf); length += buf.length;
  json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: FLOAT, count, type, ...(minmax ?? {}) });
  return json.accessors.length - 1;
};

for (const anim of json.animations) {
  const w = welded.get(anim.name);
  if (w == null) continue;
  const timeIdx = addAccessor(w.times, "SCALAR", w.times.length, { min: [w.times[0]], max: [w.times[w.times.length - 1]] });
  const samplers = [], channels = [];
  // Scale channels are preserved exactly as they were.
  for (const ch of anim.channels) {
    if (ch.target.path !== "scale") continue;
    samplers.push(anim.samplers[ch.sampler]);
    channels.push({ sampler: samplers.length - 1, target: { ...ch.target } });
  }
  for (const [nodeI, arr] of w.rot) {
    const out = addAccessor(arr.flat(), "VEC4", arr.length);
    samplers.push({ input: timeIdx, output: out, interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: nodeI, path: "rotation" } });
  }
  for (const [nodeI, arr] of w.pos) {
    const out = addAccessor(arr.flat(), "VEC3", arr.length);
    samplers.push({ input: timeIdx, output: out, interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: nodeI, path: "translation" } });
  }
  anim.samplers = samplers;
  anim.channels = channels;
}
json.buffers[0].byteLength = length;

const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jsonBuf.length % 4)) % 4;
const binAll = Buffer.concat(chunks, length);
const bp = (4 - (binAll.length % 4)) % 4;
const jc = Buffer.concat([jsonBuf, Buffer.alloc(jp, 0x20)]);
const bc = Buffer.concat([binAll, Buffer.alloc(bp, 0)]);
const total = 12 + 8 + jc.length + 8 + bc.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
out.writeUInt32LE(jc.length, 12); out.writeUInt32LE(JSON_CHUNK, 16); jc.copy(out, 20);
out.writeUInt32LE(bc.length, 20 + jc.length); out.writeUInt32LE(BIN_CHUNK, 24 + jc.length); bc.copy(out, 28 + jc.length);
writeFileSync(outPath, out);

console.log(`identified  stand→sit : ${toSit.anim.name}  (${toSit.tk.dur.toFixed(2)}s)`);
console.log(`identified  sit→stand : ${toStand.anim.name}  (${toStand.tk.dur.toFixed(2)}s)`);
console.log(`seated pose : ${SEATED} @ t=0, untouched`);
console.log(`blend       : ${BLEND}s smoothstep, resampled at ${FPS}fps, shortest-arc slerp`);
console.log(`wrote ${outPath} (${(total / 1048576).toFixed(2)} MB)`);
