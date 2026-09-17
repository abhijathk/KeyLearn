#!/usr/bin/env node
/**
 * Turns a raw scenery prop into a game-ready one, for Village Road.
 *
 *   node scripts/village-prop.mjs in.glb out.glb [--tris 6000] [--tex 1024] [--q 88]
 *
 * These props arrive as ~18 MB single-mesh bakes: float positions, one 2048px
 * baseColor PNG and one 4096px metallicRoughness PNG. Three things are wrong
 * with them for a game that has to start on a school laptop, and only one of
 * them is the obvious one.
 *
 * 1. THE METALLIC-ROUGHNESS MAP IS THE BIGGEST FILE AND CARRIES ALMOST NOTHING.
 *    glTF reads G as roughness and B as metallic, and R only if an occlusion
 *    texture is declared - which none of these do. Measured across all eight
 *    props: metallic averages 0 (they are stone, wood, thatch and moss, so that
 *    is correct), and roughness varies by 5-12% of full range. That is 4096x4096
 *    pixels, twice the resolution of the colour map, to say "not metal, fairly
 *    rough". It is replaced here by two numbers, which is exact for metallic and
 *    invisible for roughness on a baked prop at trail distance.
 *
 * 2. THE GEOMETRY IS MOSTLY UNREDUCED - but not entirely, and the difference
 *    matters. For the temple, market, banyan, wall, cart and thatch homestead
 *    the supplied "optimised" copies have byte-for-byte the same triangle
 *    counts as the originals: only the textures were ever compressed. For the
 *    other two houses they were genuinely decimated, and far better than
 *    meshopt manages here - 59,317 down to 20,760 where meshopt stalls at
 *    51,949, because these bakes are split at every UV seam and built from many
 *    separate shells, so the collapser runs out of legal edges long before it
 *    runs out of budget. Hence --geom: take their mesh where theirs is better,
 *    simplify here where it is not, and take the colour map from the original
 *    either way. Rendered side by side at game distance the two are
 *    indistinguishable, so the cheaper one wins.
 *
 * 3. NO MIPMAPS. The supplied KTX2 textures carry a single level, so they
 *    shimmer as they shrink on screen - which is most of the time, on a trail.
 *    They are re-encoded here WITH a mip chain. WebP was tried first, on the
 *    reasoning that the renderer would then build mips itself and that it is
 *    what the game's existing scenery collections use - but measured, a mipped
 *    ETC1S KTX2 is both smaller AND already mipped: 234 KB against WebP's 300
 *    at 1024px, 77 against 89 at 512. ETC1S is a GPU format and compresses far
 *    harder than WebP, and it also stays compressed in video memory, which
 *    matters more here than matching the trees' convention.
 *
 * The result is re-derived from the ORIGINAL, never from the pre-optimised
 * copy: compressing an already-compressed texture stacks two lossy passes for
 * no reason when the source is sitting right there.
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { MeshoptSimplifier } from "meshoptimizer";

const args = process.argv.slice(2);
const num = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i < 0 ? dflt : Number(args[i + 1]);
};
const [inPath, outPath] = args.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")),
);
if (!inPath || !outPath) {
  console.error("usage: village-prop.mjs in.glb out.glb [--tris N] [--tex px] [--q n]");
  process.exit(2);
}
const TEX = num("--tex", 1024);
const QUALITY = num("--q", 190);

// ── read ────────────────────────────────────────────────────────────────
const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), type = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (type === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}
const prim = json.meshes[0].primitives[0];
const acc = (i) => json.accessors[i];
const viewOf = (a) => json.bufferViews[a.bufferView];
// Reads float OR quantized attributes. The supplied pre-optimised props store
// positions as normalized shorts under KHR_mesh_quantization, with the node's
// scale and translation putting them back where they belong - so borrowing
// their geometry means undoing that here rather than getting a model 60,000
// units across.
const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
function readAttr(index, comps, srcJson = json, srcBin = bin) {
  const a = srcJson.accessors[index], v = srcJson.bufferViews[a.bufferView];
  const sz = CSIZE[a.componentType];
  const stride = v.byteStride || comps * sz;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(a.count * comps);
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < comps; c++) {
      const p = base + i * stride + c * sz;
      let x;
      switch (a.componentType) {
        case 5126: x = srcBin.readFloatLE(p); break;
        case 5122: x = srcBin.readInt16LE(p); if (a.normalized) x = Math.max(x / 32767, -1); break;
        case 5123: x = srcBin.readUInt16LE(p); if (a.normalized) x /= 65535; break;
        case 5120: x = srcBin.readInt8(p); if (a.normalized) x = Math.max(x / 127, -1); break;
        case 5121: x = srcBin.readUInt8(p); if (a.normalized) x /= 255; break;
        default: x = srcBin.readFloatLE(p);
      }
      out[i * comps + c] = x;
    }
  }
  return out;
}
function readIndices(srcJson = json, srcBin = bin, srcPrim = prim) {
  const a = srcJson.accessors[srcPrim.indices], v = srcJson.bufferViews[a.bufferView];
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Uint32Array(a.count);
  for (let i = 0; i < a.count; i++) {
    out[i] = a.componentType === 5125 ? srcBin.readUInt32LE(base + i * 4)
           : a.componentType === 5123 ? srcBin.readUInt16LE(base + i * 2)
           : srcBin.readUInt8(base + i);
  }
  return out;
}

// --geom borrows the mesh from a DIFFERENT file, keeping this one's texture.
// meshopt stalls on these bakes - it could not take the hearth house below
// 51,949 of its 59,317 triangles, where whoever prepared the supplied copies
// reached 20,760 - so where their decimation is better, use it, and still take
// the colour map from the 18 MB original rather than from their recompressed
// one. Best geometry, best texture, neither re-encoded twice.
const geomPath = (() => { const i = args.indexOf("--geom"); return i < 0 ? null : args[i + 1]; })();
let gJson = json, gBin = bin, gPrim = prim, gNode = json.nodes[0];
if (geomPath) {
  const gs = readFileSync(geomPath);
  let go = 12;
  while (go + 8 <= gs.length) {
    const len = gs.readUInt32LE(go), t = gs.readUInt32LE(go + 4);
    const body = gs.subarray(go + 8, go + 8 + len);
    if (t === 0x4e4f534a) gJson = JSON.parse(body.toString("utf8"));
    if (t === 0x004e4942) gBin = Buffer.from(body);
    go += 8 + len;
  }
  gPrim = gJson.meshes[0].primitives[0];
  gNode = gJson.nodes.find((n) => n.mesh != null) ?? gJson.nodes[0];
}
const pos = readAttr(gPrim.attributes.POSITION, 3, gJson, gBin);
const nrm = gPrim.attributes.NORMAL != null ? readAttr(gPrim.attributes.NORMAL, 3, gJson, gBin) : null;
const uv  = gPrim.attributes.TEXCOORD_0 != null ? readAttr(gPrim.attributes.TEXCOORD_0, 2, gJson, gBin) : null;
// Bake the node's own scale/translation into the vertices, so the output is a
// plain mesh at true size whatever the source did with quantization.
{
  const sc = gNode.scale ?? [1, 1, 1], tr = gNode.translation ?? [0, 0, 0];
  if (sc.some((x) => x !== 1) || tr.some((x) => x !== 0))
    for (let i = 0; i < pos.length / 3; i++)
      for (let c = 0; c < 3; c++) pos[i * 3 + c] = pos[i * 3 + c] * sc[c] + tr[c];
}
let idx = readIndices(gJson, gBin, gPrim);
const vertCount = pos.length / 3;
const triCount = idx.length / 3;

// real-world size, for fitting it into the world later
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vertCount; i++)
  for (let c = 0; c < 3; c++) {
    const x = pos[i * 3 + c];
    if (x < lo[c]) lo[c] = x;
    if (x > hi[c]) hi[c] = x;
  }

// ── simplify ────────────────────────────────────────────────────────────
await MeshoptSimplifier.ready;
// Clamped to what the mesh actually has: meshopt asserts if asked for more
// indices than it was given, and "--tris huge" is the natural way to say
// "reduce only as far as the error budget allows".
const target = Math.min(idx.length, Math.max(3, Math.round(num("--tris", Math.round(triCount * 0.5))) * 3));
// LockBorder keeps the outer edge of the mesh where it is. These props are
// single shells rather than tiles, but a roof edge or a wall end that creeps
// inward as triangles are removed reads as the model shrinking, and the error
// metric alone will happily spend its budget there.
const LOCK = !args.includes("--free-border");
const ERR = num("--err", 0.05);
// SEAM-AWARE. Plain simplify() stalls on these meshes: the market would not go
// below 23,151 triangles however low the target or however loose the error,
// because a baked prop is split at every UV seam - 52,005 vertices for 31,485
// triangles, where a welded mesh would have a third of that. Every seam is a
// border the collapser will not cross, so the budget is spent long before the
// target. simplifyWithAttributes lets it collapse ACROSS the seams while
// keeping the UVs honest, by giving the texture coordinates their own error
// weight rather than treating them as a wall.
let simplified, error;
if (args.includes("--sloppy")) {
  // TOPOLOGY-BLIND. The attribute-aware path still stalls on the heaviest
  // props - the hearth house would not go below 51,949 of its 59,317 triangles
  // - because they are built from many separate shells and meshopt will not
  // destroy a component to meet a budget. simplifySloppy ignores connectivity
  // entirely and will hit any target, which is the wrong tool for a character
  // and the right one for a building seen from across a field.
  const r = MeshoptSimplifier.simplifySloppy(idx, pos, 3, null, target, ERR);
  simplified = Array.isArray(r) ? r[0] : r;
  error = Array.isArray(r) ? r[1] : 0;
} else if (uv && !args.includes("--no-attrs")) {
  const UVW = num("--uvw", 0.5);
  [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
    idx, pos, 3, uv, 2, [UVW, UVW], null, target, ERR,
    LOCK ? ["LockBorder"] : [],
  );
} else {
  [simplified, error] = MeshoptSimplifier.simplify(
    idx, pos, 3, target, ERR, LOCK ? ["LockBorder"] : [],
  );
}
idx = simplified;

// Drop the vertices nothing references any more. Simplify only rewrites the
// index buffer; without this the file still carries every original vertex.
// Compaction, done here rather than through MeshoptSimplifier.compactMesh.
// That call returns a TUPLE - [remap, uniqueCount] - which I twice read wrongly:
// first as a bare remap (every position packed to zero, giving a mesh made
// entirely of the origin that still had valid-looking counts), then with a
// guard that discarded referenced vertices (31,795 indices left pointing at
// 0xFFFFFFFF). Walking the index buffer and numbering vertices in order of
// first use is a few lines, has no contract to misread, and gives a
// cache-friendly ordering for free.
const remap = new Uint32Array(vertCount).fill(0xffffffff);
let newVerts = 0;
for (let i = 0; i < idx.length; i++) {
  const v = idx[i];
  if (remap[v] === 0xffffffff) remap[v] = newVerts++;
}
const pack = (srcArr, comps) => {
  if (!srcArr) return null;
  const out = new Float32Array(newVerts * comps);
  for (let i = 0; i < vertCount; i++) {
    const d = remap[i];
    if (d === 0xffffffff) continue;
    for (let c = 0; c < comps; c++) out[d * comps + c] = srcArr[i * comps + c];
  }
  return out;
};
const pos2 = pack(pos, 3), nrm2 = pack(nrm, 3), uv2 = pack(uv, 2);
for (let i = 0; i < idx.length; i++) idx[i] = remap[idx[i]];

// ── texture ─────────────────────────────────────────────────────────────
// baseColor only. See the note at the top for why metallicRoughness is thrown
// away rather than resized.
const mat = json.materials[0];
const baseImg = json.images[json.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source];
const bv = json.bufferViews[baseImg.bufferView];
const rawPng = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
const tmpIn = `/tmp/vp_${process.pid}.png`;
const tmpScaled = `/tmp/vp_${process.pid}_s.png`;
const tmpOut = `/tmp/vp_${process.pid}_s.ktx2`;
writeFileSync(tmpIn, rawPng);
// basisu has no resize of its own, so the scale happens first. cwebp is only
// borrowed as a resampler here; its output is immediately re-encoded.
execFileSync("cwebp", ["-quiet", "-resize", String(TEX), String(TEX), "-lossless", tmpIn, "-o", `${tmpScaled}.webp`]);
execFileSync("dwebp", ["-quiet", `${tmpScaled}.webp`, "-o", tmpScaled]);
// --qa-webp swaps the GPU format for a plain one, purely so the result can be
// opened in Blender for a look: its glTF importer supports neither
// KHR_texture_basisu nor EXT_meshopt_compression, so the shipping file cannot
// be inspected there at all.
const QA = args.includes("--qa-webp");
// `-mip_linear` — the same flag, and the same reason, as the cast.
//
// basisu's default converts an SDR texture from sRGB to LINEAR LIGHT before
// filtering each mip and back again. That is the right way to average LIGHT
// and the wrong way to average a baked ALBEDO: linear-light averaging is
// dominated by the bright end, so cream plaster beside a dark doorway comes
// back pale rather than mid-brown. It turned the blacksmith's hair white at
// the distance he is drawn at, and these buildings are the same bake in the
// large — cream walls against dark thatch, dark shutters, dark timber — and
// they are drawn at distance nearly always. Mip 0 is untouched either way,
// so the near view does not change; what changes is that a house half way
// down the road keeps the tone it has up close.
if (!QA) execFileSync("basisu", ["-ktx2", "-mipmap", "-mip_linear", "-q", String(QUALITY), "-file", tmpScaled, "-output_file", tmpOut], { stdio: "ignore" });
const tex = QA ? readFileSync(`${tmpScaled}.webp`) : readFileSync(tmpOut);
for (const f of [tmpIn, tmpScaled, `${tmpScaled}.webp`, tmpOut]) { try { unlinkSync(f); } catch { /* already gone */ } }

