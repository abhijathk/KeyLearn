/**
 * Reorder every indexed mesh's triangles and vertices for locality — a pure
 * permutation, so the mesh is the same mesh, byte for byte per vertex.
 *
 *   node scripts/glb-reorder-mesh.mjs in.glb out.glb
 *
 * The meshopt codecs compress what is NEAR what came before it. A Meshy
 * export lists its triangles in atlas order, so consecutive triangles are
 * scattered over the body, the index codec finds nothing to predict (it made
 * the buffalo's indices BIGGER — see glb-compress), and the vertex codec sees
 * neighbouring vertices that are not neighbours. `reorderMesh` puts both in
 * cache order first. Nothing is added, removed or rounded.
 *
 * Plain GLB only (run before glb-compress). Vertex attributes shared between
 * primitives are refused rather than permuted twice.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptEncoder } from "meshoptimizer";
await MeshoptEncoder.ready;

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) { console.error("usage: glb-reorder-mesh.mjs in.glb out.glb"); process.exit(2); }
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
  console.error("glb-reorder-mesh: input is meshopt-compressed; run it before glb-compress");
  process.exit(1);
}
const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const owner = new Map();
for (const m of json.meshes) for (const p of m.primitives) for (const ai of Object.values(p.attributes)) {
  if (owner.has(ai) && owner.get(ai) !== p) { console.error(`accessor ${ai} is shared between primitives — refusing`); process.exit(1); }
  owner.set(ai, p);
}
let total = 0;
for (const m of json.meshes) for (const p of m.primitives) {
  if (p.indices == null || (p.mode ?? 4) !== 4 || p.targets?.length) continue;
  const ia = json.accessors[p.indices], iv = json.bufferViews[ia.bufferView];
  const isz = SIZE[ia.componentType], ib = (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
  const rd = { 1: (o) => bin.readUInt8(o), 2: (o) => bin.readUInt16LE(o), 4: (o) => bin.readUInt32LE(o) }[isz];
  const wr = { 1: (v, o) => bin.writeUInt8(v, o), 2: (v, o) => bin.writeUInt16LE(v, o), 4: (v, o) => bin.writeUInt32LE(v, o) }[isz];
  const idx = new Uint32Array(ia.count);
  for (let i = 0; i < ia.count; i++) idx[i] = rd(ib + i * isz);
  const vcount = json.accessors[p.attributes.POSITION].count;
  const [remap, unique] = MeshoptEncoder.reorderMesh(idx, true, false);   // rewrites idx in place
  if (unique !== vcount) {
    // reorderMesh drops vertices no triangle uses; keeping the permutation
    // total means appending those at the end rather than losing them.
    let next = unique;
    for (let v = 0; v < vcount; v++) if (remap[v] === 0xffffffff) remap[v] = next++;
  }
  for (let i = 0; i < ia.count; i++) wr(idx[i], ib + i * isz);
  for (const ai of Object.values(p.attributes)) {
    const a = json.accessors[ai], v = json.bufferViews[a.bufferView];
    const es = SIZE[a.componentType] * N[a.type], st = v.byteStride || es, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const old = Buffer.from(bin.subarray(base, base + (a.count - 1) * st + es));
    for (let k = 0; k < a.count; k++) old.copy(bin, base + remap[k] * st, k * st, k * st + es);
  }
  total++;
  console.log(`  primitive: ${ia.count / 3} triangles, ${vcount} vertices reordered${unique !== vcount ? ` (${vcount - unique} unused kept at the end)` : ""}`);
}
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jc = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const bc = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const head = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const body = Buffer.concat([head(jc.length, 0x4e4f534a), jc, head(bc.length, 0x004e4942), bc]);
const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + body.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, body]));
console.log(`  ${total} primitive(s) reordered -> ${outPath}`);
