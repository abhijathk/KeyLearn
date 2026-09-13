/**
 * Give the buffalo a neck.
 *
 * The source rig has none. `chest` sits at the withers and `head` pivots
 * essentially on top of it, so the head can only SWING — measured, the muzzle
 * cannot get below about 0.8m off the ground, and pushing it lower only tucks
 * it back under the chest instead of reaching forward into the grass. A
 * grazing bovid lowers its neck; this rig could only nod.
 *
 * This inserts two neck joints between `chest` and `head`, splitting the
 * existing chest->head offset three ways so the REST POSE IS UNCHANGED — with
 * identity rotations on the new joints every existing clip still evaluates to
 * exactly what it did before. Then it moves the skin weights of the neck
 * region off `head` and onto the new joints, graded by how far along the neck
 * each vertex sits, so bending them deforms the neck instead of the skull.
 *
 *   node scripts/buffalo-add-neck.mjs <in.glb> <out.glb>
 */
import { readFileSync, writeFileSync } from "node:fs";

const [inPath, outPath] = process.argv.slice(2);
const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const l = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const b = src.subarray(off + 8, off + 8 + l);
  if (t === 0x4e4f534a) json = JSON.parse(b.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(b);
  off += 8 + l;
}
const acc = json.accessors, views = json.bufferViews;
const compSize = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 };
const compRead = { 5120:"readInt8", 5121:"readUInt8", 5122:"readInt16LE", 5123:"readUInt16LE", 5125:"readUInt32LE", 5126:"readFloatLE" };
const compWrite= { 5120:"writeInt8", 5121:"writeUInt8", 5122:"writeInt16LE", 5123:"writeUInt16LE", 5125:"writeUInt32LE", 5126:"writeFloatLE" };
const numOf = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 };
const readAcc = (i) => { const a = acc[i], v = views[a.bufferView];
  const n = numOf[a.type], sz = compSize[a.componentType];
  const st = v.byteStride || n * sz, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) { const r = [];
    for (let c = 0; c < n; c++) r.push(bin[compRead[a.componentType]](base + k * st + c * sz));
    out.push(r); }
  return out; };
const writeAcc = (i, rows) => { const a = acc[i], v = views[a.bufferView];
  const n = numOf[a.type], sz = compSize[a.componentType];
  const st = v.byteStride || n * sz, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  rows.forEach((r, k) => r.forEach((x, c) =>
    bin[compWrite[a.componentType]](x, base + k * st + c * sz))); };

// ── 4x4 helpers (column-major, as glTF stores them) ──────────────────────
const mul = (A, B) => { const C = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0;
    for (let k = 0; k < 4; k++) s += A[k*4+r] * B[c*4+k];
    C[c*4+r] = s; } return C; };
const transM = (t) => [1,0,0,0, 0,1,0,0, 0,0,1,0, t[0],t[1],t[2],1];
function inv(m) {                                   // general 4x4 inverse
  const a = m, o = new Array(16);
  const s0=a[0]*a[5]-a[4]*a[1], s1=a[0]*a[6]-a[8]*a[1], s2=a[0]*a[7]-a[12]*a[1];
  const s3=a[4]*a[6]-a[8]*a[5], s4=a[4]*a[7]-a[12]*a[5], s5=a[8]*a[7]-a[12]*a[6];
  const c5=a[10]*a[15]-a[14]*a[11], c4=a[9]*a[15]-a[13]*a[11], c3=a[9]*a[14]-a[13]*a[10];
  const c2=a[2]*a[15]-a[14]*a[3], c1=a[2]*a[11]-a[10]*a[3], c0=a[2]*a[7]-a[6]*a[3];
  const det = s0*c5-s1*c4+s2*c3+s3*c2-s4*c1+s5*c0, d = 1/det;
  o[0]=( a[5]*c5-a[6]*c4+a[7]*c3)*d;  o[1]=(-a[1]*c5+a[2]*c4-a[3]*c3)*d;
  o[2]=( a[13]*s5-a[14]*s4+a[15]*s3)*d; o[3]=(-a[9]*s5+a[10]*s4-a[11]*s3)*d;
  o[4]=(-a[4]*c5+a[6]*c2-a[7]*c1)*d;  o[5]=( a[0]*c5-a[2]*c2+a[3]*c1)*d;
  o[6]=(-a[12]*s5+a[14]*s2-a[15]*s1)*d; o[7]=( a[8]*s5-a[10]*s2+a[11]*s1)*d;
  o[8]=( a[4]*c4-a[5]*c2+a[7]*c0)*d;  o[9]=(-a[0]*c4+a[1]*c2-a[3]*c0)*d;
  o[10]=( a[12]*s4-a[13]*s2+a[15]*s0)*d; o[11]=(-a[8]*s4+a[9]*s2-a[11]*s0)*d;
  o[12]=(-a[4]*c3+a[5]*c1-a[6]*c0)*d; o[13]=( a[0]*c3-a[1]*c1+a[2]*c0)*d;
  o[14]=(-a[12]*s3+a[13]*s1-a[14]*s0)*d; o[15]=( a[8]*s3-a[9]*s1+a[10]*s0)*d;
  return o;
}
const xform = (m, v) => [
  m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
  m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
  m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];

