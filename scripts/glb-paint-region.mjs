#!/usr/bin/env node
/**
 * Paints a colour onto an atlas by WHERE THE SURFACE IS, not where the UVs
 * landed.
 *
 *   node scripts/glb-paint-region.mjs in.glb out.glb --rgb 232,222,176 \
 *     --y 0.58,0.86 --halfwidth 0.17 --front 0.25 --soften 3
 *
 * A texture generator will refuse some instructions however plainly they are
 * put. The god-stone came back with its marigold garland and its jasmine and
 * without the sandalwood paste it was asked for three times — and paste is
 * not a thing that can be nudged out of a prompt, because its whole meaning
 * is WHERE it is: a band down the front of the stone, put there by a hand.
 *
 * That is a spatial instruction, and an atlas is not a spatial thing — which
 * is exactly why this is possible here and not in an image editor. Every
 * texel belongs to a triangle, and that triangle has a position and a normal.
 * So the region can be stated in the MODEL's terms — this height band, this
 * far from the centre line, on faces looking this way — and the texels that
 * satisfy it are found rather than hunted for.
 *
 * `--soften` feathers the edge over N texels so the paste has the look of
 * something smeared on with a thumb instead of masked in.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePNG, encodePNG } from "./png-codec.mjs";

const args = process.argv.slice(2);
const str = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : args[i + 1]; };
const num = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : Number(args[i + 1]); };
const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!inPath || !outPath) { console.error("usage: glb-paint-region.mjs in.glb out.glb --rgb r,g,b --y a,b [--halfwidth f] [--front f] [--soften n] [--strength f]"); process.exit(2); }
const RGB = str("--rgb", "235,225,180").split(",").map(Number);
const [Y0, Y1] = str("--y", "0.55,0.85").split(",").map(Number);
const HALF = num("--halfwidth", 0.2);
const FRONT = num("--front", 0.25);
const SOFTEN = num("--soften", 3);
const STRENGTH = num("--strength", 0.82);

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
const UV = attr(prim.attributes.TEXCOORD_0, 2);
const ia = json.accessors[prim.indices], iv = json.bufferViews[ia.bufferView];
const ib = (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
const IDX = new Uint32Array(ia.count);
for (let i = 0; i < ia.count; i++)
  IDX[i] = ia.componentType === 5125 ? bin.readUInt32LE(ib + i * 4)
         : ia.componentType === 5123 ? bin.readUInt16LE(ib + i * 2) : bin.readUInt8(ib + i);

const imgIdx = json.textures[json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source;
const view = json.bufferViews[json.images[imgIdx].bufferView];
const tex = decodePNG(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
const { w: TW, h: TH, ch: TC } = tex;

let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (let i = 0; i < P.length / 3; i++) for (let c = 0; c < 3; c++) {
  const v = P[i * 3 + c]; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v;
}
const H = hi[1] - lo[1], WD = Math.max(hi[0] - lo[0], 1e-6);
const cx = (lo[0] + hi[0]) / 2;

// Coverage, 0..1, accumulated per texel.
const cov = new Float32Array(TW * TH);
for (let t = 0; t < IDX.length; t += 3) {
  const a = IDX[t] * 3, b = IDX[t + 1] * 3, c = IDX[t + 2] * 3;
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
  const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz) || 1; nz /= nl;
  if (nz < FRONT) continue; // not looking at the road
  const my = ((P[a + 1] + P[b + 1] + P[c + 1]) / 3 - lo[1]) / H;
  if (my < Y0 || my > Y1) continue;
  const mx = Math.abs((P[a] + P[b] + P[c]) / 3 - cx) / WD;
  if (mx > HALF) continue;
  const p = [];
  for (let k = 0; k < 3; k++) { const i2 = IDX[t + k] * 2; p.push([UV[i2] * TW, UV[i2 + 1] * TH]); }
  const [A, B, C] = p;
  const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  if (Math.abs(den) < 1e-12) continue;
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
  const x1 = Math.min(TW - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
  const y1 = Math.min(TH - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const w0 = ((B[1] - C[1]) * (x + .5 - C[0]) + (C[0] - B[0]) * (y + .5 - C[1])) / den;
    const w1 = ((C[1] - A[1]) * (x + .5 - C[0]) + (A[0] - C[0]) * (y + .5 - C[1])) / den;
    if (w0 < 0 || w1 < 0 || 1 - w0 - w1 < 0) continue;
    cov[y * TW + x] = 1;
  }
}
// Feather, so it reads as smeared rather than masked.
for (let pass = 0; pass < SOFTEN; pass++) {
  const c2 = Float32Array.from(cov);
  for (let y = 1; y < TH - 1; y++) for (let x = 1; x < TW - 1; x++) {
    const o = y * TW + x;
    cov[o] = (c2[o] * 4 + c2[o - 1] + c2[o + 1] + c2[o - TW] + c2[o + TW]) / 8;
  }
}
let painted = 0;
for (let i = 0; i < TW * TH; i++) {
  const a = cov[i] * STRENGTH;
  if (a < 0.01) continue;
  painted++;
  const o = i * TC;
  for (let c = 0; c < 3; c++) tex.data[o + c] = Math.round(tex.data[o + c] * (1 - a) + RGB[c] * a);
}

const png = encodePNG(TW, TH, TC, tex.data);
const head = bin.subarray(0, view.byteOffset ?? 0);
const tail = bin.subarray((view.byteOffset ?? 0) + view.byteLength);
const pad = (4 - (png.length % 4)) % 4;
const newBin = Buffer.concat([head, png, Buffer.alloc(pad), tail]);
const delta = png.length + pad - view.byteLength;
view.byteLength = png.length;
for (const v of json.bufferViews) if ((v.byteOffset ?? 0) > (view.byteOffset ?? 0)) v.byteOffset += delta;
json.buffers[0].byteLength = newBin.length;
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jpad = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const mk = (len, ty) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(ty, 4); return b; };
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4);
hdr.writeUInt32LE(12 + 8 + jpad.length + 8 + newBin.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, mk(jpad.length, 0x4e4f534a), jpad, mk(newBin.length, 0x004e4942), newBin]));
console.log(`  painted ${((painted / (TW * TH)) * 100).toFixed(2)}% of the atlas, rgb(${RGB.join(",")}) at ${STRENGTH}`);
