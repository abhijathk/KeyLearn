/**
 * Reduce a SKINNED mesh's triangle count without breaking its skin.
 *
 *   node scripts/glb-simplify-skinned.mjs in.glb out.glb --ratio 0.5 [--error 0.02]
 *
 * The buffalo ships 30,669 vertices. That is a sensible number for a
 * character you inspect and an extravagant one for an animal standing out in
 * a paddy field at a couple of hundred screen pixels, and geometry is by
 * some distance the largest thing in its file - larger than the texture and
 * the sixteen animations put together. Cutting it is the only lever that
 * reaches a one-megabyte budget without touching the texture.
 *
 * WHY THIS IS SAFE FOR A SKIN, which is the part worth understanding:
 * meshopt's simplifier does not create vertices or move them. It chooses a
 * subset of the ORIGINAL vertices and hands back an index buffer referring to
 * them. So every surviving vertex keeps the exact joints and weights it was
 * authored with - the skin is not resampled, interpolated or guessed at, it
 * is simply the same skin on fewer points. Every other attribute (normals,
 * UVs) comes along the same way.
 *
 * The compaction afterwards is hand-rolled on purpose. `compactMesh` returns
 * a TUPLE - [remap, uniqueVertexCount] - and reading it as a bare remap packs
 * every position to zero: a file with plausible vertex counts, a valid
 * bounding box, and every triangle at the origin. It cost two rounds to find
 * because nothing about the output looks wrong until you open it. The loop
 * below builds the remap from the index buffer directly, which cannot
 * misread anything.
 *
 * --error is the simplifier's own bound on the geometric deviation, as a
 * fraction of the mesh's extent. It will stop short of the ratio rather than
 * exceed that bound, and it REPORTS what it actually achieved - always read
 * that number rather than assuming the ratio was met.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptSimplifier } from "../node_modules/meshoptimizer/meshopt_simplifier.js";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : parseFloat(args[i + 1]); };
const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!inPath || !outPath) {
  console.error("usage: glb-simplify-skinned.mjs in.glb out.glb [--ratio r] [--error e]");
  process.exit(2);
}
const RATIO = flag("--ratio", 0.5);
const ERROR = flag("--error", 0.02);
/** Collapse across UV seams, counting UV distortion as error. See below. */
const ATTRS = args.includes("--attrs");
/** How hard to defend the UVs when doing so. Higher = truer texture. */
const UVW = flag("--uv-weight", 0.5);

await MeshoptSimplifier.ready;

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}
if (json.extensionsRequired?.includes("EXT_meshopt_compression")) {
  console.error("this file is meshopt-compressed; simplify the UNCOMPRESSED master instead");
  process.exit(2);
}

const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const readAcc = (ai, denorm = false) => {
  const a = json.accessors[ai], v = json.bufferViews[a.bufferView];
  const n = NC[a.type], sz = COMP[a.componentType];
  const stride = v.byteStride || n * sz;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const get = {
    5120: (p) => bin.readInt8(p), 5121: (p) => bin.readUInt8(p),
    5122: (p) => bin.readInt16LE(p), 5123: (p) => bin.readUInt16LE(p),
    5125: (p) => bin.readUInt32LE(p), 5126: (p) => bin.readFloatLE(p),
  }[a.componentType];
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      let x = get(base + k * stride + c * sz);
      // Quantised UVs come back as raw integers; the simplifier needs them in
      // the same units as the positions or the error metric is meaningless.
      if (denorm && a.normalized) {
        x /= a.componentType === 5123 ? 65535 : a.componentType === 5121 ? 255 : 32767;
      }
      row.push(x);
    }
    out.push(row);
  }
  return out;
};