const skin = json.skins[0];
const nameOf = (i) => json.nodes[i].name;
const idByName = Object.fromEntries(json.nodes.map((n, i) => [n.name, i]));
const chestI = idByName.chest, headI = idByName.head;
if (chestI == null || headI == null) throw new Error("chest/head not found");

const headT = json.nodes[headI].translation ?? [0,0,0];
const third = headT.map((x) => x / 3);

// ── insert neck0 / neck1, splitting the offset so the rest pose is identical
const neck0 = json.nodes.length;
json.nodes.push({ name: "neck0", translation: third.slice(), rotation: [0,0,0,1], children: [neck0 + 1] });
const neck1 = json.nodes.length;
json.nodes.push({ name: "neck1", translation: third.slice(), rotation: [0,0,0,1], children: [headI] });
json.nodes[headI].translation = third.slice();
json.nodes[chestI].children = (json.nodes[chestI].children ?? []).map((c) => (c === headI ? neck0 : c));

// ── skin: joints + inverse bind matrices ────────────────────────────────
const ibm = readAcc(skin.inverseBindMatrices);
const jointIdx = Object.fromEntries(skin.joints.map((n, i) => [n, i]));
const gChest = inv(ibm[jointIdx[chestI]]);                    // bind global of chest
const gNeck0 = mul(gChest, transM(third));
const gNeck1 = mul(gNeck0, transM(third));
skin.joints.push(neck0, neck1);
const newIbm = [...ibm, inv(gNeck0), inv(gNeck1)];

// rewrite the IBM accessor into fresh bytes appended to the BIN
const pad = (n) => (4 - (n % 4)) % 4;
const ibmBytes = Buffer.alloc(newIbm.length * 64);
newIbm.forEach((m, k) => m.forEach((x, c) => ibmBytes.writeFloatLE(x, k * 64 + c * 4)));
const ibmOffset = bin.length + pad(bin.length);
bin = Buffer.concat([bin, Buffer.alloc(pad(bin.length)), ibmBytes]);
views.push({ buffer: 0, byteOffset: ibmOffset, byteLength: ibmBytes.length });
acc.push({ bufferView: views.length - 1, componentType: 5126, count: newIbm.length, type: "MAT4" });
skin.inverseBindMatrices = acc.length - 1;

// ── move the neck region's weights off `head` onto the new joints ───────
const prim = json.meshes[0].primitives[0];
const pos = readAcc(prim.attributes.POSITION);
const jj  = readAcc(prim.attributes.JOINTS_0);
const ww  = readAcc(prim.attributes.WEIGHTS_0);
const headJ = jointIdx[headI], chestJ = jointIdx[chestI];
const n0J = skin.joints.indexOf(neck0), n1J = skin.joints.indexOf(neck1);
// bind-space positions of the chest and head pivots, and the axis between them
const pChest = xform(gChest, [0,0,0]);
const gHead  = inv(ibm[headJ]);
const pHead  = xform(gHead, [0,0,0]);
const pNeck1 = xform(gNeck1, [0,0,0]);
const axis = [pHead[0]-pChest[0], pHead[1]-pChest[1], pHead[2]-pChest[2]];
const L2 = axis[0]**2 + axis[1]**2 + axis[2]**2;

