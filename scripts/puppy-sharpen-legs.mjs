/**
 * Sharpen the LEG skin weights so the limbs hinge instead of bending like rope.
 *
 *   node scripts/puppy-sharpen-legs.mjs in.glb out.glb [--power 2.4] [--max 2]
 *
 * The complaint was that the legs move "like a soft toy", and the skinning says
 * why. Measured on the source puppy, over 15,534 leg vertices:
 *
 *   - the bone that OWNS a leg vertex holds only 0.639 of it on average;
 *   - 3.10 bones influence each leg vertex;
 *   - 4.3% of leg vertices take weight from a bone ACROSS A JOINT GAP - the
 *     shoulder pulling directly on the paw, the hip on the hock.
 *
 * A limb weighted like that has no joints. It is a smooth blend from shoulder
 * to toe, so it deforms as one continuous curve: exactly the way a stuffed leg
 * bends, and nothing an animation curve can fix, because the pose is correct
 * and the SKIN is what is wrong. No amount of work on the animation reaches it.
 *
 * Three changes, leg vertices only:
 *
 *  1. CUT THE GAP. Any influence from a bone more than one joint away along the
 *     same limb is removed outright. A vertex on the forearm has no business
 *     answering to the shoulder; that link is what makes the whole leg swing as
 *     a curve rather than pivoting at the elbow.
 *  2. CONTRAST. Remaining weights are raised to a power and renormalised, which
 *     pulls each vertex towards its own bone and tightens the transition band
 *     at each joint without hard-edging it.
 *  3. LIMIT. Leg vertices keep their strongest few influences. A joint needs
 *     two bones to blend across it; a third is what smears the hinge.
 *
 * The body, head, ears and tail are deliberately untouched - soft, spread
 * weighting is right for them, and it is only limbs that need to articulate.
 *
 * The bind pose is unchanged by construction: weights only matter once bones
 * move away from bind, and they are renormalised to sum to 1 exactly as before.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : parseFloat(args[i + 1]); };
const [inPath, outPath] = args.filter((a) => !a.startsWith("--") && !/^[\d.]+$/.test(a));
if (!inPath || !outPath) { console.error("usage: puppy-sharpen-legs.mjs in.glb out.glb [--power p] [--max n]"); process.exit(2); }
const POWER = flag("--power", 2.4);
const MAXINF = Math.round(flag("--max", 2));

const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), t = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (t === 0x004e4942) bin = Buffer.from(body);
  off += 8 + len;
}

const COMP = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
function readVec4(ai) {
  const a = json.accessors[ai], v = json.bufferViews[a.bufferView];
  const sz = COMP[a.componentType], stride = v.byteStride || 4 * sz;
  const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < 4; c++) {
      const p = base + k * stride + c * sz;
      row.push(a.componentType === 5126 ? bin.readFloatLE(p)
             : a.componentType === 5123 ? bin.readUInt16LE(p)
             : bin.readUInt8(p));
    }
    out.push(row);
  }
  return out;
}

const names = json.skins[0].joints.map((i) => json.nodes[i].name);
// Which joint index is which limb, and how far down that limb it sits. The
// chains are named consistently on this rig, so the position in the chain is
// readable from the name rather than having to be walked.
const CHAINS = {
  LF: ["frontleg", "frontleg0", "frontleg1", "frontleg2"],
  RF: ["R_frontleg", "R_frontleg0", "R_frontleg1", "R_frontleg2"],
  LB: ["backleg", "backleg0", "backleg1", "backleg2"],
  RB: ["R_backleg", "R_backleg0", "R_backleg1", "R_backleg2"],
};
const limbOf = new Map(), depthOf = new Map();
for (const k of Object.keys(CHAINS)) {
  CHAINS[k].forEach((n, d) => {
    const ji = names.indexOf(n);
    if (ji >= 0) { limbOf.set(ji, k); depthOf.set(ji, d); }
  });
}

let changed = 0, gapCut = 0, before = 0, after = 0, legVerts = 0;
for (const mesh of json.meshes ?? []) {
  for (const prim of mesh.primitives ?? []) {
    const jAcc = prim.attributes.JOINTS_0, wAcc = prim.attributes.WEIGHTS_0;
    if (jAcc == null || wAcc == null) continue;
    const Jd = readVec4(jAcc), Wd = readVec4(wAcc);
    const wIsByte = json.accessors[wAcc].componentType !== 5126;
    const outW = Buffer.alloc(Jd.length * (wIsByte ? 4 : 16));
    const outJ = Buffer.alloc(Jd.length * 4);       // joints stay u8 VEC4

    for (let v = 0; v < Jd.length; v++) {
      let w = Wd[v].map((x) => (wIsByte ? x / 255 : x));
      const jj = Jd[v].slice();
      let bi = 0;
      for (let c = 1; c < 4; c++) if (w[c] > w[bi]) bi = c;
      const dominant = jj[bi];

      if (limbOf.has(dominant)) {
        legVerts++;
        before += w[bi];
        const limb = limbOf.get(dominant), depth = depthOf.get(dominant);
        // 1. cut influences that reach across a joint gap on the same limb
        for (let c = 0; c < 4; c++) {
          if (c === bi || w[c] <= 0) continue;
          if (limbOf.get(jj[c]) === limb && Math.abs(depthOf.get(jj[c]) - depth) > 1) {
            w[c] = 0; gapCut++;
          }
        }
        // 2. contrast
        for (let c = 0; c < 4; c++) w[c] = Math.pow(w[c], POWER);
        // 3. keep the strongest MAXINF
        const order = [0, 1, 2, 3].sort((a, b) => w[b] - w[a]);
        for (let r = MAXINF; r < 4; r++) w[order[r]] = 0;
        const sum = w.reduce((a, b) => a + b, 0);
        if (sum > 1e-9) for (let c = 0; c < 4; c++) w[c] /= sum;
        let nbi = 0; for (let c = 1; c < 4; c++) if (w[c] > w[nbi]) nbi = c;
        after += w[nbi];
        changed++;
      }

      // write back, re-normalising in whatever precision the file uses
      if (wIsByte) {
        const q = w.map((x) => Math.round(x * 255));
        let s = q.reduce((a, b) => a + b, 0);
        if (s !== 255) { let big = 0; for (let c = 1; c < 4; c++) if (q[c] > q[big]) big = c; q[big] += 255 - s; }
        for (let c = 0; c < 4; c++) outW.writeUInt8(Math.max(0, Math.min(255, q[c])), v * 4 + c);
      } else {
        for (let c = 0; c < 4; c++) outW.writeFloatLE(w[c], v * 16 + c * 4);
      }
      for (let c = 0; c < 4; c++) outJ.writeUInt8(jj[c], v * 4 + c);
    }

    // append the rewritten attributes
    const put = (buf, comps, componentType, type, normalized) => {
      const pad = (4 - (bin.length % 4)) % 4;
      if (pad) bin = Buffer.concat([bin, Buffer.alloc(pad)]);
      const byteOffset = bin.length;
      bin = Buffer.concat([bin, buf]);
      json.bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length });
      json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType,
                            count: Jd.length, type, ...(normalized ? { normalized: true } : {}) });
      void comps;
      return json.accessors.length - 1;
    };
    prim.attributes.WEIGHTS_0 = wIsByte
      ? put(outW, 4, 5121, "VEC4", true)
      : put(outW, 4, 5126, "VEC4", false);
    prim.attributes.JOINTS_0 = put(outJ, 4, 5121, "VEC4", false);
  }
}

json.buffers = [{ byteLength: bin.length }];
const jb = Buffer.from(JSON.stringify(json), "utf8");
const jp = (4 - (jb.length % 4)) % 4, jc = Buffer.concat([jb, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (bin.length % 4)) % 4, bc = Buffer.concat([bin, Buffer.alloc(bp)]);
const chunk = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
const total = 12 + 8 + jc.length + 8 + bc.length;
const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
writeFileSync(outPath, Buffer.concat([hdr, chunk(jc.length, 0x4e4f534a), jc, chunk(bc.length, 0x004e4942), bc]));

console.log(`  leg vertices sharpened : ${changed}`);
console.log(`  cross-joint links cut  : ${gapCut}`);
console.log(`  dominant weight        : ${(before / legVerts).toFixed(3)} -> ${(after / legVerts).toFixed(3)}`);
console.log(`  power ${POWER}, max ${MAXINF} influences per leg vertex`);
console.log(`wrote ${outPath}  ${total.toLocaleString()} bytes`);
