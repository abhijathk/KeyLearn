/**
 * Decode EXT_meshopt_compression back to a plain GLB, so the QA suite (which
 * reads raw bufferViews) can be run on what the game will actually decode.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const [inGlb, outGlb] = process.argv.slice(2);
const src = readFileSync(inGlb);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const l = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const b = src.subarray(off + 8, off + 8 + l);
  if (t === 0x4e4f534a) json = JSON.parse(b.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(b);
  off += 8 + l;
}
const out = [];
let cursor = 0;
const pad = (n) => (4 - (n % 4)) % 4;
for (const bv of json.bufferViews) {
  const ext = bv.extensions?.EXT_meshopt_compression;
  let bytes;
  if (ext) {
    const srcBytes = bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
    const dst = new Uint8Array(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(dst, ext.count, ext.byteStride, srcBytes, ext.mode, ext.filter ?? "NONE");
    bytes = Buffer.from(dst);
    delete bv.extensions.EXT_meshopt_compression;
    if (!Object.keys(bv.extensions).length) delete bv.extensions;
    bv.byteStride = ext.byteStride;
  } else {
    bytes = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
  }
  bv.byteOffset = cursor; bv.byteLength = bytes.length;
  out.push(bytes, Buffer.alloc(pad(bytes.length)));
  cursor += bytes.length + pad(bytes.length);
}
const newBin = Buffer.concat(out);
json.buffers[0].byteLength = newBin.length;
json.extensionsUsed = (json.extensionsUsed||[]).filter(e=>e!=="EXT_meshopt_compression");
json.extensionsRequired = (json.extensionsRequired||[]).filter(e=>e!=="EXT_meshopt_compression");
const jb = Buffer.from(JSON.stringify(json),"utf8"), jp = Buffer.alloc(pad(jb.length),0x20);
const jc = Buffer.concat([jb,jp]), bc = Buffer.concat([newBin, Buffer.alloc(pad(newBin.length))]);
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67,0); h.writeUInt32LE(2,4);
h.writeUInt32LE(12+8+jc.length+8+bc.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(jc.length,0); jh.writeUInt32LE(0x4e4f534a,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(bc.length,0); bh.writeUInt32LE(0x004e4942,4);
writeFileSync(outGlb, Buffer.concat([h,jh,jc,bh,bc]));
console.log("decoded ->", outGlb);
