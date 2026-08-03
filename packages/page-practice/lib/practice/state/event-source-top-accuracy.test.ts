import { test } from "node:test";
import { ResultFaker } from "@keylearn/result";
import { deepEqual } from "rich-assert";
import { TopAccuracyEvents } from "./event-source-top-accuracy.ts";
import { type LessonEvent } from "./event-types.ts";

test("generate accuracy events", () => {
  // Arrange.

  const faker = new ResultFaker();
  const source = new TopAccuracyEvents();
  const events = new Set<LessonEvent>();
  const listener = events.add.bind(events);

  // Act — three runs at 96% accuracy (length 100, 4 errors), no fire yet.

  source.append(faker.nextResult({ errors: 4 }), listener);
  source.append(faker.nextResult({ errors: 4 }), listener);
  source.append(faker.nextResult({ errors: 4 }), listener);

  // Assert.

  deepEqual([...events], []);
  events.clear();

  // Act — a cleaner run at 98% beats the best and fires.

  source.append(faker.nextResult({ errors: 2 }), listener);

  // Assert.

  deepEqual(
    [...events],
    [{ type: "top-accuracy", accuracy: 0.98, previous: 0.96 }],
  );
  events.clear();

  // Act — a worse run does not fire.

  source.append(faker.nextResult({ errors: 6 }), listener);

  // Assert.

  deepEqual([...events], []);
});
