import { type GuidedLesson } from "@keybr/lesson";
import { Description, Explainer, FieldSet } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { AlphabetSizeProp } from "./AlphabetSizeProp.tsx";
import { BottleneckDrillProp } from "./BottleneckDrillProp.tsx";
import { KeyboardOrderProp } from "./KeyboardOrderProp.tsx";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { NaturalWordsProp } from "./NaturalWordsProp.tsx";
import { RecoverKeysProp } from "./RecoverKeysProp.tsx";
import { RepeatWordsProp } from "./RepeatWordsProp.tsx";
import { SpacedRepetitionProp } from "./SpacedRepetitionProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";
import { TextManglingProp } from "./TextManglingProp.tsx";

export function GuidedLessonSettings({
  lesson,
}: {
  readonly lesson: GuidedLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <Explainer>
        <Description>
          <FormattedMessage
            id="lessonType.guided.description"
            defaultMessage="Creates lessons from randomly generated words that follow your language’s phonetic patterns. The set of keys grows automatically as you improve — ideal if you’re just starting out."
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
        <RecoverKeysProp />
        <SpacedRepetitionProp />
        <BottleneckDrillProp />
        <KeyboardOrderProp />
        <NaturalWordsProp />
        <RepeatWordsProp />
        <AlphabetSizeProp />
        <TextManglingProp />
        <LessonLengthProp />
      </FieldSet>
    </>
  );
}
