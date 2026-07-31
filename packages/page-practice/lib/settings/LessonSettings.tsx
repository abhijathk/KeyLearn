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
  type WordListLesson,
} from "@keybr/lesson";
import { LessonLoader } from "@keybr/lesson-loader";
import { type Settings, useSettings } from "@keybr/settings";
import { SettingTiles } from "@keybr/widget";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { BooksLessonSettings } from "./lesson/BooksLessonSettings.tsx";
import { CodeLessonSettings } from "./lesson/CodeLessonSettings.tsx";
import { CurriculumLessonSettings } from "./lesson/CurriculumLessonSettings.tsx";
import { CustomTextLessonSettings } from "./lesson/CustomTextLessonSettings.tsx";
import { DailyGoalSettings } from "./lesson/DailyGoalSettings.tsx";
import { GuidedLessonSettings } from "./lesson/GuidedLessonSettings.tsx";
import { LessonPreview } from "./lesson/LessonPreview.tsx";
import { NumbersLessonSettings } from "./lesson/NumbersLessonSettings.tsx";
import { WordListLessonSettings } from "./lesson/WordListLessonSettings.tsx";
import * as styles from "./SettingsScreen.module.less";

export function LessonSettings(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const sources = [
    {
      label: formatMessage({
        id: "t_Guided_lessons",
        defaultMessage: "Guided practice",
      }),
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
        id: "t_Source_code",
        defaultMessage: "Code Snippets",
      }),
      description: formatMessage({
        id: "lessonType.code.summary",
        defaultMessage: "Source code, with its symbols and indentation.",
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
        options={sources.map(({ label, description }, index) => ({
          id: index,
          label,
          description,
        }))}
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
