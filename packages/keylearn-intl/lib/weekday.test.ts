import { test } from "node:test";
import { equal, isFalse, isNotEmpty, isTrue } from "rich-assert";
import { hasInflectedWeekdays, weekdayInSentence } from "./weekday.ts";

// 2024-01-07 was a Sunday. Built through the local-time constructor at noon
// so `getDay()` names the intended day under any host timezone — a UTC
// midnight would slide a day either way.
const noon = (day: number) => new Date(2024, 0, day, 12, 0, 0);

const SUNDAY = noon(7);
const MONDAY = noon(8);
const TUESDAY = noon(9);
const WEDNESDAY = noon(10);
const THURSDAY = noon(11);
const FRIDAY = noon(12);
const SATURDAY = noon(13);

const WEEK = [
  SUNDAY,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
] as const;

const INFLECTED = [
  "fi",
  "et",
  "hu",
  "lv",
  "lt",
  "cs",
  "sk",
  "pl",
  "ru",
  "uk",
  "hr",
  "sl",
  "is",
] as const;

test("the fixture dates are the days they claim to be", () => {
  equal(
    WEEK.map((date) => date.getDay()).join(","),
    "0,1,2,3,4,5,6",
    "index 0 must be Sunday, as Date.getDay() numbers the week",
  );
});

test("every inflected locale answers all seven days", () => {
  for (const locale of INFLECTED) {
    isTrue(hasInflectedWeekdays(locale), `${locale} should be in the table`);

    const forms = WEEK.map((date) => weekdayInSentence(date, locale));

    equal(forms.length, 7, locale);
    for (const form of forms) {
      isNotEmpty(form, locale);
      equal(form, form.trim(), `${locale}: no stray whitespace`);
    }
    equal(
      new Set(forms).size,
      7,
      `${locale}: the seven days must not collapse onto each other`,
    );
  }
});

test("the table wins over the formatter", () => {
  // Not every day differs from the nominative — Hungarian "vasárnap" is its
  // own adverbial — but a locale where none differed would mean the table was
  // never consulted.
  for (const locale of INFLECTED) {
    const differs = WEEK.some(
      (date) =>
        weekdayInSentence(date, locale) !==
        date.toLocaleDateString(locale, { weekday: "long" }),
    );

    isTrue(differs, `${locale}: table form never differed from the formatter`);
  }
});

test("adverbial forms, Finnish", () => {
  equal(weekdayInSentence(SUNDAY, "fi"), "sunnuntaina");
  equal(weekdayInSentence(TUESDAY, "fi"), "tiistaina");
  equal(weekdayInSentence(WEDNESDAY, "fi"), "keskiviikkona");
  equal(weekdayInSentence(SATURDAY, "fi"), "lauantaina");
});

test("adverbial forms, Polish", () => {
  equal(weekdayInSentence(SUNDAY, "pl"), "w niedzielę");
  equal(weekdayInSentence(MONDAY, "pl"), "w poniedziałek");
  equal(weekdayInSentence(TUESDAY, "pl"), "we wtorek");
  equal(weekdayInSentence(WEDNESDAY, "pl"), "w środę");
  equal(weekdayInSentence(SATURDAY, "pl"), "w sobotę");
});

test("adverbial forms, Czech", () => {
  equal(weekdayInSentence(MONDAY, "cs"), "v pondělí");
  equal(weekdayInSentence(TUESDAY, "cs"), "v úterý");
  equal(weekdayInSentence(WEDNESDAY, "cs"), "ve středu");
  equal(weekdayInSentence(THURSDAY, "cs"), "ve čtvrtek");
  equal(weekdayInSentence(FRIDAY, "cs"), "v pátek");
});

test("the preposition alternates with the day, not with the language", () => {
  // The reason the preposition lives in the table rather than in the
  // catalogue string: it is not constant within a single language.
  equal(weekdayInSentence(TUESDAY, "pl"), "we wtorek");
  equal(weekdayInSentence(WEDNESDAY, "pl"), "w środę");

  equal(weekdayInSentence(TUESDAY, "ru"), "во вторник");
  equal(weekdayInSentence(WEDNESDAY, "ru"), "в среду");

  equal(weekdayInSentence(THURSDAY, "sk"), "vo štvrtok");
  equal(weekdayInSentence(WEDNESDAY, "sk"), "v stredu");

  equal(weekdayInSentence(WEDNESDAY, "cs"), "ve středu");
  equal(weekdayInSentence(TUESDAY, "cs"), "v úterý");
});

test("region tags resolve to the base language", () => {
  equal(weekdayInSentence(TUESDAY, "pl-PL"), "we wtorek");
  equal(weekdayInSentence(TUESDAY, "ru-RU"), "во вторник");
  equal(weekdayInSentence(TUESDAY, "HR-BA"), "u utorak");

  isTrue(hasInflectedWeekdays("pl-PL"));
  isTrue(hasInflectedWeekdays("cs_CZ"));
  isTrue(hasInflectedWeekdays("IS-is"));
});

test("locales outside the table fall back to the formatter", () => {
  for (const locale of ["en", "en-US", "de", "de-DE", "fr", "ja", "zh-Hans"]) {
    isFalse(hasInflectedWeekdays(locale), locale);

    const form = weekdayInSentence(TUESDAY, locale);

    isNotEmpty(form, locale);
    equal(
      form,
      TUESDAY.toLocaleDateString(locale, { weekday: "long" }),
      locale,
    );
  }

  equal(weekdayInSentence(TUESDAY, "en"), "Tuesday");
});

test("a malformed locale degrades rather than throwing", () => {
  isNotEmpty(weekdayInSentence(TUESDAY, "not a locale"));
  isNotEmpty(weekdayInSentence(TUESDAY, ""));
});
