#!/usr/bin/env node
/**
 * Stops a model glowing in daylight, without throwing away the glow.
 *
 *   node scripts/glb-daylight-material.mjs in.glb out.glb
 *
 * The buffalo shipped with `emissiveFactor: [1,1,1]` and its own albedo bound
 * as an emissive texture - that is, lit at full strength by itself, in every
 * light, at noon. It also had no `metallicFactor` at all, and glTF's default
 * for that is 1.0: fully metallic. The two faults hid each other. Zeroing the
 * emissive alone turns the animal BLACK, because what is left is a mirror with
 * nothing to reflect, and that is exactly what happened the first time this was
 * tried - so the glow went back on and stayed on.
 *
 * Both have to move together: emissive off, metallic to 0, roughness to
 * something a hide actually has. The specular boost goes too - 2.0 on a
 * specularColorFactor is another way of saying "shiny wet animal".
 *
 * The emissive TEXTURE is deliberately left bound. The map costs nothing while
 * the factor is zero, and keeping it means the night pass can raise the factor
 * again and get a glow that follows the animal's own markings, rather than a
 * uniform wash that would have to be invented.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error("usage: glb-daylight-material.mjs in.glb out.glb");
  process.exit(2);
}
const src = readFileSync(inPath);
let off = 12;
const chunks = [];
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), type = src.readUInt32LE(off + 4);
  chunks.push({ type, body: src.subarray(off + 8, off + 8 + len) });
  off += 8 + len;
}
const jsonChunk = chunks.find((c) => c.type === 0x4e4f534a);
const json = JSON.parse(jsonChunk.body.toString("utf8"));

let changed = 0;
for (const m of json.materials ?? []) {
  const before = JSON.stringify(m);
  // NOT zero. These models were authored lit by their own emissive, so taking
  // it to nothing leaves them reading as a silhouette in the shade - the
  // buffalo went from glowing to too dark in one step. A low factor keeps the
  // lift the artist built in without the animal looking like it swallowed a
  // lamp, and leaves the night pass somewhere to raise it from.
  const keep = Number(process.env.EMISSIVE ?? 0.18);
  m.emissiveFactor = [keep, keep, keep];
  const pbr = (m.pbrMetallicRoughness ??= {});
  // Undefined means 1.0 - fully metallic - which is the trap.
  pbr.metallicFactor = 0;
  pbr.roughnessFactor = pbr.roughnessFactor ?? 0.9;
  const spec = m.extensions?.KHR_materials_specular;
  if (spec?.specularColorFactor) {
    spec.specularColorFactor = [1, 1, 1];
  }
  if (JSON.stringify(m) !== before) {
    changed++;
    console.log(`  ${m.name ?? "material"}: emissive ${keep}, metallic 0, roughness ${pbr.roughnessFactor}${spec ? ", specular 1" : ""}`);
    if (m.emissiveTexture != null) {
      console.log(`    emissiveTexture kept (index ${m.emissiveTexture.index}) so night can raise it again`);
    }
  }
}

const jb = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jb.length % 4)) % 4;
const out = [Buffer.alloc(12)];
out[0].write("glTF", 0);
out[0].writeUInt32LE(2, 4);
const parts = [];
for (const c of chunks) {
  const body = c.type === 0x4e4f534a ? Buffer.concat([jb, Buffer.alloc(jp, 0x20)]) : c.body;
  const h = Buffer.alloc(8);
  h.writeUInt32LE(body.length, 0);
  h.writeUInt32LE(c.type, 4);
  parts.push(h, body);
}
const total = 12 + parts.reduce((n, b) => n + b.length, 0);
out[0].writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([...out, ...parts]));
console.log(`  ${changed} material(s) changed; wrote ${outPath} (${total.toLocaleString()} bytes)`);
