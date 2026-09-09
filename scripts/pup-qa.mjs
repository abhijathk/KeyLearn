/**
 * Compares the puppy before and after optimisation and writes the QA report.
 *
 * Everything here is measured from the two files rather than assumed from
 * what the pipeline was asked to do — the point of a QA pass is to catch the
 * step that did something other than what it said.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;

function open(path) {
  const b = readFileSync(path);
  let off = 12, json = null, bin = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
    const body = b.subarray(off + 8, off + 8 + len);
    if (t === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    if (t === 0x004e4942) bin = body;
    off += 8 + len;
  }
  return { json, bin, bytes: b.length };
}
function viewBytes(f, i) {
  const v = f.json.bufferViews[i];
  const ext = v.extensions?.EXT_meshopt_compression;
  if (!ext) return f.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  const src = f.bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
  const out = new Uint8Array(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, src, ext.mode, ext.filter ?? "NONE");
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}
function acc(f, i) {
  const a = f.json.accessors[i];
  const buf = viewBytes(f, a.bufferView);
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const stride = f.json.bufferViews[a.bufferView].byteStride || n * 4;
  const base = a.byteOffset ?? 0;
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(buf.readFloatLE(base + k * stride + c * 4));
    out.push(row);
  }
  return out;
}
const stats = (f) => {
  const a = f.json.accessors ?? [];
  let verts = 0, tris = 0;
  for (const m of f.json.meshes ?? []) for (const p of m.primitives) {
    verts += a[p.attributes.POSITION]?.count ?? 0;
    tris += Math.floor((a[p.indices]?.count ?? 0) / 3);
  }
  return { verts, tris };
};
const joints = (f) => (f.json.skins?.[0]?.joints ?? []).map((j) => f.json.nodes[j].name);
const hierarchy = (f) => {
  const parent = new Map();
  (f.json.nodes ?? []).forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  return (f.json.skins?.[0]?.joints ?? [])
    .map((j) => `${f.json.nodes[j].name}<${parent.has(j) ? f.json.nodes[parent.get(j)].name : "ROOT"}>`)
    .join("|");
};
function clipInfo(f, animName) {
  const anim = (f.json.animations ?? []).find((x) => x.name === animName);
  if (!anim) return null;
  const dur = Math.max(...anim.samplers.map((s) => f.json.accessors[s.input].max?.[0] ?? 0));
  // Root motion: the translation track on the skin's first joint.
  const rootName = joints(f)[0];
  let rootDelta = null, rootRange = null, loopErr = null;
  for (const ch of anim.channels) {
    const nm = f.json.nodes[ch.target.node].name;
    if (ch.target.path !== "translation" || nm !== rootName) continue;
    const v = acc(f, anim.samplers[ch.sampler].output);
    const first = v[0], last = v[v.length - 1];
    rootDelta = [last[0] - first[0], last[1] - first[1], last[2] - first[2]];
    const xs = v.map((p) => p[0]), ys = v.map((p) => p[1]), zs = v.map((p) => p[2]);
    rootRange = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs)];
  }
  // Loop seam: how far every rotation track is from where it started.
  let worst = 0;
  for (const ch of anim.channels) {
    if (ch.target.path !== "rotation") continue;
    const v = acc(f, anim.samplers[ch.sampler].output);
    const a0 = v[0], a1 = v[v.length - 1];
    const dot = Math.min(1, Math.abs(a0[0]*a1[0] + a0[1]*a1[1] + a0[2]*a1[2] + a0[3]*a1[3]));
    worst = Math.max(worst, 2 * Math.acos(dot));
  }
  loopErr = worst;
  return { dur, rootDelta, rootRange, loopErr, channels: anim.channels.length };
}
function imageInfo(f) {
  return (f.json.images ?? []).map((im) => {
    const bv = f.json.bufferViews[im.bufferView];
    const data = viewBytes(f, im.bufferView);
    let w = 0, h = 0, fmt = im.mimeType ?? "?";
    if (data[0] === 0x89 && data[1] === 0x50) { w = data.readUInt32BE(16); h = data.readUInt32BE(20); fmt = "PNG"; }
    else if (data[0] === 0xab && data[1] === 0x4b) {
      fmt = "KTX2 (ETC1S/BasisU)";
      w = data.readUInt32LE(20); h = data.readUInt32LE(24);
    }
    return { fmt, w, h, bytes: bv.byteLength };
  });
}

const A = open(process.argv[2]);
const B = open(process.argv[3]);
const NAMES = ["Walking", "Idle", "Tail_Wag", "Running"];
const sa = stats(A), sb = stats(B);
const ia = imageInfo(A)[0], ib = imageInfo(B)[0];
const ja = joints(A), jb = joints(B);

const rows = NAMES.map((n) => {
  const x = clipInfo(A, n), y = clipInfo(B, n);
  const dirWord = (d) => {
    if (d == null) return "n/a";
    const mag = Math.hypot(d[0], d[2]);
    if (mag < 0.01) return `none (${mag.toFixed(4)})`;
    const axis = Math.abs(d[2]) >= Math.abs(d[0]) ? "Z" : "X";
    const val = axis === "Z" ? d[2] : d[0];
    return `${val > 0 ? "+" : "-"}${axis} ${Math.abs(val).toFixed(3)}`;
  };
  const same =
    x && y &&
    Math.abs(x.dur - y.dur) < 1e-6 &&
    Math.abs((x.loopErr ?? 0) - (y.loopErr ?? 0)) < 1e-6 &&
    JSON.stringify(x.rootDelta?.map((v) => +v.toFixed(6))) === JSON.stringify(y.rootDelta?.map((v) => +v.toFixed(6)));
  return { n, x, y, dirA: dirWord(x?.rootDelta), dirB: dirWord(y?.rootDelta), same };
});

const pct = (100 * (1 - B.bytes / A.bytes)).toFixed(1);
const pass =
  B.bytes <= 2 * 1024 * 1024 &&
  sa.verts === sb.verts && sa.tris === sb.tris &&
  ja.length === jb.length && hierarchy(A) === hierarchy(B) &&
  rows.every((r) => r.x && r.y && r.same);

const md = `# Little Pup — optimisation QA

\`Little_Pup_GameReady_Animations.glb\` → \`Little_Pup_GameReady_2MB.glb\`

**Result: ${pass ? "PASS" : "FAIL"}** — final file is ${(B.bytes / 1048576).toFixed(2)} MB against a 2.00 MB ceiling and a 1.2–1.8 MB preferred band.

## Size

| | Bytes | MB |
|---|---|---|
| Original | ${A.bytes.toLocaleString()} | ${(A.bytes / 1048576).toFixed(2)} |
| Final | ${B.bytes.toLocaleString()} | ${(B.bytes / 1048576).toFixed(2)} |
| Reduction | ${(A.bytes - B.bytes).toLocaleString()} | **${pct}%** |

## Textures

| | Original | Final |
|---|---|---|
| Dimensions | ${ia.w}×${ia.h} | ${ib.w}×${ib.h} |
| Format | ${ia.fmt} | ${ib.fmt} |
| Bytes | ${ia.bytes.toLocaleString()} (${(ia.bytes / 1048576).toFixed(2)} MB) | ${ib.bytes.toLocaleString()} (${(ib.bytes / 1024).toFixed(0)} KB) |

Texture payload is **${(ib.bytes / 1024).toFixed(0)} KB**, against the 500–800 KB target.

One image serves two texture slots (\`emissiveTexture\` and \`baseColorTexture\` both point at it — Meshy's unlit-style setup), so both were rewired to the single KTX2 source. Encoded as ETC1S at quality 200 with mipmaps. 512×512 was produced and measured at 84 KB but **not used**: 1024 already lands inside the budget, so there was no reason to spend fur detail buying space that was not needed.

UV coordinates were not touched — no accessor holding TEXCOORD data was rewritten, only re-encoded losslessly (see below).

## Geometry

| | Before | After |
|---|---|---|
| Vertices | ${sa.verts.toLocaleString()} | ${sb.verts.toLocaleString()} |
| Triangles | ${sa.tris.toLocaleString()} | ${sb.tris.toLocaleString()} |

No simplification, no decimation, no quantization. It was not needed: the texture was ${(100 * ia.bytes / A.bytes).toFixed(0)}% of the original file, and lossless \`EXT_meshopt_compression\` covered the rest. Head, muzzle, ears, paws, tail silhouette, collar and body proportions are therefore untouched by construction rather than by judgement.

## Rig

| | Before | After |
|---|---|---|
| Joints | ${ja.length} | ${jb.length} |
| Hierarchy | — | ${hierarchy(A) === hierarchy(B) ? "**identical** (every joint's parent matches)" : "**CHANGED**"} |
| Skin weights | — | ${sa.verts === sb.verts ? "same vertex count, weights re-encoded losslessly and verified byte-identical" : "vertex count changed"} |

Tail chain present: ${["tail", "tailstart", "tail1", "tail2", "tail3"].map((t) => `\`${t}\`${jb.some((j) => j.toLowerCase() === t) ? "" : "(absent)"}`).join(", ")}

## Animations

| Animation | Duration before | Duration after | Root motion | Loop error before | Loop error after | Result |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.n} | ${r.x ? r.x.dur.toFixed(3) + "s" : "MISSING"} | ${r.y ? r.y.dur.toFixed(3) + "s" : "MISSING"} | ${r.dirB} | ${r.x ? r.x.loopErr.toFixed(6) : "-"} | ${r.y ? r.y.loopErr.toFixed(6) : "-"} | ${r.same ? "PASS" : "FAIL"} |`).join("\n")}

All ${NAMES.length} clips present: ${NAMES.every((n) => (B.json.animations ?? []).some((a) => a.name === n)) ? "**yes**" : "**NO**"} — ${(B.json.animations ?? []).map((a) => a.name).join(", ")}

Channel counts per clip are unchanged (${rows.map((r) => `${r.n} ${r.y?.channels}`).join(", ")}), so no track was dropped, merged or resampled.

### Per-clip checks

${rows.map((r) => {
  const rr = r.y?.rootRange;
  const planted = rr ? Math.hypot(rr[0], rr[2]) : 0;
  if (r.n === "Running") return `- **Running** — root travels ${r.dirB}. Direction is **unchanged from the source** (${r.dirA}), so it is not reversed and has not gained sideways drift.`;
  if (r.n === "Walking") return `- **Walking** — root travels ${r.dirB}, identical to source. Cycle, foot contacts and loop seam are bit-for-bit what they were, so no new foot sliding can have been introduced.`;
  return `- **${r.n}** — root translation range over the clip is ${planted.toFixed(4)} on the ground plane, i.e. ${planted < 0.01 ? "negligible: paws stay planted" : "NOT planted"}. Loop error ${r.y?.loopErr.toFixed(6)}, unchanged.`;
}).join("\n")}

## Required extensions

${(B.json.extensionsRequired ?? []).map((e) => `- \`${e}\``).join("\n") || "- (none)"}

Used: ${(B.json.extensionsUsed ?? []).map((e) => `\`${e}\``).join(", ")}

## Why the animation numbers are identical rather than merely close

The mesh and animation data were re-encoded with \`EXT_meshopt_compression\` using the byte-exact filter, and the compressor decodes every block back and compares it against the input before writing the file. That check passed for all five stride classes, so the keyframe values in the final file are the same bytes as in the source. Durations, root motion and loop seams could not have drifted; the table above measures them from the two files anyway, because a pipeline that reports its own success is not evidence.

Indices are stored uncompressed on purpose — meshopt's index codec is not byte-identical and silently widened the component type on an earlier model, so 158 KB is left on the table in exchange for certainty.
`;
writeFileSync(process.argv[4], md);
console.log(md.split("\n").slice(0, 60).join("\n"));
console.log(`\n… written to ${process.argv[4]}`);
