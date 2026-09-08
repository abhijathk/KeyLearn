#!/usr/bin/env node
/**
 * Bakes one character's animation onto another, into a new GLB.
 *
 * The six-year-old Explorer's own clips were rejected — his crouch, his
 * cross-legged sit, his walk and his run — so he wears the ten-year-old's
 * instead. His one clip nobody wanted to lose is the ninja move, which the
 * ten-year-old does not have, so it is carried across.
 *
 * ── Why bake rather than retarget at load ────────────────────────────────
 *
 * This was done in the browser first, which cost a second model download for
 * every child in the younger bands and put the retarget on the critical path
 * of a page that is already slow to open. It is a fixed transform on fixed
 * inputs, so it belongs in the asset.
 *
 * ── What actually transfers ──────────────────────────────────────────────
 *
 * The two rigs share a bone chain and nothing else. Measured:
 *
 *   · Units differ. The donor is authored in centimetres with a 0.01 scale on
 *     its Armature, hips resting at 75.493; the host is in metres, hips at
 *     0.720.
 *   · Rest poses differ. Their LeftArm rest quaternions match by 0.75, their
 *     Hips by 0.92.
 *
 * So:
 *
 *   ROTATION  is taken as the donor's change from its own rest and applied to
 *             the host's rest, IN PARENT SPACE — donorKey · donorRest⁻¹ ·
 *             hostRest. A track holds a bone's orientation relative to its
 *             parent, so that is the frame the delta belongs in. Composed in
 *             the bone's own frame instead, every bone still lands on its rest
 *             when the donor is at rest — the character stands correctly — but
 *             each rotation swings about the wrong axis.
 *
 *   POSITION  is dropped for every bone except the hips, because a bone's
 *             translation IS its length: copying them rebuilds the host's
 *             skeleton out of the donor's proportions, which is a stretched
 *             neck and a pulled-apart face. The hips keep theirs — that is the
 *             character moving, not a bone length — scaled into host units.
 *
 *   SCALE     is dropped. The world strips scale tracks at load anyway.
 *
 *   node scripts/kids-bake-clips.mjs <host.glb> <donor.glb> <out.glb> [keep...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;
const SIZE_OF = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGlb(path) {
  const buf = readFileSync(path);
  let off = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString("utf8"));
    else if (type === BIN_CHUNK) bin = Buffer.from(data);
    off += 8 + len;
  }
  if (json == null) throw new Error(`${path}: no JSON chunk`);
  return { json, bin };
}

/** A bufferView's bytes, decompressing it first if it is meshopt-packed. */
async function viewBytes(json, bin, index, cache) {
  if (cache.has(index)) return cache.get(index);
  const view = json.bufferViews[index];
  const packed = view.extensions?.["EXT_meshopt_compression"];
  let out;
  if (packed == null) {
    out = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  } else {
    await MeshoptDecoder.ready;
    const src = bin.subarray(packed.byteOffset ?? 0, (packed.byteOffset ?? 0) + packed.byteLength);
    const dst = new Uint8Array(packed.count * packed.byteStride);
    MeshoptDecoder.decodeGltfBuffer(
      dst,
      packed.count,
      packed.byteStride,
      new Uint8Array(src),
      packed.mode,
      packed.filter ?? "NONE",
    );
    out = Buffer.from(dst.buffer, dst.byteOffset, dst.byteLength);
  }
  cache.set(index, out);
  return out;
}

async function readAccessor(json, bin, index, cache) {
  const acc = json.accessors[index];
  const per = COMPONENTS[acc.type];
  const bytes = await viewBytes(json, bin, acc.bufferView, cache);
  const view = json.bufferViews[acc.bufferView];
  const packed = view.extensions?.["EXT_meshopt_compression"];
  const stride = packed?.byteStride ?? view.byteStride ?? per * SIZE_OF[acc.componentType];
  const base = acc.byteOffset ?? 0;
  const out = new Float32Array(acc.count * per);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < per; c++) {
      const at = base + i * stride + c * SIZE_OF[acc.componentType];
      let v;
      switch (acc.componentType) {
        case FLOAT: v = bytes.readFloatLE(at); break;
        case 5122: v = Math.max(bytes.readInt16LE(at) / 32767, -1); break;
        case 5123: v = bytes.readUInt16LE(at) / 65535; break;
        case 5120: v = Math.max(bytes.readInt8(at) / 127, -1); break;
        case 5121: v = bytes.readUInt8(at) / 255; break;
        default: throw new Error(`accessor ${index}: componentType ${acc.componentType}`);
      }
      out[i * per + c] = v;
    }
  }
  return { values: out, type: acc.type, count: acc.count };
}

// ── quaternion helpers (w last, as glTF stores them) ──
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];

const [, , hostPath, donorPath, outPath, ...keep] = process.argv;
if (!hostPath || !donorPath || !outPath) {
  console.error("usage: kids-bake-clips.mjs <host.glb> <donor.glb> <out.glb> [clipToKeep...]");
  process.exit(2);
}

