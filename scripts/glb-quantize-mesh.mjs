/**
 * Quantize a SKINNED mesh's positions (and optionally normals) with
 * KHR_mesh_quantization — the half of the attribute data that
 * glb-quantize-attrs leaves alone because it needs the extension.
 *
 *   node scripts/glb-quantize-mesh.mjs in.glb out.glb [--bits 14] [--normals keep|drop]
 *
 * WHY IT IS WORTH THE EXTENSION NOW. On the cattle, POSITION and NORMAL are
 * float32, interleaved, and after meshopt they are 329 KB of a 899 KB file —
 * bigger than the texture. Every loader this app uses is three's
 * GLTFLoader, which has read KHR_mesh_quantization for years.
 *
 * POSITIONS become int16 on a uniform grid. A skinned mesh ignores its node
 * transform, so the dequantization (offset + one scale) cannot live on the
 * node the way it does for a static mesh; it is folded into every inverse
 * bind matrix instead: IBM' = IBM * (translate(offset) * scale(s)). The
 * skinned result is the same vertex, to within half a grid step. At 14 bits
 * over this animal that step is 1/16383 of its longest side — about a
 * tenth of a millimetre on a real cow.
 *
 * NORMALS are the game's to throw away. `loadModel` welds every mesh and
 * RECOMPUTES its normals on load (world.ts, mergeVertices +
 * computeVertexNormals), so the shipped ones never reach the screen in the
 * village. `--normals drop` removes them; `keep` (the default) leaves them
 * as they are. They are never quantized: see the note where they are dropped.
 * Dropping is only safe where every consumer recomputes — see the review
 * page, which was changed to weld exactly as the game does.
 *
 * Expects a plain GLB (no EXT_meshopt_compression): run it before
 * glb-compress, after glb-quantize-attrs.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BITS = +opt("--bits", 14);
const NORMALS = opt("--normals", "keep");
if (!inPath || !outPath || !(BITS >= 8 && BITS <= 15) || !/^(keep|drop)$/.test(NORMALS)) {
  console.error("usage: glb-quantize-mesh.mjs in.glb out.glb [--bits 8-15] [--normals keep|drop]");
  process.exit(2);
}

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}
if ((json.extensionsUsed ?? []).includes("EXT_meshopt_compression")) {
  console.error("glb-quantize-mesh: input is meshopt-compressed; run it before glb-compress");
  process.exit(1);
}

const views = json.bufferViews, accs = json.accessors;
const readVec = (ai, n) => {
  const a = accs[ai], v = views[a.bufferView];
  if (a.componentType !== 5126) throw new Error(`accessor ${ai} is not float32`);
  const st = v.byteStride || n * 4, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * n);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = bin.readFloatLE(base + k * st + c * 4);
  return out;
};
const extra = [];
let cursor = bin.length;
const addView = (buf, stride) => {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { extra.push(Buffer.alloc(pad)); cursor += pad; }
  views.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length, byteStride: stride, target: 34962 });
  extra.push(buf); cursor += buf.length;
  return views.length - 1;
};

// Column-major 4x4, as glTF stores it.
const mul = (A, B) => { const C = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0;
    for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k]; C[c * 4 + r] = s; }
  return C; };

const skinned = new Map();   // mesh index -> skin index
json.nodes.forEach((n) => { if (n.mesh != null && n.skin != null) skinned.set(n.mesh, n.skin); });
const done = new Set();
let posBefore = 0, posAfter = 0, nrmBefore = 0, nrmAfter = 0, worst = 0;

json.meshes.forEach((mesh, mi) => {
  const si = skinned.get(mi);
  if (si == null) { console.log(`  mesh ${mi}: not skinned — left alone`); return; }
  // One grid per skin, so every primitive of the mesh shares one IBM fix.
  const prims = mesh.primitives;
  const pAcc = [...new Set(prims.map((p) => p.attributes.POSITION))];
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const ai of pAcc) {
    const p = readVec(ai, 3);
    for (let i = 0; i < p.length; i += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[i + c]); hi[c] = Math.max(hi[c], p[i + c]); }
  }
  const Q = (1 << BITS) - 1;
  const s = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / Q;   // uniform: keeps angles and normals honest
  for (const ai of pAcc) {
    if (done.has(ai)) continue; done.add(ai);
    const p = readVec(ai, 3), n = p.length / 3;
    const buf = Buffer.alloc(n * 8);            // int16 x3, padded to a 4-byte stride
    const qlo = [Infinity, Infinity, Infinity], qhi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
      const q = Math.round((p[i * 3 + c] - lo[c]) / s);
      worst = Math.max(worst, Math.abs(lo[c] + q * s - p[i * 3 + c]));
      buf.writeInt16LE(q, i * 8 + c * 2);
      qlo[c] = Math.min(qlo[c], q); qhi[c] = Math.max(qhi[c], q);
    }
    posBefore += n * 12; posAfter += buf.length;
    const a = accs[ai];
    a.bufferView = addView(buf, 8); a.byteOffset = 0; a.componentType = 5122; a.normalized = false;
    a.min = qlo; a.max = qhi;
  }
  // Fold the dequantization into the skin: world = sum w * J * IBM * (lo + s*q).
  const skin = json.skins[si];
  const ia = accs[skin.inverseBindMatrices], iv = views[ia.bufferView];
  const ib = (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
  const D = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, lo[0], lo[1], lo[2], 1];
  for (let k = 0; k < ia.count; k++) {
    const m = []; for (let c = 0; c < 16; c++) m.push(bin.readFloatLE(ib + k * 64 + c * 4));
    const r = mul(m, D);
    for (let c = 0; c < 16; c++) bin.writeFloatLE(r[c], ib + k * 64 + c * 4);
  }
  // THE WELD GUARD. The game welds with three's mergeVertices(geo, 1e-4),
  // which hashes EVERY attribute. With the normals in the file, a hard edge —
  // two vertices alike in position, UV and skin but not in normal — stays two
  // vertices, and the recomputed normals keep the crease. Take the normals
  // away and the weld merges them and smooths the crease over: measured on
  // the cow, 160 vertices, 368 triangle corners turning by more than 5
  // degrees and one by 48. So each such vertex keeps a difference the hash
  // can see: its UV is moved by 8 steps of the 16-bit grid, 1e-4 of the
  // texture — a tenth of a texel at 1024. The weld then keeps exactly the
  // splits it kept before.
  if (NORMALS === "drop") for (const pr of prims) {
    const ni = pr.attributes.NORMAL, ui = pr.attributes.TEXCOORD_0;
    if (ni == null || ui == null) continue;
    const ua = accs[ui];
    if (ua.componentType !== 5123 || !ua.normalized) throw new Error("weld guard expects uint16 normalized UVs (run glb-quantize-attrs first)");
    const raw = (ai) => { const a = accs[ai], v = views[a.bufferView];
      const C = { 5121: [1, "readUInt8"], 5123: [2, "readUInt16LE"], 5126: [4, "readFloatLE"] }[a.componentType];
      const n = { VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], st = v.byteStride || n * C[0], base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
      const div = a.normalized ? (a.componentType === 5121 ? 255 : 65535) : 1;
      return { n, count: a.count, at: (k, c) => bin[C[1]](base + k * st + c * C[0]) / div, off: (k, c) => base + k * st + c * C[0] }; };
    const key = (vals) => vals.map((x) => ~~(x * 1e4 + 0.5)).join(",");   // mergeVertices' hash, tolerance 1e-4
    const P = accs[pr.attributes.POSITION], pv = views[P.bufferView];      // already int16 here
    const others = ["TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"].filter((k) => pr.attributes[k] != null).map((k) => raw(pr.attributes[k]));
    const nrm = raw(ni), U = raw(ui);
    const qpos = new Int16Array(P.count * 3);
    { const b2 = Buffer.concat([bin, ...extra]); const base = pv.byteOffset;
      for (let k = 0; k < P.count; k++) for (let c = 0; c < 3; c++) qpos[k * 3 + c] = b2.readInt16LE(base + k * 8 + c * 2); }
    const vals = (k, withN) => {
      const v = [qpos[k * 3], qpos[k * 3 + 1], qpos[k * 3 + 2]];   // ints: the hash sees every grid step
      for (const o of others) for (let c = 0; c < o.n; c++) v.push(o.at(k, c));
      if (withN) for (let c = 0; c < 3; c++) v.push(nrm.at(k, c));
      return v; };
    const groups = new Map();                  // hash without normals -> Map(hash with normals -> [vertices])
    for (let k = 0; k < P.count; k++) {
      const h = key(vals(k, false)), hn = key(vals(k, true));
      if (!groups.has(h)) groups.set(h, new Map());
      const g = groups.get(h); if (!g.has(hn)) g.set(hn, []); g.get(hn).push(k);
    }
    let nudged = 0;
    for (const g of groups.values()) {
      if (g.size < 2) continue;
      let cls = 0;
      for (const verts of g.values()) {
        if (cls > 0) for (const k of verts) {
          const o = U.off(k, 0), u = bin.readUInt16LE(o);
          bin.writeUInt16LE(u + 8 * cls <= 65535 ? u + 8 * cls : u - 8 * cls, o); nudged++;
        }
        cls++;
      }
    }
    console.log(`  weld guard: ${nudged} vertices kept apart by a 1e-4 UV nudge`);
  }
  // Normals: dropped, or left exactly as they are. NOT int8: the game's
  // computeVertexNormals() reuses an existing normal attribute and sums face
  // normals INTO it, and an int8 normalized attribute saturates at 1 — the
  // lighting comes out wrong on every vertex (measured: median 90 degrees
  // off). A float attribute, or none (three then makes a float one), is fine.
  for (const pr of prims) {
    const ni = pr.attributes.NORMAL;
    if (ni == null || NORMALS !== "drop") continue;
    nrmBefore += accs[ni].count * 12;
    delete pr.attributes.NORMAL;
  }
  console.log(`  mesh ${mi} (skin ${si}): ${BITS}-bit grid, step ${s.toExponential(3)}, worst position error ${worst.toExponential(2)} (${(worst / (s * Q) * 100).toFixed(4)}% of size)`);
});

for (const k of ["extensionsUsed", "extensionsRequired"]) {
  json[k] = [...new Set([...(json[k] ?? []), "KHR_mesh_quantization"])];
}

// Drop the accessors nothing references any more (a dropped NORMAL), so
// their data does not ride along unreferenced — then the views likewise
// (the old interleaved floats), and lay the binary chunk out again.
{
  const live = new Set();
  for (const m of json.meshes) for (const p of m.primitives) {
    for (const ai of Object.values(p.attributes)) live.add(ai);
    if (p.indices != null) live.add(p.indices);
    for (const t of p.targets ?? []) for (const ai of Object.values(t)) live.add(ai);
  }
  for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) live.add(sk.inverseBindMatrices);
  for (const an of json.animations ?? []) for (const sm of an.samplers) { live.add(sm.input); live.add(sm.output); }
  const amap = new Map(); accs.forEach((_, i) => { if (live.has(i)) amap.set(i, amap.size); });
  const ren = (i) => amap.get(i);
  for (const m of json.meshes) for (const p of m.primitives) {
    for (const k in p.attributes) p.attributes[k] = ren(p.attributes[k]);
    if (p.indices != null) p.indices = ren(p.indices);
    for (const t of p.targets ?? []) for (const k in t) t[k] = ren(t[k]);
  }
  for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) sk.inverseBindMatrices = ren(sk.inverseBindMatrices);
  for (const an of json.animations ?? []) for (const sm of an.samplers) { sm.input = ren(sm.input); sm.output = ren(sm.output); }
  json.accessors = accs.filter((_, i) => live.has(i));
}
const used = new Set();
for (const a of json.accessors) if (a.bufferView != null) used.add(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) used.add(im.bufferView);
const all = Buffer.concat([bin, ...extra]);
const remap = new Map(); const parts = []; let at = 0;
views.forEach((v, i) => {
  if (!used.has(i)) return;
  const pad = (4 - (at % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); at += pad; }
  const bytes = all.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  remap.set(i, remap.size);
  parts.push(bytes); v.byteOffset = at; at += bytes.length;
});
json.bufferViews = views.filter((_, i) => used.has(i));
for (const a of json.accessors) if (a.bufferView != null) a.bufferView = remap.get(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) im.bufferView = remap.get(im.bufferView);
const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];

const jb = Buffer.from(JSON.stringify(json), "utf8");
const jc = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const bc = Buffer.concat([newBin, Buffer.alloc((4 - (newBin.length % 4)) % 4)]);
const head = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const body = Buffer.concat([head(jc.length, 0x4e4f534a), jc, head(bc.length, 0x004e4942), bc]);
const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + body.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, body]));
console.log(`  positions ${(posBefore / 1024).toFixed(0)} -> ${(posAfter / 1024).toFixed(0)} KB raw; normals ${NORMALS === "drop" ? `${(nrmBefore / 1024).toFixed(0)} KB dropped` : "kept as float"}`);
