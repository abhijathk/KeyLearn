import { useIntlNumbers } from "@keylearn/intl";
import { lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import {
  Description,
  Explainer,
  Range,
  RowSeparator,
  SettingRow,
} from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function TextManglingProp(): ReactNode {
  const { formatPercents } = useIntlNumbers();
  const { settings, updateSettings } = useSettings();
  const capitals = settings.get(lessonProps.capitals);
  const punctuators = settings.get(lessonProps.punctuators);
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.capitalLetters.label"
            defaultMessage="Capital letters"
          />
        }
        description={
          <FormattedMessage
            id="settings.capitalLetters.short"
            defaultMessage="How often a word starts with a capital, so you practise the shift key."
          />
        }
        value={formatPercents(capitals)}
      >
        <Range
          size={10}
          min={0}
          max={100}
          step={1}
          value={Math.round(capitals * 100)}
          onChange={(next) => {
            updateSettings(settings.set(lessonProps.capitals, next / 100));
          }}
        />
      </SettingRow>
      <RowSeparator />
      <SettingRow
        label={
          <FormattedMessage
            id="settings.punctuation.label"
            defaultMessage="Punctuation"
          />
        }
        description={
          <FormattedMessage
            id="settings.punctuation.short"
            defaultMessage="How often commas, full stops and quotes appear between the words."
          />
        }
        value={formatPercents(punctuators)}
      >
        <Range
          size={10}
          min={0}
          max={100}
          step={1}
          value={Math.round(punctuators * 100)}
          onChange={(next) => {
            updateSettings(settings.set(lessonProps.punctuators, next / 100));
          }}
        />
      </SettingRow>
    </>
  );
}
