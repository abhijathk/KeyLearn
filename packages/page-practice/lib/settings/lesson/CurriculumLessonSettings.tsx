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
      <Explainer>
        <Description>
          <FormattedMessage
            id="lessonType.curriculum.description"
            defaultMessage="The classic touch-typing course: a fixed, finger-by-finger march through the keyboard — home row first, then the top and bottom rows. Familiar if you learned on TypingClub or Mavis Beacon. The one twist is that it’s adaptive — the next stage unlocks only once you’ve mastered the keys you’re on."
          />
        </Description>
      </Explainer>
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
