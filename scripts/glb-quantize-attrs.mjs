/**
 * Quantize the two mesh attributes glTF lets you shrink WITHOUT an extension.
 *
 *   node scripts/glb-quantize-attrs.mjs in.glb out.glb
 *
 * The puppy's skin weights ship as float32 VEC4 - 724 KB, the single largest
 * attribute in the file, and by some distance the most wasteful. A skin weight
 * is a number between 0 and 1 that gets multiplied by a bone matrix; 24 bits of
 * mantissa on it is meaningless when four of them must sum to exactly 1 anyway.
 * glTF CORE already allows WEIGHTS_n as normalized unsigned byte and TEXCOORD_n
 * as normalized unsigned short, so this needs no KHR_mesh_quantization and no
 * loader support beyond the base spec - every engine that reads glTF reads this.
 *
 * POSITION and NORMAL are deliberately left alone: shrinking those DOES require
 * the extension, and it is not worth trading universal compatibility for on a
 * file that fits without it.
 *
 * The weights are re-normalized IN the 8-bit domain - the four bytes are made
 * to sum to exactly 255 by giving the rounding remainder to the largest
 * component. Rounding each weight independently leaves sums of 254 or 256,
 * which shows up as vertices that subtly shrink or swell as they animate.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const [inPath, outPath] = args.filter((a) => !a.startsWith("--"));
if (!inPath || !outPath) { console.error("usage: glb-quantize-attrs.mjs in.glb out.glb"); process.exit(2); }

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}

const extra = [];
let cursor = bin.length;
function appendView(buf) {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { extra.push(Buffer.alloc(pad)); cursor += pad; }
  json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length });
  extra.push(buf); cursor += buf.length;
  return json.bufferViews.length - 1;
}
const readVec = (accIndex, comps) => {
  const a = json.accessors[accIndex], v = json.bufferViews[a.bufferView];
  const stride = v.byteStride || comps * 4;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < comps; c++) row.push(bin.readFloatLE(base + k * stride + c * 4));
    out.push(row);
  }
  return out;
};

let saved = 0;
const report = [];
for (const mesh of json.meshes ?? []) {
  for (const prim of mesh.primitives ?? []) {
    // ── WEIGHTS_n -> normalized unsigned byte ───────────────────────────
    for (const key of Object.keys(prim.attributes)) {
      if (!/^WEIGHTS_/.test(key)) continue;
      const ai = prim.attributes[key], a = json.accessors[ai];
      if (a.componentType !== 5126) continue;          // already compact
      const rows = readVec(ai, 4);
      const buf = Buffer.alloc(rows.length * 4);
      for (let i = 0; i < rows.length; i++) {
        const w = rows[i];
        const sum = w[0] + w[1] + w[2] + w[3];
        const norm = sum > 1e-8 ? w.map((x) => x / sum) : [1, 0, 0, 0];
        const q = norm.map((x) => Math.round(x * 255));
        // Force the four bytes to sum to exactly 255. Rounding each in
        // isolation leaves 254 or 256, and a vertex whose weights do not sum
        // to one quietly scales as the bones move.
        let s = q[0] + q[1] + q[2] + q[3];
        if (s !== 255) {
          let big = 0;
          for (let c = 1; c < 4; c++) if (q[c] > q[big]) big = c;
          q[big] += 255 - s;
          if (q[big] < 0) q[big] = 0;
        }
        for (let c = 0; c < 4; c++) buf.writeUInt8(q[c], i * 4 + c);
      }
      const before = json.bufferViews[a.bufferView].byteLength;
      const bv = appendView(buf);
      json.accessors[ai] = { bufferView: bv, componentType: 5121, normalized: true,
                             count: rows.length, type: "VEC4" };
      saved += before - buf.length;
      report.push(`${key}: f32 -> u8 normalized, ${(before/1024).toFixed(0)}KB -> ${(buf.length/1024).toFixed(0)}KB`);
    }
    // ── NORMAL -> normalized signed short, behind KHR_mesh_quantization ──
    // This one DOES need the extension, because glTF core insists NORMAL is
    // float. Signed short rather than signed byte: a byte gives about 0.45
    // degrees of angular resolution, which bands visibly across a smooth flank,
    // while a short is finer than the lighting can show. Opt in with --normals,
    // because the extension is a real (if widely met) requirement on the loader.
    if (args.includes("--normals")) for (const key of Object.keys(prim.attributes)) {
      if (key !== "NORMAL") continue;
      const ai = prim.attributes[key], a = json.accessors[ai];
      if (a.componentType !== 5126) continue;
      const rows = readVec(ai, 3);
      // TIGHTLY PACKED, 6 bytes per normal, with no byteStride on the view.
      // A padded 8-byte stride is also legal, and the meshopt pass downstream
      // groups views by element size and silently dropped the strided one -
      // leaving an accessor pointing at a bufferView that no longer existed.
      // The file was the right size and failed to open in three.js.
      const buf = Buffer.alloc(rows.length * 6);
      for (let i = 0; i < rows.length; i++) {
        const n = rows[i];
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        for (let c = 0; c < 3; c++) {
          let q = Math.round((n[c] / l) * 32767);
          if (q > 32767) q = 32767; if (q < -32767) q = -32767;
          buf.writeInt16LE(q, i * 6 + c * 2);
        }
      }
      const before = json.bufferViews[a.bufferView].byteLength;
      const bv = appendView(buf);
      json.accessors[ai] = { bufferView: bv, componentType: 5122, normalized: true,
                             count: rows.length, type: "VEC3" };
      json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), "KHR_mesh_quantization"])];
      json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), "KHR_mesh_quantization"])];
      saved += before - buf.length;
      report.push(`${key}: f32 -> i16 normalized (KHR_mesh_quantization), ${(before/1024).toFixed(0)}KB -> ${(buf.length/1024).toFixed(0)}KB`);
    }
    // ── TEXCOORD_n -> normalized unsigned short, ONLY if UVs are in [0,1] ─
    for (const key of Object.keys(prim.attributes)) {
      if (!/^TEXCOORD_/.test(key)) continue;
      const ai = prim.attributes[key], a = json.accessors[ai];
      if (a.componentType !== 5126) continue;
      const rows = readVec(ai, 2);
      let lo = Infinity, hi = -Infinity;
      for (const r of rows) for (const x of r) { if (x < lo) lo = x; if (x > hi) hi = x; }
      if (lo < 0 || hi > 1) {
        // Outside the unit square a normalized short cannot represent the UVs,
        // and forcing it would wrap the texture. Left as float, and said so.
        report.push(`${key}: LEFT AS FLOAT - UVs run ${lo.toFixed(2)}..${hi.toFixed(2)}, outside [0,1]`);
        continue;
      }
      const buf = Buffer.alloc(rows.length * 4);
      for (let i = 0; i < rows.length; i++) {
        buf.writeUInt16LE(Math.round(Math.min(1, Math.max(0, rows[i][0])) * 65535), i * 4);
        buf.writeUInt16LE(Math.round(Math.min(1, Math.max(0, rows[i][1])) * 65535), i * 4 + 2);
      }
      const before = json.bufferViews[a.bufferView].byteLength;
      const bv = appendView(buf);
      json.accessors[ai] = { bufferView: bv, componentType: 5123, normalized: true,
                             count: rows.length, type: "VEC2" };
      saved += before - buf.length;
      report.push(`${key}: f32 -> u16 normalized, ${(before/1024).toFixed(0)}KB -> ${(buf.length/1024).toFixed(0)}KB`);
    }
  }
}

// ── prune ───────────────────────────────────────────────────────────────
// Replacing an accessor leaves its old float data sitting in the buffer,
// referenced by nothing. Appending 181 KB while orphaning 724 KB makes the file
// BIGGER, and the meshopt pass downstream cannot help: it compresses the views
// it is given and has no way to know which are dead. So the buffer is rebuilt
// here from the views something actually points at.
const live = new Set();
for (const a of json.accessors) { if (a.bufferView != null) live.add(a.bufferView); }
for (const im of json.images ?? []) if (im.bufferView != null) live.add(im.bufferView);
for (const s2 of json.skins ?? []) if (s2.inverseBindMatrices != null) {
  const a = json.accessors[s2.inverseBindMatrices]; if (a?.bufferView != null) live.add(a.bufferView);
}
const combined = Buffer.concat([bin, ...extra]);
const remap = new Map();
const parts = []; let outLen = 0;
const newViews = [];
for (let i = 0; i < json.bufferViews.length; i++) {
  if (!live.has(i)) continue;
  const v = json.bufferViews[i];
  const pad = (4 - (outLen % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); outLen += pad; }
  const slice = combined.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  const nv = { buffer: 0, byteOffset: outLen, byteLength: v.byteLength };
  if (v.byteStride != null) nv.byteStride = v.byteStride;
  if (v.target != null) nv.target = v.target;
  remap.set(i, newViews.length);
  newViews.push(nv); parts.push(slice); outLen += v.byteLength;
}
const dropped = json.bufferViews.length - newViews.length;
json.bufferViews = newViews;
// An accessor whose view was pruned would get `undefined` here and break the
// loader; the quantizer REPLACES accessors in place so it should never happen,
// but a silent undefined is exactly the failure that ships.
for (const a of json.accessors) if (a.bufferView != null) {
  const r = remap.get(a.bufferView);
  if (r === undefined) throw new Error(`accessor references pruned bufferView ${a.bufferView}`);
  a.bufferView = r;
}
for (const im of json.images ?? []) if (im.bufferView != null) im.bufferView = remap.get(im.bufferView);
console.log(`  pruned ${dropped} orphaned bufferView(s)`);
const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jb.length % 4)) % 4, jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (newBin.length % 4)) % 4, bc = Buffer.concat([newBin, Buffer.alloc(bp)]);
const chunk = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const total = 12 + 8 + jc.length + 8 + bc.length;
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([hdr, chunk(jc.length, 0x4e4f534a), jc, chunk(bc.length, 0x004e4942), bc]));
for (const r of report) console.log("  " + r);
console.log(`saved ${(saved/1024).toFixed(0)} KB of attribute data (orphaned views are pruned by the meshopt pass)`);
console.log(`wrote ${outPath}  ${total.toLocaleString()} bytes`);
