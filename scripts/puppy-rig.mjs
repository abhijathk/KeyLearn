/**
 * Give the puppy the joints it never had.
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
 *   node scripts/puppy-rig.mjs <in.glb> <out.glb>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// ── neutralise the rotations of the bones that used to drive nothing ─────
//
// `headend`, `earend` and `R_earend` are animated in every existing clip, but
// they drove ZERO vertices - so whatever those curves contained was invisible
// and is, in practice, junk. The moment the chin, ears and tongue are bound to
// them that junk starts deforming the face: it moved 656 vertices of the
// otherwise-untouched Walk by up to 0.10m. Their rotation channels are dropped
// so the bones sit at rest until something deliberately animates them.
{
  const dead = new Set(["headend", "earend", "R_earend"]
    .map((n) => json.nodes.findIndex((x) => x.name === n)).filter((i) => i >= 0));
  let n = 0;
  for (const cl of json.animations ?? []) {
    const before = cl.channels.length;
    cl.channels = cl.channels.filter(
      (ch) => !(dead.has(ch.target.node) && ch.target.path === "rotation"));
    n += before - cl.channels.length;
  }
  console.log(`dropped ${n} rotation channels from bones that drove no geometry`);
}

// ── drop the redundant constant channels ────────────────────────────────
//
// Every clip carries a translation AND a scale channel for all 27 joints, and
// 26 of the 27 translations are CONSTANT - they merely restate the bone's rest
// offset. Harmless until the rig changes: inserting the neck re-splits the
// chest->head offset, and the head's constant channel then overrode the new
// rest value with the old full one, putting the head 5/3 of the way out and
// shifting the existing Walk by 0.31m.
//
// Stripping them fixes that, and shrinks every clip: only the root's
// translation actually varies, and no scale channel varies at all.
{
  let dropped = 0;
  for (const cl of json.animations ?? []) {
    cl.channels = cl.channels.filter((ch) => {
      if (ch.target.path === "rotation") return true;
      const v = readAcc(cl.samplers[ch.sampler].output);
      const first = v[0];
      const constant = v.every((x) => x.every((c, i) => Math.abs(c - first[i]) < 1e-6));
      if (!constant) return true;
      // a constant channel is only redundant if it matches the rest value
      const rest = ch.target.path === "scale"
        ? (json.nodes[ch.target.node].scale ?? [1,1,1])
        : (json.nodes[ch.target.node].translation ?? [0,0,0]);
      const same = first.every((c, i) => Math.abs(c - rest[i]) < 1e-5);
      if (same) { dropped++; return false; }
      return true;
    });
  }
  console.log(`dropped ${dropped} constant translation/scale channels that only restated rest`);
}

// Insert `n` joints into the gap between a parent and its child, splitting the
// child's offset evenly so the REST POSE IS UNCHANGED and every existing clip
// still evaluates identically.
function splitChain(parentName, childName, names) {
  const pI = idByName[parentName], cI = idByName[childName];
  const off = json.nodes[cI].translation ?? [0,0,0];
  const step = off.map((x) => x / (names.length + 1));
  const made = [];
  let attachTo = pI;
  for (let k = 0; k < names.length; k++) {
    const idx = json.nodes.length;
    json.nodes.push({ name: names[k], translation: step.slice(), rotation: [0,0,0,1] });
    json.nodes[attachTo].children = (json.nodes[attachTo].children ?? [])
      .map((c) => (c === cI ? idx : c));
    if (k > 0) json.nodes[made[k-1]].children = [idx];
    made.push(idx); attachTo = idx;
  }
  json.nodes[made[made.length-1]].children = [cI];
  json.nodes[cI].translation = step.slice();
  return made;
}
const headT = json.nodes[headI].translation ?? [0,0,0];
const third = headT.map((x) => x / 3);

// ── insert neck0 / neck1, splitting the offset so the rest pose is identical
// A DOG'S SPINE BENDS. The research is unambiguous: 3-4 degrees of lateral
// flexion per intervertebral joint across ~20 joints, so a 60-80 degree C-curve
// is available on a hard turn - where a horse gets roughly ONE dog-joint's worth
// for its entire back. This puppy had a single joint between Hips and chest and
// could not curve at all, which is why it turned like a piece of furniture.
// Two joints is not twenty, but it is the difference between a body that bends
// and one that does not.
const [spine0, spine1] = splitChain("Hips", "chest", ["spine0", "spine1"]);
const neck0 = json.nodes.length;
json.nodes.push({ name: "neck0", translation: third.slice(), rotation: [0,0,0,1], children: [neck0 + 1] });
const neck1 = json.nodes.length;
json.nodes.push({ name: "neck1", translation: third.slice(), rotation: [0,0,0,1], children: [headI] });
// A TIP joint for each ear. One bone per ear can only swivel it rigidly from
// the base; a floppy ear needs a second segment so the lower half can lag and
// swing. The tip sits along the ear's own hang direction, and starts at
// identity so the rest pose is untouched.
const earLI = idByName.earend, earRI = idByName.R_earend;
const earTipL = json.nodes.length;
json.nodes.push({ name: "earTipL", translation: [0,0,0], rotation: [0,0,0,1] });
const earTipR = json.nodes.length;
json.nodes.push({ name: "earTipR", translation: [0,0,0], rotation: [0,0,0,1] });
json.nodes[earLI].children = [...(json.nodes[earLI].children ?? []), earTipL];
json.nodes[earRI].children = [...(json.nodes[earRI].children ?? []), earTipR];
// A TONGUE joint. The puppy does have a tongue - 105 vertices lolling past the
// snout - but it was welded to `head` and had never moved. Its indices were
// found by sampling the base-colour texture for pink texels at the muzzle and
// are stored alongside this script, so the build is reproducible without
// needing to read the texture again. It hangs off the CHIN, so it follows the
// jaw and pants for free whenever the chin moves.
const chinI = idByName.headend;
const tongueI = json.nodes.length;
json.nodes.push({ name: "tongue", translation: [0,0,0], rotation: [0,0,0,1] });
json.nodes[chinI].children = [...(json.nodes[chinI].children ?? []), tongueI];
json.nodes[headI].translation = third.slice();
json.nodes[chestI].children = (json.nodes[chestI].children ?? []).map((c) => (c === headI ? neck0 : c));

// ── skin: joints + inverse bind matrices ────────────────────────────────
const ibm = readAcc(skin.inverseBindMatrices);
const jointIdx = Object.fromEntries(skin.joints.map((n, i) => [n, i]));
const gChest = inv(ibm[jointIdx[chestI]]);                    // bind global of chest
// bind globals for the two spine joints, from the Hips' own bind transform
const gHips   = inv(ibm[jointIdx[idByName.Hips]]);
const chestStep = json.nodes[idByName.chest].translation;
const gSpine0 = mul(gHips, transM(chestStep));
const gSpine1 = mul(gSpine0, transM(chestStep));
const gNeck0 = mul(gChest, transM(third));
const gNeck1 = mul(gNeck0, transM(third));
skin.joints.push(neck0, neck1, earTipL, earTipR, tongueI, spine0, spine1);
json.nodes[neck0].name = 'neck0'; json.nodes[neck1].name = 'neck1';
// The ear tips sit at the same bind place as their parents, so their inverse
// bind matrices are their parents' - the offset lives entirely in the weights.
const newIbm = [...ibm, inv(gNeck0), inv(gNeck1),
                ibm[jointIdx[idByName.earend]], ibm[jointIdx[idByName.R_earend]],
                ibm[jointIdx[idByName.headend]],
                inv(gSpine0), inv(gSpine1)];

// rewrite the IBM accessor into fresh bytes appended to the BIN
const pad = (n) => (4 - (n % 4)) % 4;
const ibmBytes = Buffer.alloc(newIbm.length * 64);
newIbm.forEach((m, k) => m.forEach((x, c) => ibmBytes.writeFloatLE(x, k * 64 + c * 4)));
const ibmOffset = bin.length + pad(bin.length);
bin = Buffer.concat([bin, Buffer.alloc(pad(bin.length)), ibmBytes]);
views.push({ buffer: 0, byteOffset: ibmOffset, byteLength: ibmBytes.length });
acc.push({ bufferView: views.length - 1, componentType: 5126, count: newIbm.length, type: "MAT4" });
skin.inverseBindMatrices = acc.length - 1;

// ── give the dead bones their geometry, and the neck its share ──────────
//
// The puppy's whole front end was ONE RIGID LUMP: `head` drove 16,823 vertices
// - skull, ears, muzzle and much of the neck - while `chest` drove 838. That
// is why its animation looked generic; there was nothing articulated to move.
//
// Three bones already existed, parented to `head`, driving ZERO vertices, and
// sitting exactly where they were meant to:
//     earend   (x +0.18, z 2.61)  the left ear
//     R_earend (x -0.07, z 2.62)  the right ear
//     headend  (y -2.00, z 1.19)  the chin
// So ears and chin need no new bones - only weights. The neck is the one
// genuinely missing joint, and that is what the two inserted above provide.
const prim = json.meshes[0].primitives[0];
const pos = readAcc(prim.attributes.POSITION);
const jj  = readAcc(prim.attributes.JOINTS_0);
const ww  = readAcc(prim.attributes.WEIGHTS_0);
const nameOfJ = (n) => json.nodes[n].name;
const J = Object.fromEntries(skin.joints.map((n, i) => [nameOfJ(n), i]));
J.earTipL = skin.joints.indexOf(earTipL); J.earTipR = skin.joints.indexOf(earTipR);
J.tongue  = skin.joints.indexOf(tongueI);
const TONGUE = new Set(JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "puppy-tongue-verts.json"), "utf8")).indices);
// base and tip measured from the mesh itself, in bind space
let tBase = null, tTip = null;
{
  let far = -Infinity, near = Infinity;
  for (const i of TONGUE) {
    const d = pos[i][2];                      // the snout axis in bind space
    if (d > far) { far = d; tBase = pos[i]; }
    if (d < near) { near = d; tTip = pos[i]; }
  }
}
const tongueLen = tBase && tTip ? Math.hypot(tBase[0]-tTip[0], tBase[1]-tTip[1], tBase[2]-tTip[2]) : 1;
const xform4 = (m, v) => [
  m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
  m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
  m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
const bindPos = (nm) => xform4(inv(ibm[J[nm]]), [0,0,0]);
const pHeadB = bindPos("head"), pChestB = bindPos("chest");
const pEarL = bindPos("earend"), pEarR = bindPos("R_earend"), pChin = bindPos("headend");
const pN0 = xform4(inv(inv(gNeck0)), [0,0,0]);   // gNeck0 is already the bind global
const pN1 = xform4(gNeck1, [0,0,0]);
const L = Math.hypot(pHeadB[0]-pChestB[0], pHeadB[1]-pChestB[1], pHeadB[2]-pChestB[2]);
const d3 = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const ramp = (x,a,b) => Math.max(0, Math.min(1, (x-a)/(b-a)));
// Which way is "up" and which way is "sideways", in bind space, taken from the
// bones themselves rather than assumed: the ears are above the head pivot, so
// the axis from head to ear IS up.
const upAxis = [ (pEarL[0]+pEarR[0])/2 - pHeadB[0],
                 (pEarL[1]+pEarR[1])/2 - pHeadB[1],
                 (pEarL[2]+pEarR[2])/2 - pHeadB[2] ];
const upLen = Math.hypot(...upAxis); for (let i=0;i<3;i++) upAxis[i] /= upLen || 1;
const dot3 = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const latAxis = (() => { const d=[pEarL[0]-pEarR[0], pEarL[1]-pEarR[1], pEarL[2]-pEarR[2]];
  const n=Math.hypot(...d)||1; return [d[0]/n, d[1]/n, d[2]/n]; })();

const wComp = acc[prim.attributes.WEIGHTS_0].componentType;
const wNorm = wComp !== 5126, wMax = wComp === 5121 ? 255 : wComp === 5123 ? 65535 : 1;
const enc = (x) => (wNorm ? Math.round(x * wMax) : x);
const dec = (x) => (wNorm ? x / wMax : x);
let touched = 0;
const tally = {};
for (let i = 0; i < pos.length; i++) {
  const slot = jj[i].findIndex((j) => j === J.head);
  if (slot < 0) continue;
  const w = dec(ww[i][slot]);
  if (w <= 0) continue;
  const v = pos[i];
  const rel = [v[0]-pHeadB[0], v[1]-pHeadB[1], v[2]-pHeadB[2]];
  const above = dot3(rel, upAxis);                       // + is toward the ears
  // EARS: close to an ear bone AND above the skull. Side chosen by which ear
  // bone is nearer, because both bones sit near the midline while the ear
  // geometry fans out well past it.
  // EARS by LATERAL OFFSET, not by distance to the ear bone. Both ear bones sit
  // almost on the midline while the ears themselves fan out and hang well below
  // them - claiming by proximity captured 142 vertices out of ~11,750 and left
  // the ears welded to the skull. The dog's skull is narrow and the ears are
  // the only thing out at the sides, so lateral offset separates them cleanly.
  const lat = dot3(rel, latAxis);
  const earBone = lat > 0 ? J.earend : J.R_earend;
  const earTip  = lat > 0 ? J.earTipL : J.earTipR;
  const fEarAll = ramp(Math.abs(lat) / L, 1.80, 2.30) * ramp(above / L, -0.75, -0.15);
  // and split base/tip along the hang, so the lower half can flop independently
  const tipShare = ramp(-above / L, 0.25, 1.10);
  const fEar = fEarAll;
  // CHIN: close to the chin bone and BELOW the skull.
  const fChin = (1 - ramp(d3(v, pChin) / L, 0.30, 0.80)) * (1 - ramp(above / L, -0.55, -0.05));
  // NECK: nearer the neck pivots than the head pivot (the buffalo rule).
  const dHead = d3(v, pHeadB);
  const dNeck = Math.min(d3(v, pN0), d3(v, pN1));
  const fNeckAll = ramp(dHead / Math.max(1e-6, dNeck * 1.25), 0.85, 1.20);
  const nearer0 = d3(v, pN0) < d3(v, pN1);
  // normalise so the four claims plus the head sum to 1
  let e = fEar, c = fChin, n = fNeckAll;
  const over = e + c + n;
  if (over > 1) { e /= over; c /= over; n /= over; }
  const h = Math.max(0, 1 - e - c - n);
  let parts;
  if (TONGUE.has(i)) {
    // graded along its length: the root stays with the jaw, the tip is free
    const fromBase = Math.hypot(v[0]-tBase[0], v[1]-tBase[1], v[2]-tBase[2]) / (tongueLen || 1);
    const g2 = Math.max(0, Math.min(1, fromBase));
    parts = [[J.tongue, 0.25 + 0.75*g2], [J.headend, 0.75 - 0.75*g2]];
  } else parts = [[J.head, h], [earBone, e * (1 - tipShare)], [earTip, e * tipShare],
                 [J.headend, c], [nearer0 ? J.neck0 : J.neck1, n]]
    .filter(([, f]) => f > 0.004).sort((a, b) => b[1] - a[1]);
  if (!parts.length) continue;
  // Take only as many parts as there are SLOTS. glTF gives each vertex four
  // influences; on a fur-shell mesh many are already full. Splitting into five
  // shares and then folding the overflow into whatever slot happened to be
  // free attributed weight to the wrong bone - most vertices were exact but
  // 2,625 of them moved, by up to 0.10m.
  {
    const free = jj[i].reduce((a, _, k) => a + (k === slot || dec(ww[i][k]) <= 0 ? 1 : 0), 0);
    if (parts.length > free) parts = parts.slice(0, Math.max(1, free));
  }
  // RENORMALISE. Skinning needs the shares to sum to one; dropping the small
  // ones without redistributing quietly removes weight, and the vertex then
  // collapses toward the origin - it left the untouched Walk 0.10m out.
  {
    const sum = parts.reduce((a, [, f]) => a + f, 0);
    if (sum > 1e-6) for (const pr of parts) pr[1] /= sum;
  }
  jj[i][slot] = parts[0][0]; ww[i][slot] = enc(w * parts[0][1]);
  for (let pi = 1; pi < parts.length; pi++) {
    const [joint, frac] = parts[pi];
    let dst = jj[i].findIndex((j, k) => k !== slot && j === joint && dec(ww[i][k]) > 0);
    if (dst < 0) dst = jj[i].findIndex((j, k) => k !== slot && dec(ww[i][k]) <= 0);
    if (dst < 0) { ww[i][slot] = enc(dec(ww[i][slot]) + w * frac); continue; }  // no free slot: keep the weight
    jj[i][dst] = joint; ww[i][dst] = enc(dec(ww[i][dst]) + w * frac);
  }
  for (const [j] of parts) { const nm = nameOfJ(skin.joints[j]); tally[nm] = (tally[nm]||0)+1; }
  touched++;
}
writeAcc(prim.attributes.JOINTS_0, jj);
writeAcc(prim.attributes.WEIGHTS_0, ww);
console.log(`re-weighted ${touched} of the head's vertices`);
for (const [k, n] of Object.entries(tally).sort((a,b)=>b[1]-a[1]))
  console.log(`   ${k.padEnd(10)} now claims ${n}`);

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
