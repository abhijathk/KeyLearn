import { type CurriculumLesson } from "@keybr/lesson";
import { Description, Explainer, FieldSet } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { RepeatWordsProp } from "./RepeatWordsProp.tsx";
import { StageSizeProp } from "./StageSizeProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";
import { TextManglingProp } from "./TextManglingProp.tsx";

export function CurriculumLessonSettings({
  lesson,
}: {
  readonly lesson: CurriculumLesson;
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
        <TargetSpeedProp />
        <StageSizeProp />
        <RepeatWordsProp />
        <TextManglingProp />
        <LessonLengthProp />
      </FieldSet>
    </>
  );
}
