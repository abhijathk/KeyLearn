import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, Range, SettingRow } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function LessonLengthProp(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const value = settings.get(lessonProps.length);
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.lessonLength.label"
            defaultMessage="Lesson length"
          />
        }
        description={
          <FormattedMessage
            id="settings.lessonLength.short"
            defaultMessage="How many words you type before a lesson ends and scores you."
          />
        }
      >
        <Range
          size={10}
          min={1}
          max={100}
          step={1}
          value={Math.round(value * 100)}
          onChange={(next) => {
            updateSettings(settings.set(lessonProps.length, next / 100));
          }}
        />
      </SettingRow>
    </>
  );
}
