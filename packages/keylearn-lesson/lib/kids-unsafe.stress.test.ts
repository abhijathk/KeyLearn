import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Language, Layout, loadKeyboard } from "@keylearn/keyboard";
import {
  censor,
  getBlacklist,
  Letter,
  makePhoneticModel,
  TransitionTable,
} from "@keylearn/phonetic-model";
import { XorShift128Plus } from "@keylearn/rand";
import { makeKeyStatsMap } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { isTrue } from "rich-assert";
import { GuidedLesson } from "./guided.ts";
import { LessonKey, LessonKeys } from "./key.ts";
import { isUnsafeWord } from "./kids-unsafe.ts";
import { kidsLetterOrder } from "./kids-words.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";

// The real English model and the real word list, exactly as the browser
// loads them — then every lesson a child could be given, at every stage.
const file = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url));
const model = censor(
  makePhoneticModel(
    Language.EN,
    TransitionTable.load(file("keylearn-phonetic-model/assets/model-en.data")),
  ),
);
const words: string[] = JSON.parse(
  String(file("keylearn-content-words/lib/data/words-en.json")),
);
const keyboard = loadKeyboard(Layout.EN_US);
const profanity = getBlacklist(Language.EN);

function typedWords(settings: Settings, kidsOrder: boolean): Set<string> {
  const lesson = new GuidedLesson(settings, keyboard, model, words);
  const order = kidsOrder
    ? kidsLetterOrder(Letter.frequencyOrder(model.letters))
    : Letter.frequencyOrder(model.letters);
  const target = new Target(settings);
  const stats = makeKeyStatsMap(model.letters, []);
  const seen = new Set<string>();
  const rng = XorShift128Plus(42);
  for (let n = 6; n <= order.length; n++) {
    for (const focus of [null, ...order.slice(0, n)]) {
      const keys = new LessonKeys(
        order.map((letter) => LessonKey.from(stats.get(letter), target)),
      );
      for (const letter of order.slice(0, n)) keys.include(letter);
      if (focus != null) keys.focus(focus);
      for (let i = 0; i < 4; i++) {
        const text = String(lesson.generate(keys, rng));
        for (const w of text.toLowerCase().split(/[^a-z']+/)) {
          if (w) seen.add(w);
        }
      }
    }
  }
  return seen;
}

function check(name: string, seen: Set<string>) {
  const bad = [...seen].filter((w) => isUnsafeWord(w) || !profanity.allow(w));
  isTrue(seen.size > 300, `${name}: generated ${seen.size} distinct words`);
  isTrue(bad.length === 0, `${name}: unsuitable words typed: ${bad.join(" ")}`);
}

test("Kids Classic: no unsuitable word in any lesson, at any stage", () => {
  const settings = new Settings()
    .set(lessonProps.guided.safeWords, true)
    .set(lessonProps.capitals, 0.15)
    .set(lessonProps.punctuators, 0.1);
  check("classic", typedWords(settings, false));
});

test("the trail: no unsuitable word in any lesson, at any stage", () => {
  const settings = new Settings().set(lessonProps.guided.kidsWords, true);
  check("trail", typedWords(settings, true));
});

test("control: without the filter, the grown-up page does type them", () => {
  const seen = typedWords(new Settings(), false);
  isTrue(
    [...seen].some((w) => isUnsafeWord(w)),
    "the check can fail",
  );
});
