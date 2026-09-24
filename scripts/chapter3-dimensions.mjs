/* eslint-disable n/no-extraneous-import -- Uses the page-kids workspace's Three.js geometry loader. */
// Run with node --experimental-strip-types scripts/chapter3-dimensions.mjs.
// Checks geometry only; textures are intentionally omitted from this measurement.
import fs from "node:fs";
import * as T from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { LESSONS_3 } from "../packages/page-kids/lib/chapter3.ts";
globalThis.ProgressEvent = class {
  constructor(t, p) {
    Object.assign(this, p);
  }
};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const result = {};
for (const name of new Set(
  LESSONS_3.flatMap((l) =>
    l.props.flatMap((p) => [
      p.model,
      ...(p.run?.gate ? [p.run.gate.model] : []),
    ]),
  ),
)) {
  const b = fs.readFileSync(
    new URL(
      "../root/public/kids-assets/models/" + name + ".glb",
      import.meta.url,
    ),
  );
  const n = b.readUInt32LE(12),
    g = JSON.parse(b.subarray(20, 20 + n).toString());
  const bin = b.subarray(28 + n);
  g.buffers[0].uri =
    "data:application/octet-stream;base64," + bin.toString("base64");
  delete g.images;
  delete g.textures;
  delete g.materials;
  delete g.animations;
  for (const m of g.meshes) for (const p of m.primitives) delete p.material;
  const model = await loader.parseAsync(JSON.stringify(g), "");
  model.scene.updateMatrixWorld(true);
  const box = new T.Box3();
  model.scene.traverse((m) => {
    if (m.isMesh) {
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
    }
  });
  const s = box.getSize(new T.Vector3());
  result[name] = { w: s.x / s.y, d: s.z / s.y };
}
const { CHAPTER3_DIMENSIONS: stored } =
  await import("../packages/page-kids/lib/chapter3-dimensions.ts");
for (const [name, dim] of Object.entries(result)) {
  if (
    !stored[name] ||
    Math.abs(stored[name].w - dim.w) > 1e-6 ||
    Math.abs(stored[name].d - dim.d) > 1e-6
  )
    throw new Error("Stale footprint dimensions: " + name);
}
console.log(
  "Chapter 3: " +
    Object.keys(result).length +
    " decoded model dimensions match the layout.",
);
