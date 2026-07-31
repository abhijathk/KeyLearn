import { useIntlNumbers } from "@keybr/intl";
import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, Range, SettingRow } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function RepeatWordsProp(): ReactNode {
  const { formatNumber } = useIntlNumbers();
  const { settings, updateSettings } = useSettings();
  const value = settings.get(lessonProps.repeatWords);
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.repeatWords.label"
            defaultMessage="Repeat each word"
          />
        }
        description={
          <FormattedMessage
            id="settings.repeatWords.short"
            defaultMessage="Type the same word more than once before moving on to the next."
          />
        }
        value={
          <FormattedMessage
            id="settings.repeatWords.value"
            defaultMessage="{count}×"
            values={{ count: formatNumber(value) }}
          />
        }
      >
        <Range
          size={10}
          min={lessonProps.repeatWords.min}
          max={lessonProps.repeatWords.max}
          step={1}
          value={value}
          onChange={(next) => {
            updateSettings(settings.set(lessonProps.repeatWords, next));
          }}
        />
      </SettingRow>
    </>
  );
}
