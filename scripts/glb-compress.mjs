#!/usr/bin/env node
/**
 * Lossless meshopt compression for a GLB, with the animation left alone.
 *
 * Written for the Peeli controller, whose constraints are unusually strict:
 * every clip, name, duration, channel, sampler and keyframe VALUE has to
 * survive, the skeleton and skinning have to survive, and the controller
 * metadata in `extras` has to survive. Nothing may be resampled, baked,
 * merged or decimated.
 *
 * ── What this does, and why it is safe ────────────────────────────────────
 *
 * Two changes, both of which move bytes without changing numbers.
 *
 * 1. MERGE. The source carries one bufferView per accessor — 2781 of them.
 *    A meshopt block has fixed overhead, so compressing thousands of tiny
 *    views achieves close to nothing and can grow the file. Accessors sharing
 *    an element size are concatenated into one view each, which is pure
 *    relocation: the same bytes, at new offsets, with accessor byteOffsets
 *    updated to match. It also collapses about a fifth of a megabyte of JSON.
 *
 * 2. ENCODE. Each merged view is passed through meshopt with filter NONE.
 *    That filter is the whole reason this is allowed to touch animation data:
 *    the OCTAHEDRAL, QUATERNION and EXPONENTIAL filters are lossy transforms
 *    applied before the codec, but with NONE the codec is a byte-level
 *    compressor and the decoder reproduces the input exactly. Float
 *    keyframes come back bit-identical, which is the numerical equivalence
 *    the brief asks to be proven rather than assumed — and `--verify` proves
 *    it by decoding the result and comparing every byte.
 *
 * Mesh attributes are NOT quantized. Quantizing positions is the usual big
 * win, but it needs a compensating transform on the node or normalized
 * accessors, and both change the character's proportions by a hair. The brief
 * forbids that, so positions stay float32 and simply compress.
 *
 * Images are copied through untouched.
 *
 *   node scripts/glb-compress.mjs <in.glb> <out.glb> [--verify]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptEncoder } from "meshoptimizer";
import { MeshoptDecoder } from "meshoptimizer";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function parseGlb(path) {
  const buf = readFileSync(path);
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString("utf8"));
    else if (type === BIN_CHUNK) bin = Buffer.from(data);
    off += 8 + len;
  }
  return { json, bin, size: buf.length };
}

const [, , inPath, outPath, ...flags] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: glb-compress.mjs <in.glb> <out.glb> [--verify]");
  process.exit(2);
}
const verify = flags.includes("--verify");

await MeshoptEncoder.ready;
const { json, bin, size: inSize } = parseGlb(inPath);

// Which bufferViews hold what. Images pass through; indices get the index
// codec; everything else is attribute-style data.
const indexViews = new Set();
const imageViews = new Set();
for (const m of json.meshes ?? []) {
  for (const p of m.primitives) {
    if (p.indices != null) indexViews.add(json.accessors[p.indices].bufferView);
  }
}
for (const im of json.images ?? []) {
  if (im.bufferView != null) imageViews.add(im.bufferView);
}

/** Element size in bytes for an accessor — the row stride once packed. */
const strideOf = (a) => COMPONENTS[a.type] * COMPONENT_BYTES[a.componentType];

/** Raw bytes of an accessor, packed tightly. */
function accessorBytes(a) {
  const view = json.bufferViews[a.bufferView];
  const stride = strideOf(a);
  const srcStride = view.byteStride ?? stride;
  const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  if (srcStride === stride) {
    return bin.subarray(base, base + a.count * stride);
  }
  // Interleaved source: de-interleave so the merged view is tightly packed.
  const out = Buffer.alloc(a.count * stride);
  for (let i = 0; i < a.count; i++) {
    bin.copy(out, i * stride, base + i * srcStride, base + i * srcStride + stride);
  }
  return out;
}

// ── group accessors by stride, keeping indices and images out of it ──
const groups = new Map(); // stride -> accessor indices
const indexAccessors = [];
json.accessors.forEach((a, i) => {
  if (a.bufferView == null) return; // sparse / zero-filled: left alone
  if (indexViews.has(a.bufferView)) { indexAccessors.push(i); return; }
  const s = strideOf(a);
  if (s % 4 !== 0 || s > 256) return; // outside what meshopt accepts
  if (!groups.has(s)) groups.set(s, []);
  groups.get(s).push(i);
});

const outBin = [];          // buffer 0: compressed blobs, then images
let outLen = 0;
const newViews = [];
let fallbackLen = 0;        // buffer 1: the uncompressed sizes
const report = [];

const align = () => {
  const pad = (4 - (outLen % 4)) % 4;
  if (pad) { outBin.push(Buffer.alloc(pad, 0)); outLen += pad; }
};

function addCompressed(raw, { mode, byteStride, count }) {
  const encoded = mode === "TRIANGLES"
    ? MeshoptEncoder.encodeIndexBuffer(new Uint8Array(raw), count, byteStride)
    : MeshoptEncoder.encodeVertexBuffer(new Uint8Array(raw), count, byteStride);
  align();
  const view = {
    buffer: 1,
    byteOffset: fallbackLen,
    byteLength: raw.length,
    extensions: {
      EXT_meshopt_compression: {
        buffer: 0,
        byteOffset: outLen,
        byteLength: encoded.length,
        mode,
        byteStride,
        count,
        filter: "NONE",
      },
    },
  };
  outBin.push(Buffer.from(encoded));
  outLen += encoded.length;
  fallbackLen += raw.length;
  newViews.push(view);
  return { index: newViews.length - 1, raw, encoded };
}

