import { test } from "node:test";
import { LocalDate, ResultFaker } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { deepEqual } from "rich-assert";
import { MutableDailyGoal } from "./dailygoal.ts";
import { lessonProps } from "./settings.ts";

test("daily goal is not set", () => {
  // Arrange.

  const today = new LocalDate(2001, 2, 3);
  const faker = new ResultFaker({ timeStamp: today.timeStamp });
  const dailyGoal = new MutableDailyGoal(
    new Settings().set(lessonProps.dailyGoal, 0),
    () => today.timeStamp,
  );

  // Assert.

  deepEqual(dailyGoal.copy(), { goal: 0, value: 0 });

  // Act.

  dailyGoal.append(faker.nextResult({ time: 60000 }));
  dailyGoal.append(faker.nextResult({ time: 60000 }));

  // Assert.

  deepEqual(dailyGoal.copy(), { goal: 0, value: 0 });
});

test("daily goal is set", () => {
  // Arrange.

  const today = new LocalDate(2001, 2, 3);
  const faker = new ResultFaker({ timeStamp: today.timeStamp });
  const dailyGoal = new MutableDailyGoal(
    new Settings().set(lessonProps.dailyGoal, 10),
    () => today.timeStamp,
  );

  // Act, Assert.

  dailyGoal.append(faker.nextResult({ time: 60000, timeStamp: 0 }));
  deepEqual(dailyGoal.copy(), { goal: 10, value: 0 });

  // Act, Assert.

  dailyGoal.append(faker.nextResult({ time: 60000 }));
  deepEqual(dailyGoal.copy(), { goal: 10, value: 0.1 });

  // Act, Assert.

  dailyGoal.append(faker.nextResult({ time: 60000 }));
  deepEqual(dailyGoal.copy(), { goal: 10, value: 0.2 });

  // Act, Assert.

  dailyGoal.append(
    faker.nextResult({
      time: 60000,
      timeStamp: today.plusDays(1).timeStamp,
    }),
  );
  deepEqual(dailyGoal.copy(), { goal: 10, value: 0.2 });
});

test("the ring keeps counting past midnight", () => {
  // The day used to be captured when the object was built, and the progress
  // object is only rebuilt when a setting changes — so anybody still
  // practising after midnight had every further lesson land outside
  // yesterday's window and the ring simply stopped. Practising late is
  // exactly when somebody is most likely to be watching it.
  const monday = new LocalDate(2001, 2, 3);
  const tuesday = monday.plusDays(1);
  let now = monday.timeStamp + 23 * 3600000;
  const faker = new ResultFaker({ timeStamp: monday.timeStamp });
  const dailyGoal = new MutableDailyGoal(
    new Settings().set(lessonProps.dailyGoal, 10),
    () => now,
  );

  dailyGoal.append(
    faker.nextResult({ time: 300000, timeStamp: monday.timeStamp }),
  );
  deepEqual(dailyGoal.copy(), { goal: 10, value: 0.5 }, "five of ten minutes");

  // Midnight passes, and the learner carries on.
  now = tuesday.timeStamp + 600000;
  deepEqual(dailyGoal.copy(), { goal: 10, value: 0 }, "a fresh day, correctly");

  dailyGoal.append(faker.nextResult({ time: 180000, timeStamp: now }));
  deepEqual(
    dailyGoal.copy(),
    { goal: 10, value: 0.3 },
    "and the new day's minutes count",
  );
});

test("yesterday's minutes are kept, not merged into today", () => {
  const monday = new LocalDate(2001, 2, 3);
  let now = monday.timeStamp;
  const faker = new ResultFaker({ timeStamp: monday.timeStamp });
  const dailyGoal = new MutableDailyGoal(
    new Settings().set(lessonProps.dailyGoal, 10),
    () => now,
  );
  dailyGoal.append(
    faker.nextResult({ time: 600000, timeStamp: monday.timeStamp }),
  );
  deepEqual(dailyGoal.copy(), { goal: 10, value: 1 });
  now = monday.plusDays(1).timeStamp;
  deepEqual(dailyGoal.copy(), { goal: 10, value: 0 }, "a goal is per day");
});
