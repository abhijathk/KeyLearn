#!/usr/bin/env node
/**
 * Renders a CHARACTER'S FACE out of a shipped GLB, as a flat avatar.
 *
 *   node scripts/glb-face.mjs in.glb out.png [--yaw 0] [--size 256] [--body]
 *
 * The picker shows one character in live 3-D and everybody else as a
 * portrait, which only works if the portraits are the same people. Drawn
 * avatars would be a second cast to keep in step with the first: rename
 * somebody, retexture them, swap a model, and the face beside their name is
 * quietly of a different character.
 *
 * So the faces come out of the models themselves, offline, once. A 256px PNG
 * is a few kilobytes against a megabyte of skinned, animated GLB — which is
 * the whole reason only one of them is ever live at a time.
 *
 * WHY THIS EXISTS RATHER THAN `glb-views.mjs --tex-png`: every shipped
 * character is meshopt-compressed with KTX2 textures, and that viewer can
 * read neither. This decodes both — three's own meshopt decoder for the
 * buffers, `basisu -unpack` for the texture — and then frames the head.
 *
 * FRAMING IS MEASURED, NOT GUESSED. A fixed "top 18 per cent" crop is right
 * for one character and wrong for the next; a puppy is mostly head and a
 * robot is mostly not. This renders the silhouette, walks down it from the
 * crown until the width stops falling, and calls that the neck — which is
 * what a neck is.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodePNG, encodePNG } from "./png-codec.mjs";
import { MeshoptDecoder } from "../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js";

/* ── the container ──────────────────────────────────────────────────── */

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

/**
 * Every bufferView, decompressed if it needs to be.
 *
 * `EXT_meshopt_compression` replaces a view's bytes with a codec stream and
 * describes how to expand it in the extension block. Resolved up front for
 * the whole file rather than per accessor, because several accessors share
 * one view and decoding it twice is both slower and a chance to disagree.
 */
async function views(json, bin) {
  await MeshoptDecoder.ready;
  return (json.bufferViews ?? []).map((v) => {
    const mo = v.extensions?.EXT_meshopt_compression;
    if (mo == null) {
      const o = v.byteOffset ?? 0;
      return Buffer.from(bin.subarray(o, o + v.byteLength));
    }
    const src = bin.subarray(
      mo.byteOffset ?? 0,
      (mo.byteOffset ?? 0) + mo.byteLength,
    );
    const out = new Uint8Array(mo.count * mo.byteStride);
    MeshoptDecoder.decodeGltfBuffer(
      out, mo.count, mo.byteStride, src, mo.mode, mo.filter,
    );
    return Buffer.from(out);
  });
}

const CT = { 5120: [1, "Int8"], 5121: [1, "UInt8"], 5122: [2, "Int16"], 5123: [2, "UInt16"], 5125: [4, "UInt32"], 5126: [4, "Float"] };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function accessor(json, bufs, i) {
  const a = json.accessors[i];
  const v = json.bufferViews[a.bufferView];
  const buf = bufs[a.bufferView];
  const [sz, kind] = CT[a.componentType], n = NC[a.type];
  // A decompressed view is exactly its own bytes, so the accessor's offset is
  // relative to the view and NOT to the file — which is the one thing that
  // silently produces a plausible, wrong mesh if it is got backwards.
  const stride = v.byteStride || sz * n;
  const base = a.byteOffset ?? 0;
  const out = new Float64Array(a.count * n);
  const read = `read${kind}${sz === 1 ? "" : "LE"}`;
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < n; c++)
      out[k * n + c] = buf[read](base + k * stride + c * sz);
  if (a.normalized) {
    const d = a.componentType === 5122 ? 32767 : a.componentType === 5123 ? 65535
            : a.componentType === 5120 ? 127 : a.componentType === 5121 ? 255 : 1;
    for (let j = 0; j < out.length; j++) out[j] = Math.max(out[j] / d, -1);
  }
  return { data: out, n, count: a.count };
}

/* ── the texture ────────────────────────────────────────────────────── */

/**
 * The base colour map, through `basisu -unpack`.
 *
 * It writes a small family of files next to its input — one per GPU format,
 * plus the PNGs — so this takes the RGB or RGBA unpack and ignores the rest.
 * A character with no readable map still renders; a shaded silhouette is
 * enough to check the framing, and the framing is what this script decides.
 */
