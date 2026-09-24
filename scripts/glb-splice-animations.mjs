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

// Read an accessor out of the donor and hand it back as plain float32.
//
// DECODED, NOT MEMCPY'D. This used to copy `n * 4` bytes per element
// straight across and declare the result float32, on the reasoning that it
// was reading "a Blender file" and Blender writes float32. The donor is not
// always a Blender file. `ak-3d-pack/Buffalo.glb` — the DEFAULT donor for
// every splice here — ships its rotations quantised, `componentType` 5122
// (int16) with `normalized: true`, which is 8 bytes per quaternion and not
// 16.
//
// So the copy read each key plus half of the next one, and relabelled those
// bytes as floats. Two int16s reinterpreted as a float is an arbitrary bit
// pattern: most came out as NaN, a few as zero. Every spliced clip on the
// cow and the calf was corrupt from that moment on, and nothing downstream
// noticed — `glb-reduce-keys` compares keys with `err > worstErr`, which is
// FALSE for NaN, so it quietly thinned those channels to their two
// endpoints and reported a healthy "59% dropped".
//
// The failure surfaces only at playback, and not as an error: three.js
// writes the NaN quaternions into the skeleton's bone matrices, the GPU
// skins every vertex to NaN, and the animal renders as nothing at all while
// its bounding box, its scale and its frustum test all still read correct.
// That is what "the cow is only showing the walking animation" was.
//
// Decoding through the declared component type is the only version of this
// that cannot be wrong for a donor somebody swaps in later.
const COMPONENT = {
  5120: { array: Int8Array, bytes: 1, scale: 127 },
  5121: { array: Uint8Array, bytes: 1, scale: 255 },
  5122: { array: Int16Array, bytes: 2, scale: 32767 },
  5123: { array: Uint16Array, bytes: 2, scale: 65535 },
  5125: { array: Uint32Array, bytes: 4, scale: 4294967295 },
  5126: { array: Float32Array, bytes: 4, scale: 1 },
};
const rawAccessor = (g, bin, i) => {
  const a = g.accessors[i], v = g.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const c = COMPONENT[a.componentType];
  if (c == null) throw new Error(`accessor ${i}: unsupported componentType ${a.componentType}`);
  const stride = v.byteStride || n * c.bytes;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(a.count * n);
  for (let k = 0; k < a.count; k++) {
    const at = base + k * stride;
    for (let e = 0; e < n; e++) {
      // Read component-wise rather than viewing the buffer: a bufferView's
      // byteOffset carries no alignment guarantee for the wider types, and
      // a misaligned TypedArray view throws.
      const o = at + e * c.bytes;
      let x;
      switch (a.componentType) {
        case 5120: x = bin.readInt8(o); break;
        case 5121: x = bin.readUInt8(o); break;
        case 5122: x = bin.readInt16LE(o); break;
        case 5123: x = bin.readUInt16LE(o); break;
        case 5125: x = bin.readUInt32LE(o); break;
        default: x = bin.readFloatLE(o); break;
      }
      // glTF 3.10.1: a normalized signed integer decodes with the negative
      // end clamped, so -32768 and -32767 both mean -1.
      out[k * n + e] = a.normalized ? Math.max(x / c.scale, -1) : x;
    }
  }
  const bytes = Buffer.from(out.buffer, out.byteOffset, out.byteLength);
  // The declared min/max describe the STORED values; after de-normalising
  // they are the wrong numbers, and a wrong bound is worse than none.
  const keep = !a.normalized && a.componentType === 5126;
  return {
    bytes,
    count: a.count,
    type: a.type,
    min: keep ? a.min : undefined,
    max: keep ? a.max : undefined,
  };
};

