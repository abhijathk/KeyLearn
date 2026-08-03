import { test } from "node:test";
import { isTrue } from "rich-assert";
import {
  bktMastery,
  bktTrace,
  bktUpdate,
  defaultBktParams,
  sampleSuccess,
} from "./bkt.ts";

test("a correct observation raises mastery, an incorrect one lowers it", () => {
  isTrue(bktUpdate(0.5, true) > 0.5);
  isTrue(bktUpdate(0.5, false) < 0.5);
});

test("mastery converges high after a run of correct observations", () => {
  const { pL } = bktTrace([true, true, true, true, true, true, true, true]);
  isTrue(pL >= 0.95);
});

test("mastery stays low after repeated failures", () => {
  const { pL } = bktTrace([false, false, false, false, false]);
  isTrue(pL < 0.2);
});

test("the peak posterior is retained even after a regression", () => {
  const { pL, pLMax } = bktTrace([true, true, true, true, false, false]);
  isTrue(pLMax >= pL);
  isTrue(pLMax > 0.5);
});

test("params are respected (higher guess rate slows mastery)", () => {
  const obs = [true, true, true, true];
  const low = bktTrace(obs, { ...defaultBktParams, pG: 0.05 }).pL;
  const high = bktTrace(obs, { ...defaultBktParams, pG: 0.45 }).pL;
  isTrue(low > high);
});

test("sampleSuccess requires both speed and accuracy", () => {
  const targetSpeed = 250; // 50 wpm -> 240 ms target time
  const fastAccurate = sample(200, 10, 0);
  const fastSloppy = sample(200, 10, 5);
  const slowAccurate = sample(400, 10, 0);
  isTrue(sampleSuccess(fastAccurate, targetSpeed));
  isTrue(!sampleSuccess(fastSloppy, targetSpeed));
  isTrue(!sampleSuccess(slowAccurate, targetSpeed));
});

test("bktMastery reflects a strong sample history", () => {
  const targetSpeed = 250;
  const samples = Array.from({ length: 8 }, () => sample(180, 10, 0));
  isTrue(bktMastery(samples, targetSpeed).pL >= 0.95);
});

function sample(timeToType: number, hitCount: number, missCount: number) {
  return {
    index: 0,
    timeStamp: 0,
    hitCount,
    missCount,
    timeToType,
    filteredTimeToType: timeToType,
  };
}
