import { test } from "node:test";
import { Book } from "@keylearn/content";
import { Settings } from "@keylearn/settings";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import { LessonType } from "./lessontype.ts";
import { lessonProps } from "./settings.ts";
import { lessonStamp, type StampMode } from "./stamp.ts";

// Kept beside the component's own record: a mode the component cannot name
// would render an empty stamp, which reads as a bug rather than as a mode.
const NAMED: readonly StampMode[] = [
  "guided",
  "curriculum",
  "code",
  "wordlist",
  "books",
  "quotes",
  "custom",
  "numbers",
];

test("every lesson type maps to a mode the stamp can name", () => {
  // A missing case would fall through to "guided" and quietly lie about what
  // the learner is typing.
  const seen = new Set<StampMode>();
  for (const type of LessonType.ALL) {
    const { mode } = lessonStamp(new Settings().set(lessonProps.type, type));
    isTrue(NAMED.includes(mode), `${type.id} produced an unnamed mode`);
    seen.add(mode);
  }
  equal(seen.size, NAMED.length, "and every mode is reachable from some type");
});

test("the default settings name the guided course", () => {
  equal(lessonStamp(new Settings()).mode, "guided");
});

test("the modes with a choice inside them say which one", () => {
  // "Code craft" alone does not say which language, and "Book Text" does not
  // say which book — and those are the choices most easily forgotten.
  const books = new Settings()
    .set(lessonProps.type, LessonType.BOOKS)
    .set(lessonProps.books.book, Book.EN_TREASURE_ISLAND);
  equal(lessonStamp(books).detail, Book.EN_TREASURE_ISLAND.title);

  const code = new Settings().set(lessonProps.type, LessonType.CODE);
  isNotNull(lessonStamp(code).detail, "the syntax names itself");
});

test("the modes without a choice carry no detail", () => {
  for (const type of [
    LessonType.GUIDED,
    LessonType.CURRICULUM,
    LessonType.QUOTES,
    LessonType.CUSTOM,
    LessonType.NUMBERS,
  ]) {
    isNull(lessonStamp(new Settings().set(lessonProps.type, type)).detail);
  }
});

test("the word list says when it is drilling the learner's own words", () => {
  const common = new Settings().set(lessonProps.type, LessonType.WORDLIST);
  isNull(lessonStamp(common).detail, "the frequency list is the plain case");

  const own = common.set(lessonProps.wordList.useCustom, true);
  const stamp = lessonStamp(own);
  isNotNull(stamp.detail);
  equal(
    stamp.detailIsMessage,
    true,
    "this detail is our words, so it must be translated and not printed",
  );
});

test("a content title is printed, never translated", () => {
  const books = new Settings().set(lessonProps.type, LessonType.BOOKS);
  equal(lessonStamp(books).detailIsMessage, false);
});
