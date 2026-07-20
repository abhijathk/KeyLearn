import {
  BookPreview,
  BookSelector,
  ParagraphPreview,
  ParagraphSelector,
} from "@keybr/content";
import { type BooksLesson, lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
  Spacer,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";

export function BooksLessonSettings({
  lesson,
}: {
  readonly lesson: BooksLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const { book, content, paragraphs, paragraphIndex } = lesson;
  return (
    <>
      <Explainer>
        <Description>
          <FormattedMessage
            id="lessonType.books.description"
            defaultMessage="Turn real book text into typing lessons. Every key is enabled from the start — built for experienced typists."
          />
        </Description>
      </Explainer>
      <FieldSet
        legend={formatMessage({
          id: "t_Lesson_options",
          defaultMessage: "Lesson settings",
        })}
      >
        <BookSelector
          book={book}
          onChange={(book) => {
            updateSettings(
              settings
                .set(lessonProps.books.book, book)
                .set(lessonProps.books.paragraphIndex, 0),
            );
          }}
        />
        <BookPreview book={book} content={content} />
        <ParagraphSelector
          paragraphs={paragraphs}
          paragraphIndex={paragraphIndex}
          onChange={(paragraphIndex) => {
            updateSettings(
              settings.set(lessonProps.books.paragraphIndex, paragraphIndex),
            );
          }}
        />
        <ParagraphPreview
          paragraphs={paragraphs}
          paragraphIndex={paragraphIndex}
        />
        <Spacer size={3} />
        <BookTextProcessing />
        <TargetSpeedProp />
        <LessonLengthProp />
      </FieldSet>
    </>
  );
}

function BookTextProcessing(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldList>
      <Field>
        <CheckBox
          checked={settings.get(lessonProps.books.lettersOnly)}
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
            updateSettings(settings.set(lessonProps.books.lettersOnly, value));
          }}
        />
      </Field>
      <Field>
        <CheckBox
          checked={settings.get(lessonProps.books.lowercase)}
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
            updateSettings(settings.set(lessonProps.books.lowercase, value));
          }}
        />
      </Field>
    </FieldList>
  );
}