let totalBefore = 0, totalAfter = 0;
for (const mesh of json.meshes ?? []) {
  for (const prim of mesh.primitives ?? []) {
    if (prim.indices == null || prim.attributes.POSITION == null) continue;
    const idxAcc = json.accessors[prim.indices];
    const posAcc = json.accessors[prim.attributes.POSITION];
    const vertCount = posAcc.count;
    const indices = new Uint32Array(readAcc(prim.indices).map((r) => r[0]));
    const positions = new Float32Array(readAcc(prim.attributes.POSITION).flat());

    const target = Math.max(3, Math.floor(indices.length * RATIO / 3) * 3);
    let simplified, error;
    if (ATTRS && prim.attributes.TEXCOORD_0 != null) {
      // ATTRIBUTE-AWARE, and on these meshes it is the only thing that works.
      //
      // Plain `simplify` sees positions and an index buffer. A mesh whose UVs
      // are an atlas has a separate vertex for every seam, so from the
      // simplifier's point of view the surface is riddled with open borders —
      // and with LockBorder it can barely collapse anything. Measured on the
      // puppy: 46,333 vertices down to 40,107, a 13% saving, at any ratio or
      // error bound you ask for. The triangles fall but the VERTICES do not,
      // and vertices are where the bytes are: five attributes each.
      //
      // Feeding the UVs in as attributes lets it collapse across a seam while
      // counting the UV difference as error, so the texture stretches by a
      // bounded amount instead of the seam being frozen. The weight is what
      // buys that trade: higher keeps the texture truer and collapses less.
      const uv = new Float32Array(readAcc(prim.attributes.TEXCOORD_0, true).flat());
      [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
        indices, positions, 3, uv, 2, [UVW, UVW], null, target, ERROR, [],
      );
    } else {
      [simplified, error] = MeshoptSimplifier.simplify(
        indices, positions, 3, target, ERROR, ["LockBorder"],
      );
    }
    totalBefore += indices.length / 3;
    totalAfter += simplified.length / 3;

    // Hand-rolled compaction. See the header: compactMesh returns a tuple and
    // misreading it silently collapses the mesh to a point.
    const remap = new Uint32Array(vertCount).fill(0xffffffff);
    let kept = 0;
    for (let i = 0; i < simplified.length; i++) {
      const v = simplified[i];
      if (remap[v] === 0xffffffff) remap[v] = kept++;
    }
    const order = new Uint32Array(kept);
    for (let v = 0; v < vertCount; v++) if (remap[v] !== 0xffffffff) order[remap[v]] = v;

    // Rewrite every attribute, in its own original component type, keeping
    // only the surviving vertices IN THEIR NEW ORDER. Joints and weights come
    // through untouched, which is what keeps the skin exactly as authored.
    const views = [];
    const addView = (buf) => {
      const pad = (4 - (bin.length % 4)) % 4;
      if (pad) bin = Buffer.concat([bin, Buffer.alloc(pad)]);
      const byteOffset = bin.length;
      bin = Buffer.concat([bin, buf]);
      json.bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length });
      return json.bufferViews.length - 1;
    };
    for (const key of Object.keys(prim.attributes)) {
      const ai = prim.attributes[key];
      const a = json.accessors[ai];
      const n = NC[a.type], sz = COMP[a.componentType];
      const rows = readAcc(ai);
      const buf = Buffer.alloc(kept * n * sz);
      const put = {
        5120: (p, x) => buf.writeInt8(x, p), 5121: (p, x) => buf.writeUInt8(x, p),
        5122: (p, x) => buf.writeInt16LE(x, p), 5123: (p, x) => buf.writeUInt16LE(x, p),
        5125: (p, x) => buf.writeUInt32LE(x, p), 5126: (p, x) => buf.writeFloatLE(x, p),
      }[a.componentType];
      const mn = new Array(n).fill(Infinity), mx = new Array(n).fill(-Infinity);
      for (let k = 0; k < kept; k++) {
        const row = rows[order[k]];
        for (let c = 0; c < n; c++) {
          put(k * n * sz + c * sz, row[c]);
          if (row[c] < mn[c]) mn[c] = row[c];
          if (row[c] > mx[c]) mx[c] = row[c];
        }
      }
      const bv = addView(buf);
      const na = { bufferView: bv, componentType: a.componentType, count: kept, type: a.type };
      if (a.normalized) na.normalized = true;
      // POSITION must carry min/max; the loader uses them for the bounding
      // box and a stale pair from the dense mesh is a wrong frustum test.
      if (key === "POSITION") { na.min = mn; na.max = mx; }
      json.accessors.push(na);
      prim.attributes[key] = json.accessors.length - 1;
      views.push(bv);
    }
    // Indices, in the narrowest type that still addresses every vertex.
    const wide = kept > 65535;
    const ibuf = Buffer.alloc(simplified.length * (wide ? 4 : 2));
    for (let i = 0; i < simplified.length; i++) {
      const v = remap[simplified[i]];
      if (wide) ibuf.writeUInt32LE(v, i * 4); else ibuf.writeUInt16LE(v, i * 2);
    }
    const ibv = addView(ibuf);
    json.accessors.push({
      bufferView: ibv, componentType: wide ? 5125 : 5123,
      count: simplified.length, type: "SCALAR",
    });
    prim.indices = json.accessors.length - 1;
    void idxAcc;
    console.log(
      `  ${mesh.name ?? "mesh"}: ${vertCount} -> ${kept} verts, ` +
      `${indices.length / 3} -> ${simplified.length / 3} tris, ` +
      `deviation ${(error * 100).toFixed(2)}% of extent`,
    );
  }
}

