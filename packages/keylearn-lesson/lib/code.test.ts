import { test } from "node:test";
import { Syntax } from "@keylearn/code";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { LCG } from "@keylearn/rand";
import { makeKeyStatsMap } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { flattenStyledText } from "@keylearn/textinput";
import { isTrue } from "rich-assert";
import { CodeLesson } from "./code.ts";
import { lessonProps } from "./settings.ts";

test("generate code fragment", () => {
  const settings = new Settings().set(lessonProps.code.syntax, Syntax.HTML);
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const lesson = new CodeLesson(settings, keyboard, model);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

  const text = lesson.generate(lessonKeys, LCG(123));
  isTrue(flattenStyledText(text).length > 0);
});
