import { lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import { Description, Explainer, Range, SettingRow } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function AlphabetSizeProp(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const value = settings.get(lessonProps.guided.alphabetSize);
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.alphabetSize.label"
            defaultMessage="Unlock letters yourself"
          />
        }
        description={
          <FormattedMessage
            id="settings.alphabetSize.short"
            defaultMessage="Open up more of the alphabet than you have earned. Best left alone."
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
            updateSettings(
              settings.set(lessonProps.guided.alphabetSize, next / 100),
            );
          }}
        />
      </SettingRow>
    </>
  );
}
