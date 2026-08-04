import { test } from "node:test";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { LCG } from "@keylearn/rand";
import { makeKeyStatsMap } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { equal, isTrue } from "rich-assert";
import { QuotesLesson } from "./quotes.ts";
import { lessonProps } from "./settings.ts";

const keyboard = loadKeyboard(Layout.EN_US);
const model = new FakePhoneticModel();

function generate(settings: Settings, seed = 123): string {
  const lesson = new QuotesLesson(settings, keyboard, model);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));
  return lesson.generate(lessonKeys, LCG(seed));
}

test("a lesson is real prose with its punctuation kept", () => {
  const text = generate(new Settings());
  isTrue(text.length >= 100, "fills the lesson length");
  isTrue(/[A-Z]/.test(text), "capitals survive");
  isTrue(/[.,;!?']/.test(text), "punctuation survives");
});

test("the same seed serves the same quotes", () => {
  equal(generate(new Settings(), 42), generate(new Settings(), 42));
});

test("different seeds serve different quotes", () => {
  isTrue(generate(new Settings(), 1) !== generate(new Settings(), 2));
});

test("attribution is a choice", () => {
  // With it on, quotes end in "- Author"; with it off, no hyphen is added.
  const on = generate(
    new Settings().set(lessonProps.quotes.attribution, true),
    7,
  );
  const off = generate(
    new Settings().set(lessonProps.quotes.attribution, false),
    7,
  );
  isTrue(on.includes(" - "), "the author is named");
  isTrue(!off.includes(" - "), "or not mentioned at all");
});

test("the lesson length setting stretches the text", () => {
  const short = generate(new Settings().set(lessonProps.length, 0), 5);
  const long = generate(new Settings().set(lessonProps.length, 1), 5);
  isTrue(long.length > short.length);
});
