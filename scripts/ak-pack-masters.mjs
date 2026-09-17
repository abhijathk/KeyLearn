#!/usr/bin/env node
/**
 * Gathers the MASTER of every asset the game ships, into one pack.
 *
 *   node scripts/ak-pack-masters.mjs [--write]
 *
 * The game loads about a hundred files out of `root/public/kids-assets`, and
 * every one of them is the far end of a pipeline: a 20–70 MB bake that was
 * retopologised, re-baked, blanked, quantised and meshopt-compressed down to
 * a few hundred kilobytes. The compressed file is the only one in the repo,
 * and it is the one thing that CANNOT be re-processed — every step of that
 * pipeline is lossy, so a shipped asset is a dead end.
 *
 * The masters exist, but scattered: some under `3D ASSETS`, some in
 * `meshy_output`, some wherever they were downloaded to. This walks what
 * ships, finds each one's master by name, and lays them out in `AK 3D Pack`
 * mirroring the shipped tree — so the pack and the game have the same shape
 * and a master is where you would look for it.
 *
 * IT DOES NOT GO TO GITHUB. Nearly two gigabytes of source against thirty-six
 * megabytes of game, and the masters change rarely while the shipped files
 * change every time a pipeline improves. The pack is in `.gitignore`; the
 * MANIFEST it writes is not, so the repo still records what each shipped
 * asset came from and which ones have no master at all.
 *
 * Dry by default. `--write` copies.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname, basename, extname } from "node:path";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SHIPPED = join(REPO, "root/public/kids-assets");
const PACK = join(REPO, "AK 3D Pack");
const HUNTS = [
  join(REPO, "../3D ASSETS"),
  join(REPO, "../meshy_output"),
  join(process.env.HOME ?? "", "Downloads"),
];

/**
 * WHERE A NAME MATCH CANNOT WORK.
 *
 * A shipped asset is not always named after its master, and the gap is often
 * the whole history of the thing: `CottageBell` is a house that arrived as
 * `House_Bell_m6`, and the temple and its three houses came out of a folder
 * of Meshy exports whose names are timestamps. Matching on the stem finds
 * seventy of a hundred and twenty-four; the rest have to be said out loud,
 * once, here — which is also the only written record that they are the same
 * object.
 */
