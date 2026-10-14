import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Language, Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { Settings } from "@keylearn/settings";
import { deepEqual, equal, isFalse, isTrue } from "rich-assert";
import { GuidedLesson } from "./guided.ts";
import { filterUnsafeWords, isUnsafeWord } from "./kids-unsafe.ts";
import { filterKidsWords } from "./kids-words.ts";
import { lessonProps } from "./settings.ts";

const en = (name: string): string[] =>
  JSON.parse(
    readFileSync(
      new URL(`../../keylearn-content-words/lib/data/${name}`, import.meta.url),
      "utf8",
    ),
  );

test("drops unsuitable words, keeps order, matches whole words only", () => {
  deepEqual(
    filterUnsafeWords(
      ["the", "gun", "skill", "beer", "rainbow", "killed", "Naked", "scrap"],
      Language.EN,
    ),
    ["the", "skill", "rainbow", "scrap"],
  );
});

test("ordinary story words stay in", () => {
  for (const word of [
    "battle",
    "ghost",
    "poison",
    "whipped",
    "sentenced",
    "army",
    "adult",
    "kiss",
  ]) {
    isFalse(isUnsafeWord(word), word);
  }
});

test("the curated kids vocabulary loses nothing to the filter", () => {
  for (const name of ["words-en.json", "words-en-GB.json"]) {
    const kids = filterKidsWords(en(name));
    deepEqual(filterUnsafeWords(kids, Language.EN), kids, name);
  }
});

test("Kids Classic: the grown-up list, minus the unsuitable words", () => {
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const words = en("words-en.json");
  const classic = new GuidedLesson(
    new Settings().set(lessonProps.guided.safeWords, true),
    keyboard,
    model,
    words,
  );
  const grownUp = new GuidedLesson(new Settings(), keyboard, model, words);
  const kept = new Set(classic.dictionary);
  const all = [...grownUp.dictionary];
  isTrue(
    all.some((w) => w === "naked"),
    "the grown-up list has it",
  );
  isFalse(kept.has("naked"));
  isFalse([...kept].some((w) => isUnsafeWord(w)));
  // Only the word pool changes: everything else the grown-up page has is kept.
  deepEqual([...kept], filterUnsafeWords(all, Language.EN));
  isTrue(kept.size > 9000);
});
