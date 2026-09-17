#!/usr/bin/env node
/**
 * Renders a GLB from four sides, so a prop can be LOOKED at without a browser.
 *
 *   node scripts/glb-views.mjs in.glb out.png [--tex-from other.glb]
 *
 * Written to answer one question that nothing else here could: WHICH WAY DOES
 * THIS BUILDING FACE. A bake arrives as a bounding box and a 2048px atlas, and
 * the front is only obvious once the door is on screen. A silhouette is not
 * enough — every side of a house is a house-shaped blob — so this samples the
 * baseColor map, which is where the doors and windows actually are.
 *
 * It is also the check on a decimation: sloppy simplification smears an atlas
 * in a way that a triangle count cannot show you, and four textured views will.
 *
 * `--tex-from` borrows the atlas from another file, which is how a decimated
 * mesh whose texture is already a GPU format gets previewed: UVs survive
 * simplification, so the original PNG is a faithful stand-in.
 *
 * Reads plain float bakes and KHR_mesh_quantization alike; a mesh whose
 * texture is KTX2 renders untextured unless `--tex-from` points somewhere.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePNG, encodePNG } from "./png-codec.mjs";

function readGLB(f) {
  const src = readFileSync(f);
  let off = 12, json = null, bin = null;
  while (off + 8 <= src.length) {
    const l = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
    const b = src.subarray(off + 8, off + 8 + l);
    if (t === 0x4e4f534a) json = JSON.parse(b.toString("utf8"));
    if (t === 0x004e4942) bin = b;
    off += 8 + l;
  }
  return { json, bin };
}
const CT = { 5120: [1, "Int8"], 5121: [1, "UInt8"], 5122: [2, "Int16"], 5123: [2, "UInt16"], 5125: [4, "UInt32"], 5126: [4, "Float"] };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function accessor(json, bin, i) {
  const a = json.accessors[i], v = json.bufferViews[a.bufferView];
  const [sz, kind] = CT[a.componentType], n = NC[a.type];
  const stride = v.byteStride || sz * n;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * n);
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < n; c++)
      out[k * n + c] = bin[`read${kind}${sz === 1 ? "" : "LE"}`](base + k * stride + c * sz);
  if (a.normalized) {
    const d = a.componentType === 5122 ? 32767 : a.componentType === 5123 ? 65535
            : a.componentType === 5120 ? 127 : a.componentType === 5121 ? 255 : 1;
    for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i] / d, -1);
  }
  return { data: out, n, count: a.count };
}

const file = process.argv[2], out = process.argv[3];
const { json, bin } = readGLB(file);
const prim = json.meshes[0].primitives[0];
const P = accessor(json, bin, prim.attributes.POSITION);
const I = accessor(json, bin, prim.indices);
const UV = prim.attributes.TEXCOORD_0 != null ? accessor(json, bin, prim.attributes.TEXCOORD_0) : null;
{
  const nd = json.nodes.find((n) => n.mesh === 0) ?? json.nodes[0];
  const sc = nd?.scale ?? [1, 1, 1], tr = nd?.translation ?? [0, 0, 0];
  if (sc.some((v) => v !== 1) || tr.some((v) => v !== 0))
    for (let i = 0; i < P.count; i++) for (let c = 0; c < 3; c++)
      P.data[i * 3 + c] = P.data[i * 3 + c] * sc[c] + tr[c];
}
const texArg = process.argv.indexOf("--tex-from");
const texSrc = texArg > 0 ? readGLB(process.argv[texArg + 1]) : { json, bin };
let TEX = null;
{
  const tj = texSrc.json, tb = texSrc.bin;
  const mat = tj.materials[0];
  const ti = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
  if (ti != null && tj.images?.[0]?.mimeType === "image/png") {
    const im = tj.images[tj.textures[ti].source ?? 0];
    const bv = tj.bufferViews[im.bufferView];
    const raw = tb.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    TEX = decodePNG(raw);
    // `--tex-size N` box-filters the atlas down before sampling, which is how
    // a resolution is DECIDED rather than argued about: the question "is 768
    // enough" has a picture as its answer and nothing else.
    const szArg = process.argv.indexOf("--tex-size");
    if (szArg > 0) {
      const n = Number(process.argv[szArg + 1]);
      const k = Math.max(1, Math.round(TEX.w / n));
      if (k > 1) {
        const w2 = Math.floor(TEX.w / k), h2 = Math.floor(TEX.h / k);
        const d2 = Buffer.alloc(w2 * h2 * TEX.ch);
        for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
          for (let c = 0; c < TEX.ch; c++) {
            let sum = 0;
            for (let j = 0; j < k; j++) for (let i = 0; i < k; i++)
              sum += TEX.data[(((y * k + j) * TEX.w) + (x * k + i)) * TEX.ch + c];
            d2[(y * w2 + x) * TEX.ch + c] = Math.round(sum / (k * k));
          }
        }
        TEX = { w: w2, h: h2, ch: TEX.ch, data: d2 };
      }
    }
    console.log(`  baseColor ${TEX.w}x${TEX.h} ch${TEX.ch}`);
  }
}

let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < P.count; i++) for (let c = 0; c < 3; c++) {
  const v = P.data[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v;
}
const ctr = mn.map((v, c) => (v + mx[c]) / 2);
const ext = Math.max(...mx.map((v, c) => v - mn[c])) * 0.58;

const S = 360, PAD = 8;
// yaw: 0 = looking from +Z (front), 90 = from +X (right), 180 = from -Z (back), 270 = from -X
const VIEWS = [["+Z", 0], ["+X", 90], ["-Z", 180], ["-X", 270]];
const W = (S + PAD) * VIEWS.length + PAD, H = S + PAD * 2 + 16;
const img = Buffer.alloc(W * H * 3, 0x1a);

for (let vi = 0; vi < VIEWS.length; vi++) {
  const [, deg] = VIEWS[vi];
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const ox = PAD + vi * (S + PAD);
  const zbuf = new Float64Array(S * S).fill(-1e9);
  const px = new Uint8Array(S * S * 3);
  const tri = [0, 0, 0];
  for (let t = 0; t < I.count; t += 3) {
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const idx = I.data[t + k];
      const x = P.data[idx * 3] - ctr[0], y = P.data[idx * 3 + 1] - ctr[1], z = P.data[idx * 3 + 2] - ctr[2];
      // rotate about Y so the chosen side faces the camera (camera on +Z)
      const rx = x * ca - z * sa, rz = x * sa + z * ca;
      pts.push([ (rx / ext) * (S / 2) + S / 2, S / 2 - (y / ext) * (S / 2), rz ]);
    }
    const [A, B, C] = pts;
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const lit = Math.max(0.35, Math.min(1.1, 0.5 + 0.55 * Math.abs(0.45 * nx - 0.55 * ny + 0.7 * nz)));
    const uvs = [];
    if (UV && TEX) for (let k = 0; k < 3; k++) {
      const idx = I.data[t + k];
      uvs.push([UV.data[idx * 2], UV.data[idx * 2 + 1]]);
    }
    const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
    const maxX = Math.min(S - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
    const maxY = Math.min(S - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(den) < 1e-12) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const w0 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / den;
      const w1 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / den;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
      const o = y * S + x;
      if (z <= zbuf[o]) continue;
      zbuf[o] = z;
      let r = 200, gg = 200, bb = 200;
      if (uvs.length === 3) {
        const u = w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0];
        const vv = w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1];
        const tx = Math.max(0, Math.min(TEX.w - 1, Math.floor(u * TEX.w)));
        const ty = Math.max(0, Math.min(TEX.h - 1, Math.floor(vv * TEX.h)));
        const to = (ty * TEX.w + tx) * TEX.ch;
        r = TEX.data[to]; gg = TEX.data[to + 1]; bb = TEX.data[to + 2];
      }
      px[o * 3] = Math.min(255, r * lit); px[o * 3 + 1] = Math.min(255, gg * lit); px[o * 3 + 2] = Math.min(255, bb * lit);
    }
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = ((y + PAD) * W + ox + x) * 3, o = (y * S + x) * 3;
    img[d] = px[o] || 0x1a; img[d + 1] = px[o + 1] || 0x1a; img[d + 2] = px[o + 2] || 0x1a;
  }
}
writeFileSync(out, encodePNG(W, H, 3, img));
console.log(`${file.split("/").pop()} -> ${out}  [views: ${VIEWS.map(v=>v[0]).join("  ")}]`);
