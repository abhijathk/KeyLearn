import { test } from "node:test";
import { Layout } from "@keylearn/keyboard";
import { Result, TextType } from "@keylearn/result";
import { Histogram } from "@keylearn/textinput";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import { implausible, MAX_SPEED_CPM, partitionPlausible } from "./plausible.ts";

/**
 * A result as the client would post one. `length` characters in `time`
 * milliseconds, with a histogram that accounts for the run.
 */
function result({
  length = 200,
  time = 60_000,
  errors = 2,
  keys = 12,
  perKey = time / length,
  hitShare = 1,
}: {
  length?: number;
  time?: number;
  errors?: number;
  keys?: number;
  perKey?: number;
  hitShare?: number;
} = {}): Result {
  const hits = Math.round((length * hitShare) / keys);
  const histogram = new Histogram(
    Array.from({ length: keys }, (_, i) => ({
      codePoint: 97 + i,
      hitCount: hits,
      missCount: 0,
      timeToType: perKey,
    })),
  );
  return new Result(
    Layout.EN_US,
    TextType.GENERATED,
    Date.now(),
    length,
    time,
    errors,
    histogram,
    null,
  );
}

test("an ordinary lesson is credited", () => {
  // 200 characters in a minute is 200cpm, or 40wpm — a real learner, and the
  // bounds must never be near them.
  isNull(implausible(result()));
});

test("a very fast but human lesson is still credited", () => {
  // 120wpm is a strong touch typist and has to pass, or the bound is catching
  // people rather than fabrications.
  isNull(implausible(result({ length: 600, time: 60_000, perKey: 100 })));
});

test("a speed no hand has reached is refused", () => {
  // The record is around 212wpm; the ceiling is 300wpm, so this is not a
  // judgement about anyone's typing.
  const bad = implausible(result({ length: 6000, time: 60_000, perKey: 10 }));
  isNotNull(bad);
  isTrue(bad!.reason.includes("over"), bad!.reason);
});

test("the ceiling is stated in the units the app counts in", () => {
  // A quiet unit slip here would either refuse everybody or nobody. 1500cpm
  // is 300wpm, because the app counts characters and shows a fifth of them.
  equal(MAX_SPEED_CPM / 5, 300);
});

test("more keys than the clock allows is refused", () => {
  // Even with a plausible headline speed, the keystrokes have to fit in the
  // time: 500 keys in one second is not a fast run, it is a forged one.
  isNotNull(implausible(result({ length: 500, time: 1000, perKey: 2 })));
});

test("a key averaging faster than a hand moves is refused", () => {
  isNotNull(implausible(result({ perKey: 5 })));
});

test("a histogram that does not add up to the run is refused", () => {
  // The tedious part to forge: a headline speed with per-key detail that
  // never accounted for it.
  const bad = implausible(result({ hitShare: 0.1 }));
  isNotNull(bad);
  isTrue(bad!.reason.includes("histogram"), bad!.reason);
});

test("a histogram that is merely incomplete is not refused", () => {
  // Real runs lose some keys for legitimate reasons, and this bound is not
  // meant to be tight.
  isNull(implausible(result({ hitShare: 0.7 })));
});

test("nonsense numbers are refused rather than stored", () => {
  const infinite = result({ length: 100, time: 0 });
  isNotNull(implausible(infinite));
});

test("the honest results survive a batch containing a forged one", () => {
  // The partition exists so one bad row cannot cost a learner the whole
  // upload — their history keeps everything, and only the board is filtered.
  const { credited, refused } = partitionPlausible([
    result(),
    result({ length: 6000, time: 60_000, perKey: 10 }),
    result(),
  ]);
  equal(credited.length, 2);
  equal(refused.length, 1);
  isTrue(refused[0].reason.length > 0, "a refusal always says why");
});
