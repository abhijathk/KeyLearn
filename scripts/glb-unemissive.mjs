/**
 * Brings a Meshy "unlit-style" material into line with a lit scene.
 *
 * Meshy exports some models with `emissiveFactor: [1,1,1]` and the colour
 * map wired to BOTH baseColor and emissive. That is a sensible way to ship
 * something meant to be viewed unlit — and wrong in a world with a sun, a
 * hemisphere light and a lantern: the texture is added a second time as
 * self-illumination, so the model renders at roughly double brightness with
 * its highlights clipped. It reads as washed out, or "pale", next to
 * characters lit normally.
 *
 * Every other character in this game ships plain lit PBR, so this makes the
 * odd one out match rather than inventing a look for it.
 *
 *   node scripts/glb-unemissive.mjs file.glb
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
const b = readFileSync(path);
let off = 12, json = null;
const chunks = [];
while (off + 8 <= b.length) {
  const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
  const body = b.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  else chunks.push({ type, body });
  off += 8 + len;
}
for (const m of json.materials ?? []) {
  const before = JSON.stringify({ e: m.emissiveFactor, t: !!m.emissiveTexture,
    s: m.extensions?.KHR_materials_specular?.specularColorFactor });
  m.emissiveFactor = [0, 0, 0];
  delete m.emissiveTexture;
  const spec = m.extensions?.KHR_materials_specular;
  // Above 1 is not a physical specular colour; it is a brightness boost, and
  // it is the other half of the glare.
  if (spec?.specularColorFactor) spec.specularColorFactor = [1, 1, 1];
  console.log(`  ${m.name}: ${before}`);
  console.log(`    -> emissive [0,0,0], emissiveTexture removed, specular [1,1,1]`);
}
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jb.length % 4)) % 4;
const jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const head = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const parts = [head(jc.length, 0x4e4f534a), jc];
for (const c of chunks) {
  const p = (4 - (c.body.length % 4)) % 4;
  const body = Buffer.concat([c.body, Buffer.alloc(p)]);
  parts.push(head(body.length, c.type), body);
}
const rest = Buffer.concat(parts);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + rest.length, 8);
writeFileSync(path, Buffer.concat([header, rest]));
console.log(`  written: ${path}`);
