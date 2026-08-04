import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import { mergeSnapshots } from "./merge.ts";
import { type Snapshot } from "./storage.ts";

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  progress: {},
  days: [],
  daily: {},
  savedAt: 0,
  ...over,
});

const stat = (hits: number, misses = 0, bestMs: number | null = 500) => ({
  hits,
  misses,
  bestMs,
  recentMs: Array.from({ length: Math.min(8, hits) }, () => 500),
  recent: Array.from({ length: Math.min(20, hits) }, () => true),
});

test("neither device's work is thrown away", () => {
  // The whole reason this is not a clock comparison: both sides are records of
  // practice somebody actually sat through.
  const laptop = snap({ progress: { a: stat(40), b: stat(10) }, savedAt: 100 });
  const tablet = snap({ progress: { a: stat(12), c: stat(30) }, savedAt: 200 });
  const merged = mergeSnapshots(laptop, tablet) as Snapshot & {
    progress: Record<string, ReturnType<typeof stat>>;
  };
  equal(merged.progress.a.hits, 40, "the fuller record of a shared cell");
  equal(merged.progress.b.hits, 10, "a cell only the laptop knows");
  equal(merged.progress.c.hits, 30, "a cell only the tablet knows");
});

test("a stale device cannot take back cells already taught", () => {
  const ahead = snap({ progress: { "#reached": 22 as never } });
  const behind = snap({ progress: { "#reached": 7 as never } });
  const merged = mergeSnapshots(behind, ahead);
  equal((merged.progress as Record<string, unknown>)["#reached"], 22);
});

test("practice days are a set, so both calendars survive", () => {
  const a = snap({ days: ["2026-08-02", "2026-08-01"] });
  const b = snap({ days: ["2026-08-03", "2026-08-01"] });
  deepEqual(mergeSnapshots(a, b).days, [
    "2026-08-03",
    "2026-08-02",
    "2026-08-01",
  ]);
});

test("a day worked on both devices keeps the fuller tally", () => {
  const day = { hits: 0, misses: 0, totalMs: 0, timed: 0, bestMs: null };
  const a = snap({
    daily: { "2026-08-02": { ...day, hits: 40, bestMs: 600 } },
  });
  const b = snap({
    daily: {
      "2026-08-02": { ...day, hits: 12, bestMs: 400 },
      "2026-08-03": { ...day, hits: 5 },
    },
  });
  const merged = mergeSnapshots(a, b);
  equal(merged.daily["2026-08-02"].hits, 40);
  equal(merged.daily["2026-08-02"].bestMs, 400, "the better time is the best");
  equal(merged.daily["2026-08-03"].hits, 5, "and a day only one side has");
});

test("the recent window comes from one device, not spliced from two", () => {
  // Interleaving two machines' last twenty attempts would describe a session
  // that never happened, and accuracy is judged on exactly that window.
  const busy = snap({ progress: { a: { ...stat(90), recentMs: [111, 111] } } });
  const idle = snap({ progress: { a: { ...stat(3), recentMs: [999, 999] } } });
  const merged = mergeSnapshots(idle, busy) as Snapshot & {
    progress: Record<string, ReturnType<typeof stat>>;
  };
  deepEqual(merged.progress.a.recentMs, [111, 111]);
});

test("merging is order independent", () => {
  const a = snap({ progress: { a: stat(40), b: stat(2, 3) }, days: ["x"] });
  const b = snap({ progress: { a: stat(12), c: stat(30) }, days: ["y"] });
  deepEqual(mergeSnapshots(a, b), mergeSnapshots(b, a));
});

test("rubbish from the network does not corrupt the device's copy", () => {
  const mine = snap({ progress: { a: stat(40) } });
  const junk = { progress: "nonsense", days: null, daily: null, savedAt: NaN };
  const merged = mergeSnapshots(
    mine,
    junk as unknown as Snapshot,
  ) as Snapshot & {
    progress: Record<string, ReturnType<typeof stat>>;
  };
  equal(merged.progress.a.hits, 40);
  isTrue(Array.isArray(merged.days));
});
