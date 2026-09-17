#!/usr/bin/env node
/**
 * Blanks the parts of a baked atlas that only the BACK of a building uses.
 *
 *   node scripts/glb-blank-back.mjs in.glb out.glb [--dilate 12] [--back -z]
 *
 * These buildings stand beside a road and are placed with no rotation, so the
 * player sees their +Z face and, obliquely, their two ends. The -Z wall is
 * never once in frame. It is still baked at the same texel density as the
 * porch, and on a 2048px atlas that is a quarter of the file spent on a wall
 * nobody will ever see.
 *
 * WHAT THIS DOES NOT DO IS DELETE THE GEOMETRY. A wall that is gone stops
 * occluding, stops casting, and opens a hole the moment the camera yaws --
 * and this camera does yaw, by twelve degrees. The triangles stay exactly
 * where they are. What goes is the DETAIL: every texel that only back-facing
 * triangles read is flooded with the atlas's own average colour, so the wall
 * is still a wall of roughly the right shade and ETC1S, which is a block
 * codec, spends almost nothing on a field that no longer varies.
 *
 * THE DILATION IS NOT OPTIONAL. A texel is not sampled on its own: bilinear
 * reads its neighbours and every mip level averages a wider footprint still,
 * so blanking right up to the edge of a kept island bleeds flat colour into
 * the visible face as it shrinks on screen -- which is exactly when it would
 * be noticed and exactly the bug that is hard to see in a still. The kept
 * mask is grown by `--dilate` texels first, measured at the SOURCE
 * resolution, so the margin survives the downscale to 1024 further down the
 * pipeline with room to spare.
 *
 * A face counts as back-facing on its own normal, not on where it sits: the
 * inside of that same back wall faces +Z, is visible through an open door,
 * and is kept.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePNG, encodePNG } from "./png-codec.mjs";

const args = process.argv.slice(2);
const num = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : Number(args[i + 1]); };
const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!inPath || !outPath) { console.error("usage: glb-blank-back.mjs in.glb out.glb [--dilate 12]"); process.exit(2); }
const DILATE = num("--dilate", 12);
/** How square-on a face must point away before it counts as back. */
const BACK = -0.30;

// ── glb ────────────────────────────────────────────────────────────────
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
  for (let k = 0; k < a.count; k++) for (let c = 0; c < comps; c++) {
    const p = base + k * stride + c * sz;
    out[k * comps + c] = a.componentType === 5126 ? bin.readFloatLE(p)
      : a.componentType === 5123 ? (a.normalized ? bin.readUInt16LE(p) / 65535 : bin.readUInt16LE(p))
      : a.componentType === 5122 ? (a.normalized ? Math.max(bin.readInt16LE(p) / 32767, -1) : bin.readInt16LE(p))
      : a.componentType === 5121 ? (a.normalized ? bin.readUInt8(p) / 255 : bin.readUInt8(p))
      : bin.readInt8(p);
  }
  return out;
}
const prim = json.meshes[0].primitives[0];
const P = attr(prim.attributes.POSITION, 3);
const UV = attr(prim.attributes.TEXCOORD_0, 2);
const ia = json.accessors[prim.indices], iv = json.bufferViews[ia.bufferView];
const ibase = (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
const IDX = new Uint32Array(ia.count);
for (let i = 0; i < ia.count; i++)
  IDX[i] = ia.componentType === 5125 ? bin.readUInt32LE(ibase + i * 4)
         : ia.componentType === 5123 ? bin.readUInt16LE(ibase + i * 2) : bin.readUInt8(ibase + i);

const imgIdx = json.textures[json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source;
const iview = json.bufferViews[json.images[imgIdx].bufferView];
const tex = decodePNG(bin.subarray(iview.byteOffset ?? 0, (iview.byteOffset ?? 0) + iview.byteLength));
const { w: TW, h: TH, ch: TC } = tex;

// ── which triangles does the player see ────────────────────────────────
const keep = new Uint8Array(IDX.length / 3);
let back = 0;
for (let t = 0; t < IDX.length; t += 3) {
  const a = IDX[t] * 3, b = IDX[t + 1] * 3, c = IDX[t + 2] * 3;
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
  const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  const isBack = nz / len < BACK;
  keep[t / 3] = isBack ? 0 : 1;
  if (isBack) back++;
}

// ── the atlas those triangles read ─────────────────────────────────────
let mask = new Uint8Array(TW * TH);
function raster(t) {
  const p = [];
  for (let k = 0; k < 3; k++) { const i = IDX[t + k] * 2; p.push([UV[i] * TW, UV[i + 1] * TH]); }
  const [A, B, C] = p;
  const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  if (Math.abs(den) < 1e-12) return;
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])) - 1);
  const x1 = Math.min(TW - 1, Math.ceil(Math.max(A[0], B[0], C[0])) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])) - 1);
  const y1 = Math.min(TH - 1, Math.ceil(Math.max(A[1], B[1], C[1])) + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const w0 = ((B[1] - C[1]) * (x + 0.5 - C[0]) + (C[0] - B[0]) * (y + 0.5 - C[1])) / den;
    const w1 = ((C[1] - A[1]) * (x + 0.5 - C[0]) + (A[0] - C[0]) * (y + 0.5 - C[1])) / den;
    const w2 = 1 - w0 - w1;
    if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
    mask[y * TW + x] = 1;
  }
}
for (let t = 0; t < IDX.length; t += 3) if (keep[t / 3]) raster(t);
const usedBefore = mask.reduce((n, v) => n + v, 0);

