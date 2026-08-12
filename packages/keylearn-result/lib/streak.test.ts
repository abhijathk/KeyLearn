import { test } from "node:test";
import { equal } from "rich-assert";
import { ResultFaker } from "./fake.tsx";
import { dailyStreak } from "./streak.ts";

const faker = new ResultFaker();

test("a forgiven streak survives a rest day", () => {
  // A streak is a loss-aversion device. For somebody with a fatiguing illness
  // it punishes the rest they were told to take, and the fear of breaking it
  // is what makes people stop altogether rather than pause.
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const on = (daysAgo: number) =>
    faker.nextResult({ timeStamp: now - daysAgo * day });
  // Practised today, yesterday, nothing the day before, then two more days.
  const results = [on(0), on(1), on(3), on(4)];

  // Ordinarily the gap ends it at two.
  equal(dailyStreak(results), 2);
  // Forgiven, the run carries on — and still reads four, because the missed
  // day is forgiven rather than counted. The number stays a true count of days
  // actually spent at the keyboard.
  equal(dailyStreak(results, 1), 4);
});

test("forgiveness does not invent a streak out of nothing", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  // Last practised three days ago, with grace of one.
  const results = [faker.nextResult({ timeStamp: now - 3 * day })];
  equal(dailyStreak(results, 1), 0);
});
