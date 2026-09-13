/**
 * Builds the buffalo MASTER: the ORIGINAL file, byte-for-byte, plus new
 * animation clips harvested from a Blender export.
 *
 *   node scripts/glb-splice-animations.mjs original.glb blender.glb out.glb \
 *        --rename "Armature|Unreal Take|baselayer=Walk" --take Idle --take Run ...
 *
 * Why not just export everything from Blender: its importer resamples to
 * the scene frame rate and its exporter remembers original clip names and
 * shifts them a frame, so the Walk that came back measured 1.033s under
 * the wrong name. The brief says preserve the existing Walk exactly, and
 * "exactly" is not something a round trip through a resampler can promise.
 * So the mesh, skin, textures, materials and the Walk's keyframes are never
 * touched — the original binary chunk is copied across whole and the new
 * clips are appended after it. Blender is an authoring tool here, not a
 * pipeline.
 *
 * New clips reference bones by NAME, then are remapped to the original
 * file's node indices. Blender orders nodes its own way; names are what the
 * two files actually share.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const [origPath, blendPath, outPath] = args;
const renames = new Map(), takes = [];
for (let i = 3; i < args.length; i++) {
  if (args[i] === "--rename") { const [a, b] = args[++i].split("="); renames.set(a, b); }
  else if (args[i] === "--take") takes.push(args[++i]);
}

function open(path) {
  const b = readFileSync(path);
  let off = 12, json = null, bin = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
    const body = b.subarray(off + 8, off + 8 + len);
    if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    if (t === 0x004e4942) bin = Buffer.from(body);
    off += 8 + len;
  }
  return { json, bin };
}
const O = open(origPath), B = open(blendPath);

// Bone name -> node index, in each file.
const nodeByName = (g) => Object.fromEntries((g.nodes ?? []).map((n, i) => [n.name, i]));
const origNode = nodeByName(O.json), blendNode = nodeByName(B.json);
const origJoints = new Set(O.json.skins[0].joints.map((i) => O.json.nodes[i].name));

// Rename, never re-encode: the original clips keep their accessors as-is.
for (const a of O.json.animations ?? []) {
  if (renames.has(a.name)) { console.log(`  rename  "${a.name}" -> "${renames.get(a.name)}"`); a.name = renames.get(a.name); }
}

// Read a raw accessor's bytes out of the Blender file.
const rawAccessor = (g, bin, i) => {
  const a = g.accessors[i], v = g.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const stride = v.byteStride || n * 4;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = Buffer.alloc(a.count * n * 4);
  for (let k = 0; k < a.count; k++) bin.copy(out, k * n * 4, base + k * stride, base + k * stride + n * 4);
  return { bytes: out, count: a.count, type: a.type, min: a.min, max: a.max };
};

// Append new bytes to the original buffer, 4-byte aligned; return a new accessor index.
const extra = [];
let cursor = O.bin.length;
const addAccessor = ({ bytes, count, type, min, max }) => {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { extra.push(Buffer.alloc(pad)); cursor += pad; }
  O.json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: bytes.length });
  extra.push(bytes); cursor += bytes.length;
  O.json.accessors.push({ bufferView: O.json.bufferViews.length - 1, componentType: 5126, count, type, ...(min ? { min } : {}), ...(max ? { max } : {}) });
  return O.json.accessors.length - 1;
};

let added = 0;
for (const name of takes) {
  const src = (B.json.animations ?? []).find((a) => a.name === name);
  if (!src) { console.log(`  MISSING in Blender export: "${name}"`); process.exitCode = 1; continue; }
  const samplers = [], channels = [];
  const samplerMap = new Map();
  let dropped = 0;
  for (const ch of src.channels) {
    const bone = B.json.nodes[ch.target.node]?.name;
    if (!origJoints.has(bone)) { dropped++; continue; }           // not one of the 27 joints
    if (ch.target.path === "scale") { dropped++; continue; }      // the brief forbids bone scaling; never carry it
    const s = src.samplers[ch.sampler];
    let idx = samplerMap.get(ch.sampler);
    if (idx == null) {
      const input = addAccessor(rawAccessor(B.json, B.bin, s.input));
      const output = addAccessor(rawAccessor(B.json, B.bin, s.output));
      samplers.push({ input, output, interpolation: s.interpolation ?? "LINEAR" });
      idx = samplers.length - 1; samplerMap.set(ch.sampler, idx);
    }
    channels.push({ sampler: idx, target: { node: origNode[bone], path: ch.target.path } });
  }
  const dur = Math.max(...samplers.map((s) => O.json.accessors[s.input].max?.[0] ?? 0));
  O.json.animations.push({ name, samplers, channels });
  console.log(`  take    "${name}"  ${dur.toFixed(3)}s  ${channels.length} channels${dropped ? `  (${dropped} non-joint/scale channels left behind)` : ""}`);
  added++;
}

const newBin = Buffer.concat([O.bin, ...extra]);
O.json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(O.json), "utf8");
const jp = (4 - (jb.length % 4)) % 4, jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (newBin.length % 4)) % 4, bc = Buffer.concat([newBin, Buffer.alloc(bp)]);
const head = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const rest = Buffer.concat([head(jc.length, 0x4e4f534a), jc, head(bc.length, 0x004e4942), bc]);
const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + rest.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, rest]));
console.log(`\n  ${added} clip(s) spliced; original geometry, skin, textures and Walk untouched -> ${outPath}`);