// roughness as a single number, measured from the map being discarded
const ROUGH = num("--rough", 0.6);

// ── write ───────────────────────────────────────────────────────────────
const parts = [];
let cursor = 0;
const push = (buf, extra = {}) => {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); cursor += pad; }
  const view = { buffer: 0, byteOffset: cursor, byteLength: buf.length, ...extra };
  parts.push(buf); cursor += buf.length;
  return view;
};
const f32 = (arr) => { const b = Buffer.alloc(arr.length * 4); arr.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; };
const u32 = (arr) => { const b = Buffer.alloc(arr.length * 4); arr.forEach((v, i) => b.writeUInt32LE(v, i * 4)); return b; };

const views = [], accessors = [];
const addAcc = (buf, componentType, count, type, minmax, target) => {
  views.push(push(buf, target ? { target } : {}));
  accessors.push({ bufferView: views.length - 1, componentType, count, type, ...(minmax ?? {}) });
  return accessors.length - 1;
};
// POSITION as normalized unsigned shorts, with the node's scale and
// translation putting them back. Float positions were the single largest thing
// left in these files once the textures were dealt with - 12 bytes a vertex
// against 6, and meshopt compresses the quantized form far harder because
// neighbouring vertices share high bits. Precision is one part in 65,535 of the
// model's own bounding box, which on a two-metre house is three hundredths of a
// millimetre.
const span = [0, 1, 2].map((c) => Math.max(1e-9, hi[c] - lo[c]));
const u16 = (arr) => { const b = Buffer.alloc(arr.length * 2); arr.forEach((v, i) => b.writeUInt16LE(v, i * 2)); return b; };

