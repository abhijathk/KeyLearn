import test from "node:test";
import { equal, isNull } from "rich-assert";
import { cacheControl } from "./cachecontrol.ts";

/**
 * The cache policy for `/kids-assets/`, which is the one header on this
 * server that a mistake in makes permanent.
 *
 * `immutable` on a URL whose bytes can change pins a broken model on a
 * child's device with no way to reach them, and the only thing standing
 * between those two states is the version segment. These tests are that
 * guarantee written down.
 */

const withEnv = (value: string, fn: () => void) => {
  const was = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    fn();
  } finally {
    process.env.NODE_ENV = was;
  }
};

test("a versioned kids asset may be kept for a year", () => {
  withEnv("production", () => {
    const cc = cacheControl(
      "/kids-assets/v1a2b3c4d/models/ak-3d-pack/Peeli.glb",
    );
    equal(String(cc), "public, no-transform, max-age=31536000, immutable");
  });
});

test("an un-versioned kids asset gets a day and no more", () => {
  withEnv("production", () => {
    const cc = cacheControl("/kids-assets/models/ak-3d-pack/Peeli.glb");
    // A day, and crucially NOT immutable: this URL's bytes can change under
    // it, so a returning learner has to be allowed to find out.
    equal(String(cc), "public, no-transform, max-age=86400");
  });
});

test("only a well-formed version segment earns the promise", () => {
  withEnv("production", () => {
    // Eight lowercase hex and nothing else. A directory that merely starts
    // with a v is a real directory, not a version.
    for (const path of [
      "/kids-assets/village/x.glb", // a word beginning with v
      "/kids-assets/v1a2b3c/x.glb", // too short
      "/kids-assets/v1a2b3c4d5/x.glb", // too long
      "/kids-assets/V1A2B3C4/x.glb", // upper case
      "/kids-assets/v1a2b3g4/x.glb", // not hex
    ]) {
      equal(
        String(cacheControl(path)),
        "public, no-transform, max-age=86400",
        path,
      );
    }
  });
});

test("development caches nothing, versioned or not", () => {
  withEnv("development", () => {
    // Webpack rewrites the bundles on every save, and a stale asset served
    // from a local cache is an afternoon lost to a bug that is not there.
    for (const path of [
      "/kids-assets/v1a2b3c4d/models/x.glb",
      "/kids-assets/models/x.glb",
      "/assets/main.js",
    ]) {
      equal(String(cacheControl(path)), "private, no-store, max-age=0", path);
    }
  });
});

test("the service worker script is never stored", () => {
  withEnv("production", () => {
    // It decides what everything else caches, so a stale copy is the one
    // mistake that cannot be corrected from this end.
    equal(String(cacheControl("/sw.js")), "private, no-store, max-age=0");
  });
});

test("paths outside the two asset trees set no policy", () => {
  withEnv("production", () => {
    isNull(cacheControl("/"));
    isNull(cacheControl("/kids"));
  });
});
