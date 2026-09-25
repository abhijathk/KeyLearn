import { test } from "node:test";
import { equal } from "rich-assert";
import { siteConfigRefreshed } from "./cache.ts";
import { repeat } from "./repeat.ts";

/**
 * A sweep's period is a control-centre setting, but its first tick is
 * scheduled at boot — before the stored settings have loaded, while every
 * read still answers with the default. These pin that the first tick, and
 * any tick already waiting, follow the setting once it loads.
 */

const MIN = 60_000;

test("the first tick follows the configured interval once the settings load", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  let minutes = 60; // what an unloaded cache answers: the default
  let ticks = 0;
  const stop = repeat(
    () => minutes * MIN,
    () => ticks++,
  );

  // The stored value arrives a moment after boot.
  t.mock.timers.tick(2_000);
  minutes = 15;
  siteConfigRefreshed();

  t.mock.timers.tick(15 * MIN - 2_000 - 1);
  equal(ticks, 0);
  t.mock.timers.tick(1);
  equal(ticks, 1, "ran at 15 minutes, not the default hour");

  // And every tick after it keeps the configured period.
  t.mock.timers.tick(15 * MIN);
  equal(ticks, 2);
  stop();
});

test("an unchanged interval leaves the pending tick alone", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  let ticks = 0;
  const stop = repeat(
    () => 10 * MIN,
    () => ticks++,
  );
  t.mock.timers.tick(5 * MIN);
  siteConfigRefreshed();
  t.mock.timers.tick(5 * MIN);
  equal(ticks, 1);
  stop();
});

test("a shorter interval set after the wait has passed it runs at once", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  let minutes = 60;
  let ticks = 0;
  const stop = repeat(
    () => minutes * MIN,
    () => ticks++,
  );
  t.mock.timers.tick(20 * MIN);
  minutes = 15;
  siteConfigRefreshed();
  t.mock.timers.tick(0);
  equal(ticks, 1);
  stop();
});

test("a stopped timer ignores later refreshes", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  let minutes = 60;
  let ticks = 0;
  const stop = repeat(
    () => minutes * MIN,
    () => ticks++,
  );
  stop();
  minutes = 1;
  siteConfigRefreshed();
  t.mock.timers.tick(120 * MIN);
  equal(ticks, 0);
});

test("the settled interval is reported once, after the first load, as the value in force", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  let minutes = 60;
  const told: number[] = [];
  const stop = repeat(
    () => minutes * MIN,
    () => {},
    (ms) => told.push(ms),
  );
  equal(told.length, 0, "nothing is reported from the boot-time default");
  minutes = 15;
  siteConfigRefreshed();
  siteConfigRefreshed();
  equal(told.join(","), String(15 * MIN));
  stop();
});
