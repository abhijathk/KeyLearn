/**
 * Remove animations from a GLB by name.
 *
 *   node scripts/glb-drop-clips.mjs in.glb out.glb Death Attack_Horn ...
 *
 * The kids app strips death, attack and bite clips from every character at
 * LOAD time (see loadModel in world.ts), so the buffalo ships three clips —
 * Death, Attack_Horn, Attack_Stomp — that are downloaded on every visit and
 * then thrown away before anything can play them. Roughly a fifth of its
 * animation data, spent on nothing.
 *
 * The MASTER keeps all sixteen: it is the authored build and what is right
 * for the app today should not quietly delete work. This trims the SHIPPED
 * build only, which is the one with a size budget.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const [inPath, outPath, ...names] = args;
if (!inPath || !outPath || names.length === 0) {
  console.error("usage: glb-drop-clips.mjs in.glb out.glb <clip> [clip...]");
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
const drop = new Set(names);
const before = json.animations?.length ?? 0;
const gone = [];
json.animations = (json.animations ?? []).filter((a) => {
  if (drop.has(a.name)) { gone.push(a.name); return false; }
  return true;
});
for (const n of names) if (!gone.includes(n)) console.warn(`  no clip named "${n}"`);

// Everything the removed samplers pointed at is now dead. Prune accessors
// first, then the views they used — pruning only the views leaves accessors
// pointing at `undefined`, which loads as far as the first read and throws.
const liveAcc = new Set();
for (const a of json.animations) for (const s of a.samplers) { liveAcc.add(s.input); liveAcc.add(s.output); }
for (const m of json.meshes ?? []) for (const p of m.primitives ?? []) {
  for (const k of Object.keys(p.attributes)) liveAcc.add(p.attributes[k]);
  if (p.indices != null) liveAcc.add(p.indices);
  for (const t of p.targets ?? []) for (const k of Object.keys(t)) liveAcc.add(t[k]);
}
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) liveAcc.add(sk.inverseBindMatrices);
const accRemap = new Map(); const keptAcc = [];
for (let i = 0; i < json.accessors.length; i++) {
  if (!liveAcc.has(i)) continue;
  accRemap.set(i, keptAcc.length); keptAcc.push(json.accessors[i]);
}
const droppedAcc = json.accessors.length - keptAcc.length;
json.accessors = keptAcc;
for (const a of json.animations) for (const s of a.samplers) { s.input = accRemap.get(s.input); s.output = accRemap.get(s.output); }
for (const m of json.meshes ?? []) for (const p of m.primitives ?? []) {
  for (const k of Object.keys(p.attributes)) p.attributes[k] = accRemap.get(p.attributes[k]);
  if (p.indices != null) p.indices = accRemap.get(p.indices);
  for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = accRemap.get(t[k]);
}
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) sk.inverseBindMatrices = accRemap.get(sk.inverseBindMatrices);

const live = new Set();
for (const a of json.accessors) if (a.bufferView != null) live.add(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) live.add(im.bufferView);
const remap = new Map(); const parts = []; const newViews = [];
let outLen = 0;
for (let i = 0; i < json.bufferViews.length; i++) {
  if (!live.has(i)) continue;
  const v = json.bufferViews[i];
  const pad = (4 - (outLen % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); outLen += pad; }
  const nv = { buffer: 0, byteOffset: outLen, byteLength: v.byteLength };
  if (v.byteStride != null) nv.byteStride = v.byteStride;
  if (v.target != null) nv.target = v.target;
  remap.set(i, newViews.length); newViews.push(nv);
  parts.push(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  outLen += v.byteLength;
}
const droppedViews = json.bufferViews.length - newViews.length;
json.bufferViews = newViews;
for (const a of json.accessors) if (a.bufferView != null) a.bufferView = remap.get(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) im.bufferView = remap.get(im.bufferView);

const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jc = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const bc = Buffer.concat([newBin, Buffer.alloc((4 - (newBin.length % 4)) % 4)]);
const chunk = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const total = 12 + 8 + jc.length + 8 + bc.length;
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([hdr, chunk(jc.length, 0x4e4f534a), jc, chunk(bc.length, 0x004e4942), bc]));
console.log(`  clips ${before} -> ${json.animations.length}  (dropped ${gone.join(", ") || "none"})`);
console.log(`  pruned ${droppedAcc} accessor(s), ${droppedViews} bufferView(s)`);
console.log(`wrote ${outPath}  ${total.toLocaleString()} bytes`);
