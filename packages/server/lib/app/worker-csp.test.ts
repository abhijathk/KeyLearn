import test from "node:test";
import { isNull, isTrue } from "rich-assert";
import { workerCsp } from "./headers.ts";

/**
 * The Basis transcoder's worker needs `unsafe-eval`, which the document
 * deliberately never gets. That grant is looked up BY PATH — and the same
 * file is also served from `/kids-assets/v<hash>/…`, where an exact-path
 * lookup missed it and handed the worker the document policy instead.
 *
 * It fails silently and completely: a worker that cannot compile its call
 * wrappers never answers its init message, `loadAsync` never settles, and
 * every character in the kids world hangs mid-load with nothing in the
 * console. It cost an afternoon to find. These four lines are the cheapest
 * insurance in the repository.
 */

test("the worker gets its own policy at both of its URLs", () => {
  for (const path of [
    "/kids-assets/basis/ktx2-worker.js",
    "/kids-assets/v1a2b3c4d/basis/ktx2-worker.js",
  ]) {
    const csp = workerCsp(path);
    isTrue(csp != null, `${path} must have a policy of its own`);
    isTrue(csp!.includes("'unsafe-eval'"), `${path} must allow eval`);
    isTrue(csp!.includes("default-src 'none'"), `${path} must be locked down`);
  }
});

test("nothing else on the origin is handed that grant", () => {
  for (const path of [
    "/",
    "/kids",
    "/kids-assets/models/ak-3d-pack/Peeli.glb",
    "/kids-assets/v1a2b3c4d/models/ak-3d-pack/Peeli.glb",
    // A near miss: the right file, a malformed segment.
    "/kids-assets/vZZZZZZZZ/basis/ktx2-worker.js",
    "/kids-assets/basis/basis_transcoder.wasm",
  ]) {
    isNull(workerCsp(path), path);
  }
});
