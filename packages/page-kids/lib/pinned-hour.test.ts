import { test } from "node:test";
import { equal } from "rich-assert";
import { activityAt } from "./chapter1.ts";
import { pinnedHours } from "./world.ts";

/**
 * The bug this pins down: a child with the hour pinned to midday and the
 * night switched on saw a midnight sky and a scoreboard reading 12:00 am, and
 * no Kuttichathan anywhere — because the corridor is staged once while the
 * world is built, and the pinned hour used to arrive after that, through
 * `setHour`. The build therefore asked the REAL clock, which at seven in the
 * morning stages an evening, and evenings build no corridor.
 *
 * `pinnedHours` is the answer the build now gets. If these stop holding, the
 * corridor moves hours without anybody meaning it to.
 */
test("a pinned hour stages the other half of the clock as its night", () => {
  equal(pinnedHours(12).day, 12);
  equal(pinnedHours(12).night, 0);
  equal(pinnedHours(0).day, 12);
  equal(pinnedHours(0).night, 0);
  equal(pinnedHours(23).day, 11);
  equal(pinnedHours(23).night, 23);
});

test("the hours a grown-up can pick, and whether he is due at each", () => {
  // The settings offer exactly these; `deep` is when the corridor is staged.
  const due = (h: number) => activityAt(pinnedHours(h).night) === "deep";
  equal(due(7), false);
  equal(due(9), false);
  // Midday is the one the report came in on, and he IS due there.
  equal(due(12), true);
  equal(due(15), true);
  equal(due(17), false);
});