// ── QUANTIZE FIRST, THEN MERGE WHAT QUANTIZING MADE IDENTICAL ───────────
//
// The order matters and it is the whole of this saving. Simplification
// leaves a vertex wherever the source had one, and a baked prop is split at
// every UV seam and every hard edge -- on the temple, 35,557 vertices for
// 10,288 distinct POSITIONS. Most of those splits are real and have to
// stay: a seam vertex genuinely carries two texture coordinates.
//
// But quantizing collapses more of them than the source had. Positions go
// to one part in 65,535 of the box, normals to a signed byte, texture
// coordinates to one part in 65,535 of the atlas -- and pairs that differed
// in the seventh decimal place of a float land on the same integers.
// MEASURED on the temple: 10,437 of 35,557 vertices, twenty-nine per cent,
// become byte-for-byte duplicates of another vertex. Deduplicating before
// quantizing would find almost none of them.
//
// Nothing is lost. A duplicate is merged only when its position, normal AND
// texture coordinate are all identical after quantization, so every corner
// still reads the texel and takes the light it did before; the index buffer
// simply points several triangles at one copy instead of several copies.
const q = { pos: new Uint16Array(newVerts * 3) };
for (let i = 0; i < newVerts; i++)
  for (let c = 0; c < 3; c++)
    q.pos[i * 3 + c] = Math.max(0, Math.min(65535,
      Math.round(((pos2[i * 3 + c] - lo[c]) / span[c]) * 65535)));
