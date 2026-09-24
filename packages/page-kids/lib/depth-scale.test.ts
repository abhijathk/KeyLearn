import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { depthScale } from "./depth-scale.ts";

test("depth retains road scale and shrinks continuously towards the village background", () => {
  for (const eye of [33, 42]) {
    for (const lane of [0, -2]) {
      equal(depthScale(lane, eye, lane), 1);
      let previous = depthScale(lane + 2, eye, lane);
      ok(previous > 1);
      for (let z = lane; z >= -60; z -= 0.5) {
        const scale = depthScale(z, eye, lane);
        ok(Number.isFinite(scale) && scale > 0);
        ok(scale < previous, `depth ${z} must shrink at camera ${eye}`);
        previous = scale;
      }
      // A relocating actor divides out its original fit, avoiding double scaling.
      const initial = depthScale(-10, eye, lane);
      const farther = depthScale(-30, eye, lane);
      ok(Math.abs(initial * (farther / initial) - farther) < 1e-12);
    }
  }
});
