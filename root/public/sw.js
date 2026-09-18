/*
 * ── THE LOCAL ASSET STORE ────────────────────────────────────────────────
 *
 * Keeps the kids games' models, textures and sky maps on the device, so the
 * second visit costs nothing and works offline.
 *
 * ONLY VERSIONED URLS ARE EVER CACHED, and that single rule is what makes
 * this safe. A URL carrying a content hash cannot go stale: change the file
 * and every reference to it moves to a different URL, so nothing kept under
 * the old one can be wrong. Anything without a hash — `manifest.json` above
 * all, which has to stay mutable — goes to the network every time and is
 * never stored.
 *
 * That is deliberately not the usual shape. The common design precaches a
 * list and manages staleness with versioned cache names and update prompts,
 * and its worst failure is pinning a broken build on a device that has no way
 * to be told. Here the hash does the work, and there is no staleness left to
 * manage.
 *
 * NOTHING HERE MAY BE A WAY FOR THE GAME NOT TO START. Every path falls
 * through to the network: a miss, a full quota, a cache API that throws, a
 * browser in private mode. The worst this can do is fail to help.
 */

/** Only this subtree, and only requests that look content-addressed. */
const SCOPE = "/kids-assets/";
const VERSIONED = /^\/kids-assets\/v[0-9a-f]{8}\//;

/**
 * One cache, not one per build.
 *
 * A build-versioned cache name is how you evict a precache, and there is no
 * precache here. Entries are keyed by URLs that already contain their own
 * version, so a new build simply writes new keys; the old ones are swept in
 * `activate` by asking the page's manifest which URLs still exist.
 */
const CACHE = "kids-assets-v1";

self.addEventListener("install", (event) => {
  // Nothing to precache — this fills as the game asks for things, so a child
  // never pays for a download they did not trigger. Taking over immediately
  // is safe for the same reason everything else here is: a cached entry can
  // only be the bytes its URL names.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Any cache from an older shape of this worker.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("kids-assets-") && n !== CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Untouched unless it is ours: same origin, our subtree, a GET, and
  // content-addressed. Everything else — the page, the API, the bundles,
  // `manifest.json` — is left entirely alone, not even passed through.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(SCOPE) ||
    !VERSIONED.test(url.pathname)
  ) {
    return;
  }
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit != null) {
      return hit;
    }
    const res = await fetch(request);
    // Only a real answer is worth keeping. A 404 or a 5xx cached under an
    // immutable URL would be permanent, which is the one mistake this whole
    // design exists to make impossible.
    if (res.ok) {
      // Not awaited: the reply goes back now and the copy lands behind it.
      // A full quota throws here and is ignored — see the note above.
      void cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    // Cache API unavailable (private mode, storage disabled) or the network
    // failed. Either way the browser's own attempt is the honest last word.
    return fetch(request);
  }
}
