/**
 * Whether the AK 3D Pack has been merged into kids-assets.
 *
 * Time Keepers' models are commercially licensed and live in a private
 * repository, not this one (see scripts/ak-pack-merge.mjs). A checkout of the
 * public source does not have them, so the tests that look for them on disk
 * are skipped there, and run wherever the pack has been merged in.
 */
import { existsSync } from "node:fs";

export const AK_PACK_MISSING: string | false = existsSync(
  new URL("../../../root/public/kids-assets/models/ak-3d-pack", import.meta.url),
)
  ? false
  : "the AK 3D Pack is not merged in (scripts/ak-pack-merge.mjs)";
