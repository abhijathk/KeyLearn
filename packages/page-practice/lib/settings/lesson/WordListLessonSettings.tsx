import { wordListStats } from "@keylearn/content";
import { useIntlNumbers } from "@keylearn/intl";
import { lessonProps, type WordListLesson } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import {
  CheckBox,
  Field,
  FieldList,
  FieldSet,
  NameValue,
  Para,
  Range,
  TextField,
} from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { RepeatWordsProp } from "./RepeatWordsProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";
import { TextManglingProp } from "./TextManglingProp.tsx";

export function WordListLessonSettings({
  lesson,
}: {
  readonly lesson: WordListLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <FieldSet
        legend={formatMessage({
          id: "t_Lesson_options",
          defaultMessage: "Lesson settings",
        })}
      >
        <CustomWordsInput />
        <WordListPreview lesson={lesson} />
        <WordListStats lesson={lesson} />
        <TargetSpeedProp />
        <RepeatWordsProp />
        <TextManglingProp />
        <LessonLengthProp />
      </FieldSet>
    </>
  );
}

function CustomWordsInput(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const useCustom = settings.get(lessonProps.wordList.useCustom);
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "lesson.wordList.useCustom",
              defaultMessage: "Use my own words",
            })}
            checked={useCustom}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.wordList.useCustom, value),
              );
            }}
          />
        </Field>
      </FieldList>
      {useCustom && (
        <Para>
          <TextField
            type="textarea"
            placeholder={formatMessage({
              id: "lesson.wordList.custom.placeholder",
              defaultMessage:
                "Paste your words here — a spelling list, vocabulary, anything. Spaces, commas or new lines between them.",
            })}
            value={settings.get(lessonProps.wordList.custom)}
            onChange={(value) => {
              updateSettings(settings.set(lessonProps.wordList.custom, value));
            }}
          />
        </Para>
      )}
    </>
  );
}

function WordListPreview({
  lesson,
}: {
  readonly lesson: WordListLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  if (settings.get(lessonProps.wordList.useCustom)) {
    // The size and length filters trim a ranked frequency list; while the
    // learner's own words are on, only the resulting list is shown.
    return (
      <Para>
        <TextField
          type="textarea"
          value={[...lesson.wordList].join(", ")}
          readOnly={true}
        />
      </Para>
    );
  }
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Word_list_size:"
            defaultMessage="Number of words in the list:"
          />
        </Field>
        <Field>
          <Range
            size={16}
            min={lessonProps.wordList.wordListSize.min}
            max={lessonProps.wordList.wordListSize.max}
            step={1}
            value={settings.get(lessonProps.wordList.wordListSize)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.wordList.wordListSize, value),
              );
            }}
          />
        </Field>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Long_words_only",
              defaultMessage: "Longer words only",
            })}
            checked={settings.get(lessonProps.wordList.longWordsOnly)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.wordList.longWordsOnly, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <Para>
        <TextField
          type="textarea"
          value={[...lesson.wordList].join(", ")}
          readOnly={true}
        />
      </Para>
    </>
  );
}

function WordListStats({
  lesson,
}: {
  readonly lesson: WordListLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatNumber } = useIntlNumbers();
  const { wordCount, avgWordLength } = wordListStats(lesson.wordList);
  return (
    <FieldList>
      <Field>
        <NameValue
          name={formatMessage({
            id: "t_num_Unique_words",
            defaultMessage: "Distinct words",
          })}
          value={formatNumber(wordCount)}
        />
      </Field>
      <Field>
        <NameValue
          name={formatMessage({
            id: "t_Average_word_length",
            defaultMessage: "Mean word length",
          })}
          value={formatNumber(avgWordLength, 2)}
        />
      </Field>
    </FieldList>
  );
}