// grow it, separably, so the margin costs passes rather than a radius squared
for (let pass = 0; pass < DILATE; pass++) {
  const tmp = new Uint8Array(TW * TH);
  for (let y = 0; y < TH; y++) { const r = y * TW;
    for (let x = 0; x < TW; x++) tmp[r + x] = mask[r + x] | (x > 0 ? mask[r + x - 1] : 0) | (x < TW - 1 ? mask[r + x + 1] : 0); }
  const out = new Uint8Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++)
    out[y * TW + x] = tmp[y * TW + x] | (y > 0 ? tmp[(y - 1) * TW + x] : 0) | (y < TH - 1 ? tmp[(y + 1) * TW + x] : 0);
  mask = out;
}
const kept = mask.reduce((n, v) => n + v, 0);

// ── flood the rest with the atlas's own average ────────────────────────
let r = 0, g = 0, b2 = 0;
for (let i = 0; i < TW * TH; i++) if (mask[i]) { const o = i * TC; r += tex.data[o]; g += tex.data[o + 1]; b2 += tex.data[o + 2]; }
const nk = Math.max(1, kept);
const FR = Math.round(r / nk), FG = Math.round(g / nk), FB = Math.round(b2 / nk);
for (let i = 0; i < TW * TH; i++) if (!mask[i]) {
  const o = i * TC; tex.data[o] = FR; tex.data[o + 1] = FG; tex.data[o + 2] = FB;
  if (TC === 4) tex.data[o + 3] = 255;
}

// ── write it back ──────────────────────────────────────────────────────
const newPng = encodePNG(TW, TH, TC, tex.data);
const head = bin.subarray(0, iview.byteOffset ?? 0);
const tail = bin.subarray((iview.byteOffset ?? 0) + iview.byteLength);
const pad = (4 - (newPng.length % 4)) % 4;
const newBin = Buffer.concat([head, newPng, Buffer.alloc(pad), tail]);
const delta = newPng.length + pad - iview.byteLength;
iview.byteLength = newPng.length;
for (const v of json.bufferViews) if ((v.byteOffset ?? 0) > (iview.byteOffset ?? 0)) v.byteOffset += delta;
json.buffers[0].byteLength = newBin.length;
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jpad = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const mk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4);
hdr.writeUInt32LE(12 + 8 + jpad.length + 8 + newBin.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, mk(jpad.length, 0x4e4f534a), jpad, mk(newBin.length, 0x004e4942), newBin]));

const pct = (n) => ((n / (TW * TH)) * 100).toFixed(1);
console.log(`${inPath.split("/").pop()}`);
console.log(`  ${back.toLocaleString()} of ${(IDX.length / 3).toLocaleString()} triangles face away (${((back / (IDX.length / 3)) * 100).toFixed(0)}%)`);
console.log(`  atlas: ${pct(usedBefore)}% read by kept faces, ${pct(kept)}% after a ${DILATE}px margin, ${pct(TW * TH - kept)}% flooded flat`);
