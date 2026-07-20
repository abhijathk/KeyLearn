import { useIntlNumbers } from "@keybr/intl";
import { type Language } from "@keybr/keyboard";
import { type CustomTextLesson, lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { textStatsOf } from "@keybr/unicode";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
  LinkButton,
  NameValue,
  Para,
  TextField,
} from "@keybr/widget";
import { type ReactNode, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { exampleTexts } from "./example-texts.ts";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";

export function CustomTextLessonSettings({
  lesson,
}: {
  readonly lesson: CustomTextLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings } = useSettings();
  return (
    <>
      <Explainer>
        <Description>
          <FormattedMessage
            id="lessonType.customText.description"
            defaultMessage="Create typing lessons from words in text that you supply. Every key is enabled from the start — built for experienced typists."
          />
        </Description>
      </Explainer>

      <FieldSet
        legend={formatMessage({
          id: "t_Lesson_options",
          defaultMessage: "Lesson settings",
        })}
      >
        <CustomTextInput />
        <CustomTextStats
          language={lesson.model.language}
          customText={settings.get(lessonProps.customText.content)}
        />
        <CustomTextProcessing />
        <TargetSpeedProp />
        <LessonLengthProp />
      </FieldSet>
    </>
  );
}

function CustomTextInput(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <Para>
        <FormattedMessage id="t_Examples:" defaultMessage="Try one of these:" />{" "}
        {exampleTexts.map(({ title, content }, index) => (
          <span key={index}>
            {index > 0 ? ", " : null}
            <LinkButton
              onClick={() => {
                updateSettings(
                  settings.set(lessonProps.customText.content, content),
                );
              }}
            >
              {title}
            </LinkButton>
          </span>
        ))}
      </Para>
      <Para>
        <TextField
          type="textarea"
          placeholder={formatMessage({
            id: "t_Custom_text",
            defaultMessage: "Your Own Text",
          })}
          value={settings.get(lessonProps.customText.content)}
          onChange={(value) => {
            updateSettings(settings.set(lessonProps.customText.content, value));
          }}
        />
      </Para>
    </>
  );
}

function CustomTextStats({
  language,
  customText,
}: {
  readonly language: Language;
  readonly customText: string;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatNumber } = useIntlNumbers();
  const { numWords, numUniqueWords, avgWordLength } = useMemo(
    () => textStatsOf(language.locale, customText),
    [language, customText],
  );
  return (
    <FieldList>
      <Field>
        <NameValue
          name={formatMessage({
            id: "t_num_All_words",
            defaultMessage: "Total words",
          })}
          value={formatNumber(numWords)}
        />
      </Field>
      <Field>
        <NameValue
          name={formatMessage({
            id: "t_num_Unique_words",
            defaultMessage: "Distinct words",
          })}
          value={formatNumber(numUniqueWords)}
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

function CustomTextProcessing(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldList>
      <Field>
        <CheckBox
          checked={settings.get(lessonProps.customText.lettersOnly)}
          label={formatMessage({
            id: "t_Remove_punctuation_characters",
            defaultMessage: "Strip out punctuation",
          })}
          title={formatMessage({
            id: "settings.customTextLettersOnly.description",
            defaultMessage:
              "Strips punctuation marks from the text so it’s simpler to type.",
          })}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.customText.lettersOnly, value),
            );
          }}
        />
      </Field>
      <Field>
        <CheckBox
          checked={settings.get(lessonProps.customText.lowercase)}
          label={formatMessage({
            id: "t_Transform_to_lowercase",
            defaultMessage: "Switch everything to lowercase",
          })}
          title={formatMessage({
            id: "settings.customTextLowercase.description",
            defaultMessage:
              "Converts every character to lowercase so the text is simpler to type.",
          })}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.customText.lowercase, value),
            );
          }}
        />
      </Field>
      <Field>
        <CheckBox
          checked={settings.get(lessonProps.customText.randomize)}
          label={formatMessage({
            id: "t_Shuffle_words",
            defaultMessage: "Randomize word order",
          })}
          title={formatMessage({
            id: "settings.customTextRandomize.description",
            defaultMessage: "Shuffles the words from your text into a random sequence.",
          })}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.customText.randomize, value),
            );
          }}
        />
      </Field>
    </FieldList>
  );
}