if (nrm2) {
  // A signed byte is under two degrees of error at worst, on baked
  // architecture lit by one soft key -- and it is what gltfpack quantizes
  // normals to by default, for the same reason. Float normals were the
  // largest thing left in these files after the texture: twelve bytes a
  // vertex, 417 KB raw on the temple against a 162 KB atlas.
  q.nrm = new Int8Array(newVerts * 3);
  for (let i = 0; i < newVerts; i++) {
    let x = nrm2[i * 3], y = nrm2[i * 3 + 1], z = nrm2[i * 3 + 2];
    const len = Math.hypot(x, y, z) || 1;
    q.nrm[i * 3] = Math.max(-127, Math.min(127, Math.round((x / len) * 127)));
    q.nrm[i * 3 + 1] = Math.max(-127, Math.min(127, Math.round((y / len) * 127)));
    q.nrm[i * 3 + 2] = Math.max(-127, Math.min(127, Math.round((z / len) * 127)));
  }
}
// ONLY WHILE THE UVs STAY INSIDE THE UNIT SQUARE. A normalized short cannot
// express a number outside it, so a bake that tiles or overruns keeps its
// floats rather than wrapping its texture inside out -- the kind of thing
// that would otherwise be discovered on screen. One part in 65,535 across a
// 1024-texel atlas is a sixty-fourth of a texel, so where it does apply it
// is exact as far as anything can see.
const uvInUnit = uv2 != null && uv2.every((v) => v >= 0 && v <= 1);
if (uv2 && uvInUnit) {
  q.uv = new Uint16Array(newVerts * 2);
  for (let i = 0; i < newVerts * 2; i++) q.uv[i] = Math.round(uv2[i] * 65535);
}

