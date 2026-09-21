/**
 * Where a kids asset actually lives, once the manifest has had its say.
 *
 * Lifted out of `world.ts` so something that needs an asset URL does not have
 * to import the 3D world to get one — `audio.ts` needs exactly this and
 * nothing else three.js provides, and importing `world.ts` for it would pull
 * the whole renderer into a module that plays short sounds.
 */
import { ASSET_MAP } from "./asset-manifest.ts";

/** Everything the kids game loads at runtime hangs off this prefix. */
export const ASSETS = "/kids-assets";

/** `/kids-assets/models/x.glb` → `/kids-assets/v1a2b3c4d/models/x.glb`. */
export function versioned(url: string): string {
  if (!url.startsWith(`${ASSETS}/`)) {
    return url;
  }
  const entry = ASSET_MAP[url.slice(ASSETS.length + 1)];
  // An asset added since the last manifest run keeps its plain URL and a
  // day's caching, which is exactly what it had before any of this existed.
  return entry == null ? url : `${ASSETS}/${entry.u}`;
}
