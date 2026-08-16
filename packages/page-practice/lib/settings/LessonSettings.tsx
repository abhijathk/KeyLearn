import { keyboardProps } from "@keylearn/keyboard";
import {
  type BooksLesson,
  type CodeLesson,
  type CurriculumLesson,
  type CustomTextLesson,
  type GuidedLesson,
  type Lesson,
  lessonProps,
  LessonType,
  type NumbersLesson,
  type QuotesLesson,
  type WordListLesson,
} from "@keylearn/lesson";
import { LessonLoader } from "@keylearn/lesson-loader";
import { type Settings, useSettings } from "@keylearn/settings";
import { SettingTiles } from "@keylearn/widget";
import { type ReactNode, useEffect } from "react";
import { useIntl } from "react-intl";
import { BooksLessonSettings } from "./lesson/BooksLessonSettings.tsx";
import { CodeLessonSettings } from "./lesson/CodeLessonSettings.tsx";
import { CurriculumLessonSettings } from "./lesson/CurriculumLessonSettings.tsx";
import { CustomTextLessonSettings } from "./lesson/CustomTextLessonSettings.tsx";
import { DailyGoalSettings } from "./lesson/DailyGoalSettings.tsx";
import { GuidedLessonSettings } from "./lesson/GuidedLessonSettings.tsx";
import { LessonPreview } from "./lesson/LessonPreview.tsx";
import { NumbersLessonSettings } from "./lesson/NumbersLessonSettings.tsx";
import { QuotesLessonSettings } from "./lesson/QuotesLessonSettings.tsx";
import { WordListLessonSettings } from "./lesson/WordListLessonSettings.tsx";
import * as styles from "./SettingsScreen.module.less";

export function LessonSettings(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  // Every book in packages/content-books is English-only (public-domain
  // English-language novels) — there's no per-language edition to fall
  // back to, so the source itself has to be unavailable rather than
  // silently handing back English text under a different keyboard layout.
  // Matched by id prefix, not `=== Language.EN`, so a regional variant
  // like British English (id "en-GB") still counts as English rather than
  // getting disabled for a dialect difference that doesn't affect books.
  const booksAvailable = settings
    .get(keyboardProps.language)
    .id.startsWith("en");
  // If the layout changes away from English while Book Text is the active
  // source, don't leave the learner stranded on a now-disabled tile —
  // fall back to guided practice, the same default a first-time learner
  // starts on.
  useEffect(() => {
    if (
      !booksAvailable &&
      settings.get(lessonProps.type) === LessonType.BOOKS
    ) {
      updateSettings(settings.set(lessonProps.type, LessonType.GUIDED));
    }
  }, [booksAvailable, settings, updateSettings]);
  const sources = [
    {
      label: formatMessage({
        id: "t_Guided_lessons",
        defaultMessage: "Guided practice",
      }),
      badge: formatMessage({ id: "t_Pick", defaultMessage: "Pick" }),
      description: formatMessage({
        id: "lessonType.guided.summary",
        defaultMessage:
          "KeyLearn picks the letters and adds a new one as each is mastered.",
      }),
    },
    {
      label: formatMessage({
        id: "lessonType.curriculum.name",
        defaultMessage: "Classic course",
      }),
      description: formatMessage({
        id: "lessonType.curriculum.summary",
        defaultMessage:
          "A fixed sequence of lessons, the same order for everyone.",
      }),
    },
    {
      label: formatMessage({
        id: "t_Source_code",
        defaultMessage: "Code craft",
      }),
      badge: formatMessage({ id: "t_Pick", defaultMessage: "Pick" }),
      description: formatMessage({
        id: "lessonType.code.summary",
        defaultMessage:
          "Real code from real frameworks, written to the language\u2019s own standard.",
      }),
    },
    {
      label: formatMessage({
        id: "t_Common_words",
        defaultMessage: "Frequent words",
      }),
      description: formatMessage({
        id: "lessonType.wordList.summary",
        defaultMessage:
          "The most common words in your language, most frequent first.",
      }),
    },
    {
      label: formatMessage({ id: "t_Books", defaultMessage: "Book Text" }),
      description: formatMessage({
        id: "lessonType.books.summary",
        defaultMessage: "Real passages from public-domain books.",
      }),
      disabled: !booksAvailable,
      disabledReason: formatMessage({
        id: "lessonType.books.englishOnly",
        defaultMessage:
          "Book text is only available in English — switch your keyboard language to English to use it.",
      }),
    },
    {
      label: formatMessage({
        id: "lessonType.quotes.name",
        defaultMessage: "Quotes",
      }),
      description: formatMessage({
        id: "lessonType.quotes.summary",
        defaultMessage:
          "Short, complete thoughts with their real capitals and punctuation.",
      }),
    },
    {
      label: formatMessage({
        id: "t_Custom_text",
        defaultMessage: "Your Own Text",
      }),
      description: formatMessage({
        id: "lessonType.customText.summary",
        defaultMessage: "Paste in anything you would rather practise.",
      }),
    },
    {
      label: formatMessage({
        id: "t_Numbers",
        defaultMessage: "Number Drills",
      }),
      description: formatMessage({
        id: "lessonType.numbers.summary",
        defaultMessage: "Digits and the number row on their own.",
      }),
    },
  ];
  const selected = LessonType.ALL.indexOf(settings.get(lessonProps.type));
  return (
    <>
      <SettingTiles
        value={selected}
        onChange={(index) => {
          updateSettings(
            settings.set(lessonProps.type, LessonType.ALL.at(index)),
          );
        }}
        options={sources.map(
          ({ label, description, badge, disabled, disabledReason }, index) => ({
            id: index,
            label,
            description,
            badge,
            disabled,
            disabledReason,
          }),
        )}
      />
      <LessonLoader>
        {(lesson) => (
          <>
            <LessonPreview lesson={lesson} />
            {tabBody(settings, lesson)}
            <DailyGoalSettings />
          </>
        )}
      </LessonLoader>
    </>
  );
}

function tabBody(settings: Settings, lesson: Lesson): ReactNode {
  switch (settings.get(lessonProps.type)) {
    case LessonType.GUIDED:
      return <GuidedLessonSettings lesson={lesson as GuidedLesson} />;
    case LessonType.CURRICULUM:
      return <CurriculumLessonSettings lesson={lesson as CurriculumLesson} />;
    case LessonType.WORDLIST:
      return <WordListLessonSettings lesson={lesson as WordListLesson} />;
    case LessonType.BOOKS:
      return <BooksLessonSettings lesson={lesson as BooksLesson} />;
    case LessonType.QUOTES:
      return <QuotesLessonSettings lesson={lesson as QuotesLesson} />;
    case LessonType.CUSTOM:
      return <CustomTextLessonSettings lesson={lesson as CustomTextLesson} />;
    case LessonType.CODE:
      return <CodeLessonSettings lesson={lesson as CodeLesson} />;
    case LessonType.NUMBERS:
      return <NumbersLessonSettings lesson={lesson as NumbersLesson} />;
    default:
      throw new Error();
  }
}