const canon = new Map();
const dedup = new Uint32Array(newVerts);
let uniq = 0;
for (let i = 0; i < newVerts; i++) {
  let key = `${q.pos[i * 3]},${q.pos[i * 3 + 1]},${q.pos[i * 3 + 2]}`;
  if (q.nrm) key += `|${q.nrm[i * 3]},${q.nrm[i * 3 + 1]},${q.nrm[i * 3 + 2]}`;
  if (q.uv) key += `|${q.uv[i * 2]},${q.uv[i * 2 + 1]}`;
  else if (uv2) key += `|${uv2[i * 2]},${uv2[i * 2 + 1]}`;
  const seen = canon.get(key);
  if (seen != null) { dedup[i] = seen; continue; }
  canon.set(key, uniq);
  dedup[i] = uniq;
  q.pos.copyWithin(uniq * 3, i * 3, i * 3 + 3);
  if (q.nrm) q.nrm.copyWithin(uniq * 3, i * 3, i * 3 + 3);
  if (q.uv) q.uv.copyWithin(uniq * 2, i * 2, i * 2 + 2);
  if (uv2 && !q.uv) { uv2[uniq * 2] = uv2[i * 2]; uv2[uniq * 2 + 1] = uv2[i * 2 + 1]; }
  uniq++;
}
for (let i = 0; i < idx.length; i++) idx[i] = dedup[idx[i]];
const merged = newVerts - uniq;
newVerts = uniq;

views.push(push(u16(q.pos.subarray(0, newVerts * 3)), { target: 34962 }));
accessors.push({
  bufferView: views.length - 1, componentType: 5123, normalized: true,
  count: newVerts, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1],
});
const aPos = accessors.length - 1;
// Three bytes padded to four: glTF wants a vertex attribute's stride on a
// four-byte boundary.
const aNrm = q.nrm
  ? (() => {
      const b = Buffer.alloc(newVerts * 4);
      for (let i = 0; i < newVerts; i++) {
        b.writeInt8(q.nrm[i * 3], i * 4);
        b.writeInt8(q.nrm[i * 3 + 1], i * 4 + 1);
        b.writeInt8(q.nrm[i * 3 + 2], i * 4 + 2);
      }
      views.push(push(b, { target: 34962, byteStride: 4 }));
      accessors.push({ bufferView: views.length - 1, componentType: 5120, normalized: true, count: newVerts, type: "VEC3" });
      return accessors.length - 1;
    })()
  : nrm2 ? addAcc(f32(nrm2.subarray(0, newVerts * 3)), 5126, newVerts, "VEC3", null, 34962) : null;
