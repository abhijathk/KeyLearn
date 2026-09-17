#!/usr/bin/env node
/**
 * Renders a prop as a BILLBOARD, from the game's own camera, with alpha.
 *
 *   node scripts/glb-billboard.mjs in.glb out.png [--px 512] [--tex-png a.png]
 *
 * The far band of the road does not need geometry. The ground stops at
 * z -38 and there is a painted horizon behind it; a roof out there is never
 * walked past, never occluded by anything in front of it, and never seen
 * from any angle but one. The camera is LOCKED — the brief says so and
 * `cam.lookAt` agrees — so the flat card that ruins billboards everywhere
 * else cannot turn edge-on here. One job, one viewpoint.
 *
 * WHICH VIEWPOINT IS NOT A GUESS. It is read off the village camera rather
 * than eyeballed: position (-camX, camY, camZ) looking at (0, lookY, 0),
 * which for the village is (-10, 11, 33) -> (0, 3.6, 0) — a yaw of 16.9
 * degrees and a pitch of 12.1 down. Render at any other angle and the card's
 * painted perspective disagrees with the world's, which reads as a cardboard
 * cut-out. That is the failure billboards are blamed for and it is really a
 * failure to match the camera.
 *
 * FLAT ALBEDO, NO KEY LIGHT. The world lights this card at runtime. Baking a
 * sun into it is the one thing that would stop it being the same place at
 * two in the morning, which is the brief's own first rule.
 *
 * Orthographic, because the game is — no vanishing point, so one card is
 * correct at any depth.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePNG, encodePNG } from "./png-codec.mjs";

const args = process.argv.slice(2);
const num = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : Number(args[i + 1]); };
const str = (f) => { const i = args.indexOf(f); return i < 0 ? null : args[i + 1]; };
const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!inPath || !outPath) { console.error("usage: glb-billboard.mjs in.glb out.png [--px N] [--tex-png f]"); process.exit(2); }
const PX = num("--px", 512);
const CAMX = num("--camx", 10), CAMY = num("--camy", 11), CAMZ = num("--camz", 33), LOOKY = num("--looky", 3.6);
const YAW = Math.atan2(CAMX, CAMZ);
const PITCH = Math.atan2(CAMY - LOOKY, Math.hypot(CAMX, CAMZ));

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const l = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const b = src.subarray(off + 8, off + 8 + l);
  if (t === 0x4e4f534a) json = JSON.parse(b.toString("utf8"));
  if (t === 0x004e4942) bin = b;
  off += 8 + l;
}
const CT = { 5120: [1, "Int8"], 5121: [1, "UInt8"], 5122: [2, "Int16"], 5123: [2, "UInt16"], 5125: [4, "UInt32"], 5126: [4, "Float"] };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function accessor(i) {
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
    for (let j = 0; j < out.length; j++) out[j] = Math.max(out[j] / d, -1);
  }
  return { data: out, n, count: a.count };
}
const prim = json.meshes[0].primitives[0];
const P = accessor(prim.attributes.POSITION);
const I = accessor(prim.indices);
const UV = prim.attributes.TEXCOORD_0 != null ? accessor(prim.attributes.TEXCOORD_0) : null;
{
  const nd = json.nodes.find((n) => n.mesh === 0) ?? json.nodes[0];
  const sc = nd?.scale ?? [1, 1, 1], tr = nd?.translation ?? [0, 0, 0];
  for (let i = 0; i < P.count; i++) for (let c = 0; c < 3; c++)
    P.data[i * 3 + c] = P.data[i * 3 + c] * sc[c] + tr[c];
}
let TEX = null;
const pngPath = str("--tex-png");
if (pngPath) TEX = decodePNG(readFileSync(pngPath));
else {
  const ti = json.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.index;
  if (ti != null && json.images?.[0]?.mimeType === "image/png") {
    const im = json.images[json.textures[ti].source ?? 0];
    const bv = json.bufferViews[im.bufferView];
    TEX = decodePNG(bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength));
  }
}

// `--frame-from` measures the framing off a DIFFERENT file. Without it each
// render is fitted to its own silhouette, which is right for one prop and
// useless for two halves of one building: each would be blown up to fill the
// frame and neither could be laid over the other. Given the whole model to
// measure against, both halves land in one coordinate system and compositing
// them reconstructs the original — which is the only way to see a seam
// without opening a browser.
const frameSrc = str("--frame-from");
const framePts = frameSrc == null ? null : (() => {
  const fsrc = readFileSync(frameSrc);
  let o = 12, fj = null, fb = null;
  while (o + 8 <= fsrc.length) {
    const l = fsrc.readUInt32LE(o), t = fsrc.readUInt32LE(o + 4);
    const bb = fsrc.subarray(o + 8, o + 8 + l);
    if (t === 0x4e4f534a) fj = JSON.parse(bb.toString("utf8"));
    if (t === 0x004e4942) fb = bb;
    o += 8 + l;
  }
  const fp = fj.meshes[0].primitives[0];
  const a = fj.accessors[fp.attributes.POSITION], v = fj.bufferViews[a.bufferView];
  const [sz, kind] = CT[a.componentType];
  const stride = v.byteStride || sz * 3;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * 3);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < 3; c++)
    out[k * 3 + c] = fb[`read${kind}${sz === 1 ? "" : "LE"}`](base + k * stride + c * sz);
  const nd = fj.nodes.find((n) => n.mesh === 0) ?? fj.nodes[0];
  const s2 = nd?.scale ?? [1, 1, 1], t2 = nd?.translation ?? [0, 0, 0];
  for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++)
    out[i * 3 + c] = out[i * 3 + c] * s2[c] + t2[c];
  return { data: out, count: a.count };
})();
const measure = framePts ?? P;
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < measure.count; i++) for (let c = 0; c < 3; c++) {
  const v = measure.data[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v;
}
// Origin at the FOOT, so placing the card is "stand the bottom on the ground".
const ctr = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
const cy = Math.cos(YAW), sy = Math.sin(YAW), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
const view = (x, y, z) => {
  const rx = x * cy - z * sy, rz = x * sy + z * cy;
  return [rx, y * cp - rz * sp, y * sp + rz * cp];
};
let ax = 1e9, bx = -1e9, ay = 1e9, by = -1e9;
for (let i = 0; i < measure.count; i++) {
  const v = view(measure.data[i * 3] - ctr[0], measure.data[i * 3 + 1] - ctr[1], measure.data[i * 3 + 2] - ctr[2]);
  if (v[0] < ax) ax = v[0]; if (v[0] > bx) bx = v[0];
  if (v[1] < ay) ay = v[1]; if (v[1] > by) by = v[1];
}
// PADDING EVERYWHERE EXCEPT UNDER THE FEET.
//
// A margin round a sprite keeps its edges from clipping, and putting one
// under the bottom lifts the building off the card's lower edge — which the
// world then stands on the ground, so the house floats by however much the
// margin was. Small, and exactly the kind of small that reads as a building
// hovering. The foot goes on the edge; everything else gets its margin.
const PAD = 0.015;
const spanX = (bx - ax) * (1 + PAD * 2), spanY = (by - ay) * (1 + PAD);
const H = PX, W = Math.max(8, Math.round(PX * (spanX / spanY)));
const px = Buffer.alloc(W * H * 4, 0);
const zb = new Float64Array(W * H).fill(-1e9);
const sX = (v) => ((v - ax) / spanX + PAD) * W;
const sY = (v) => H - ((v - ay) / spanY) * H;

for (let t = 0; t < I.count; t += 3) {
  const p = [], uv = [];
  for (let k = 0; k < 3; k++) {
    const idx = I.data[t + k];
    const v = view(P.data[idx * 3] - ctr[0], P.data[idx * 3 + 1] - ctr[1], P.data[idx * 3 + 2] - ctr[2]);
    p.push([sX(v[0]), sY(v[1]), v[2]]);
    if (UV) uv.push([UV.data[idx * 2], UV.data[idx * 2 + 1]]);
  }
  const [A, B, C] = p;
  const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  if (Math.abs(den) < 1e-12) continue;
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const w0 = ((B[1] - C[1]) * (x + .5 - C[0]) + (C[0] - B[0]) * (y + .5 - C[1])) / den;
    const w1 = ((C[1] - A[1]) * (x + .5 - C[0]) + (A[0] - C[0]) * (y + .5 - C[1])) / den;
    const w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
    const o = y * W + x;
    if (z <= zb[o]) continue;
    zb[o] = z;
    let r = 190, g = 190, b = 190;
    if (TEX && uv.length === 3) {
      const u = w0 * uv[0][0] + w1 * uv[1][0] + w2 * uv[2][0];
      const vv = w0 * uv[0][1] + w1 * uv[1][1] + w2 * uv[2][1];
      const tx = Math.max(0, Math.min(TEX.w - 1, Math.floor(u * TEX.w)));
      const ty = Math.max(0, Math.min(TEX.h - 1, Math.floor(vv * TEX.h)));
      const to = (ty * TEX.w + tx) * TEX.ch;
      r = TEX.data[to]; g = TEX.data[to + 1]; b = TEX.data[to + 2];
    }
    px[o * 4] = r; px[o * 4 + 1] = g; px[o * 4 + 2] = b; px[o * 4 + 3] = 255;
  }
}
// BLEED THE COLOUR OUTWARD under the transparent edge. Bilinear sampling
// reaches past the silhouette, and what it finds there is black unless
// something is put in its way — which is where a card's dark rim comes from.
for (let pass = 0; pass < 3; pass++) {
  const copy = Buffer.from(px);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (copy[o + 3] > 0) continue;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
      const q = (yy * W + xx) * 4;
      if (copy[q + 3] === 0) continue;
      r += copy[q]; g += copy[q + 1]; b += copy[q + 2]; n++;
    }
    if (n) { px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n; px[o + 3] = 0; }
  }
}
writeFileSync(outPath, encodePNG(W, H, 4, px));
// ── HOW FAR THE CARD HAS TO SINK ───────────────────────────────────────
//
// The bottom of this image is the silhouette's lowest PIXEL, and on a
// building that is one corner of the plinth — the camera looks down, so the
// nearest corner projects lower than the rest of the base. Stand that pixel
// on the ground and the base line across the width of the building floats
// above it by the difference, which reads as a house hovering.
//
// So it is measured: the mean base row across the middle of the silhouette,
// against the lowest row, as a fraction of the card's height. The placer
// sinks the card by that much and the base line lands on the ground.
{
  const bottomOf = (x) => {
    for (let y = H - 1; y >= 0; y--) if (px[(y * W + x) * 4 + 3] > 127) return y;
    return -1;
  };
  let sum = 0, n = 0, lowest = 0;
  for (let x = Math.floor(W * 0.2); x < W * 0.8; x++) {
    const b = bottomOf(x);
    if (b < 0) continue;
    sum += b; n++;
    if (b > lowest) lowest = b;
  }
  const sink = n > 0 ? (lowest - sum / n) / H : 0;
  console.log(`  sink ${sink.toFixed(4)} — the base line is that far above the lowest corner`);
}
let opaque = 0;
for (let i = 0; i < W * H; i++) if (px[i * 4 + 3]) opaque++;
console.log(`  ${W}x${H}, ${((opaque / (W * H)) * 100).toFixed(0)}% opaque`);
console.log(`  yaw ${((YAW * 180) / Math.PI).toFixed(1)}deg  pitch ${((PITCH * 180) / Math.PI).toFixed(1)}deg down — the village camera`);
console.log(`  aspect ${(spanX / spanY).toFixed(4)} wide per unit of height; origin at the foot`);
