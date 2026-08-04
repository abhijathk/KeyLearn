import { describe, it, test } from "node:test";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { makeKeyStatsMap } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { deepEqual, equal, isNull } from "rich-assert";
import { LessonKey } from "./key.ts";
import { lessonProps } from "./settings.ts";
import { WordListLesson } from "./wordlist.ts";

test("provide key set", () => {
  const settings = new Settings();
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const wordList = ["abc", "def", "ghi"];
  const lesson = new WordListLesson(settings, keyboard, model, wordList);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

  deepEqual(lessonKeys.findIncludedKeys(), [
    new LessonKey({
      letter: FakePhoneticModel.letter1,
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
      letter: FakePhoneticModel.letter2,
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
      letter: FakePhoneticModel.letter3,
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
      letter: FakePhoneticModel.letter4,
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
      letter: FakePhoneticModel.letter5,
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
      letter: FakePhoneticModel.letter6,
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
      letter: FakePhoneticModel.letter7,
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
      letter: FakePhoneticModel.letter8,
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
      letter: FakePhoneticModel.letter9,
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
      letter: FakePhoneticModel.letter10,
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

test("filter words", () => {
  const settings = new Settings();
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const wordList = ["abc", "def", "こんにちは"];
  const lesson = new WordListLesson(settings, keyboard, model, wordList);

  deepEqual(lesson.wordList, ["abc", "def"]);
});

describe("generate randomized text using settings", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  it("should transform to lower case", () => {
    const settings = new Settings()
      .set(lessonProps.capitals, 0)
      .set(lessonProps.punctuators, 0);
    const model = new FakePhoneticModel();
    const wordList = ["abc", "def", "ghi"];
    const lesson = new WordListLesson(settings, keyboard, model, wordList);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, model.rng),
      "abc def ghi abc def ghi abc def ghi abc def ghi abc def ghi abc def " +
        "ghi abc def ghi abc def ghi abc def ghi abc def ghi abc def ghi abc",
    );
  });

  it("should preserve case", () => {
    const settings = new Settings()
      .set(lessonProps.capitals, 1)
      .set(lessonProps.punctuators, 1);
    const model = new FakePhoneticModel();
    const wordList = ["abc", "def", "ghi"];
    const lesson = new WordListLesson(settings, keyboard, model, wordList);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, model.rng),
      "Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, " +
        "Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc,",
    );
  });
});

describe("the learner's own words", () => {
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const commonWords = ["abc", "def", "ghi"];

  it("replaces the frequency list while the toggle is on", () => {
    const settings = new Settings()
      .set(lessonProps.wordList.useCustom, true)
      .set(
        lessonProps.wordList.custom,
        "necessary, rhythm; embarrass\nliaison",
      );
    const lesson = new WordListLesson(settings, keyboard, model, commonWords);
    deepEqual([...lesson.wordList].sort(), [
      "embarrass",
      "liaison",
      "necessary",
      "rhythm",
    ]);
  });

  it("collapses duplicates so one word cannot crowd the drill", () => {
    const settings = new Settings()
      .set(lessonProps.wordList.useCustom, true)
      .set(lessonProps.wordList.custom, "echo echo echo delta");
    const lesson = new WordListLesson(settings, keyboard, model, commonWords);
    deepEqual([...lesson.wordList].sort(), ["delta", "echo"]);
  });

  it("falls back to the frequency list when the box is empty", () => {
    // The toggle alone must not empty the lesson.
    const settings = new Settings()
      .set(lessonProps.wordList.useCustom, true)
      .set(lessonProps.wordList.custom, "   ");
    const lesson = new WordListLesson(settings, keyboard, model, commonWords);
    deepEqual([...lesson.wordList], commonWords);
  });

  it("is ignored entirely while the toggle is off", () => {
    const settings = new Settings()
      .set(lessonProps.wordList.useCustom, false)
      .set(lessonProps.wordList.custom, "necessary rhythm");
    const lesson = new WordListLesson(settings, keyboard, model, commonWords);
    deepEqual([...lesson.wordList], commonWords);
  });

  it("is not trimmed by the frequency-list filters", () => {
    // Size and length filters exist for ranked lists of thousands; hand-picked
    // words are drilled exactly as given.
    const settings = new Settings()
      .set(lessonProps.wordList.useCustom, true)
      .set(lessonProps.wordList.custom, "ox at up cat")
      .set(lessonProps.wordList.longWordsOnly, true)
      .set(lessonProps.wordList.wordListSize, 10);
    const lesson = new WordListLesson(settings, keyboard, model, commonWords);
    deepEqual([...lesson.wordList].sort(), ["at", "cat", "ox", "up"]);
  });
});