// Weights are BLENDED, not switched.
//
// Reassigning each vertex to whichever joint was nearest tore the mane into
// spikes: two neighbouring hairs either side of the cut-off moved with
// different bones, so the surface came apart. Skinning wants a smooth
// partition of unity, so each vertex's `head` weight is split across the
// chain by where it sits along the neck, and neighbouring vertices always get
// nearly the same split.
const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
const wComp = acc[prim.attributes.WEIGHTS_0].componentType;
const wNorm = wComp !== 5126;                    // normalized ubyte/ushort
const wMax  = wComp === 5121 ? 255 : wComp === 5123 ? 65535 : 1;
let touched = 0;
for (let i = 0; i < pos.length; i++) {
  const slot = jj[i].findIndex((j) => j === headJ);
  if (slot < 0) continue;
  const wRaw = ww[i][slot];
  const w = wNorm ? wRaw / wMax : wRaw;
  if (w <= 0) continue;
  const d = [pos[i][0]-pChest[0], pos[i][1]-pChest[1], pos[i][2]-pChest[2]];
  const t = (d[0]*axis[0] + d[1]*axis[1] + d[2]*axis[2]) / L2;   // 0 chest .. 1 head pivot
  // Four overlapping bands, summing to 1 everywhere.
  //
  // The skull is claimed by DISTANCE from the head pivot, not by where it
  // projects onto the neck axis. The horns sit high and to the sides, well off
  // that axis, so projecting them put them at a low `t` and handed them to the
  // neck - measured, the horn region came out 58% neck1, and pitching the head
  // 45 degrees moved the horns 0.10m while the face swung right down. They
  // stayed pointing up while the animal put its head down to charge.
  // The skull is claimed by a NEAREST-PIVOT test, not by a fixed radius.
  //
  // A radius cannot separate the horns from the hump: the horn tips stand
  // ~1.6 neck-lengths from the head pivot and the hump is a similar distance,
  // so any radius wide enough to take the horns also takes the hump. Measured
  // with a 1.35 radius, the horn TIPS came out 100% neck0/neck1 - the base of
  // each horn moved with the skull and the tip stayed behind, which is why the
  // horns sheared instead of turning with the head.
  //
  // Comparing distance to the HEAD pivot against distance to the NECK1 pivot
  // does separate them: the horns sit almost directly above the head pivot and
  // well away from neck1, while the hump is close to neck1 and far from the
  // head. The 1.35 bias gives the head clear ownership of anything horn-like.
  const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  const dHead = dist(pos[i], pHead), dNeck = dist(pos[i], pNeck1);
  const skull = 1 - ramp(dHead / Math.max(1e-6, dNeck * 1.35), 0.85, 1.15);
  const fHead  = Math.max(ramp(t, 0.85, 1.25), skull);      // the skull, horns included
  const fNeck1 = ramp(t, 0.35, 0.75) * (1 - fHead);         // upper neck
  const fNeck0 = ramp(t, -0.10, 0.30) * (1 - fHead - fNeck1);
  const fChest = Math.max(0, 1 - fHead - fNeck1 - fNeck0);   // mane over the withers
  const parts = [[headJ, fHead], [n1J, fNeck1], [n0J, fNeck0], [chestJ, fChest]]
    .filter(([, f]) => f > 0.001)
    .sort((a, b) => b[1] - a[1]);
  // Fold the split into the vertex's four slots: the original head slot takes
  // the biggest share, and the rest go into free slots (or merge with a slot
  // that already drives the same joint).
  const enc = (x) => (wNorm ? Math.round(x * wMax) : x);
  let remaining = w;
  jj[i][slot] = parts[0][0]; ww[i][slot] = enc(w * parts[0][1]);
  remaining -= w * parts[0][1];
  for (let pi = 1; pi < parts.length; pi++) {
    const [joint, frac] = parts[pi];
    const share = w * frac;
    let dst = jj[i].findIndex((j, k) => k !== slot && j === joint && (wNorm ? ww[i][k] : ww[i][k]) > 0);
    if (dst < 0) dst = jj[i].findIndex((j, k) => k !== slot && (wNorm ? ww[i][k] : ww[i][k]) <= 0);
    if (dst < 0) { ww[i][slot] = enc((wNorm ? ww[i][slot]/wMax : ww[i][slot]) + share); continue; }
    jj[i][dst] = joint;
    ww[i][dst] = enc((wNorm ? ww[i][dst]/wMax : ww[i][dst]) + share);
  }
  touched++;
}
writeAcc(prim.attributes.JOINTS_0, jj);
writeAcc(prim.attributes.WEIGHTS_0, ww);
const moved = touched;

// ── repack ──────────────────────────────────────────────────────────────
json.buffers[0].byteLength = bin.length;
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jc = Buffer.concat([jb, Buffer.alloc(pad(jb.length), 0x20)]);
const bc = Buffer.concat([bin, Buffer.alloc(pad(bin.length), 0)]);
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67,0); h.writeUInt32LE(2,4);
h.writeUInt32LE(12+8+jc.length+8+bc.length,8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jc.length,0); jh.writeUInt32LE(0x4e4f534a,4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bc.length,0); bh.writeUInt32LE(0x004e4942,4);
writeFileSync(outPath, Buffer.concat([h,jh,jc,bh,bc]));
console.log(`neck0/neck1 inserted between chest and head; joints ${skin.joints.length - 2} -> ${skin.joints.length}`);
console.log(`skin weights moved off the skull and onto the neck: ${moved} vertices`);
