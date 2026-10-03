#!/usr/bin/env node
/**
 * Merges the AK 3D Pack into kids-assets, for a production build.
 *
 * Time Keepers' art (models, textures, horizon, faces, cards, its logo) is
 * the AK 3D Pack: commercially licensed, not AGPL, and kept in its own
 * private repository rather than this public one. That repository mirrors
 * `root/public/kids-assets/` path for path, so merging is a plain copy over
 * the top; `.gitignore` keeps the result out of this repository's history.
 *
 *   AK_PACK_DIR=../ak-3d-pack node scripts/ak-pack-merge.mjs
 *   node scripts/kids-manifest.mjs
 *
 * Without the pack the site still builds; Time Keepers is then missing art.
 */
import { cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = new URL("..", import.meta.url).pathname;
const PACK = resolve(process.env.AK_PACK_DIR ?? join(REPO, "..", "ak-3d-pack"));
const FROM = join(PACK, "kids-assets");
const TO = join(REPO, "root", "public", "kids-assets");

if (!existsSync(FROM)) {
  console.error(`ak-pack-merge: no pack at ${FROM} (set AK_PACK_DIR)`);
  process.exit(1);
}
cpSync(FROM, TO, { recursive: true, force: true });
console.log(`ak-pack-merge: merged ${FROM} -> ${TO}`);
