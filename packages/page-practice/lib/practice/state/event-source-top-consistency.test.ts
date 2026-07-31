import { test } from "node:test";
import { Layout } from "@keybr/keyboard";
import { Result, TextType } from "@keybr/result";
import { Histogram } from "@keybr/textinput";
import { deepEqual } from "rich-assert";
import { TopConsistencyEvents } from "./event-source-top-consistency.ts";
import { type LessonEvent } from "./event-types.ts";

function result(consistency: number | null): Result {
  return new Result(
    Layout.EN_US,
    TextType.GENERATED,
    Date.parse("2026-01-01T00:00:00Z"),
    100,
    50000,
    0,
    Histogram.empty,
    consistency,
  );
}

test("generate consistency events", () => {
  // Arrange.

  const source = new TopConsistencyEvents();
  const events = new Set<LessonEvent>();
  const listener = events.add.bind(events);

  // Act — three equal-rhythm runs; nothing beats the first, no fire.

  source.append(result(0.5), listener);
  source.append(result(0.5), listener);
  source.append(result(0.5), listener);

  // Assert.

  deepEqual([...events], []);
  events.clear();

  // Act — a smoother run beats the best and fires.

  source.append(result(0.8), listener);

  // Assert.

  deepEqual(
    [...events],
    [{ type: "top-consistency", consistency: 0.8, previous: 0.5 }],
  );
  events.clear();

  // Act — results without rhythm data (loaded from storage) are ignored.

  source.append(result(null), listener);

  // Assert.

  deepEqual([...events], []);
});