const ALIASES = {
  "ak-3d-pack/CottageBell": "House_Bell_m6",
  "ak-3d-pack/CottageTiled": "House_Tiled_m6",
  "ak-3d-pack/CottageVeranda": "House_Veranda_m6",
  "ak-3d-pack/Mana": "Weathered_Heritage_Mana",
  "ak-3d-pack/Temple": "Meshy_AI_Moss_Covered_Temple",
  "ak-3d-pack/HouseMoss": "Meshy_AI_Moss_Crowned_Homestea",
  "ak-3d-pack/HouseThatch": "Meshy_AI_Mossy_Thatch_Homestea",
  "ak-3d-pack/HouseHearth": "Meshy_AI_weathered_hearth_hous",
  "village-stone/Shrine_Idol": "Shrine_Idol_v6",
  "village-util/Nilavilakku": "Nilavilakku_raw",
  "village-util/Haystack": "Haystack_raw",
  "village-util/Estate_Gate": "Estate_Gate_raw",
  "village-util/Produce_Pile": "Produce_Pile_raw",
  "cards/CottageBell": "House_Bell_m6",
  "cards/CottageTiled": "House_Tiled_m6",
  "cards/CottageThatch": "House_Thatch_m6",
  "cards/CottageVeranda": "House_Veranda_m6",
};
const WRITE = process.argv.includes("--write");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const shipped = walk(SHIPPED).filter((f) => /\.(glb|webp|ktx2)$/i.test(f));
// ── WHAT COUNTS AS A MASTER ────────────────────────────────────────────
//
// A .glb or .fbx, and nothing else. The first pass accepted .png and .blend
// too, on the reasoning that a source is a source — and it matched 57 of 100
// shipped models to QA RENDER IMAGES and unrelated Blender files, because a
// loose substring will always find something in two gigabytes. `Banyan.glb`
// was paired with a render called `Banyan_Almaram_common_scale.png`, and
// `Triceratops.glb` with a Blender file called `Ice.blend`.
//
// A WRONG MASTER IS WORSE THAN NO MASTER. No master says "this cannot be
// re-processed"; a wrong one says "it can" and wastes somebody's afternoon
// proving otherwise. Render folders are excluded outright for the same
// reason — everything in them is a picture OF an asset, never the asset.
const pool = HUNTS.flatMap((h) => walk(h))
  .filter((f) => /\.(glb|fbx)$/i.test(f))
  .filter((f) => !/qa-renders|\/samples?\//i.test(f));

/** Loose match: the shipped stem, ignoring case, separators and _raw/_m6 tails. */
const norm = (s) => basename(s, extname(s)).toLowerCase().replace(/[^a-z0-9]/g, "");
const byNorm = new Map();
for (const f of pool) {
  const k = norm(f);
  const prev = byNorm.get(k);
  // The master is the BIGGEST candidate: these pipelines only ever shrink.
  if (prev == null || statSync(f).size > statSync(prev).size) byNorm.set(k, f);
}

const rows = [];
for (const s of shipped) {
  const rel = relative(SHIPPED, s).replace(/^models\//, "").replace(/\.[^.]+$/, "");
  const stem = ALIASES[rel] != null ? norm(ALIASES[rel]) : norm(s);
  // Exact first. The fallback needs a real overlap — eight characters, not
  // "cover" inside "groundcover" — or it invents relationships.
  let master =
    byNorm.get(stem) ??
    [...byNorm.entries()].find(
      ([k]) =>
        Math.min(k.length, stem.length) >= 8 &&
        (k.includes(stem) || stem.includes(k)),
    )?.[1] ??
    null;
  rows.push({
    shipped: relative(SHIPPED, s),
    shippedKB: Math.round(statSync(s).size / 1024),
    master: master ? relative(join(REPO, ".."), master) : null,
    masterKB: master ? Math.round(statSync(master).size / 1024) : 0,
  });
}

const found = rows.filter((r) => r.master != null);
for (const r of found) {
  if (!WRITE) continue;
  const dest = join(PACK, dirname(r.shipped), basename(r.master));
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(REPO, "..", r.master), dest);
}

const lines = [
  "# AK 3D Pack — master files",
  "",
  "Every asset the game ships, and the master it was made from. The pack",
  "itself is gitignored; this manifest is not, so the repo records where each",
  "shipped file came from even though the source is not in it.",
  "",
  "Regenerate with `node scripts/ak-pack-masters.mjs --write`.",
  "",
  `${found.length} of ${rows.length} shipped assets have a master on this machine.`,
  "",
  "| shipped | KB | master | KB |",
  "| --- | --: | --- | --: |",
  ...rows.map(
    (r) =>
      `| \`${r.shipped}\` | ${r.shippedKB} | ${r.master ? `\`${r.master}\`` : "**none found**"} | ${r.masterKB || ""} |`,
  ),
];
if (WRITE) {
  mkdirSync(PACK, { recursive: true });
  writeFileSync(join(REPO, "AK-3D-PACK.md"), lines.join("\n") + "\n");
}
console.log(`${found.length}/${rows.length} shipped assets matched to a master`);
console.log(`  masters total ${Math.round(found.reduce((n, r) => n + r.masterKB, 0) / 1024)} MB`);
console.log(`  shipped total ${Math.round(rows.reduce((n, r) => n + r.shippedKB, 0) / 1024)} MB`);
for (const r of rows.filter((x) => x.master == null).slice(0, 12)) {
  console.log(`  no master: ${r.shipped}`);
}
if (!WRITE) console.log("\n(dry run — pass --write to copy and write the manifest)");
