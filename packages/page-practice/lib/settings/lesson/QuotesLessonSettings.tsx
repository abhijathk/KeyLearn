import { lessonProps, type QuotesLesson } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import { CheckBox, Field, FieldList, FieldSet } from "@keylearn/widget";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";

export function QuotesLessonSettings({
  lesson,
}: {
  readonly lesson: QuotesLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldSet
      legend={formatMessage({
        id: "t_Lesson_options",
        defaultMessage: "Lesson settings",
      })}
    >
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "lesson.quotes.attribution",
              defaultMessage: "Name the author after each quote",
            })}
            checked={settings.get(lessonProps.quotes.attribution)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.quotes.attribution, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <TargetSpeedProp />
      <LessonLengthProp />
    </FieldSet>
  );
}
