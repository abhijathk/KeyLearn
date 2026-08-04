import { describe, it, test } from "node:test";
import { dateProps } from "@keylearn/intl";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel, Letter } from "@keylearn/phonetic-model";
import { LCG } from "@keylearn/rand";
import { makeKeyStatsMap } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { deepEqual, equal, isNull, isTrue } from "rich-assert";
import { LessonKey } from "./key.ts";
import { NumbersLesson } from "./numbers.ts";
import { lessonProps } from "./settings.ts";

test("provide key set", () => {
  const settings = new Settings();
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const lesson = new NumbersLesson(settings, keyboard, model);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

  deepEqual(lessonKeys.findIncludedKeys(), [
    new LessonKey({
      letter: Letter.digits[0],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[1],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[2],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[3],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[4],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[5],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[6],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[7],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[8],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: Letter.digits[9],
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
  ]);
  deepEqual(lessonKeys.findExcludedKeys(), []);
  isNull(lessonKeys.findFocusedKey());
});

describe("generate text using settings", () => {
  const keyboard = loadKeyboard(Layout.EN_US);
  const plainOnly = ["plain"];

  it("should generate using the Benford's law", () => {
    const settings = new Settings()
      .set(lessonProps.numbers.benford, true)
      .set(lessonProps.numbers.formats, plainOnly);
    const model = new FakePhoneticModel();
    const lesson = new NumbersLesson(settings, keyboard, model);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, LCG(123)),
      "487617 286 59728 489 4829 103825 356 5049 28027 6869 3985 1820",
    );
  });

  it("should generate not using the Benford's law", () => {
    const settings = new Settings()
      .set(lessonProps.numbers.benford, false)
      .set(lessonProps.numbers.formats, plainOnly);
    const model = new FakePhoneticModel();
    const lesson = new NumbersLesson(settings, keyboard, model);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, LCG(123)),
      "787617 486 79728 789 6829 303825 656 7049 48027 8693 98532 820",
    );
  });
});

describe("real-world number formats", () => {
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();

  // Every case pins the time zone: the drill reads the account's zone to know
  // which country's shapes to serve, and a test that leaned on the machine's
  // own zone would pass in Sydney and fail in Berlin.
  const inZone = (timeZone: string, formats?: readonly string[]) => {
    let settings = new Settings().set(dateProps.timeZone, timeZone);
    if (formats != null) {
      settings = settings.set(lessonProps.numbers.formats, formats);
    }
    return settings;
  };

  const line = (settings: Settings, seed: number): string => {
    const lesson = new NumbersLesson(settings, keyboard, model);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));
    return lesson.generate(lessonKeys, LCG(seed));
  };

  const words = (settings: Settings, seed: number): string[] =>
    line(settings, seed).split(" ");

  it("writes a date the way the learner's own country writes it", () => {
    // The same drill, three countries: day first in London, month first in
    // Chicago, year first in Tokyo.
    for (const word of words(inZone("Europe/London", ["dates"]), 11)) {
      isTrue(/^\d{2}\/\d{2}\/\d{4}$/.test(word), `${word} is not a UK date`);
    }
    for (const word of words(inZone("Asia/Tokyo", ["dates"]), 11)) {
      isTrue(/^\d{4}\/\d{2}\/\d{2}$/.test(word), `${word} is not a JP date`);
    }
    for (const word of words(inZone("Europe/Berlin", ["dates"]), 11)) {
      isTrue(/^\d{2}\.\d{2}\.\d{4}$/.test(word), `${word} is not a DE date`);
    }
  });

  it("reads the clock the way the country reads it", () => {
    const us = line(inZone("America/Chicago", ["times"]), 5);
    isTrue(/\d{1,2}:\d{2} (am|pm)/.test(us), `${us} is not a 12-hour clock`);

    const de = line(inZone("Europe/Berlin", ["times"]), 5);
    isTrue(!/(am|pm)/.test(de), `${de} should be a 24-hour clock`);
    isTrue(/\d{2}:\d{2}/.test(de));
  });

  it("puts the currency symbol where the country puts it", () => {
    const us = line(inZone("America/Chicago", ["currency"]), 7);
    isTrue(/\$\d/.test(us), `${us} should lead with $`);

    // Germany trails the symbol and swaps the separators: 1.234,56 € — and
    // needs a German keyboard, because a US one cannot type a euro sign.
    const lesson = new NumbersLesson(
      inZone("Europe/Berlin", ["currency"]),
      loadKeyboard(Layout.DE_DE),
      model,
    );
    const de = lesson.generate(
      lesson.update(makeKeyStatsMap(lesson.letters, [])),
      LCG(7),
    );
    isTrue(/\d €/.test(de), `${de} should trail with €`);
    isTrue(/\d,\d{2}/.test(de), `${de} should use a comma for decimals`);
  });

  it("groups the way South Asia groups", () => {
    // 12,34,567 rather than 1,234,567 — the shape typed constantly in India.
    // No layout here carries a rupee sign, so the symbol degrades to "$" and
    // the grouping — the part that actually differs — survives.
    // Below seven digits every system agrees, so this looks across a few
    // lines for an amount large enough to actually differ.
    const settings = inZone("Asia/Kolkata", ["currency"]);
    const text = [1, 2, 3, 4].map((seed) => line(settings, seed)).join(" ");
    isTrue(!text.includes("₹"), "an untypeable symbol is never served");
    isTrue(
      /\d{1,2},\d{2},\d{3}/.test(text),
      `no South Asian grouping appeared in: ${text}`,
    );
    isTrue(!/\d,\d{3},\d{3}/.test(text), `western grouping leaked in: ${text}`);
  });

  it("keeps the money shape when the symbol cannot be typed", () => {
    // Dropping the whole drill over one glyph would take the grouping and the
    // decimal mark with it, which is the part worth practising.
    const lesson = new NumbersLesson(
      inZone("Asia/Kolkata", ["currency"]),
      keyboard,
      model,
    );
    isTrue(lesson.formats.some((f) => f.id === "currency"));
    equal(lesson.regionFormats.currencySymbol, "$");
    isTrue(lesson.regionFormats.southAsianGrouping, "the grouping is kept");
  });

  it("serves a phone number in the local shape", () => {
    const us = line(inZone("America/Chicago", ["phone"]), 9);
    isTrue(/\(\d{3}\) \d{3}-\d{4}/.test(us), `${us} is not a US number`);

    const fr = line(inZone("Europe/Paris", ["phone"]), 9);
    isTrue(/0\d( \d{2}){4}/.test(fr), `${fr} is not a French number`);
  });

  it("keeps every default shape plausible", () => {
    // Phone numbers are off by default; the rest mix into every line.
    const settings = inZone("America/Chicago");
    for (const seed of [1, 2, 3]) {
      const text = line(settings, seed);
      isTrue(!text.includes("("), "no phone numbers unasked");
      isTrue(
        /^[\d\s:/.,$apm-]+$/.test(text),
        `${text} contains something no default shape emits`,
      );
    }
  });

  it("never generates an untypeable lesson", () => {
    // Every shape switched off still produces plain digits — a settings state
    // must not be able to empty the drill.
    for (const word of words(inZone("America/Chicago", []), 3)) {
      isTrue(/^\d+$/.test(word), `${word} should be plain digits`);
    }
  });

  it("an unmapped zone falls back to unambiguous rather than to a guess", () => {
    for (const word of words(inZone("Antarctica/Troll", ["dates"]), 4)) {
      isTrue(/^\d{4}-\d{2}-\d{2}$/.test(word), `${word} is not ISO`);
    }
  });
});
