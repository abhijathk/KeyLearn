import { Syntax } from "@keylearn/code";
import { Book } from "@keylearn/content";
import { HIDE_COMMENTS, SNIPPET_FLAGS } from "@keylearn/content-snippets";
import {
  booleanProp,
  flagsProp,
  itemProp,
  numberProp,
  stringProp,
} from "@keylearn/settings";
import { LessonType } from "./lessontype.ts";

const CODE_FLAGS: readonly string[] = [...Syntax.FLAGS, ...SNIPPET_FLAGS];

// Everything on to begin with, except the one that takes something away: a
// learner who has never opened these settings should get the comments.
const CODE_FLAGS_ON: readonly string[] = CODE_FLAGS.filter(
  (flag) => flag !== HIDE_COMMENTS,
);

export const lessonProps = {
  type: itemProp("lesson.type", LessonType.ALL, LessonType.GUIDED),
  length: numberProp("lesson.length", 0, { min: 0, max: 1 }),
  guided: {
    naturalWords: booleanProp("lesson.guided.naturalWords", true),
    // Kids mode: intersect the dictionary with a curated child vocabulary.
    // The adaptive algorithm is untouched — only the word pool changes.
    kidsWords: booleanProp("lesson.guided.kidsWords", false),
    keyboardOrder: booleanProp("lesson.guided.keyboardOrder", false),
    alphabetSize: numberProp("lesson.guided.alphabetSize", 0, {
      min: 0,
      max: 1,
    }),
    recoverKeys: booleanProp("lesson.guided.recoverKeys", false),
    // Front-load "due" keys as a warmup; layers on top of the speed algorithm.
    spacedRepetition: booleanProp("lesson.guided.spacedRepetition", true),
    // Target weak bigrams; layers on top of the speed algorithm.
    bottleneckDrill: booleanProp("lesson.guided.bottleneckDrill", true),
    // Blend a Bayesian Knowledge Tracing posterior (accuracy-aware) into the
    // classic speed-ratio confidence at 2:1 — the speed ratio stays dominant,
    // BKT adds a minority accuracy signal alongside it.
    smartConfidence: booleanProp("lesson.guided.smartConfidence", true),
    // Apply spaced-repetition decay so long-unpractised keys lose confidence
    // over real time; multiplies the classic confidence, so it runs alongside.
    skillDecay: booleanProp("lesson.guided.skillDecay", true),
  } as const,
  curriculum: {
    // How many new keys the classic curriculum introduces per stage.
    stageSize: numberProp("lesson.curriculum.stageSize", 2, { min: 1, max: 5 }),
  } as const,
  wordList: {
    wordListSize: numberProp("lesson.wordList.wordListSize", 1000, {
      min: 10,
      max: 1000,
    }),
    longWordsOnly: booleanProp("lesson.wordList.longWordsOnly", false),
  } as const,
  books: {
    book: itemProp("lesson.books.book", Book.ALL, Book.EN_WIZARD_OZ),
    paragraphIndex: numberProp("lesson.books.paragraphIndex", 0, {
      min: 0,
      max: 1000,
    }),
    lettersOnly: booleanProp("lesson.books.lettersOnly", false),
    lowercase: booleanProp("lesson.books.lowercase", false),
  },
  customText: {
    content: stringProp(
      "lesson.customText.content",
      "The quick brown fox jumps over the lazy dog.",
      { maxLength: 10_000 },
    ),
    lettersOnly: booleanProp("lesson.customText.lettersOnly", true),
    lowercase: booleanProp("lesson.customText.lowercase", true),
    randomize: booleanProp("lesson.customText.randomize", false),
  } as const,
  numbers: {
    benford: booleanProp("lesson.numbers.benford", true),
  } as const,
  code: {
    // TypeScript, and the written corpus rather than the grammar. It is the
    // largest corpus here, the language most learners will be typing all day,
    // and unlike a generated one it teaches something on the first lesson.
    syntax: itemProp("lesson.code.syntax", Syntax.ALL, Syntax.TYPESCRIPT_CODE),
    // Grammar flags and corpus topics share one setting, and it drops anything
    // outside this list — so every topic has to be named here or it would turn
    // itself back on at the next reload.
    flags: flagsProp("lesson.code.flags", CODE_FLAGS, CODE_FLAGS_ON),
    // The editor palette.
    theme: stringProp("lesson.code.theme", "keylearn-bright"),
    // Whether the scheme also brings its own ground. Off: a coloured panel is
    // a big change to the page, and with it off the light or dark half of the
    // scheme is chosen automatically to suit the app's own background, so the
    // colours stay legible either way.
    themeBackground: booleanProp("lesson.code.themeBackground", false),
  } as const,
  capitals: numberProp("lesson.capitals", 0, { min: 0, max: 1 }),
  punctuators: numberProp("lesson.punctuators", 0, { min: 0, max: 1 }),
  repeatWords: numberProp("lesson.repeatWords", 1, { min: 1, max: 10 }),
  targetSpeed: numberProp("lesson.targetSpeed", 175, { min: 75, max: 750 }),
  dailyGoal: numberProp("lesson.dailyGoal", 30, { min: 0, max: 120 }),
} as const;