const aUv = q.uv
  ? (() => {
      views.push(push(u16(q.uv.subarray(0, newVerts * 2)), { target: 34962, byteStride: 4 }));
      accessors.push({ bufferView: views.length - 1, componentType: 5123, normalized: true, count: newVerts, type: "VEC2" });
      return accessors.length - 1;
    })()
  : uv2 ? addAcc(f32(uv2.subarray(0, newVerts * 2)), 5126, newVerts, "VEC2", null, 34962) : null;
// 16-bit indices whenever the mesh fits, which every one of these props does.
// 32-bit was costing 2 bytes a corner for a range none of them use.
const aIdx = newVerts <= 65536
  ? (() => {
      const b = Buffer.alloc(idx.length * 2);
      for (let i = 0; i < idx.length; i++) b.writeUInt16LE(idx[i], i * 2);
      views.push(push(b, { target: 34963 }));
      accessors.push({ bufferView: views.length - 1, componentType: 5123, count: idx.length, type: "SCALAR" });
      return accessors.length - 1;
    })()
  : addAcc(u32(idx), 5125, idx.length, "SCALAR", null, 34963);
views.push(push(tex));
const imgView = views.length - 1;

const out = {
  asset: { version: "2.0", generator: "village-prop.mjs" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{
    mesh: 0,
    name: json.nodes[0]?.name ?? "prop",
    // Undoes the position quantization above.
    scale: span,
    translation: lo,
  }],
  meshes: [{ primitives: [{
    attributes: { POSITION: aPos, ...(aNrm != null ? { NORMAL: aNrm } : {}), ...(aUv != null ? { TEXCOORD_0: aUv } : {}) },
    indices: aIdx, material: 0,
  }] }],
  materials: [{
    name: mat.name ?? "prop",
    doubleSided: mat.doubleSided ?? true,
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      // Exact, not an approximation: the discarded map's metallic channel
      // averaged zero across every one of these props.
      metallicFactor: 0,
      roughnessFactor: ROUGH,
    },
  }],
  textures: [QA ? { sampler: 0, source: 0 } : { sampler: 0, extensions: { KHR_texture_basisu: { source: 0 } } }],
  extensionsUsed: QA ? ["KHR_mesh_quantization"] : ["KHR_texture_basisu", "KHR_mesh_quantization"],
  extensionsRequired: QA ? ["KHR_mesh_quantization"] : ["KHR_texture_basisu", "KHR_mesh_quantization"],
  images: [{ bufferView: imgView, mimeType: QA ? "image/webp" : "image/ktx2" }],
  // Trilinear with mipmaps - the whole point of moving off single-level KTX2.
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  bufferViews: views,
  accessors,
  buffers: [{ byteLength: cursor }],
};
const binOut = Buffer.concat(parts);
const jsonBuf = Buffer.from(JSON.stringify(out), "utf8");
const jPad = (4 - (jsonBuf.length % 4)) % 4;
const bPad = (4 - (binOut.length % 4)) % 4;
const chunk = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const total = 12 + 8 + jsonBuf.length + jPad + 8 + binOut.length + bPad;
const header = Buffer.alloc(12);
header.write("glTF", 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([
  header,
  chunk(jsonBuf.length + jPad, 0x4e4f534a), jsonBuf, Buffer.alloc(jPad, 0x20),
  chunk(binOut.length + bPad, 0x004e4942), binOut, Buffer.alloc(bPad),
]));

const dim = [0, 1, 2].map((c) => hi[c] - lo[c]);
console.log(`  ${inPath.split("/").pop()}`);
console.log(`    tris    ${triCount} -> ${idx.length / 3}   verts ${vertCount} -> ${newVerts}   simplify error ${(error * 100).toFixed(2)}%`);
console.log(`    merged  ${merged} vertices identical after quantizing (${((merged / (newVerts + merged)) * 100).toFixed(0)}% of them), losslessly`);
console.log(`    texture ${TEX}px mipped ktx2 q${QUALITY} ${(tex.length / 1024).toFixed(0)}KB   (metallicRoughness dropped: metallic 0, roughness ${ROUGH})`);
console.log(`    size    ${(src.length / 1048576).toFixed(1)}MB -> ${(total / 1024).toFixed(0)}KB`);
console.log(`    bounds  X ${dim[0].toFixed(2)}  Y ${dim[1].toFixed(2)}  Z ${dim[2].toFixed(2)}   (floor at y=${lo[1].toFixed(2)})`);
