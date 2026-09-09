/**
 * Replaces a GLB's embedded image with a KTX2 one, and rebuilds the binary
 * chunk so the old bytes actually leave the file.
 *
 *   node scripts/glb-swap-texture.mjs in.glb out.glb imageIndex new.ktx2
 *
 * Appending the new image and orphaning the old one would be far simpler and
 * would save nothing — the point of the exercise is the seven megabytes the
 * PNG occupies. So every bufferView is copied into a fresh buffer in order
 * and given a new offset, which is the only part of this that can go wrong;
 * accessors are left alone and keep pointing at their view.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath, imageIdxRaw, ktxPath] = process.argv;
const imageIdx = Number(imageIdxRaw);
const src = readFileSync(inPath);
const ktx = readFileSync(ktxPath);

let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), type = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (type === 0x004e4942) bin = body;
  off += 8 + len;
}
if (json == null || bin == null) throw new Error("need both chunks");

const image = json.images[imageIdx];
if (image?.bufferView == null) throw new Error(`image ${imageIdx} is not buffer-backed`);
const oldView = image.bufferView;

// The replacement's bytes, as a new view appended to the list.
const newViewIndex = json.bufferViews.length;
json.bufferViews.push({ buffer: 0, byteOffset: 0, byteLength: ktx.length });
const payloads = json.bufferViews.map((v, i) =>
  i === newViewIndex ? ktx : bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength),
);

image.bufferView = newViewIndex;
image.mimeType = "image/ktx2";

// Every texture pointing at this image goes through the extension instead.
let moved = 0;
for (const t of json.textures ?? []) {
  if (t.source === imageIdx) {
    delete t.source;
    t.extensions = { ...(t.extensions ?? {}), KHR_texture_basisu: { source: imageIdx } };
    moved++;
  }
}
const add = (arr, name) => (arr.includes(name) ? arr : [...arr, name]);
json.extensionsUsed = add(json.extensionsUsed ?? [], "KHR_texture_basisu");
json.extensionsRequired = add(json.extensionsRequired ?? [], "KHR_texture_basisu");

// Rebuild the binary chunk, dropping the view the old image used.
const keep = json.bufferViews.map((_, i) => i).filter((i) => i !== oldView);
const parts = [];
let cursor = 0;
const remap = new Map();
for (const i of keep) {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); cursor += pad; }
  remap.set(i, cursor);
  parts.push(payloads[i]);
  cursor += payloads[i].length;
}
const newBin = Buffer.concat(parts);
const rebuilt = keep.map((i) => ({ ...json.bufferViews[i], byteOffset: remap.get(i), byteLength: payloads[i].length }));
// Old index -> new index, for everything that names a bufferView.
const idxMap = new Map(keep.map((old, next) => [old, next]));
json.bufferViews = rebuilt;
for (const a of json.accessors ?? []) if (a.bufferView != null) a.bufferView = idxMap.get(a.bufferView);
for (const im of json.images ?? []) if (im.bufferView != null) im.bufferView = idxMap.get(im.bufferView);
json.buffers = [{ byteLength: newBin.length }];

const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);
const binPad = (4 - (newBin.length % 4)) % 4;
const binChunk = Buffer.concat([newBin, Buffer.alloc(binPad)]);
const head = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
const body = Buffer.concat([head(jsonChunk.length, 0x4e4f534a), jsonChunk, head(binChunk.length, 0x004e4942), binChunk]);
header.writeUInt32LE(12 + body.length, 8);
writeFileSync(outPath, Buffer.concat([header, body]));
console.log(`  image ${imageIdx}: PNG -> KTX2 (${(ktx.length / 1024).toFixed(0)} KB), ${moved} texture(s) rewired`);
console.log(`  ${(src.length / 1048576).toFixed(2)} MB -> ${(12 + body.length) / 1048576} MB`);
