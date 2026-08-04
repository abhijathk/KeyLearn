import { describe, it, test } from "node:test";
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

  const words = (settings: Settings, seed: number): string[] => {
    const lesson = new NumbersLesson(settings, keyboard, model);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));
    return lesson.generate(lessonKeys, LCG(seed)).split(" ");
  };

  it("serves each chosen shape and nothing else", () => {
    const settings = new Settings().set(lessonProps.numbers.formats, ["dates"]);
    for (const word of words(settings, 11)) {
      isTrue(/^\d{2}\/\d{2}\/\d{4}$/.test(word), `${word} is not a date`);
    }
  });

  it("keeps every shape plausible", () => {
    const shapes = [
      /^\d+$/, // plain digits
      /^\d{2}\/\d{2}\/\d{4}$/, // dates
      /^\d{2}:\d{2}(:\d{2})?$/, // times
      /^\$\d{1,3}(,\d{3})*(\.\d{2})?$/, // currency
    ];
    // Phone numbers are off by default, and the default settings mix the
    // other shapes: over a few lessons every word matches one of them.
    const settings = new Settings();
    for (const seed of [1, 2, 3]) {
      for (const word of words(settings, seed)) {
        isTrue(
          shapes.some((re) => re.test(word)),
          `${word} matches no default shape`,
        );
        isTrue(!word.startsWith("("), "no phone numbers unasked");
      }
    }
  });

  it("never generates an untypeable lesson", () => {
    // Every shape switched off still produces plain digits — a settings state
    // must not be able to empty the drill.
    const settings = new Settings().set(lessonProps.numbers.formats, []);
    for (const word of words(settings, 3)) {
      isTrue(/^\d+$/.test(word), `${word} should be plain digits`);
    }
  });
});
