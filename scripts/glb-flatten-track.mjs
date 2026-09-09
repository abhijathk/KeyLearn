/**
 * Holds one component of one bone's translation constant through a clip.
 *
 *   node scripts/glb-flatten-track.mjs in.glb out.glb Running Hips y
 *
 * Written for a specific defect worth describing, because the shape of it
 * recurs: Meshy exported the puppy's `Running` with a hips translation that
 * sinks 0.850 units over the cycle, on a rig whose ENTIRE back leg — hip to
 * paw — measures 0.208. Four times the leg length, straight down.
 *
 * Its three sibling clips hold the hips at exactly 0.0000, so the authored
 * convention for this rig is plainly "the hips do not translate"; Running
 * is not expressing a bound, it is wrong.
 *
 * It also broke the other gaits, which is what made it hard to see. Ground
 * contact is measured across idle, walk and run together and the rig is
 * lifted so the lowest point of ANY of them sits on the path — so one clip
 * dipping four leg-lengths lifts the dog into the air for the other two.
 * "Walking is wrong" and "running is wrong" were one bad track.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath, clipName, boneName, axisName] = process.argv;
const axis = { x: 0, y: 1, z: 2 }[axisName.toLowerCase()];
const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}
const anim = json.animations.find((a) => a.name === clipName);
if (!anim) throw new Error(`no clip ${clipName}`);
let done = false;
for (const ch of anim.channels) {
  if (ch.target.path !== "translation") continue;
  if (json.nodes[ch.target.node].name !== boneName) continue;
  const a = json.accessors[anim.samplers[ch.sampler].output];
  const v = json.bufferViews[a.bufferView];
  const stride = v.byteStride || 12;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const vals = [];
  for (let k = 0; k < a.count; k++) vals.push(bin.readFloatLE(base + k * stride + axis * 4));
  // The value the clip STARTS at, which is also what its siblings hold.
  const hold = vals[0];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  for (let k = 0; k < a.count; k++) bin.writeFloatLE(hold, base + k * stride + axis * 4);
  console.log(`  ${clipName}/${boneName}.${axisName}: was ${lo.toFixed(4)}..${hi.toFixed(4)} (range ${(hi-lo).toFixed(4)}) -> held at ${hold.toFixed(4)}`);
  done = true;
}
if (!done) throw new Error(`no ${boneName} translation track in ${clipName}`);
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jb.length % 4)) % 4;
const jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (bin.length % 4)) % 4;
const bc = Buffer.concat([bin, Buffer.alloc(bp)]);
const head = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const rest = Buffer.concat([head(jc.length, 0x4e4f534a), jc, head(bc.length, 0x004e4942), bc]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + rest.length, 8);
writeFileSync(outPath, Buffer.concat([header, rest]));
console.log(`  -> ${outPath}`);
