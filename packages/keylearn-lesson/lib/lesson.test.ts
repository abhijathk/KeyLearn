import { test } from "node:test";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { Result, type TextType } from "@keylearn/result";
import { TextType as TT } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { Histogram } from "@keylearn/textinput";
import { equal, isTrue } from "rich-assert";
import { GuidedLesson } from "./guided.ts";
import { LessonType } from "./lessontype.ts";
import { lessonProps } from "./settings.ts";

const result = (textType: TextType, layout = Layout.EN_US) =>
  new Result(
    layout,
    textType,
    /* timeStamp= */ 0,
    /* length= */ 100,
    /* time= */ 20000,
    /* errors= */ 0,
    Histogram.empty,
  );

const lessonOf = (type: LessonType) =>
  new GuidedLesson(
    new Settings().set(lessonProps.type, type),
    loadKeyboard(Layout.EN_US),
    new FakePhoneticModel(["uno", "due", "tre"]),
    [],
  );

test("prose, code and numbers are not the same sport", () => {
  // Pooled, switching to Code craft made "recent form" report a dip, sent
  // every delta negative, and quietly retired the top-speed and top-score
  // awards for good — a code speed will never beat a prose record, so the
  // award system went silent the moment somebody moved on from prose.
  const history = [
    result(TT.GENERATED),
    result(TT.GENERATED),
    result(TT.CODE),
    result(TT.NUMBERS),
    result(TT.NATURAL),
  ];
  equal(lessonOf(LessonType.GUIDED).filter(history).length, 2);
  equal(lessonOf(LessonType.CODE).filter(history).length, 1);
  equal(lessonOf(LessonType.NUMBERS).filter(history).length, 1);
  equal(lessonOf(LessonType.BOOKS).filter(history).length, 1);
});

test("lessons that are the same sport still share their history", () => {
  // Guided and the curriculum are both generated text; word lists, books and
  // custom text are all natural prose. Splitting those would be as wrong as
  // pooling the others, and would throw history away on every mode switch.
  const generated = [result(TT.GENERATED), result(TT.GENERATED)];
  equal(lessonOf(LessonType.GUIDED).filter(generated).length, 2);
  equal(lessonOf(LessonType.CURRICULUM).filter(generated).length, 2);

  const natural = [result(TT.NATURAL)];
  for (const type of [
    LessonType.WORDLIST,
    LessonType.BOOKS,
    LessonType.CUSTOM,
  ]) {
    equal(lessonOf(type).filter(natural).length, 1, String(type));
  }
});

test("a different keyboard layout is still a different history", () => {
  // The layout split was already there and has to survive the type split:
  // the same letter is a different motion on a different layout.
  const mixed = [
    result(TT.GENERATED, Layout.EN_US),
    result(TT.GENERATED, Layout.EN_DVORAK),
  ];
  equal(lessonOf(LessonType.GUIDED).filter(mixed).length, 1);
});

test("an empty history filters to an empty history", () => {
  isTrue(lessonOf(LessonType.GUIDED).filter([]).length === 0);
});