// Append new bytes to the original buffer, 4-byte aligned; return a new accessor index.
const extra = [];
let cursor = O.bin.length;
const newBinLength = () => cursor;
const readAppended = (at) => {
  if (at < O.bin.length) return O.bin.readFloatLE(at);
  let seek = at - O.bin.length;
  for (const b of extra) {
    if (seek + 4 <= b.length) return b.readFloatLE(seek);
    seek -= b.length;
  }
  return 0;
};
const addAccessor = ({ bytes, count, type, min, max }) => {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { extra.push(Buffer.alloc(pad)); cursor += pad; }
  O.json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: bytes.length });
  extra.push(bytes); cursor += bytes.length;
  O.json.accessors.push({ bufferView: O.json.bufferViews.length - 1, componentType: 5126, count, type, ...(min ? { min } : {}), ...(max ? { max } : {}) });
  return O.json.accessors.length - 1;
};

// ── A BORROWED ROTATION IS RELATIVE TO THE DONOR'S REST, NOT TO THIS ONE'S ──
//
// A channel remapped by name carries the donor's LOCAL rotation, and a local
// rotation only means the same thing on two skeletons if the bone rests the
// same way on both. Measured between the cow and `ak-3d-pack/Buffalo.glb`,
// every leg bone rests within 16 degrees — close enough that copying across
// looked right and this went unnoticed — but `head` rests 176.7 degrees
// apart. Essentially flipped. So every clip taken from the buffalo drove the
// cow's head into a reversed frame and folded it down between her front legs,
// which is what "the front legs are flipped in walking" actually was.
//
// What transfers between two rigs is the MOTION — how far the bone has
// turned from wherever it rests — not the absolute local rotation. With
// `local = motion * rest` in the parent's frame, the motion is
// `q * inverse(restDonor)`, and replaying it on this animal is
//
//     q' = q * inverse(restDonor) * restTarget
//
// For a bone that rests identically on both this is exactly the identity, so
// the legs and the spine come through unchanged and only the genuinely
// differing joints move. It is also the general answer: any donor swapped in
// later is rebased the same way without anyone having to notice first.
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qdeg = (a, b) =>
  2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;
const rebased = [];
function rebaseRotation(acc, donorNode, targetNode, bone, clip) {
  const rs = donorNode?.rotation ?? [0, 0, 0, 1];
  const rt = targetNode?.rotation ?? [0, 0, 0, 1];
  const delta = qdeg(rs, rt);
  if (delta < 0.5) return;                    // rests agree; nothing to do
  const fix = qmul(qinv(rs), rt);
  const n = acc.count;
  for (let k = 0; k < n; k++) {
    const o = k * 4;
    const q = [
      acc.bytes.readFloatLE(o * 4),
      acc.bytes.readFloatLE(o * 4 + 4),
      acc.bytes.readFloatLE(o * 4 + 8),
      acc.bytes.readFloatLE(o * 4 + 12),
    ];
    const r = qmul(q, fix);
    const l = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
    for (let e = 0; e < 4; e++) acc.bytes.writeFloatLE(r[e] / l, (o + e) * 4);
  }
  rebased.push({ clip, bone, delta });
}

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
    // Keyed by bone AND sampler: two bones may share a donor sampler, and
    // once the values are rebased into a bone's own rest frame they are no
    // longer the same numbers.
    const key = `${ch.sampler}/${ch.target.path}/${bone}`;
    let idx = samplerMap.get(key);
    if (idx == null) {
      const input = addAccessor(rawAccessor(B.json, B.bin, s.input));
      const out = rawAccessor(B.json, B.bin, s.output);
      if (ch.target.path === "rotation") {
        rebaseRotation(out, B.json.nodes[ch.target.node], O.json.nodes[origNode[bone]], bone, name);
      }
      const output = addAccessor(out);
      samplers.push({ input, output, interpolation: s.interpolation ?? "LINEAR" });
      idx = samplers.length - 1; samplerMap.set(key, idx);
    }
    channels.push({ sampler: idx, target: { node: origNode[bone], path: ch.target.path } });
  }
  // From the time values themselves. `accessor.max` is only carried over
  // for accessors that were already float32, so a donor with quantised
  // inputs would otherwise report every clip as 0.000s.
  const lastTime = (ai) => {
    const a = O.json.accessors[ai];
    if (a.max?.[0] != null) return a.max[0];
    const v = O.json.bufferViews[a.bufferView];
    const at = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + (a.count - 1) * 4;
    return at + 4 <= newBinLength() ? readAppended(at) : 0;
  };
  const dur = Math.max(0, ...samplers.map((s) => lastTime(s.input)));
  O.json.animations.push({ name, samplers, channels });
  console.log(`  take    "${name}"  ${dur.toFixed(3)}s  ${channels.length} channels${dropped ? `  (${dropped} non-joint/scale channels left behind)` : ""}`);
  added++;
}

