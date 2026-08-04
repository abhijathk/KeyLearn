import { test } from "node:test";
import { Layout } from "@keylearn/keyboard";
import { Result, TextType } from "@keylearn/result";
import { Histogram } from "@keylearn/textinput";
import { equal, isNull, isTrue } from "rich-assert";
import { bandConfig } from "./age.ts";
import { paceTarget, perKeyTimes, slowKeyPace } from "./pace.ts";

/**
 * A session in which every listed key was typed at its own pace.
 * `speeds` is characters per minute per character.
 */
function session(speeds: Record<string, number>): Result {
  const samples = Object.entries(speeds).map(([ch, cpm]) => ({
    codePoint: ch.codePointAt(0)!,
    hitCount: 10,
    missCount: 0,
    timeToType: 60000 / cpm,
  }));
  const mean =
    Object.values(speeds).reduce((s, v) => s + v, 0) /
    Object.values(speeds).length;
  return new Result(
    Layout.EN_US,
    TextType.GENERATED,
    0,
    100,
    (100 / mean) * 60000,
    0,
    new Histogram(samples),
  );
}

test("nothing is assumed from one or two sessions", () => {
  isNull(slowKeyPace([]));
  isNull(slowKeyPace([session({ a: 50 }), session({ a: 50 })]));
  // Until then the band's floor stands, which is the BOTTOM of what the band
  // itself calls typical for the age — not, as before, above the top of it.
  const cfg = bandConfig("5-6");
  equal(paceTarget([], cfg), cfg.paceFloor);
});

test("the bar is built from per-key speeds, not the session average", () => {
  // One fast letter flatters a session average badly. The gate is decided by
  // the slowest key, so the target has to be too.
  const runs = Array.from({ length: 4 }, () =>
    session({ a: 40, e: 42, n: 44, l: 300 }),
  );
  const pace = slowKeyPace(runs)!;
  isTrue(pace < 60, `anchored near the slow keys, got ${pace}`);
});

test("the target lands within reach of the slowest key", () => {
  const runs = Array.from({ length: 5 }, () =>
    session({ a: 40, e: 45, n: 50, r: 60, l: 100 }),
  );
  const target = paceTarget(runs, bandConfig("5-6"));
  // Above the slowest, or nothing is being asked for. But close to it, or the
  // trail can never move — which is precisely what stalled a real five-year-old
  // for twenty-seven sessions.
  isTrue(target > 40, `should ask for more than the slowest, got ${target}`);
  isTrue(target < 40 * 1.35, `should stay within reach, got ${target}`);
});

test("a child who is flying is not held back, nor run away from", () => {
  const cfg = bandConfig("9-10");
  const fast = Array.from({ length: 6 }, () =>
    session({ a: 400, e: 420, n: 440 }),
  );
  equal(paceTarget(fast, cfg), cfg.paceCeil, "the ceiling holds");
  const slow = Array.from({ length: 6 }, () => session({ a: 10, e: 11 }));
  equal(paceTarget(slow, cfg), cfg.paceFloor, "and so does the floor");
});

test("one bad session does not move the bar much", () => {
  const good = Array.from({ length: 8 }, () =>
    session({ a: 60, e: 62, n: 64 }),
  );
  const steady = paceTarget(good, bandConfig("7-8"));
  const withSlump = paceTarget(
    [...good, session({ a: 20, e: 21, n: 22 })],
    bandConfig("7-8"),
  );
  // Averaged across the window rather than taken from the last run, so an off
  // day costs a little and not the whole target.
  isTrue(
    withSlump >= steady * 0.75,
    `a slump moved the bar from ${steady} to ${withSlump}`,
  );
});

test("per-key times average across the window", () => {
  const times = perKeyTimes([session({ a: 60 }), session({ a: 120 })]);
  // 60 cpm is 1000ms a character, 120 cpm is 500ms; the mean is 750.
  equal(Math.round(times.get("a".codePointAt(0)!)!), 750);
});
