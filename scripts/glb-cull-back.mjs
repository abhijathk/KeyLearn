/**
 * Remove the faces of a prop that never face the camera.
 *
 *   node scripts/glb-cull-back.mjs in.glb out.glb [--axis z] [--keep -0.35]
 *
 * WHY THIS IS WORTH DOING, and it is not mainly the file size.
 *
 * A building in this world stands at the roadside and is only ever seen from
 * the road: the camera is orthographic, fixed, and yawed twelve degrees, so
 * it sees one face and a little of one end, for the life of the chapter. The
 * back of a market is modelled, textured, simplified, shipped, uploaded to
 * the GPU and then never drawn from an angle that shows it.
 *
 * Measured on the market: 27 per cent of its triangles and 27 per cent of its
 * surface area point away from the road.
 *
 * THE BYTES ARE THE SMALL PART. What actually matters is that the simplifier
 * was spending a quarter of its budget refining geometry nobody can see —
 * meshopt has no idea which side is which, so at a target of 6,000 triangles
 * it kept roughly 1,600 of them for the back wall. Culling first means the
 * whole budget goes on the face you look at, and the front comes out sharper
 * at the same cost. The same argument applies to the texture: the atlas
 * cannot be repacked here, but every texel spent on a hidden surface is a
 * texel the visible ones do not get, so knowing how much is wasted tells you
 * what resolution the front really needs.
 *
 * A TRIANGLE IS JUDGED BY ITS OWN GEOMETRIC NORMAL, not by the shading
 * normals in the file, which are smoothed across edges and would keep a
 * back-facing triangle whose vertex normals were averaged with a side wall's.
 *
 * `--keep` is how far past straight-back a face may point and still be kept.
 * -0.35 is about twenty degrees past perpendicular: generous, because the
 * cost of keeping a face nobody sees is a few triangles and the cost of
 * cutting one that IS seen is a hole in the model.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i < 0 ? d : args[i + 1];
};
const [inPath, outPath] = args.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")),
);
if (!inPath || !outPath) {
  console.error("usage: glb-cull-back.mjs in.glb out.glb [--axis z] [--keep -0.35]");
  process.exit(2);
}
const AXIS = { x: 0, y: 1, z: 2 }[flag("--axis", "z")];
const KEEP = Number(flag("--keep", "-0.35"));

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), type = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (type === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}

const CS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const readAcc = (i, comps) => {
  const a = json.accessors[i], v = json.bufferViews[a.bufferView];
  const sz = CS[a.componentType];
  const stride = v.byteStride || comps * sz;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * comps);
  for (let k = 0; k < a.count; k++) {
    for (let c = 0; c < comps; c++) {
      const at = base + k * stride + c * sz;
      out[k * comps + c] =
        a.componentType === 5126 ? bin.readFloatLE(at)
        : a.componentType === 5125 ? bin.readUInt32LE(at)
        : a.componentType === 5123 ? bin.readUInt16LE(at)
        : a.componentType === 5122 ? bin.readInt16LE(at)
        : bin.readUInt8(at);
    }
  }
  return out;
};

let kept = 0, cut = 0;
for (const mesh of json.meshes) {
  for (const prim of mesh.primitives) {
    if (prim.indices == null) continue;
    const pos = readAcc(prim.attributes.POSITION, 3);
    const idx = readAcc(prim.indices, 1);
    const keepList = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const len = Math.hypot(n[0], n[1], n[2]) || 1e-12;
      if (n[AXIS] / len < KEEP) { cut++; continue; }
      keepList.push(idx[i], idx[i + 1], idx[i + 2]);
      kept++;
    }
    // Written back into the SAME accessor, widened only if it has to be.
    // Vertices are left in place: an unreferenced one costs its attributes
    // and nothing else, and re-indexing here would mean rewriting every
    // attribute buffer for a few per cent more.
    const acc = json.accessors[prim.indices];
    const view = json.bufferViews[acc.bufferView];
    const wide = keepList.some((v) => v > 65535);
    const bytes = wide ? 4 : 2;
    const buf = Buffer.alloc(keepList.length * bytes);
    keepList.forEach((v, i) => (wide ? buf.writeUInt32LE(v, i * 4) : buf.writeUInt16LE(v, i * 2)));
    const at = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    buf.copy(bin, at);
    acc.count = keepList.length;
    acc.componentType = wide ? 5125 : 5123;
    view.byteLength = Math.max(view.byteLength, buf.length);
  }
}

const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20);
const binPad = Buffer.alloc((4 - (bin.length % 4)) % 4);
const jh = Buffer.alloc(8), bh = Buffer.alloc(8), head = Buffer.alloc(12);
jh.writeUInt32LE(jsonBuf.length + jsonPad.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(bin.length + binPad.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const body = Buffer.concat([jh, jsonBuf, jsonPad, bh, bin, binPad]);
head.write("glTF", 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + body.length, 8);
writeFileSync(outPath, Buffer.concat([head, body]));
console.log(`  kept ${kept} triangles, cut ${cut} facing away (${((cut / (kept + cut)) * 100).toFixed(0)}%)`);
