import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, SettingRow, Switch } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function NaturalWordsProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.naturalWords.label"
            defaultMessage="Prefer real words"
          />
        }
        description={
          <FormattedMessage
            id="settings.naturalWords.short"
            defaultMessage="Draw from the dictionary, falling back to invented words when too few letters are unlocked."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "settings.naturalWords.label",
            defaultMessage: "Prefer real words",
          })}
          checked={settings.get(lessonProps.guided.naturalWords)}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.guided.naturalWords, value),
            );
          }}
        />
      </SettingRow>
    </>
  );
}
