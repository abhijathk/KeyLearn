import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import { intlDates } from "./dates.ts";

// 2 August 2026, 04:32 UTC. Chosen because it falls on a different date in
// some zones than in others, which is the whole point of the exercise.
const at = Date.UTC(2026, 7, 2, 4, 32);

test("writes the date in the order the locale writes it", () => {
  // The example everybody recognises: the same instant, three conventions.
  equal(
    intlDates("en-AU", "Australia/Sydney").formatStamp(at),
    "02-08-2026-1432",
  );
  equal(
    intlDates("en-US", "America/New_York").formatStamp(at),
    "08-02-2026-0032",
  );
  equal(intlDates("ja-JP", "Asia/Tokyo").formatStamp(at), "2026-08-02-1332");
});

test("the time zone decides which day it is", () => {
  // 04:32 UTC is still the 1st in Los Angeles and already the 2nd in Sydney.
  equal(intlDates("en-AU", "Australia/Sydney").formatIsoDate(at), "2026-08-02");
  equal(
    intlDates("en-US", "America/Los_Angeles").formatIsoDate(at),
    "2026-08-01",
  );
  equal(intlDates("en-GB", "UTC").formatIsoDate(at), "2026-08-02");
});

test("the ISO form stays sortable whatever the locale", () => {
  // Unlike formatStamp, this one never reorders — it exists for grouping and
  // comparing, not for reading.
  for (const locale of ["en-AU", "en-US", "ja-JP", "de-DE", "ar-EG"]) {
    equal(intlDates(locale, "UTC").formatIsoDate(at), "2026-08-02");
  }
});

test("shows the clock in the account's zone", () => {
  const sydney = intlDates("en-AU", "Australia/Sydney").formatTime(at);
  const london = intlDates("en-GB", "Europe/London").formatTime(at);
  isTrue(
    sydney.includes("2:32"),
    `expected an afternoon in Sydney, got ${sydney}`,
  );
  isTrue(
    london.includes("05:32"),
    `expected an early morning in London, got ${london}`,
  );
});

test("falls back to the device when the zone is not one the runtime knows", () => {
  // A stored zone can go stale, or arrive from another machine. Throwing on
  // every render is not an option.
  const dates = intlDates("en-AU", "Mars/Olympus_Mons");
  isTrue(dates.timeZone !== "Mars/Olympus_Mons");
  isTrue(dates.formatIsoDate(at).length === 10);
});

test("names the month in the reader's language", () => {
  // This one used to be hard-coded to English on the calendar heat map.
  equal(intlDates("en-AU", "UTC").formatMonth(at), "Aug");
  equal(intlDates("de-DE", "UTC").formatMonth(at), "Aug");
  equal(intlDates("fr-FR", "UTC").formatMonth(at, "long"), "août");
});

test("midnight is 00 rather than 24", () => {
  const midnight = Date.UTC(2026, 7, 2, 0, 0);
  equal(intlDates("en-GB", "UTC").formatStamp(midnight), "02-08-2026-0000");
});

test("the week begins where the region begins it", () => {
  // The setting is empty for all of these — the locale already knows.
  equal(intlDates("en-AU", "UTC").firstDayOfWeek, 1); // Monday
  equal(intlDates("en-GB", "UTC").firstDayOfWeek, 1);
  equal(intlDates("de-DE", "UTC").firstDayOfWeek, 1);
  equal(intlDates("en-US", "UTC").firstDayOfWeek, 7); // Sunday
  equal(intlDates("ja-JP", "UTC").firstDayOfWeek, 7);
  equal(intlDates("pt-BR", "UTC").firstDayOfWeek, 7);
  equal(intlDates("ar-EG", "UTC").firstDayOfWeek, 6); // Saturday
});

test("an explicit setting overrides the region", () => {
  equal(intlDates("en-US", "UTC", "mon").firstDayOfWeek, 1);
  equal(intlDates("en-AU", "UTC", "sun").firstDayOfWeek, 7);
});

test("names the weekdays in the reader's own order and language", () => {
  deepEqual(intlDates("en-AU", "UTC").weekDayNames("short"), [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]);
  deepEqual(intlDates("en-US", "UTC").weekDayNames("short"), [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ]);
  deepEqual(intlDates("de-DE", "UTC").weekDayNames("short"), [
    "Mo",
    "Di",
    "Mi",
    "Do",
    "Fr",
    "Sa",
    "So",
  ]);
});
