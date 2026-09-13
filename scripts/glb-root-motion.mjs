/**
 * What each animation clip does to the ROOT - the question you must answer
 * before driving a character from code.
 *
 *   node scripts/glb-root-motion.mjs file.glb
 *
 * A clip either moves the character itself ("root motion") or runs on the
 * spot while the game moves it. Drive a root-motion clip from code as well
 * and the two add: the animal travels at double speed, or - the case that
 * caught me - turns through 180 degrees when both it and the engine apply
 * the same 90.
 *
 * This prints, for every clip, the net and peak translation and rotation of
 * the root and its first child, which is where a rig puts that motion if it
 * has any. The buffalo's answer: every clip is in place EXCEPT Turn_Left_90
 * and Turn_Right_90, which rotate the hips a clean 90 degrees and hold it,
 * and Graze, which drifts 16 degrees and does not come back - enough to make
 * looping it snap the whole animal round every six seconds.
 *
 * Handles EXT_meshopt_compression, which the AK pack files all use and which
 * makes their buffers unreadable by a plain accessor walk - the reason the
 * first attempt at this measurement read garbage floats and then ran off the
 * end of the buffer.
 */
import { readFileSync } from "node:fs";
import { MeshoptDecoder } from "../node_modules/meshoptimizer/meshopt_decoder.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: glb-root-motion.mjs file.glb");
  process.exit(2);
}
const b = readFileSync(file);
let o = 12, j = null, bin = null;
while (o < b.length) {
  const L = b.readUInt32LE(o), T = b.readUInt32LE(o + 4), s = b.subarray(o + 8, o + 8 + L);
  if (T === 0x4e4f534a) j = JSON.parse(s);
  if (T === 0x004e4942) bin = Buffer.from(s);
  o += 8 + L;
}
await MeshoptDecoder.ready;
const views = j.bufferViews.map((v) => {
  const mo = v.extensions?.EXT_meshopt_compression;
  if (!mo) return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  const out = new Uint8Array(mo.count * mo.byteStride);
  const src = new Uint8Array(bin.buffer, bin.byteOffset + (mo.byteOffset ?? 0), mo.byteLength);
  MeshoptDecoder.decodeGltfBuffer(out, mo.count, mo.byteStride, src, mo.mode, mo.filter ?? "NONE");
  return Buffer.from(out);
});
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const rd = (ai) => {
  const a = j.accessors[ai], v = views[a.bufferView];
  const n = NC[a.type], sz = COMP[a.componentType];
  const stride = j.bufferViews[a.bufferView].byteStride || n * sz;
  const base = a.byteOffset ?? 0;
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const r = [];
    for (let c = 0; c < n; c++) {
      const p = base + k * stride + c * sz;
      r.push(a.componentType === 5126 ? v.readFloatLE(p)
           : a.componentType === 5122 ? v.readInt16LE(p) / (a.normalized ? 32767 : 1)
           : a.componentType === 5123 ? v.readUInt16LE(p) / (a.normalized ? 65535 : 1)
           : v.readUInt8(p));
    }
    out.push(n === 1 ? r[0] : r);
  }
  return out;
};
const par = new Map();
j.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => par.set(c, i)));
const depth = (i) => { let d = 0, k = i; while (par.has(k)) { k = par.get(k); d++; } return d; };
console.log(`\n${file.split("/").pop()}   ${j.animations?.length ?? 0} clips\n`);
for (const a of j.animations ?? []) {
  const rep = [];
  for (const ch of a.channels) {
    const ni = ch.target.node;
    if (depth(ni) > 1) continue; // root, or the first bone under it
    const nm = j.nodes[ni].name ?? `#${ni}`;
    const v = rd(a.samplers[ch.sampler].output);
    if (ch.target.path === "translation") {
      const f = v[0], l = v[v.length - 1];
      let mx = 0, mz = 0;
      for (const p of v) { mx = Math.max(mx, Math.abs(p[0] - f[0])); mz = Math.max(mz, Math.abs(p[2] - f[2])); }
      rep.push(`${nm}.t net(${(l[0]-f[0]).toFixed(3)}, ${(l[1]-f[1]).toFixed(3)}, ${(l[2]-f[2]).toFixed(3)}) peak x${mx.toFixed(3)} z${mz.toFixed(3)}`);
    } else if (ch.target.path === "rotation") {
      const q0 = v[0], q1 = v[v.length - 1];
      const ang = (q) => 2 * Math.acos(Math.min(1, Math.abs(q0[0]*q[0]+q0[1]*q[1]+q0[2]*q[2]+q0[3]*q[3]))) * 180 / Math.PI;
      let peak = 0;
      for (const q of v) peak = Math.max(peak, ang(q));
      rep.push(`${nm}.r net ${ang(q1).toFixed(1)}deg peak ${peak.toFixed(1)}deg`);
    }
  }
  console.log("  " + a.name.padEnd(26) + (rep.join("   |   ") || "(in place)"));
}
console.log();