const newBin = Buffer.concat([O.bin, ...extra]);

// NOTHING LEAVES HERE WITH A NaN IN IT.
//
// The int16 donor bug above shipped for weeks because a corrupt clip is
// completely silent: it loads, it reports the right duration and channel
// count, and it draws nothing. Every stage downstream — key reduction,
// quantisation, meshopt — passed it along happily, and the first hint was
// an invisible cow on a review page. A clip is cheap to check and the check
// is exact, so it runs on the way out rather than being rediscovered.
{
  const bad = [];
  for (const anim of O.json.animations ?? []) {
    for (const ch of anim.channels) {
      const s = anim.samplers[ch.sampler];
      for (const [what, ai] of [["times", s.input], ["values", s.output]]) {
        const a = O.json.accessors[ai];
        if (a.componentType !== 5126) continue;
        const v = O.json.bufferViews[a.bufferView];
        const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
        const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
        let nan = 0, zeroQuat = 0;
        for (let k = 0; k < a.count; k++) {
          let sq = 0, ok = true;
          for (let e = 0; e < n; e++) {
            const x = newBin.readFloatLE(base + (k * n + e) * 4);
            if (!Number.isFinite(x)) ok = false;
            sq += x * x;
          }
          if (!ok) nan++;
          // Only ever on the VALUES. The times accessor is SCALAR and its
          // first key is legitimately 0.0, which this would otherwise read
          // as a zero-length quaternion on every channel in the file.
          else if (what === "values" && ch.target.path === "rotation" && sq < 1e-12) zeroQuat++;
        }
        if (nan || zeroQuat) {
          const bone = O.json.nodes[ch.target.node]?.name ?? ch.target.node;
          bad.push(`${anim.name}/${bone}.${ch.target.path} ${what}: ${nan} non-finite, ${zeroQuat} zero-length quaternion(s) of ${a.count}`);
        }
      }
    }
  }
  if (bad.length) {
    console.error("\n  REFUSING TO WRITE — the spliced animation data is corrupt:");
    for (const b of bad.slice(0, 20)) console.error(`    ! ${b}`);
    if (bad.length > 20) console.error(`    ... and ${bad.length - 20} more`);
    console.error("\n  A zero-length or non-finite quaternion poses the skeleton to NaN and");
    console.error("  the model renders as nothing at all. Check the donor's accessor");
    console.error("  component types before shipping this.\n");
    process.exit(1);
  }
}

O.json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(O.json), "utf8");
const jp = (4 - (jb.length % 4)) % 4, jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (newBin.length % 4)) % 4, bc = Buffer.concat([newBin, Buffer.alloc(bp)]);
const head = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const rest = Buffer.concat([head(jc.length, 0x4e4f534a), jc, head(bc.length, 0x004e4942), bc]);
const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + rest.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, rest]));
if (rebased.length) {
  const worst = new Map();
  for (const r of rebased) if (!(worst.get(r.bone) >= r.delta)) worst.set(r.bone, r.delta);
  const shown = [...worst].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`  rebased ${rebased.length} rotation channel(s) onto this rig's rest pose:`);
  for (const [b, d] of shown) console.log(`    ${b} rests ${d.toFixed(1)}deg from the donor's`);
}
console.log(`\n  ${added} clip(s) spliced; original geometry, skin, textures and Walk untouched -> ${outPath}`);
