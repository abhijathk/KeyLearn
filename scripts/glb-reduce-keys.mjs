/**
 * Drop animation keyframes that a linear interpolation already reproduces.
 *
 *   node scripts/glb-reduce-keys.mjs in.glb out.glb [--tol-deg 0.25] [--tol-pos 0.0002]
 *
 * The authored clips carry a key on EVERY joint on EVERY frame, because that is
 * what the solver produces: it poses the whole skeleton each frame and writes
 * the result. Most of those keys say nothing. A puppy's tongue does not move
 * during a Walk, its legs do not move at all while it sleeps, and a joint
 * turning steadily needs two keys, not thirty.
 *
 * Each channel is thinned independently by the standard split test: keep the
 * first and last key, then repeatedly find the key that the current kept set
 * mis-predicts by the most, and keep that one too, until nothing is mispredicted
 * by more than the tolerance. Because the error is measured against the SAME
 * linear interpolation the runtime will perform, the tolerance is a hard bound
 * on the playback error, not an estimate of it.
 *
 * Defaults are deliberately tight - a quarter of a degree, and 0.2 mm on the
 * root - so this is a size win rather than a quality trade. Anything a viewer
 * could see is kept.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : parseFloat(args[i + 1]); };
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [inPath, outPath] = positional;
if (!inPath || !outPath) { console.error("usage: glb-reduce-keys.mjs in.glb out.glb [--tol-deg d] [--tol-pos p]"); process.exit(2); }
const TOL_DEG = flag("--tol-deg", 0.25);
const TOL_POS = flag("--tol-pos", 0.0002);

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}
const readAcc = (i) => {
  const a = json.accessors[i], v = json.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const stride = v.byteStride || n * 4;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(bin.readFloatLE(base + k * stride + c * 4));
    out.push(n === 1 ? row[0] : row);
  }
  return out;
};
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return [q[0]/l, q[1]/l, q[2]/l, q[3]/l]; };
const slerp = (a, c, t) => {
  let d = a[0]*c[0] + a[1]*c[1] + a[2]*c[2] + a[3]*c[3];
  let cc = c; if (d < 0) { d = -d; cc = c.map((x) => -x); }
  if (d > 0.9995) return qnorm(a.map((x, i) => x + t * (cc[i] - x)));
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((x, i) => Math.sin((1 - t) * th) / s * x + Math.sin(t * th) / s * cc[i]);
};
const qangDeg = (a, b) =>
  2 * Math.acos(Math.min(1, Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]))) * 180 / Math.PI;

// Keep the first and last key; then repeatedly add whichever key the kept set
// predicts worst, until every key is within tolerance. Measuring against the
// same linear/slerp the runtime uses makes the tolerance a hard error bound.
function thin(times, values, isRot) {
  const N = times.length;
  if (N <= 2) return null;
  const keep = new Uint8Array(N); keep[0] = 1; keep[N - 1] = 1;
  const idx = [0, N - 1];
  for (;;) {
    let worst = -1, worstErr = 0;
    for (let s = 0; s < idx.length - 1; s++) {
      const a = idx[s], b = idx[s + 1];
      if (b - a < 2) continue;
      for (let k = a + 1; k < b; k++) {
        const u = (times[k] - times[a]) / (times[b] - times[a] || 1);
        let err;
        if (isRot) {
          err = qangDeg(values[k], slerp(values[a], values[b], u)) / TOL_DEG;
        } else {
          let m = 0;
          for (let c = 0; c < values[k].length; c++) {
            m = Math.max(m, Math.abs(values[k][c] - (values[a][c] + u * (values[b][c] - values[a][c]))));
          }
          err = m / TOL_POS;
        }
        if (err > worstErr) { worstErr = err; worst = k; }
      }
    }
    if (worst < 0 || worstErr <= 1) break;
    keep[worst] = 1;
    idx.push(worst); idx.sort((x, y) => x - y);
  }
  if (idx.length >= N) return null;
  return idx;
}

const extra = []; let cursor = bin.length;
function appendView(buf) {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { extra.push(Buffer.alloc(pad)); cursor += pad; }
  json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length });
  extra.push(buf); cursor += buf.length;
  return json.bufferViews.length - 1;
}
function addAcc(arr, type) {
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
  const flat = type === "SCALAR" ? arr : arr.flat();
  const buf = Buffer.alloc(flat.length * 4);
  flat.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  const bv = appendView(buf);
  const a = { bufferView: bv, componentType: 5126, count: arr.length, type };
  if (type === "SCALAR") { a.min = [Math.min(...arr)]; a.max = [Math.max(...arr)]; }
  json.accessors.push(a);
  return json.accessors.length - 1;
  void comps;
}

let keptTotal = 0, origTotal = 0;
for (const anim of json.animations ?? []) {
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler];
    if (s.interpolation && s.interpolation !== "LINEAR") continue;
    const times = readAcc(s.input);
    const values = readAcc(s.output);
    origTotal += times.length;
    const isRot = ch.target.path === "rotation";
    const idx = thin(times, values, isRot);
    if (!idx) { keptTotal += times.length; continue; }
    keptTotal += idx.length;
    s.input = addAcc(idx.map((i) => times[i]), "SCALAR");
    s.output = addAcc(idx.map((i) => values[i]), isRot ? "VEC4" : "VEC3");
  }
}

// Rebuild the buffer from what is still referenced - the old dense accessors
// are now orphaned, and leaving them in makes the file bigger, not smaller.
// Liveness has to be traced from the things that REFERENCE accessors, not from
// the accessor array itself. Replacing a sampler's accessor leaves the old one
// sitting in that array pointing at its old dense data; scanning the array
// marks it live, nothing is pruned, and dropping 59% of the keyframes makes the
// file BIGGER because the new sparse copies are simply appended to the old ones.
const liveAcc = new Set();
for (const anim of json.animations ?? []) for (const s2 of anim.samplers) { liveAcc.add(s2.input); liveAcc.add(s2.output); }
for (const mesh of json.meshes ?? []) for (const prim of mesh.primitives ?? []) {
  for (const k of Object.keys(prim.attributes)) liveAcc.add(prim.attributes[k]);
  if (prim.indices != null) liveAcc.add(prim.indices);
  for (const tgt of prim.targets ?? []) for (const k of Object.keys(tgt)) liveAcc.add(tgt[k]);
}
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) liveAcc.add(sk.inverseBindMatrices);
// Prune the dead ACCESSORS too, not just their bufferViews.
//
// Thinning a channel leaves its old dense accessor in the array. Pruning only
// the views then rewrites that accessor's bufferView to `undefined` - the remap
// has no entry for a view that is gone - and the file loads as far as three.js
// GLTFMeshoptCompression.loadBufferView, which reads `.extensions` off the
// missing view and throws "Cannot read properties of undefined". The file is
// the right size, passes every geometry and animation check offline, and simply
// does not open. Only loading it in the engine finds this.
const accRemap = new Map();
const keptAcc = [];
for (let i = 0; i < json.accessors.length; i++) {
  if (!liveAcc.has(i)) continue;
  accRemap.set(i, keptAcc.length);
  keptAcc.push(json.accessors[i]);
}
const droppedAcc = json.accessors.length - keptAcc.length;
json.accessors = keptAcc;
for (const anim of json.animations ?? []) for (const s2 of anim.samplers) {
  s2.input = accRemap.get(s2.input); s2.output = accRemap.get(s2.output);
}
for (const mesh of json.meshes ?? []) for (const prim of mesh.primitives ?? []) {
  for (const k of Object.keys(prim.attributes)) prim.attributes[k] = accRemap.get(prim.attributes[k]);
  if (prim.indices != null) prim.indices = accRemap.get(prim.indices);
  for (const tgt of prim.targets ?? []) for (const k of Object.keys(tgt)) tgt[k] = accRemap.get(tgt[k]);
}
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) sk.inverseBindMatrices = accRemap.get(sk.inverseBindMatrices);

const live = new Set();
for (const a of json.accessors) if (a.bufferView != null) live.add(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) live.add(im.bufferView);
const combined = Buffer.concat([bin, ...extra]);
const remap = new Map(), parts = [], newViews = [];
let outLen = 0;
for (let i = 0; i < json.bufferViews.length; i++) {
  if (!live.has(i)) continue;
  const v = json.bufferViews[i];
  const pad = (4 - (outLen % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); outLen += pad; }
  const nv = { buffer: 0, byteOffset: outLen, byteLength: v.byteLength };
  if (v.byteStride != null) nv.byteStride = v.byteStride;
  if (v.target != null) nv.target = v.target;
  remap.set(i, newViews.length);
  newViews.push(nv);
  parts.push(combined.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  outLen += v.byteLength;
}
const dropped = json.bufferViews.length - newViews.length;
json.bufferViews = newViews;
for (const a of json.accessors) if (a.bufferView != null) a.bufferView = remap.get(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) im.bufferView = remap.get(im.bufferView);

const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jb.length % 4)) % 4, jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (newBin.length % 4)) % 4, bc = Buffer.concat([newBin, Buffer.alloc(bp)]);
const chunk = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const total = 12 + 8 + jc.length + 8 + bc.length;
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([hdr, chunk(jc.length, 0x4e4f534a), jc, chunk(bc.length, 0x004e4942), bc]));
console.log(`  keys ${origTotal} -> ${keptTotal} (${(100 - 100*keptTotal/origTotal).toFixed(0)}% dropped) at <=${TOL_DEG} deg / ${TOL_POS} units`);
console.log(`  pruned ${droppedAcc} orphaned accessor(s), ${dropped} orphaned bufferView(s)`);
console.log(`wrote ${outPath}  ${total.toLocaleString()} bytes`);
