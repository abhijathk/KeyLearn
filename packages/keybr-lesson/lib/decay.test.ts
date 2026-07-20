import { test } from "node:test";
import { isTrue } from "rich-assert";
import { halfLifeOf, recallProbability } from "./decay.ts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const targetSpeed = 250; // 50 wpm -> 240 ms target time

test("recall is 1 when never practised", () => {
  isTrue(recallProbability([], targetSpeed, 100 * MS_PER_DAY) === 1);
});

test("recall is 1 immediately after practice and decays over time", () => {
  const samples = [good(0), good(0), good(0)];
  isTrue(recallProbability(samples, targetSpeed, 0) === 1);
  const later = recallProbability(samples, targetSpeed, 100 * MS_PER_DAY);
  isTrue(later < 1);
  isTrue(later > 0);
});

test("stronger histories decay more slowly (longer half-life)", () => {
  const weak = [good(0)];
  const strong = Array.from({ length: 8 }, () => good(0));
  isTrue(halfLifeOf(strong, targetSpeed) > halfLifeOf(weak, targetSpeed));

  const at = 20 * MS_PER_DAY;
  isTrue(
    recallProbability(strong, targetSpeed, at) >
      recallProbability(weak, targetSpeed, at),
  );
});

test("a recent failure shrinks the half-life", () => {
  const allGood = Array.from({ length: 5 }, () => good(0));
  const endsBad = [...Array.from({ length: 4 }, () => good(0)), bad(0)];
  isTrue(halfLifeOf(endsBad, targetSpeed) < halfLifeOf(allGood, targetSpeed));
});

function good(timeStamp: number) {
  return sample(timeStamp, 180, 5, 0); // fast + accurate
}

function bad(timeStamp: number) {
  return sample(timeStamp, 400, 5, 4); // slow + sloppy
}

function sample(
  timeStamp: number,
  timeToType: number,
  hitCount: number,
  missCount: number,
) {
  return {
    index: 0,
    timeStamp,
    hitCount,
    missCount,
    timeToType,
    filteredTimeToType: timeToType,
  };
}