// Prune what nothing points at any more, or the old dense attributes stay in
// the buffer and the file grows instead of shrinking.
const liveAcc = new Set();
for (const a of json.animations ?? []) for (const s of a.samplers) { liveAcc.add(s.input); liveAcc.add(s.output); }
for (const m of json.meshes ?? []) for (const p of m.primitives ?? []) {
  for (const k of Object.keys(p.attributes)) liveAcc.add(p.attributes[k]);
  if (p.indices != null) liveAcc.add(p.indices);
  for (const t of p.targets ?? []) for (const k of Object.keys(t)) liveAcc.add(t[k]);
}
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) liveAcc.add(sk.inverseBindMatrices);
const accRemap = new Map(); const keptAcc = [];
for (let i = 0; i < json.accessors.length; i++) {
  if (!liveAcc.has(i)) continue;
  accRemap.set(i, keptAcc.length); keptAcc.push(json.accessors[i]);
}
json.accessors = keptAcc;
for (const a of json.animations ?? []) for (const s of a.samplers) { s.input = accRemap.get(s.input); s.output = accRemap.get(s.output); }
for (const m of json.meshes ?? []) for (const p of m.primitives ?? []) {
  for (const k of Object.keys(p.attributes)) p.attributes[k] = accRemap.get(p.attributes[k]);
  if (p.indices != null) p.indices = accRemap.get(p.indices);
  for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = accRemap.get(t[k]);
}
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices != null) sk.inverseBindMatrices = accRemap.get(sk.inverseBindMatrices);

const live = new Set();
for (const a of json.accessors) if (a.bufferView != null) live.add(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) live.add(im.bufferView);
const remapV = new Map(); const parts = []; const newViews = [];
let outLen = 0;
for (let i = 0; i < json.bufferViews.length; i++) {
  if (!live.has(i)) continue;
  const v = json.bufferViews[i];
  const pad = (4 - (outLen % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); outLen += pad; }
  const nv = { buffer: 0, byteOffset: outLen, byteLength: v.byteLength };
  if (v.byteStride != null) nv.byteStride = v.byteStride;
  if (v.target != null) nv.target = v.target;
  remapV.set(i, newViews.length); newViews.push(nv);
  parts.push(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  outLen += v.byteLength;
}
json.bufferViews = newViews;
for (const a of json.accessors) if (a.bufferView != null) a.bufferView = remapV.get(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) im.bufferView = remapV.get(im.bufferView);

const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jc = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const bc = Buffer.concat([newBin, Buffer.alloc((4 - (newBin.length % 4)) % 4)]);
const chunk = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const total = 12 + 8 + jc.length + 8 + bc.length;
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([hdr, chunk(jc.length, 0x4e4f534a), jc, chunk(bc.length, 0x004e4942), bc]));
console.log(`  triangles ${totalBefore} -> ${totalAfter} (${(100 * totalAfter / totalBefore).toFixed(0)}%)`);
console.log(`wrote ${outPath}  ${total.toLocaleString()} bytes`);