function atlas(json, bufs) {
  const mat = json.materials?.[0];
  const ti = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
  if (ti == null) return null;
  const tex = json.textures[ti];
  const src = tex.extensions?.KHR_texture_basisu?.source ?? tex.source;
  if (src == null) return null;
  const img = json.images[src];
  if (img.bufferView == null) return null;
  const bytes = bufs[img.bufferView];
  const dir = mkdtempSync(join(tmpdir(), "glbface-"));
  const ktx = join(dir, "t.ktx2");
  writeFileSync(ktx, bytes);
  try {
    execFileSync("basisu", ["-unpack", "-no_ktx", "-file", ktx], {
      cwd: dir, stdio: "ignore",
    });
  } catch {
    return null;
  }
  const png = readdirSync(dir)
    .filter((f) => f.endsWith(".png") && /_unpacked_(rgba|rgb)_/.test(f))
    // Level 0. The unpack writes every mip, and `_0000` sorts first anyway,
    // but relying on that is relying on a filename.
    .sort((a, b) => (/_0000/.test(b) ? 1 : 0) - (/_0000/.test(a) ? 1 : 0))[0];
  return png == null ? null : decodePNG(readFileSync(join(dir, png)));
}

/* ── the raster ─────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const file = args[0], out = args[1];
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i > 0 ? Number(args[i + 1]) : d;
};
const YAW = opt("--yaw", 0);
const SIZE = opt("--size", 256);
const BODY = args.includes("--body");

const { json, bin } = readGLB(file);
const bufs = await views(json, bin);
const prim = json.meshes[0].primitives[0];
const P = accessor(json, bufs, prim.attributes.POSITION);
const I = accessor(json, bufs, prim.indices);
const UV = prim.attributes.TEXCOORD_0 != null
  ? accessor(json, bufs, prim.attributes.TEXCOORD_0) : null;
{
  // KHR_mesh_quantization puts the dequantisation on the NODE, so positions
  // are integers until this runs. Skipping it renders a unit cube's worth of
  // confetti, which at least fails loudly.
  const nd = json.nodes.find((n) => n.mesh === 0) ?? json.nodes[0];
  const sc = nd?.scale ?? [1, 1, 1], tr = nd?.translation ?? [0, 0, 0];
  for (let i = 0; i < P.count; i++)
    for (let c = 0; c < 3; c++)
      P.data[i * 3 + c] = P.data[i * 3 + c] * sc[c] + tr[c];
}
const TEX = atlas(json, bufs);
/**
 * KHR_texture_transform, applied to the UVs before they are sampled.
 *
 * A re-export of Dave arrived carrying `scale: [16.0034, 16.0030]` on its
 * base colour texture — every UV in the file is a sixteenth of where it
 * actually reads. Sampled raw, the whole character is coloured from one
 * corner tile of its own atlas, which came out as the hoodie's blue running
 * through his hair and no face at all. It looked like a broken export and
 * was a perfectly good one this script could not read.
 *
 * Wrapped rather than clamped, because that is what a scale above one is
 * FOR: the tile repeats, and clamping it would pin every UV past the first
 * tile to the atlas edge.
 */
const XF = (() => {
  const t =
    json.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.extensions
      ?.KHR_texture_transform;
  if (t == null) return null;
  const [sx, sy] = t.scale ?? [1, 1];
  const [ox, oy] = t.offset ?? [0, 0];
  return { sx, sy, ox, oy, rot: t.rotation ?? 0 };
})();
if (XF) {
  console.log(
    `  KHR_texture_transform: scale ${XF.sx.toFixed(4)},${XF.sy.toFixed(4)} ` +
      `offset ${XF.ox},${XF.oy}${XF.rot ? ` rotation ${XF.rot}` : ""}`,
  );
}
/** One UV through the transform, wrapped into the unit square. */
const uvAt = (u, v) => {
  if (XF == null) return [u, v];
  let a = u;
  let b = v;
  if (XF.rot) {
    const c = Math.cos(XF.rot);
    const s2 = Math.sin(XF.rot);
    [a, b] = [c * a + s2 * b, -s2 * a + c * b];
  }
  a = a * XF.sx + XF.ox;
  b = b * XF.sy + XF.oy;
  return [a - Math.floor(a), b - Math.floor(b)];
};

