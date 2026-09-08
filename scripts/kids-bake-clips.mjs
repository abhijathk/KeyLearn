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
const qRotate = (q, v) => {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};
const qSlerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let e = b;
  if (d < 0) { e = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) {
    const r = [
      a[0] + (e[0] - a[0]) * t, a[1] + (e[1] - a[1]) * t,
      a[2] + (e[2] - a[2]) * t, a[3] + (e[3] - a[3]) * t,
    ];
    const n = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
    return [r[0] / n, r[1] / n, r[2] / n, r[3] / n];
  }
  const th = Math.acos(d);
  const si = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / si;
  const wb = Math.sin(t * th) / si;
  return [
    a[0] * wa + e[0] * wb, a[1] * wa + e[1] * wb,
    a[2] * wa + e[2] * wb, a[3] * wa + e[3] * wb,
  ];
};

/** Parent index per node, and a root-first ordering to accumulate along. */
function hierarchy(json) {
  const parent = new Array(json.nodes.length).fill(-1);
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)));
  const order = [];
  const seen = new Set();
  const visit = (i) => {
    if (seen.has(i)) return;
    if (parent[i] !== -1) visit(parent[i]);
    seen.add(i);
    order.push(i);
  };
  json.nodes.forEach((_, i) => visit(i));
  return { parent, order };
}

/** World rest rotation per node, accumulated down the tree. */
function worldRest(json, h) {
  const out = new Array(json.nodes.length);
  for (const i of h.order) {
    const local = json.nodes[i].rotation ?? [0, 0, 0, 1];
    out[i] = h.parent[i] === -1 ? local : qMul(out[h.parent[i]], local);
  }
  return out;
}

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

// The rigs, as trees rather than as flat node lists. Retargeting is a
// hierarchical operation: a bone's orientation only means anything relative
// to where its parent ended up.
const hostH = hierarchy(host.json);
const donorH = hierarchy(donor.json);
const hostWorldRest = worldRest(host.json, hostH);
const donorWorldRest = worldRest(donor.json, donorH);
const donorIndex = new Map();
donor.json.nodes.forEach((n, i) => {
  if (n.name) donorIndex.set(n.name, i);
});

const SAMPLE_FPS = 30;

