import { test } from "node:test";
import { Layout } from "@keylearn/keyboard";
import { Result, TextType } from "@keylearn/result";
import { Histogram } from "@keylearn/textinput";
import { deepEqual } from "rich-assert";
import { LastRunEvents } from "./event-source-last-run.ts";
import { type LessonEvent } from "./event-types.ts";

// A shorter time means a higher score, so smaller time = better run.
function result(time: number): Result {
  return new Result(
    Layout.EN_US,
    TextType.GENERATED,
    Date.parse("2026-01-01T00:00:00Z"),
    100,
    time,
    0,
    new Histogram([
      { codePoint: 0x61, hitCount: 50, missCount: 0, timeToType: 200 },
      { codePoint: 0x62, hitCount: 50, missCount: 0, timeToType: 200 },
    ]),
  );
}

function collect(source: LastRunEvents, times: number[]): string[] {
  const types: string[] = [];
  const listener = (e: LessonEvent) => types.push(e.type);
  for (const t of times) {
    source.append(result(t), listener);
  }
  return types;
}

test("stays quiet on the first run", () => {
  deepEqual(collect(new LastRunEvents(), [60000]), []);
});

test("celebrates beating the previous run", () => {
  // 60000 then 50000 → faster → higher score → beat.
  deepEqual(collect(new LastRunEvents(), [60000, 50000]), ["beat-last-run"]);
});

test("nudges gently on a near miss", () => {
  // A slightly slower round lands within the "so close" margin.
  deepEqual(collect(new LastRunEvents(), [50000, 52000]), ["near-last-run"]);
});

test("stays quiet on a clearly worse round", () => {
  // Way slower falls outside the margin — no discouraging nudge.
  deepEqual(collect(new LastRunEvents(), [50000, 100000]), []);
});
