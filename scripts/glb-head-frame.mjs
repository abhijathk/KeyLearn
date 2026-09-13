/**
 * The head's own frame, and where an eye sits in it.
 *
 *   node scripts/glb-head-frame.mjs file.glb [headBone] [tipBone] [earL] [earR]
 *
 * Written because placing two glowing eyes on an animal that has no eye
 * geometry means deciding three directions - forward, sideways, up - and
 * every way of GUESSING one of them was wrong. Assuming up and crossing for
 * sideways put the eyes on the jaw; taking up from the bone's world matrix
 * moved them and still reported a buffalo skull 0.235 high and 0.078 wide.
 *
 * The rig knows. `headend` says which way the muzzle points and the two ear
 * bones say which way is sideways, so both axes are read rather than assumed
 * and up is what is left over. This prints the frame and the head's extent
 * along each axis so the answer can be checked against an actual skull -
 * in seconds, offline, instead of by reloading a world that takes minutes.
 */
import { readFileSync } from "node:fs";
import { MeshoptDecoder } from "../node_modules/meshoptimizer/meshopt_decoder.mjs";

const [file, HEAD = "head", TIP = "headend", EARL = "earend", EARR = "R_earend"] =
  process.argv.slice(2);
if (!file) { console.error("usage: glb-head-frame.mjs file.glb [head] [tip] [earL] [earR]"); process.exit(2); }

const b = readFileSync(file);
let o = 12, j = null, bin = null;
while (o < b.length) {
  const L = b.readUInt32LE(o), T = b.readUInt32LE(o + 4), s = b.subarray(o + 8, o + 8 + L);
  if (T === 0x4e4f534a) j = JSON.parse(s);
  if (T === 0x004e4942) bin = Buffer.from(s);
  o += 8 + L;
}
await MeshoptDecoder.ready;
const views = j.bufferViews.map((v) => {
  const mo = v.extensions?.EXT_meshopt_compression;
  if (!mo) return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  const out = new Uint8Array(mo.count * mo.byteStride);
  const src = new Uint8Array(bin.buffer, bin.byteOffset + (mo.byteOffset ?? 0), mo.byteLength);
  MeshoptDecoder.decodeGltfBuffer(out, mo.count, mo.byteStride, src, mo.mode, mo.filter ?? "NONE");
  return Buffer.from(out);
});
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const rd = (ai) => {
  const a = j.accessors[ai], v = views[a.bufferView];
  const n = NC[a.type], sz = COMP[a.componentType];
  const stride = j.bufferViews[a.bufferView].byteStride || n * sz;
  const base = a.byteOffset ?? 0, out = [];
  for (let k = 0; k < a.count; k++) {
    const r = [];
    for (let c = 0; c < n; c++) {
      const p = base + k * stride + c * sz;
      r.push(a.componentType === 5126 ? v.readFloatLE(p)
           : a.componentType === 5122 ? v.readInt16LE(p) / (a.normalized ? 32767 : 1)
           : a.componentType === 5123 ? v.readUInt16LE(p) / (a.normalized ? 65535 : 1)
           : v.readUInt8(p));
    }
    out.push(n === 1 ? r[0] : r);
  }
  return out;
};
// column-major 4x4, glTF order
const mul = (a, c) => { const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) for (let m = 0; m < 4; m++)
    r[k * 4 + i] += a[m * 4 + i] * c[k * 4 + m];
  return r; };
