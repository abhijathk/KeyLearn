import { test } from "node:test";
import { type Step } from "@keylearn/textinput";
import { deepEqual } from "rich-assert";
import { NgramStats } from "./ngramstats.ts";

function steps(
  seq: ReadonlyArray<readonly [number, number, boolean?]>,
): Step[] {
  let timeStamp = 0;
  return seq.map(([codePoint, timeToType, typo = false]) => {
    timeStamp += timeToType;
    return { timeStamp, codePoint, timeToType, typo };
  });
}

const A = 0x61;
const B = 0x62;
const X = 0x78;

test("ranks a true transition bottleneck above an intrinsically slow key", () => {
  const stats = new NgramStats();
  // B is quick after X (150ms) but slow only after A (400ms): the pair A>B is
  // the real bottleneck, even though B on its own is not the slowest key.
  const run: Step[] = [];
  for (let i = 0; i < 8; i++) {
    run.push(
      ...steps([
        [X, 150],
        [B, 150],
        [A, 150],
        [B, 400],
      ]),
    );
  }
  stats.append(run);

  const worst = stats.worst(new Set([A, B, X]));
  deepEqual([worst?.from, worst?.to], [A, B]);
});

test("needs both keys inside the included set", () => {
  const stats = new NgramStats();
  const run: Step[] = [];
  for (let i = 0; i < 8; i++) {
    run.push(
      ...steps([
        [X, 150],
        [B, 150],
        [A, 150],
        [B, 400],
      ]),
    );
  }
  stats.append(run);

  // A is not unlocked yet, so the A>B pair must not be offered.
  deepEqual(stats.worst(new Set([B, X])), null);
});

test("serialization round-trips the weakness ranking", () => {
  const stats = new NgramStats();
  const run: Step[] = [];
  for (let i = 0; i < 8; i++) {
    run.push(
      ...steps([
        [X, 150],
        [B, 150],
        [A, 150],
        [B, 400],
      ]),
    );
  }
  stats.append(run);

  const restored = NgramStats.fromJSON(stats.toJSON());
  deepEqual(
    restored.worst(new Set([A, B, X])),
    stats.worst(new Set([A, B, X])),
  );
});

test("no data yields no bottleneck", () => {
  const stats = new NgramStats();
  deepEqual(stats.hasData, false);
  deepEqual(stats.worst(new Set([A, B])), null);
});
