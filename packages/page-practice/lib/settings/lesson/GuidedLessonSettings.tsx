import { type GuidedLesson, lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import {
  Description,
  Disclosure,
  Explainer,
  RowSeparator,
  SettingsCard,
} from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { AlphabetSizeProp } from "./AlphabetSizeProp.tsx";
import { KeyboardOrderProp } from "./KeyboardOrderProp.tsx";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { NaturalWordsProp } from "./NaturalWordsProp.tsx";
import { RecoverKeysProp } from "./RecoverKeysProp.tsx";
import { RepeatWordsProp } from "./RepeatWordsProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";
import { TextManglingProp } from "./TextManglingProp.tsx";

export function GuidedLessonSettings({
  lesson,
}: {
  readonly lesson: GuidedLesson;
}): ReactNode {
  const { settings } = useSettings();

  // Folding is only safe if a folded setting can still announce itself, so
  // each group counts how many of its settings are away from their default.
  const wordsChanged = [
    settings.get(lessonProps.capitals) !== lessonProps.capitals.defaultValue,
    settings.get(lessonProps.punctuators) !==
      lessonProps.punctuators.defaultValue,
    settings.get(lessonProps.repeatWords) !==
      lessonProps.repeatWords.defaultValue,
  ].filter(Boolean).length;

  const unlockChanged = [
    settings.get(lessonProps.guided.recoverKeys) !==
      lessonProps.guided.recoverKeys.defaultValue,
    settings.get(lessonProps.guided.keyboardOrder) !==
      lessonProps.guided.keyboardOrder.defaultValue,
    settings.get(lessonProps.guided.naturalWords) !==
      lessonProps.guided.naturalWords.defaultValue,
    settings.get(lessonProps.guided.alphabetSize) !==
      lessonProps.guided.alphabetSize.defaultValue,
  ].filter(Boolean).length;

  return (
    <>
      {/* The two settings that change what practice actually feels like. Every
          other guided setting is a refinement of these, so they lead. */}
      <SettingsCard
        caption={
          <FormattedMessage
            id="settings.group.difficulty"
            defaultMessage="Difficulty"
          />
        }
      >
        <TargetSpeedProp />
        <RowSeparator />
        <LessonLengthProp />
      </SettingsCard>

      <SettingsCard>
        <Disclosure
          label={
            <FormattedMessage
              id="settings.group.words"
              defaultMessage="Fine-tune the words"
            />
          }
          changed={wordsChanged}
          summary={
            <FormattedMessage
              id="settings.group.words.summary"
              defaultMessage="Capitals, punctuation, repeats"
            />
          }
        >
          <TextManglingProp />
          <RowSeparator />
          <RepeatWordsProp />
        </Disclosure>
      </SettingsCard>

      <SettingsCard>
        <Disclosure
          label={
            <FormattedMessage
              id="settings.group.unlocking"
              defaultMessage="How letters unlock"
            />
          }
          changed={unlockChanged}
          summary={
            <FormattedMessage
              id="settings.group.unlocking.summary"
              defaultMessage="Pace, ordering, word source"
            />
          }
        >
          <RecoverKeysProp />
          <RowSeparator />
          <KeyboardOrderProp />
          <RowSeparator />
          <NaturalWordsProp />
          <RowSeparator />
          <AlphabetSizeProp />
        </Disclosure>
      </SettingsCard>
    </>
  );
}
