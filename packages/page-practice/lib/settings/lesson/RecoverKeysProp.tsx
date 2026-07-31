import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, SettingRow, Switch } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function RecoverKeysProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.recoverKeys.label"
            defaultMessage="Hold back until everything is fast"
          />
        }
        description={
          <FormattedMessage
            id="settings.recoverKeys.short"
            defaultMessage="Unlock the next letter only when every letter you already know is also above target."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "settings.recoverKeys.label",
            defaultMessage: "Hold back until everything is fast",
          })}
          checked={settings.get(lessonProps.guided.recoverKeys)}
          onChange={(value) => {
            updateSettings(settings.set(lessonProps.guided.recoverKeys, value));
          }}
        />
      </SettingRow>
    </>
  );
}