const apply = (m, p) => [
  m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
  m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
  m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
];
function invert(m) { // general 4x4 inverse
  const inv = new Array(16);
  const a = m;
  inv[0]=a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10];
  inv[4]=-a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10];
  inv[8]=a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9];
  inv[12]=-a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
  inv[1]=-a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10];
  inv[5]=a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10];
  inv[9]=-a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9];
  inv[13]=a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
  inv[2]=a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6];
  inv[6]=-a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6];
  inv[10]=a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5];
  inv[14]=-a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5];
  inv[3]=-a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6];
  inv[7]=a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6];
  inv[11]=-a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5];
  inv[15]=a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
  let det = a[0]*inv[0] + a[1]*inv[4] + a[2]*inv[8] + a[3]*inv[12];
  if (det === 0) throw new Error("singular matrix");
  det = 1 / det;
  return inv.map((x) => x * det);
}
const sub = (a, c) => [a[0]-c[0], a[1]-c[1], a[2]-c[2]];
const dot = (a, c) => a[0]*c[0] + a[1]*c[1] + a[2]*c[2];
const cross = (a, c) => [a[1]*c[2]-a[2]*c[1], a[2]*c[0]-a[0]*c[2], a[0]*c[1]-a[1]*c[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const fx = (a) => `(${a.map((x) => x.toFixed(3)).join(", ")})`;

const skin = j.skins[0];
const names = skin.joints.map((i) => j.nodes[i].name);
const IBM = rd(skin.inverseBindMatrices);
const idx = (n) => names.findIndex((x) => x.toLowerCase() === n.toLowerCase());
const hi = idx(HEAD);
if (hi < 0) { console.error(`no bone "${HEAD}"; bones: ${names.join(", ")}`); process.exit(1); }
const invHead = IBM[hi];
/** A bone's bind position, in the head's own local frame. */
const inHead = (n) => {
  const k = idx(n);
  if (k < 0) return null;
  return apply(mul(invHead, invert(IBM[k])), [0, 0, 0]);
};
const pTip = inHead(TIP), pL = inHead(EARL), pR = inHead(EARR);
// How far apart the two "sideways" bones actually are, relative to the head.
// The buffalo's two ear bones turned out to sit 2mm apart on a head 245mm
// long - co-located at bind, so the direction between them is authoring
// noise, and a frame built on it is a frame built on nothing.
const sep = pL && pR ? Math.hypot(...sub(pR, pL)) : 0;
console.log(`\n${file.split("/").pop()}   head="${HEAD}"`);
console.log(`  ${TIP} in head frame : ${pTip ? fx(pTip) : "MISSING"}`);
console.log(`  ${EARL} / ${EARR}    : ${pL ? fx(pL) : "MISSING"} / ${pR ? fx(pR) : "MISSING"}`);
if (!pTip || !pL || !pR) { console.error("  cannot build a frame without all three"); process.exit(1); }

let fwd = norm(pTip);
// Sideways, from whichever PAIR of bones is genuinely on opposite sides.
// The legs are the reliable pair on any quadruped: they are far apart, they
// are named symmetrically, and the body between them is not twisted, so the
// direction from one to the other is the animal's lateral axis wherever you
// measure it.
const PAIRS = [[EARL, EARR], ["frontleg", "R_frontleg"], ["backleg", "R_backleg"]];
let across = null, usedPair = null;
for (const [l, r] of PAIRS) {
  const a = inHead(l), c = inHead(r);
  if (!a || !c) continue;
  const d = sub(c, a);
  const len = Math.hypot(...d);
  console.log(`  pair ${l}/${r}: separation ${len.toFixed(4)}`);
  // A pair must be separated by a real fraction of the head's own size, or
  // it is telling you about rounding rather than about the animal.
  if (across == null && len > 0.15 * Math.hypot(...pTip)) { across = norm(d); usedPair = `${l}/${r}`; }
}
if (across == null) { console.error("  no usable lateral pair"); process.exit(1); }
console.log(`  lateral axis from ${usedPair}`);
fwd = norm(sub(fwd, across.map((x) => x * dot(fwd, across))));
let up = norm(cross(across, fwd));
// Which perpendicular is up: the ears sit ABOVE the muzzle line on any animal
// with ears on top of its head, so the ear midpoint decides the sign.
// Which perpendicular is up: the muzzle tip sits BELOW the poll on a grazing
// animal's rig, so the ear bones (on top of the skull) settle the sign.
const earMid = pL.map((x, i) => (x + pR[i]) / 2);
if (dot(earMid, up) < 0) up = up.map((x) => -x);
void sep;
console.log(`  forward ${fx(fwd)}   across ${fx(across)}   up ${fx(up)}`);
console.log(`  orthogonality: f.a=${dot(fwd,across).toExponential(1)} f.u=${dot(fwd,up).toExponential(1)} a.u=${dot(across,up).toExponential(1)}`);

// head-weighted vertices, in the head's frame
const mesh = j.meshes[0].primitives[0];
const P = rd(mesh.attributes.POSITION);
const JJ = rd(mesh.attributes.JOINTS_0);
const WW = rd(mesh.attributes.WEIGHTS_0);
const wNorm = j.accessors[mesh.attributes.WEIGHTS_0].normalized ? 255 : 1;
const owns = (i) => {
  for (let c = 0; c < 4; c++) if (JJ[i][c] === hi && WW[i][c] / wNorm >= 0.5) return true;
  return false;
};
let f0 = Infinity, f1 = -Infinity, found = 0;
const pts = [];
for (let i = 0; i < P.length; i++) {
  if (!owns(i)) continue;
  found++;
  const p = apply(invHead, P[i]);
  pts.push(p);
  const df = dot(p, fwd);
  if (df < f0) f0 = df;
  if (df > f1) f1 = df;
}
console.log(`  head vertices: ${found} of ${P.length}`);
console.log(`  extent along forward: ${f0.toFixed(3)} .. ${f1.toFixed(3)}  (${(f1-f0).toFixed(3)})`);
let U0 = Infinity, U1 = -Infinity, A1 = 0;
for (const p of pts) {
  const du = dot(p, up), da = Math.abs(dot(p, across));
  if (du < U0) U0 = du; if (du > U1) U1 = du; if (da > A1) A1 = da;
}
console.log(`  whole head:  height ${(U1-U0).toFixed(3)}  width ${(2*A1).toFixed(3)}  length ${(f1-f0).toFixed(3)}`);

const EYE_FWD = Number(process.env.EYE_FWD ?? 0.66);
const EYE_UP = Number(process.env.EYE_UP ?? 0.62);
const EYE_OUT = Number(process.env.EYE_OUT ?? 0.82);
const eyeF = f0 + (f1 - f0) * EYE_FWD;
const slab = (f1 - f0) * 0.14;
let u0 = Infinity, u1 = -Infinity, a1 = 0, near = 0;
for (const p of pts) {
  if (Math.abs(dot(p, fwd) - eyeF) > slab) continue;
  near++;
  const du = dot(p, up), da = Math.abs(dot(p, across));
  if (du < u0) u0 = du; if (du > u1) u1 = du; if (da > a1) a1 = da;
}
console.log(`  slice at the eye line (${near} verts): height ${(u1-u0).toFixed(3)} width ${(2*a1).toFixed(3)}`);
console.log(`  EYE at  fwd ${eyeF.toFixed(3)}  up ${(u0 + (u1-u0)*EYE_UP).toFixed(3)}  out ${(a1*EYE_OUT).toFixed(3)}   sprite ${( (f1-f0) * 0.2).toFixed(3)}\n`);
