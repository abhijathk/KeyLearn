#!/usr/bin/env node
/**
 * Welds a bake by POSITION, so a simplifier can actually get hold of it.
 *
 *   node scripts/glb-weld.mjs in.glb out.glb [--eps 1e-5]
 *
 * WHY THIS EXISTS. The attribute-aware simplifier floors on these props —
 * the moss house will not go below 33,648 of its 105,368 triangles however
 * low the target, however loose the error and with borders unlocked. It is
 * not the UV metric: the floor does not move when the texture weight is
 * dropped from 0.5 to 0.05. It is TOPOLOGY. A bake is split at every UV seam
 * and arrives as hundreds of separate shells, and meshopt will not destroy a
 * component to meet a budget, so the budget is spent long before the target.
 *
 * Welding co-located vertices turns those seams into interior edges and
 * joins shells that touch, which is what lets the collapser move.
 *
 * WHAT IT COSTS, stated plainly: a welded vertex can hold only ONE texture
 * coordinate, and a seam vertex genuinely had two. The first is kept and the
 * second is lost, so the atlas is stretched across every seam it is welded
 * over. Whether that is visible is a question about a particular bake at a
 * particular size, and the only way to answer it is to render the result and
 * look — which is what `glb-views.mjs` is for. This tool does not decide
 * that; it only makes the trade available.
 *
 * ── MEASURED ON THE MOSS HOUSE, AND REJECTED ─────────────────────────────
 *
 * Welding did everything it promised to the geometry. 107,974 vertices to
 * 58,613, and the simplifier that would not go below 33,648 triangles hit a
 * 10,000 target exactly, at 0.91% error — LOWER than the 3.02% it reported
 * at three times the triangles unwelded. 694 KB became 220.
 *
 * And it is not usable. The atlas stretches across every welded seam, and on
 * a bake whose texture is its whole value that shows as a speckled, dirty
 * roof and laterite blocks that have lost their edges. Raising the budget
 * does not buy it back — at 29,970 triangles and 0.26% error the geometry is
 * near-perfect and the surface is still wrong, because the damage was done
 * by the weld and not by the collapse. The error figure says nothing about
 * it, which is the trap: a number that only measures where the surface is
 * cannot see a texture sliding across it.
 *
 * Kept because the finding is worth keeping, and because a bake with clean
 * UV islands — a proper remesh rather than a photogrammetry-style split —
 * would weld without the cost and this is what would do it.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const num = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : Number(args[i + 1]); };
const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!inPath || !outPath) { console.error("usage: glb-weld.mjs in.glb out.glb [--eps 1e-5]"); process.exit(2); }
const EPS = num("--eps", 1e-5);

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const l = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const b = src.subarray(off + 8, off + 8 + l);
  if (t === 0x4e4f534a) json = JSON.parse(b.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(b);
  off += 8 + l;
}
const CS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
function attr(i, comps) {
  const a = json.accessors[i], v = json.bufferViews[a.bufferView];
  const sz = CS[a.componentType], stride = v.byteStride || comps * sz;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(a.count * comps);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < comps; c++)
    out[k * comps + c] = bin.readFloatLE(base + k * stride + c * sz);
  return out;
}
const prim = json.meshes[0].primitives[0];
const P = attr(prim.attributes.POSITION, 3);
const N = prim.attributes.NORMAL != null ? attr(prim.attributes.NORMAL, 3) : null;
const U = attr(prim.attributes.TEXCOORD_0, 2);
const ia = json.accessors[prim.indices], iv = json.bufferViews[ia.bufferView];
const ibase = (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
const IDX = new Uint32Array(ia.count);
for (let i = 0; i < ia.count; i++)
  IDX[i] = ia.componentType === 5125 ? bin.readUInt32LE(ibase + i * 4)
         : ia.componentType === 5123 ? bin.readUInt16LE(ibase + i * 2) : bin.readUInt8(ibase + i);

const count = P.length / 3;
const grid = new Map();
const remap = new Uint32Array(count);
const pos = [], nrm = [], uv = [];
const q = (v) => Math.round(v / EPS);
for (let i = 0; i < count; i++) {
  const key = `${q(P[i * 3])},${q(P[i * 3 + 1])},${q(P[i * 3 + 2])}`;
  const hit = grid.get(key);
  if (hit != null) {
    remap[i] = hit;
    // Normals are AVERAGED over everything welded here, which is the right
    // answer for a seam (both sides described the same surface) and a
    // smoothing of what used to be a hard edge everywhere else.
    if (N) { nrm[hit * 3] += N[i * 3]; nrm[hit * 3 + 1] += N[i * 3 + 1]; nrm[hit * 3 + 2] += N[i * 3 + 2]; }
    continue;
  }
  const n = pos.length / 3;
  grid.set(key, n);
  remap[i] = n;
  pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  if (N) nrm.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
  uv.push(U[i * 2], U[i * 2 + 1]);
}
const verts = pos.length / 3;
if (N) for (let i = 0; i < verts; i++) {
  const len = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
  nrm[i * 3] /= len; nrm[i * 3 + 1] /= len; nrm[i * 3 + 2] /= len;
}
const out = new Uint32Array(IDX.length);
for (let i = 0; i < IDX.length; i++) out[i] = remap[IDX[i]];
// Triangles whose corners collapsed onto each other are gone, not degenerate.
const tri = [];
for (let t = 0; t < out.length; t += 3) {
  const [a, b, c] = [out[t], out[t + 1], out[t + 2]];
  if (a !== b && b !== c && a !== c) tri.push(a, b, c);
}

const parts = [];
let cursor = 0;
const views = [], accessors = [];
const push = (buf, extra = {}) => {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); cursor += pad; }
  views.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length, ...extra });
  parts.push(buf); cursor += buf.length;
  return views.length - 1;
};
const f32 = (a) => { const b = Buffer.alloc(a.length * 4); a.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; };
const add = (buf, ct, n, type, mm, target) => {
  accessors.push({ bufferView: push(buf, target ? { target } : {}), componentType: ct, count: n, type, ...(mm ?? {}) });
  return accessors.length - 1;
};
const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (let i = 0; i < verts; i++) for (let c = 0; c < 3; c++) {
  const v = pos[i * 3 + c]; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v;
}
const aPos = add(f32(pos), 5126, verts, "VEC3", { min: lo, max: hi }, 34962);
const aNrm = N ? add(f32(nrm), 5126, verts, "VEC3", null, 34962) : null;
const aUv = add(f32(uv), 5126, verts, "VEC2", null, 34962);
const ib = Buffer.alloc(tri.length * 4);
tri.forEach((v, i) => ib.writeUInt32LE(v, i * 4));
const aIdx = add(ib, 5125, tri.length, "SCALAR", null, 34963);
const imgView = push(bin.subarray(
  json.bufferViews[json.images[0].bufferView].byteOffset ?? 0,
  (json.bufferViews[json.images[0].bufferView].byteOffset ?? 0) + json.bufferViews[json.images[0].bufferView].byteLength));

const doc = {
  asset: { version: "2.0", generator: "glb-weld.mjs" },
  scene: 0, scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: json.nodes[0]?.name ?? "prop" }],
  meshes: [{ primitives: [{
    attributes: { POSITION: aPos, ...(aNrm != null ? { NORMAL: aNrm } : {}), TEXCOORD_0: aUv },
    indices: aIdx, material: 0,
  }] }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.6 }, doubleSided: true }],
  textures: [{ sampler: 0, source: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: [{ bufferView: imgView, mimeType: "image/png" }],
  bufferViews: views, accessors, buffers: [{ byteLength: cursor }],
};
const binBuf = Buffer.concat(parts);
const jb = Buffer.from(JSON.stringify(doc), "utf8");
const jpad = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const bpad = Buffer.concat([binBuf, Buffer.alloc((4 - (binBuf.length % 4)) % 4)]);
const mk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4);
hdr.writeUInt32LE(12 + 8 + jpad.length + 8 + bpad.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, mk(jpad.length, 0x4e4f534a), jpad, mk(bpad.length, 0x004e4942), bpad]));
console.log(`  welded ${count.toLocaleString()} -> ${verts.toLocaleString()} vertices (${((1 - verts / count) * 100).toFixed(0)}% fewer), ${(IDX.length / 3).toLocaleString()} -> ${(tri.length / 3).toLocaleString()} triangles`);