const host = parseGlb(hostPath);
const donor = parseGlb(donorPath);
const hostCache = new Map();
const donorCache = new Map();

const restOf = (json) => {
  const rot = new Map();
  const pos = new Map();
  for (const n of json.nodes) {
    if (!n.name) continue;
    rot.set(n.name, n.rotation ?? [0, 0, 0, 1]);
    pos.set(n.name, n.translation ?? [0, 0, 0]);
  }
  return { rot, pos };
};
const hostRest = restOf(host.json);
const donorRest = restOf(donor.json);

const hostHips = hostRest.pos.get([...hostRest.pos.keys()].find((k) => /^hips$/i.test(k)));
const donorHips = donorRest.pos.get([...donorRest.pos.keys()].find((k) => /^hips$/i.test(k)));
const factor = donorHips?.[1] ? hostHips[1] / donorHips[1] : 1;

const nodeIndex = new Map();
host.json.nodes.forEach((n, i) => {
  if (n.name) nodeIndex.set(n.name, i);
});

// Everything the host keeps stays byte-identical; only animations are rebuilt.
const chunks = [host.bin];
let length = host.bin.length;
const addAccessor = (floats, type, count, minmax) => {
  const pad = (4 - (length % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad, 0)); length += pad; }
  const buf = Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength);
  host.json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: buf.length });
  chunks.push(buf);
  length += buf.length;
  host.json.accessors.push({
    bufferView: host.json.bufferViews.length - 1,
    componentType: FLOAT,
    count,
    type,
    ...(minmax ?? {}),
  });
  return host.json.accessors.length - 1;
};

const kept = (host.json.animations ?? []).filter((a) => keep.includes(a.name));
const rebuilt = [];
const report = [];

for (const anim of donor.json.animations ?? []) {
  const samplers = [];
  const channels = [];
  let dropped = 0;
  for (const ch of anim.channels) {
    const name = donor.json.nodes[ch.target.node]?.name;
    const target = name != null ? nodeIndex.get(name) : undefined;
    const path = ch.target.path;
    if (target === undefined || path === "scale") { dropped++; continue; }
    if (path === "translation" && !/^hips$/i.test(name)) { dropped++; continue; }
    const s = anim.samplers[ch.sampler];
    const input = await readAccessor(donor.json, donor.bin, s.input, donorCache);
    const output = await readAccessor(donor.json, donor.bin, s.output, donorCache);
    const values = Float32Array.from(output.values);
    if (path === "rotation") {
      const hr = hostRest.rot.get(name);
      const dr = donorRest.rot.get(name);
      if (hr == null || dr == null) { dropped++; continue; }
      const inv = qInv(dr);
      for (let i = 0; i < values.length; i += 4) {
        const k = [values[i], values[i + 1], values[i + 2], values[i + 3]];
        const r = qMul(qMul(k, inv), hr);
        values[i] = r[0]; values[i + 1] = r[1]; values[i + 2] = r[2]; values[i + 3] = r[3];
      }
    } else if (path === "translation") {
      for (let i = 0; i < values.length; i++) values[i] *= factor;
    }
    const times = Float32Array.from(input.values);
    const inIdx = addAccessor(times, "SCALAR", input.count, {
      min: [Math.min(...times)], max: [Math.max(...times)],
    });
    const outIdx = addAccessor(values, output.type, output.count);
    samplers.push({ input: inIdx, output: outIdx, interpolation: s.interpolation ?? "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: target, path } });
  }
  if (channels.length === 0) { report.push(`  EMPTY  ${anim.name}`); continue; }
  rebuilt.push({ name: anim.name, samplers, channels });
  report.push(`  ${anim.name.padEnd(24)} ${String(channels.length).padStart(3)} ch${dropped ? `, ${dropped} dropped` : ""}`);
}

host.json.animations = [...rebuilt, ...kept];
host.json.buffers[0].byteLength = length;

const jsonBuf = Buffer.from(JSON.stringify(host.json), "utf8");
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
const binAll = Buffer.concat(chunks, length);
const binPad = (4 - (binAll.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
const binChunk = Buffer.concat([binAll, Buffer.alloc(binPad, 0)]);
const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0);
out.writeUInt32LE(2, 4);
out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonChunk.length, 12);
out.writeUInt32LE(JSON_CHUNK, 16);
jsonChunk.copy(out, 20);
out.writeUInt32LE(binChunk.length, 20 + jsonChunk.length);
out.writeUInt32LE(BIN_CHUNK, 24 + jsonChunk.length);
binChunk.copy(out, 28 + jsonChunk.length);
writeFileSync(outPath, out);

console.log(`hips unit factor ${factor.toFixed(6)} (donor ${donorHips[1]} → host ${hostHips[1]})`);
console.log(`${rebuilt.length} clip(s) from the donor, ${kept.length} kept from the host (${kept.map((a) => a.name).join(", ") || "none"}):`);
console.log(report.join("\n"));
console.log(`wrote ${outPath} (${(total / 1048576).toFixed(2)} MB)`);
