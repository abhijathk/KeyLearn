#!/usr/bin/env node
/**
 * Adjusts the brightness of a GLB's baked atlas.
 *
 *   node scripts/glb-levels.mjs in.glb out.glb [--mean 100] [--gain 1.4]
 *
 * A generator will sometimes hand back a texture that is RIGHT but badly
 * exposed — the worn god-stone came back correctly featureless and almost
 * black, which on the road would have read as a silhouette rather than a
 * stone. Re-rolling it costs credits and risks losing what was right about
 * it; the exposure is arithmetic and belongs here.
 *
 * `--mean` lifts the atlas to a target average luminance, measuring only
 * texels the mesh actually reads so a large empty margin cannot drag the
 * figure up with it. `--gain` is the blunt multiplier when a target is not
 * what is wanted. The curve is applied in the texture's own space with a
 * soft shoulder, so the lift does not flatten the light end to white.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePNG, encodePNG } from "./png-codec.mjs";

const args = process.argv.slice(2);
const num = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : Number(args[i + 1]); };
const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!inPath || !outPath) { console.error("usage: glb-levels.mjs in.glb out.glb [--mean N] [--gain N]"); process.exit(2); }

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const l = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const b = src.subarray(off + 8, off + 8 + l);
  if (t === 0x4e4f534a) json = JSON.parse(b.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(b);
  off += 8 + l;
}
const imgIdx = json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index].source;
const view = json.bufferViews[json.images[imgIdx].bufferView];
const tex = decodePNG(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
const { w, h, ch, data } = tex;

// The mean of what is actually PAINTED. A flooded or empty margin is a big
// block of one value and would otherwise decide the exposure by itself.
let sum = 0, n = 0;
const lum = (o) => 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
for (let i = 0; i < w * h; i++) {
  const v = lum(i * ch);
  if (v < 2) continue;
  sum += v; n++;
}
const mean = n > 0 ? sum / n : 0;
const target = num("--mean", 0);
let gain = num("--gain", 0);
if (!gain) gain = target > 0 && mean > 1 ? target / mean : 1;

// A soft shoulder: below the knee it is a straight multiply, above it the
// curve rolls off, so lifting a dark texture does not clip its highlights
// into a flat white.
const KNEE = 170;
const curve = new Uint8Array(256);
for (let v = 0; v < 256; v++) {
  const lifted = v * gain;
  curve[v] = Math.round(
    lifted <= KNEE ? Math.min(255, lifted) : KNEE + (255 - KNEE) * (1 - Math.exp(-(lifted - KNEE) / (255 - KNEE))),
  );
}
for (let i = 0; i < w * h; i++) {
  const o = i * ch;
  data[o] = curve[data[o]];
  data[o + 1] = curve[data[o + 1]];
  data[o + 2] = curve[data[o + 2]];
}

const png = encodePNG(w, h, ch, data);
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
const mk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4);
hdr.writeUInt32LE(12 + 8 + jpad.length + 8 + newBin.length, 8);
writeFileSync(outPath, Buffer.concat([hdr, mk(jpad.length, 0x4e4f534a), jpad, mk(newBin.length, 0x004e4942), newBin]));
console.log(`  painted mean ${mean.toFixed(1)} -> gain x${gain.toFixed(2)}`);
