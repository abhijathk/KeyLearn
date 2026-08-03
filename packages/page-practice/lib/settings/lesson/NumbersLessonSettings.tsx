import { type NumbersLesson } from "@keylearn/lesson";
import { Description, Explainer, FieldSet } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { BenfordProp } from "./BenfordProp.tsx";

export function NumbersLessonSettings({
  lesson,
}: {
  readonly lesson: NumbersLesson;
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
        <BenfordProp />
      </FieldSet>
    </>
  );
}
