/**
 * Pack the handful of Village Road props that shipped with their geometry
 * uncompressed — without touching a triangle, a texel or a UV.
 *
 *   node scripts/village-props-pack.mjs            # build + install
 *   node scripts/village-props-pack.mjs --dry      # build, report, do not install
 *
 * Measured on 16 Sep 2026, when the question was "what does the village
 * actually fetch, and is any of it waste": nothing was wasted — every one of
 * the 38 files a village load asks for is placed — but the single largest of
 * them, Village_Market at 1.83 MB, was 1.06 MB of raw geometry: float32
 * normals and float32 UVs on 36,167 vertices, in a file whose positions were
 * already 16-bit. Its triangle count is SETTLED — see the market's history in
 * chapter1.ts: seam-aware simplification plateaus at ~23,400 and 24,000 keeps
 * the signage legible, and the sloppy simplifier was rejected in strong
 * terms. So this touches none of that. It only changes how the same numbers
 * are stored:
 *
 *   - TEXCOORD_0 float32 -> normalized uint16. On a 2048 map that is 1/32 of
 *     a texel of precision; glb-quantize-attrs refuses if any UV leaves [0,1].
 *   - NORMAL float32 -> normalized int16 (KHR_mesh_quantization, which every
 *     AK-pack file already requires). Finer than the lighting can show — and
 *     `loadModel` welds and RECOMPUTES normals on every model it loads, so
 *     the file's normals only ever influence which vertices weld together.
 *   - Then meshopt with filter NONE, which is a byte-level codec: the decoder
 *     returns the input exactly, and glb-compress --verify proves it on every
 *     view before the file is written. The index codec is on because it was
 *     MEASURED on each of these (the tool's own header says to): 97 KB more
 *     off the market, and smaller on every file here.
 *
 * WHY ONLY THESE FIVE. The same pass was run over all 52 uncompressed village
 * files. The ak-3d-pack props, the stones and nearly all the plants were
 * already fully quantized by village-prop.mjs (u16 positions, i16 normals,
 * u16 UVs) and meshopt made them LARGER — Banyan 434 KB -> 457 KB, HouseHearth
 * 434 -> 448 — because the byte-level codec has nothing left to find in a
 * compact 6,000-triangle mesh and adds its framing. Three (Palmyra_Karimpana,
 * Mango_Tree, Jackfruit_Tree) failed glb-compress's own verify and were left
 * alone rather than shipped on a mismatch. MegaPine would take the same cut
 * (821 -> 407 KB) but is not on the village road; MegaBroadleaf is already
 * gltfpack output and these tools cannot read it. What is left is the five
 * files where the numbers were real:
 *
 *   Village_Market      1,831,984 -> 1,254,112   lesson 7, the biggest thing on the road
 *   MegaDead            1,396,048 ->   665,552   the night forest
 *   Banyan_Almaram        198,832 ->   123,824   the village heart
 *   KeralaBambooGroves    152,260 ->    75,592   the market's gate
 *   MegaPebbles            52,768 ->    32,292   the ground scatter
 *
 * Each build must decode byte-identical AND come out smaller than it went in,
 * or it is not installed. The previous files are in
 * meshy_output/shipped-before-prop-compression-2026-09-16/.
 */
import { copyFileSync, statSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const MODELS = join(REPO, "root/public/kids-assets/models");

const PROPS = [
  "village-util/Village_Market",
  "nature/MegaDead",
  "village-plants/Banyan_Almaram",
  "nature/KeralaBambooGroves",
  "nature/MegaPebbles",
];

const DRY = process.argv.includes("--dry");
const run = (script, a) =>
  execFileSync("node", [join(HERE, script), ...a], { stdio: "pipe" }).toString();

/** Triangle count and image count, read straight off the JSON: the invariants. */
function shape(path) {
  const b = readFileSync(path);
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString("utf8"));
  let tris = 0, verts = 0;
  for (const m of j.meshes ?? []) {
    for (const pr of m.primitives ?? []) {
      verts += j.accessors[pr.attributes.POSITION].count;
      tris += pr.indices != null ? j.accessors[pr.indices].count / 3 : verts / 3;
    }
  }
  return { tris, verts, images: (j.images ?? []).length, materials: (j.materials ?? []).length };
}

let failed = 0;
let saved = 0;
for (const name of PROPS) {
  const src = join(MODELS, `${name}.glb`);
  const tmp = mkdtempSync(join(tmpdir(), "prop-pack-"));
  try {
    const before = shape(src);
    run("glb-quantize-attrs.mjs", [src, join(tmp, "q.glb"), "--normals"]);
    const log = run("glb-compress.mjs", [join(tmp, "q.glb"), join(tmp, "c.glb"), "--verify", "--indices"]);
    if (/MISMATCH|REFUS/i.test(log)) throw new Error("verify failed:\n" + log);
    const after = shape(join(tmp, "c.glb"));
    if (after.tris !== before.tris || after.verts !== before.verts || after.images !== before.images) {
      throw new Error(`shape changed: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    }
    const was = statSync(src).size;
    const now = statSync(join(tmp, "c.glb")).size;
    if (now >= was) throw new Error(`not smaller: ${was} -> ${now}`);
    console.log(`${name.padEnd(34)} ${was.toLocaleString().padStart(10)} -> ${now.toLocaleString().padStart(10)}  (${(100 - (now / was) * 100).toFixed(0)}% off)  ${before.tris} tris, ${before.images} image(s), unchanged`);
    if (!DRY) copyFileSync(join(tmp, "c.glb"), src);
    saved += was - now;
  } catch (e) {
    console.error(`${name}: FAILED — ${String(e.message).split("\n")[0]}`);
    failed++;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(`\n${DRY ? "would save" : "saved"} ${(saved / 1e6).toFixed(2)} MB across ${PROPS.length} props`);
process.exit(failed > 0 ? 1 : 0);
