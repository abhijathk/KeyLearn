import { test } from "node:test";
import { deepEqual, equal, ok } from "rich-assert";
import {
  landForScene,
  lessonInScene,
  SCENE_LESSONS,
  sceneIndexOf,
  sceneJustEnded,
  sceneSlot,
} from "./scene-order.ts";

test("a scene lasts ten lessons and they are one place", () => {
  equal(SCENE_LESSONS, 10);
  for (let done = 0; done < 10; done++) {
    equal(sceneIndexOf(done), 0);
  }
  equal(sceneIndexOf(10), 1);
  equal(sceneIndexOf(19), 1);
  equal(sceneIndexOf(20), 2);
});

test("lessons count from one inside their scene", () => {
  equal(lessonInScene(0), 1);
  equal(lessonInScene(9), 10);
  equal(lessonInScene(10), 1);
});

test("the world only changes when the tenth lesson is finished", () => {
  equal(sceneJustEnded(0), false);
  equal(sceneJustEnded(9), false);
  equal(sceneJustEnded(10), true);
  equal(sceneJustEnded(11), false);
  equal(sceneJustEnded(20), true);
});

test("bad counts fall back to the first scene", () => {
  equal(sceneIndexOf(-5), 0);
  equal(sceneIndexOf(Number.NaN), 0);
});

test("every place is visited once per round", () => {
  for (const count of [2, 3, 4, 7]) {
    for (let round = 0; round < 6; round++) {
      const seen = new Set<number>();
      for (let i = 0; i < count; i++) {
        seen.add(sceneSlot(count, round * count + i));
      }
      equal(seen.size, count);
    }
  }
});

test("the same scenery never appears twice running", () => {
  for (const count of [2, 3, 4, 7]) {
    for (let scene = 0; scene < 400; scene++) {
      ok(
        sceneSlot(count, scene) !== sceneSlot(count, scene + 1),
        `count ${count}, scene ${scene}`,
      );
    }
  }
});

test("a scene always gives the same place", () => {
  const first = Array.from({ length: 40 }, (_, i) => sceneSlot(4, i));
  const again = Array.from({ length: 40 }, (_, i) => sceneSlot(4, i));
  deepEqual(first, again);
});

test("one place is one place", () => {
  equal(sceneSlot(1, 0), 0);
  equal(sceneSlot(1, 12), 0);
  equal(landForScene(["only"], 5), "only");
});

test("the order is shuffled, not a plain rotation", () => {
  const order = Array.from({ length: 24 }, (_, i) => sceneSlot(4, i));
  const plain = Array.from({ length: 24 }, (_, i) => i % 4);
  ok(order.some((slot, i) => slot !== plain[i]));
});