let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < P.count; i++) for (let c = 0; c < 3; c++) {
  const v = P.data[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v;
}
const ctr = mn.map((v, c) => (v + mx[c]) / 2);
const ext = Math.max(...mx.map((v, c) => v - mn[c])) * 0.56;

// Rendered large and cropped down rather than rendered at the crop: the head
// is a fraction of the frame, and a 256px full body gives a 60px face.
const S = 1024;
const zbuf = new Float64Array(S * S).fill(-1e9);
const px = new Uint8Array(S * S * 3);
const hit = new Uint8Array(S * S);
const a = (YAW * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);

for (let t = 0; t < I.count; t += 3) {
  const pts = [], uvs = [];
  for (let k = 0; k < 3; k++) {
    const idx = I.data[t + k];
    const x = P.data[idx * 3] - ctr[0];
    const y = P.data[idx * 3 + 1] - ctr[1];
    const z = P.data[idx * 3 + 2] - ctr[2];
    const rx = x * ca - z * sa, rz = x * sa + z * ca;
    pts.push([(rx / ext) * (S / 2) + S / 2, S / 2 - (y / ext) * (S / 2), rz]);
    if (UV && TEX) uvs.push([UV.data[idx * 2], UV.data[idx * 2 + 1]]);
  }
  const [A, B, C] = pts;
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
  const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  const lit = Math.max(0.42, Math.min(1.12, 0.55 + 0.5 * Math.abs(0.4 * nx - 0.5 * ny + 0.75 * nz)));
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
    zbuf[o] = z; hit[o] = 1;
    let r = 205, g = 205, b = 205;
    if (uvs.length === 3 && TEX) {
      const u = w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0];
      const vv = w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1];
      const [uu, uvv] = uvAt(u, vv);
      const tx = Math.max(0, Math.min(TEX.w - 1, Math.floor(uu * TEX.w)));
      const ty = Math.max(0, Math.min(TEX.h - 1, Math.floor(uvv * TEX.h)));
      const to = (ty * TEX.w + tx) * TEX.ch;
      r = TEX.data[to]; g = TEX.data[to + 1]; b = TEX.data[to + 2];
    }
    px[o * 3] = Math.min(255, r * lit);
    px[o * 3 + 1] = Math.min(255, g * lit);
    px[o * 3 + 2] = Math.min(255, b * lit);
  }
}

/* ── the crop ───────────────────────────────────────────────────────── */

// Silhouette width per row, and the left/right edge of each.
const wide = new Int32Array(S), lo = new Int32Array(S).fill(S), hi = new Int32Array(S).fill(-1);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  if (hit[y * S + x] === 0) continue;
  wide[y]++; if (x < lo[y]) lo[y] = x; if (x > hi[y]) hi[y] = x;
}
let top = 0; while (top < S && wide[top] === 0) top++;
let bot = S - 1; while (bot > top && wide[bot] === 0) bot--;
const tall = bot - top;

let box;
if (BODY || tall < 8) {
  box = { y0: top, y1: bot, cx: (lo[top] + hi[bot]) / 2 };
} else {
  // THE NECK IS WHERE THE WIDTH STOPS FALLING. Down from the crown the head
  // widens to the cheeks and then narrows; the first row after that minimum
  // is the shoulders starting. Searched only over the top THIRD, so a waist
  // can never be mistaken for a neck — at 45 per cent Peeli's crop reached
  // the search limit and came back as head plus most of a jacket.
  const limit = top + Math.round(tall * 0.32);
  let peak = top, peakW = 0;
  for (let y = top; y <= limit; y++) if (wide[y] > peakW) { peakW = wide[y]; peak = y; }
  let neck = limit, neckW = Infinity;
  for (let y = peak; y <= limit; y++) if (wide[y] <= neckW) { neckW = wide[y]; neck = y; }
  // A head that is most of the animal (the puppy) has no waist to find, so
  // the minimum lands at the very bottom of the search and the crop is the
  // whole search window — which for those is the right answer anyway.
  let sx = 0, n = 0;
  for (let y = top; y <= neck; y++) { sx += (lo[y] + hi[y]) / 2; n++; }
  box = { y0: top, y1: neck, cx: sx / Math.max(1, n) };
}

// Square, with room round the head: a portrait cropped to the skull reads as
// a mugshot, and these sit in a row at 7 per cent of the screen.
//
// SIZED ON WHICHEVER WAY THE HEAD IS BIGGER. Off the height alone the two
// animals came out jammed against both edges with their ears cut off — a
// puppy's head is wider than it is tall, and so is a buffalo's once the
// horns are counted. The people are unaffected, a human head being the other
// way round, which is exactly why height alone looked correct until an
// animal turned up.
let hw = 0;
for (let y = box.y0; y <= box.y1; y++)
  if (hi[y] >= 0) hw = Math.max(hw, Math.abs(hi[y] - box.cx), Math.abs(box.cx - lo[y]));
const half = Math.max(8, ((box.y1 - box.y0) / 2) * 1.22, hw * 1.16);
const cy = (box.y0 + box.y1) / 2;
const img = Buffer.alloc(SIZE * SIZE * 4, 0);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  const sxp = Math.round(box.cx - half + (x / SIZE) * half * 2);
  const syp = Math.round(cy - half + (y / SIZE) * half * 2);
  const d = (y * SIZE + x) * 4;
  if (sxp < 0 || sxp >= S || syp < 0 || syp >= S || hit[syp * S + sxp] === 0) continue;
  const o = (syp * S + sxp) * 3;
  img[d] = px[o]; img[d + 1] = px[o + 1]; img[d + 2] = px[o + 2]; img[d + 3] = 255;
}
writeFileSync(out, encodePNG(SIZE, SIZE, 4, img));
console.log(
  `${file.split("/").pop()} -> ${out}  yaw ${YAW}  ` +
  `${TEX ? `tex ${TEX.w}x${TEX.h}` : "UNTEXTURED"}  ` +
  `crop y${box.y0}-${box.y1} of ${top}-${bot}`,
);