for (const anim of donor.json.animations ?? []) {
  // Every rotation track, resampled onto one shared timeline.
  //
  // A whole pose has to be evaluatable at a single instant to walk it down
  // the tree, and the donor's tracks do not necessarily share keyframe times.
  // Resampling at a fixed rate makes every bone answerable at the same
  // moment, which is what the world-space transfer below needs.
  const tracks = new Map();
  let hipsTrack = null;
  let duration = 0;
  for (const ch of anim.channels) {
    const s2 = anim.samplers[ch.sampler];
    const input = await readAccessor(donor.json, donor.bin, s2.input, donorCache);
    const output = await readAccessor(donor.json, donor.bin, s2.output, donorCache);
    duration = Math.max(duration, input.values[input.count - 1] ?? 0);
    const name = donor.json.nodes[ch.target.node]?.name;
    if (name == null) continue;
    if (ch.target.path === "rotation") {
      tracks.set(name, { times: input.values, values: output.values });
    } else if (ch.target.path === "translation" && /^hips$/i.test(name)) {
      hipsTrack = { times: input.values, values: output.values };
    }
  }
  const sampleQ = (track, t) => {
    const { times, values } = track;
    let i = 0;
    while (i < times.length - 1 && times[i + 1] < t) i++;
    const t0 = times[i];
    const t1 = times[Math.min(i + 1, times.length - 1)];
    const a = [values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3]];
    if (t1 <= t0) return a;
    const j = Math.min(i + 1, times.length - 1);
    const b = [values[j * 4], values[j * 4 + 1], values[j * 4 + 2], values[j * 4 + 3]];
    return qSlerp(a, b, Math.max(0, Math.min(1, (t - t0) / (t1 - t0))));
  };
  const sampleV = (track, t) => {
    const { times, values } = track;
    let i = 0;
    while (i < times.length - 1 && times[i + 1] < t) i++;
    const j = Math.min(i + 1, times.length - 1);
    const t0 = times[i];
    const t1 = times[j];
    const f = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
    return [0, 1, 2].map((c) => values[i * 3 + c] + (values[j * 3 + c] - values[i * 3 + c]) * f);
  };

  const frames = Math.max(2, Math.round(duration * SAMPLE_FPS) + 1);
  const times = Float32Array.from({ length: frames }, (_, i) => (duration * i) / (frames - 1));

  // One output rotation track per host bone that the donor drives.
  const outRot = new Map();
  const outHips = hipsTrack ? new Float32Array(frames * 3) : null;

  for (let f = 0; f < frames; f++) {
    const t = times[f];
    // Donor world rotations at this instant, root first.
    const donorWorld = new Array(donor.json.nodes.length);
    for (const i of donorH.order) {
      const name = donor.json.nodes[i].name;
      const local = name != null && tracks.has(name)
        ? sampleQ(tracks.get(name), t)
        : donor.json.nodes[i].rotation ?? [0, 0, 0, 1];
      donorWorld[i] = donorH.parent[i] === -1 ? local : qMul(donorWorld[donorH.parent[i]], local);
    }
    // Host world rotations, derived from the donor's, then written back down
    // into host-local — which is what a glTF rotation track actually stores.
    const hostWorld = new Array(host.json.nodes.length);
    for (const i of hostH.order) {
      const name = host.json.nodes[i].name;
      const d = name != null ? donorIndex.get(name) : undefined;
      if (d === undefined) {
        const local = host.json.nodes[i].rotation ?? [0, 0, 0, 1];
        hostWorld[i] = hostH.parent[i] === -1 ? local : qMul(hostWorld[hostH.parent[i]], local);
        continue;
      }
      // The donor's world movement, re-expressed on the host's rest frame:
      //   Wh = Wd · Ad⁻¹ · Bh
      // Ad and Bh are the two rigs' WORLD rest orientations for this bone, so
      // this cancels the donor's rest frame and substitutes the host's. Doing
      // the same with local rotations only is what kept coming out wrong: it
      // silently assumes both parents ended up pointing the same way.
      const w = qMul(qMul(donorWorld[d], qInv(donorWorldRest[d])), hostWorldRest[i]);
      hostWorld[i] = w;
      const parentW = hostH.parent[i] === -1 ? [0, 0, 0, 1] : hostWorld[hostH.parent[i]];
      const local = qMul(qInv(parentW), w);
      if (!outRot.has(i)) outRot.set(i, new Float32Array(frames * 4));
      const arr = outRot.get(i);
      arr[f * 4] = local[0]; arr[f * 4 + 1] = local[1];
      arr[f * 4 + 2] = local[2]; arr[f * 4 + 3] = local[3];
    }
    if (hipsTrack && outHips) {
      // Scaled into host units, and rotated out of the donor's root frame
      // into the host's, so a step goes the way the character faces.
      const hipsHost = [...hostH.order].find((i) => /^hips$/i.test(host.json.nodes[i].name ?? ""));
      const hipsDonor = donorIndex.get(host.json.nodes[hipsHost].name);
      const rootFix = qMul(hostWorldRest[hostH.parent[hipsHost]] ?? [0, 0, 0, 1],
        qInv(donorWorldRest[donorH.parent[hipsDonor]] ?? [0, 0, 0, 1]));
      const v = sampleV(hipsTrack, t).map((c) => c * factor);
      const r = qRotate(rootFix, v);
      outHips[f * 3] = r[0]; outHips[f * 3 + 1] = r[1]; outHips[f * 3 + 2] = r[2];
    }
  }

  const samplers = [];
  const channels = [];
  const timeIdx = addAccessor(Float32Array.from(times), "SCALAR", frames, {
    min: [times[0]], max: [times[frames - 1]],
  });
  for (const [nodeI, values] of outRot) {
    const outIdx = addAccessor(values, "VEC4", frames);
    samplers.push({ input: timeIdx, output: outIdx, interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: nodeI, path: "rotation" } });
  }
  if (outHips) {
    const hipsHost = [...hostH.order].find((i) => /^hips$/i.test(host.json.nodes[i].name ?? ""));
    const outIdx = addAccessor(outHips, "VEC3", frames);
    samplers.push({ input: timeIdx, output: outIdx, interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: hipsHost, path: "translation" } });
  }
  if (channels.length === 0) { report.push(`  EMPTY  ${anim.name}`); continue; }
  rebuilt.push({ name: anim.name, samplers, channels });
  report.push(`  ${anim.name.padEnd(24)} ${String(channels.length).padStart(3)} ch, ${frames} frames @${SAMPLE_FPS}fps, ${duration.toFixed(2)}s`);
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
