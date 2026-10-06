#!/usr/bin/env node
/**
 * Pack the village's people the way the cattle were packed, in place.
 *
 *   node scripts/village-folk-pack.mjs [Name ...]     (default: all five)
 *
 * Takes the SHIPPED file, not a source: decode, reorder into cache order,
 * positions to 15-bit integers with the dequantization folded into the
 * inverse bind matrices, normals dropped, then meshopt with the index codec
 * and a lossless verify. Texture, materials, skeleton, triangles and every
 * animation channel come out byte-identical (6 Oct 2026: 6.00 -> 3.74 MB for
 * the five; renders through the game's own weld differ on at most 0.15% of
 * pixels).
 *
 * Normals can go because `weldAndShade` in world.ts recomputes them on load.
 * That only works because it de-interleaves a normal-less mesh first — see
 * the comment there — so a packed file and that code ship together.
 *
 * NOT for Buffalo or Kuttichathan: their shipped files keep authored normals
 * the game uses as-is, and dropping them changed their shading (1.8% and 16%
 * of pixels) for a 7% saving. Abee's file has an accessor with no bufferView
 * that glb-compress refuses.
 *
 * The models are AK 3D Pack assets: copy the results into ../ak-3d-pack as
 * well, then run scripts/kids-manifest.mjs.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "..", "root/public/kids-assets/models/village-folk");
const names = process.argv.slice(2);
const FOLK = names.length > 0
  ? names
  : ["TeaStall", "FarmerWoman", "Blacksmith", "Headman", "VillageBoy"];

const run = (script, args) =>
  execFileSync("node", [join(HERE, script), ...args], { stdio: "inherit" });

for (const name of FOLK) {
  const file = join(DIR, `${name}.glb`);
  const tmp = mkdtempSync(join(tmpdir(), "folk-"));
  const at = (s) => join(tmp, s);
  try {
    console.log(`\n${name}`);
    run("glb-decompress.mjs", [file, at("raw.glb")]);
    run("glb-reorder-mesh.mjs", [at("raw.glb"), at("r.glb")]);
    run("glb-quantize-mesh.mjs", [at("r.glb"), at("q.glb"), "--normals", "drop", "--bits", "15"]);
    run("glb-compress.mjs", [at("q.glb"), at("pack.glb"), "--indices", "--verify"]);
    const was = statSync(file).size;
    const now = statSync(at("pack.glb")).size;
    copyFileSync(at("pack.glb"), file);
    console.log(`  ${(was / 1e6).toFixed(2)} MB -> ${(now / 1e6).toFixed(2)} MB`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