const checks = [];

// Attribute-style groups, one merged view per stride.
for (const [stride, accs] of [...groups].sort((a, b) => a[0] - b[0])) {
  const parts = [];
  const placement = [];
  let rows = 0;
  for (const ai of accs) {
    const a = json.accessors[ai];
    const bytes = accessorBytes(a);
    placement.push({ ai, offset: rows * stride });
    parts.push(bytes);
    rows += a.count;
  }
  const raw = Buffer.concat(parts);
  const { index, encoded } = addCompressed(raw, { mode: "ATTRIBUTES", byteStride: stride, count: rows });
  for (const { ai, offset } of placement) {
    json.accessors[ai].bufferView = index;
    json.accessors[ai].byteOffset = offset;
  }
  checks.push({ label: `stride ${stride}`, raw, viewIndex: index });
  report.push(`  stride ${String(stride).padStart(3)}  ${String(accs.length).padStart(4)} accessors  ${(raw.length / 1024).toFixed(0).padStart(6)} KB -> ${(encoded.length / 1024).toFixed(0).padStart(6)} KB`);
}

// Indices: straight through, untouched.
//
// meshopt has an index codec and it is markedly better than the general one —
// 270 KB down to 170 KB here. It is not used, for two reasons that the
// --verify pass surfaced rather than my reading the spec: it is lossless
// about the GEOMETRY but not about the BYTES, because it may rotate which
// vertex a triangle starts on, and feeding it the source's 16-bit indices
// meant widening them to 32-bit and rewriting each accessor's componentType.
//
// Both are defensible in a normal pipeline and neither is allowed here: the
// brief asks for keyframe and mesh data preserved, and quietly changing an
// accessor's component type is not preserving it. 138 KB of indices against a
// 9.8 MB file is not worth a caveat in the QA report.
for (const ai of indexAccessors) {
  const a = json.accessors[ai];
  const raw = accessorBytes(a);
  align();
  newViews.push({ buffer: 0, byteOffset: outLen, byteLength: raw.length, target: 34963 });
  outBin.push(Buffer.from(raw));
  outLen += raw.length;
  json.accessors[ai].bufferView = newViews.length - 1;
  json.accessors[ai].byteOffset = 0;
  report.push(`  indices     ${String(a.count).padStart(4)} values     ${(raw.length / 1024).toFixed(0).padStart(6)} KB    uncompressed, unchanged`);
}

// Images: straight through, uncompressed.
let imageBytes = 0;
for (const im of json.images ?? []) {
  if (im.bufferView == null) continue;
  const v = json.bufferViews[im.bufferView];
  const raw = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  align();
  newViews.push({ buffer: 0, byteOffset: outLen, byteLength: raw.length });
  outBin.push(Buffer.from(raw));
  outLen += raw.length;
  imageBytes += raw.length;
  im.bufferView = newViews.length - 1;
}

json.bufferViews = newViews;
json.buffers = [
  { byteLength: outLen },
  { byteLength: fallbackLen, extensions: { EXT_meshopt_compression: { fallback: true } } },
];
const need = (list, name) => {
  const set = new Set(list ?? []);
  set.add(name);
  return [...set];
};
json.extensionsUsed = need(json.extensionsUsed, "EXT_meshopt_compression");
json.extensionsRequired = need(json.extensionsRequired, "EXT_meshopt_compression");

// ── write ──
const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jsonBuf.length % 4)) % 4;
const binAll = Buffer.concat(outBin, outLen);
const bp = (4 - (binAll.length % 4)) % 4;
const jc = Buffer.concat([jsonBuf, Buffer.alloc(jp, 0x20)]);
const bc = Buffer.concat([binAll, Buffer.alloc(bp, 0)]);
const total = 12 + 8 + jc.length + 8 + bc.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
out.writeUInt32LE(jc.length, 12); out.writeUInt32LE(JSON_CHUNK, 16); jc.copy(out, 20);
out.writeUInt32LE(bc.length, 20 + jc.length); out.writeUInt32LE(BIN_CHUNK, 24 + jc.length); bc.copy(out, 28 + jc.length);
writeFileSync(outPath, out);

console.log(`in  ${(inSize / 1048576).toFixed(2)} MB`);
console.log(`out ${(total / 1048576).toFixed(2)} MB   (${(100 - (total / inSize) * 100).toFixed(1)}% smaller)`);
console.log(`bufferViews ${2781 === json.bufferViews.length ? "" : ""}-> ${json.bufferViews.length}   images passed through ${(imageBytes / 1048576).toFixed(2)} MB`);
console.log(report.join("\n"));

if (verify) {
  await MeshoptDecoder.ready;
  let ok = true;
  for (const { label, raw, viewIndex } of checks) {
    const v = json.bufferViews[viewIndex];
    const e = v.extensions.EXT_meshopt_compression;
    const dst = new Uint8Array(e.count * e.byteStride);
    MeshoptDecoder.decodeGltfBuffer(
      dst, e.count, e.byteStride,
      new Uint8Array(binAll.subarray(e.byteOffset, e.byteOffset + e.byteLength)),
      e.mode, e.filter,
    );
    const same = Buffer.compare(Buffer.from(dst), raw) === 0;
    if (!same) ok = false;
    console.log(`  verify ${label.padEnd(12)} ${same ? "byte-identical after decode" : "MISMATCH"}`);
  }
  console.log(ok ? "\nlossless: every compressed block decodes to the original bytes" : "\nLOSSY — do not ship");
  if (!ok) process.exit(1);
}
