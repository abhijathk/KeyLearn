/**
 * Makes a tail actually wag.
 *
 *   node scripts/glb-amplify-wag.mjs in.glb out.glb Tail_Wag 2.6
 *
 * Meshy authored the puppy's wag at 8-12 degrees per bone. Compounded down
 * a five-bone chain that is a real movement, but on a companion drawn 1.5
 * units tall it is a few pixels — the tail reads as trembling rather than
 * wagging.
 *
 * The amplification is done about each bone's OWN mean orientation across
 * the clip, not about its rest pose or its first key:
 *
 *   - the mean is the centre the tail actually swings around, so scaling
 *     the deviation from it widens the sweep symmetrically instead of
 *     throwing the whole tail to one side;
 *   - it is expressed as a quaternion delta, so the motion keeps whatever
 *     axis the animator used (here 83% local Z) rather than being forced
 *     onto an axis this script guessed;
 *   - nothing else in the clip is touched: only rotation tracks, only on
 *     bones named for the tail.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath, clipName, factorRaw] = process.argv;
const factor = Number(factorRaw ?? 2.5);
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
if (!anim) throw new Error(`no clip named ${clipName}`);

const mul = (a, b) => [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2],
];
const inv = (q) => [-q[0], -q[1], -q[2], q[3]];
const norm = (q) => { const l = Math.hypot(...q) || 1; return q.map((v) => v / l); };

const deg = (r) => (r * 180) / Math.PI;
let touched = 0;
for (const ch of anim.channels) {
  const nodeName = json.nodes[ch.target.node].name;
  if (ch.target.path !== "rotation" || !/tail/i.test(nodeName)) continue;
  const s = anim.samplers[ch.sampler];
  const a = json.accessors[s.output];
  const v = json.bufferViews[a.bufferView];
  const stride = v.byteStride || 16;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const keys = [];
  for (let k = 0; k < a.count; k++) {
    const q = [];
    for (let c = 0; c < 4; c++) q.push(bin.readFloatLE(base + k * stride + c * 4));
    keys.push(q);
  }
  // Mean orientation, with sign flips folded in so opposite-hemisphere
  // quaternions do not cancel each other out.
  const acc = [0, 0, 0, 0];
  const ref0 = keys[0];
  for (const q of keys) {
    const dot = q[0]*ref0[0] + q[1]*ref0[1] + q[2]*ref0[2] + q[3]*ref0[3];
    const sgn = dot < 0 ? -1 : 1;
    for (let c = 0; c < 4; c++) acc[c] += sgn * q[c];
  }
  const mean = norm(acc);
  const meanInv = inv(mean);
  let before = 0, after = 0;
  for (let k = 0; k < keys.length; k++) {
    const d = mul(meanInv, keys[k]);
    const w = Math.min(1, Math.max(-1, d[3]));
    const ang = 2 * Math.acos(Math.abs(w));
    before = Math.max(before, ang);
    const sn = Math.sqrt(Math.max(0, 1 - w * w));
    let out = keys[k];
    if (sn > 1e-6 && ang > 1e-6) {
      const sign = w < 0 ? -1 : 1;
      const axis = [sign * d[0] / sn, sign * d[1] / sn, sign * d[2] / sn];
      const na = Math.min(Math.PI * 0.9, ang * factor);
      after = Math.max(after, na);
      const hs = Math.sin(na / 2);
      out = norm(mul(mean, [axis[0]*hs, axis[1]*hs, axis[2]*hs, Math.cos(na / 2)]));
    }
    for (let c = 0; c < 4; c++) bin.writeFloatLE(out[c], base + k * stride + c * 4);
  }
  console.log(`  ${nodeName.padEnd(11)} ${deg(before).toFixed(1).padStart(5)}° -> ${deg(after).toFixed(1).padStart(5)}°`);
  touched++;
}
if (touched === 0) throw new Error("no tail rotation tracks found");

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
console.log(`  ${touched} tail track(s) amplified ${factor}x -> ${outPath}`);
