/**
 * The Time Keepers title sign.
 *
 * AK 3D Pack art: commercially licensed, NOT covered by KeyLearn's AGPL. The
 * picture itself is not in this repository; it is served from kids-assets
 * (`signs/village.webp`), which a production build merges in from the private
 * ak-3d-pack repository — see scripts/ak-pack-merge.mjs.
 */
import { ASSETS, versioned } from "../asset-url.ts";

export const SIGN = versioned(`${ASSETS}/signs/village.webp`);
