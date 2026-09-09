/**
 * Renames animation clips inside a GLB, and nothing else.
 *
 * Clip names are the only handle the kids world has on an animation — every
 * gait, pose and reaction is found by matching the name — so a Meshy export
 * that ships UUIDs for names has animations the game cannot see. The names
 * live entirely in the JSON chunk, so this rewrites that chunk and copies
 * the binary one across untouched: no keyframe, no accessor and no byte of
 * animation data is read, let alone changed.
 *
 *   node scripts/glb-rename-clips.mjs in.glb out.glb old=New old2=New2 ...
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath, ...pairs] = process.argv;
const buf = readFileSync(inPath);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a glb");

let off = 12;
let json = null;
const chunks = [];
while (off + 8 <= buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  const body = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  else chunks.push({ type, body });
  off += 8 + len;
}
if (json == null) throw new Error("no json chunk");

// `Name=NewName` renames; a bare `-Name` drops the clip entirely.
//
// Dropping matters for a follower: a clip carrying ROOT MOTION travels the
// character through space, and a companion's position comes from the player
// it is following — so the two fight and it slides away. Leaving such a clip
// in the file and hoping the matcher passes it over is a bet on clip order.
const drops = new Set(pairs.filter((p) => p.startsWith("-")).map((p) => p.slice(1)));
const map = new Map(pairs.filter((p) => !p.startsWith("-")).map((p) => {
  const i = p.indexOf("=");
  return [p.slice(0, i), p.slice(i + 1)];
}));
// Captured BEFORE the loop below: checking afterwards asks whether the old
// names are still there, and they are not — that is the whole point of the
// loop. The first version did exactly that and refused every valid rename.
const before = new Set((json.animations ?? []).map((a) => a.name));
const missing = [...map.keys(), ...drops].filter((k) => !before.has(k));
if (missing.length) {
  throw new Error(`these clips are not in the file: ${missing.join(", ")}`);
}
let renamed = 0;
for (const clip of json.animations ?? []) {
  const to = map.get(clip.name);
  if (to != null) {
    console.log(`  "${clip.name}"  ->  "${to}"`);
    clip.name = to;
    renamed++;
  }
}
if (drops.size) {
  const kept = (json.animations ?? []).filter((a) => !drops.has(a.name));
  for (const a of json.animations ?? []) {
    if (drops.has(a.name)) console.log(`  "${a.name}"  ->  DROPPED`);
  }
  json.animations = kept;
}

const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);
const parts = [];
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(jsonChunk.length, 0);
jsonHead.writeUInt32LE(0x4e4f534a, 4);
parts.push(jsonHead, jsonChunk);
for (const c of chunks) {
  const pad = (4 - (c.body.length % 4)) % 4;
  const body = Buffer.concat([c.body, Buffer.alloc(pad)]);
  const head = Buffer.alloc(8);
  head.writeUInt32LE(body.length, 0);
  head.writeUInt32LE(c.type, 4);
  parts.push(head, body);
}
const rest = Buffer.concat(parts);
header.writeUInt32LE(12 + rest.length, 8);
writeFileSync(outPath, Buffer.concat([header, rest]));
console.log(`\n${renamed} clip(s) renamed  ->  ${outPath}`);
