/**
 * ── KEEPING THE ASSETS ON THE DEVICE ─────────────────────────────────────
 *
 * Turns on the service worker in `root/public/sw.js`, which holds the kids
 * games' models and textures locally so a second visit costs nothing and
 * works offline. Forty-two megabytes that a child on a slow line should have
 * to fetch once, not once a day.
 *
 * WHY THIS IS A FUNCTION AND NOT A MODULE SIDE EFFECT. Registering a worker
 * costs a script fetch, an install and a claim, and doing that at page load
 * puts all three in front of the first lesson's assets — competing for the
 * same scarce bandwidth on exactly the connection this is meant to help.
 * Called once the game is playable, it costs the child nothing.
 *
 * NOTHING HERE IS ALLOWED TO MATTER. Every step is optional and every failure
 * is swallowed: no service worker support, a refused registration, storage
 * turned off, private browsing. The game behaved correctly before any of this
 * existed and must go on doing so when it is unavailable.
 */

import { ASSET_MAP } from "./asset-manifest.ts";

let started = false;

export function startAssetStore(): void {
  // Once per page, however many times a world is rebuilt around it.
  if (started || typeof navigator === "undefined") {
    return;
  }
  started = true;
  void (async () => {
    try {
      if (!("serviceWorker" in navigator)) {
        return;
      }
      /*
       * SCOPE `/`, WHICH IS WIDER THAN THIS NEEDS AND CANNOT BE NARROWER.
       *
       * A worker only sees requests from pages it CONTROLS, and the page is
       * at `/kids` — so a worker served from `/kids-assets/` would control
       * nothing and intercept nothing. The narrowness has to come from the
       * worker's own fetch handler instead, which returns without touching
       * anything that is not a versioned asset.
       */
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      /*
       * ASK FOR THE STORAGE TO BE KEPT.
       *
       * Without this the browser is free to evict the whole cache the moment
       * the device is short of space, which on the low-end machines this game
       * is built for is exactly when it will happen. Chrome grants it on
       * engagement rather than on asking, so this is a request that may
       * quietly be refused — and a refusal is fine: the cache simply becomes
       * evictable again, which is where it started.
       */
      if (navigator.storage?.persist != null) {
        await navigator.storage.persist();
      }
    } catch {
      // Registration refused, insecure origin, storage unavailable. The game
      // does not depend on any of it.
    }
  })();
}

/**
 * ── FILLING IN THE REST OF THIS WORLD, WHILE THE CHILD PLAYS ─────────────
 *
 * The game blocks on almost nothing: the cast, then the stretch of road about
 * to be walked. Everything else in the world arrives when it is needed, which
 * on a slow line means a child meets a pause every time they reach something
 * new.
 *
 * So once they are typing, and only in the gaps between, the rest of this
 * world is fetched quietly into the store. After one session it is all on the
 * device and every later visit is instant — that is the whole promise of the
 * cache, and without this it takes as many visits as there are lessons to
 * come true.
 *
 * ONE WORLD, NOT THREE. Time Keepers owns 27 MB of the 42; Dino Run owns
 * 0.7. A child who only ever plays Dino Run should never pay for a banyan
 * tree, and this is the only part of the system that knows the difference.
 */
export function warmWorld(
  group: "village" | "hero" | "dino",
  /** True while the child is typing — nothing is fetched during a word. */
  busy: () => boolean,
): () => void {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  /*
   * ONLY WITH A STORE TO PUT IT IN, AND ONLY ON A CONNECTION THAT CAN SPARE
   * IT.
   *
   * Without a controlling worker these fetches land in the ordinary HTTP
   * cache and are evicted at the browser's whim — which is a lot of somebody
   * else's data for a benefit that may not survive the afternoon. And a
   * child on a metered phone who has asked the browser to save data has
   * asked this too.
   */
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (
    typeof navigator === "undefined" ||
    navigator.serviceWorker?.controller == null ||
    nav.connection?.saveData === true ||
    nav.connection?.effectiveType === "slow-2g" ||
    nav.connection?.effectiveType === "2g"
  ) {
    return stop;
  }
  void (async () => {
    try {
      const cache = await caches.open("kids-assets-v1");
      // Biggest last. The small props are what a child runs into first and
      // what a stall is most noticeable on; a 1.4 MB villager can wait.
      const want = Object.values(ASSET_MAP)
        .filter((a) => a.g === group || a.g === "shared")
        .sort((x, y) => x.b - y.b);
      for (const asset of want) {
        if (stopped) {
          return;
        }
        // Between words, never during one. A fetch started mid-keystroke
        // competes with the frame that draws the letter.
        while (busy() && !stopped) {
          await gap(700);
        }
        const url = `/kids-assets/${asset.u}`;
        if ((await cache.match(url)) != null) {
          continue;
        }
        try {
          // Through `fetch`, not `cache.add`: the worker is what decides
          // what gets stored, so this goes through the same one rule as
          // everything else rather than around it.
          await fetch(url);
        } catch {
          // One failure is a blip; the next visit tries again. It is not
          // worth abandoning the whole sweep over.
        }
        // A breath between files, so this never looks like a download to the
        // rest of the machine.
        await gap(400);
      }
    } catch {
      // No Cache API, or it went away mid-sweep. Nothing here is required.
    }
  })();
  return stop;
}

const gap = (ms: number) => new Promise((go) => setTimeout(go, ms));
