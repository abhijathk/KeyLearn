import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, SettingRow, Switch } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function SpacedRepetitionProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Spaced_repetition"
            defaultMessage="Refresh keys that need reviewing"
          />
        }
        description={
          <FormattedMessage
            id="settings.spacedRepetition.short"
            defaultMessage="Brings back keys that are due for review, woven into your normal practice."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Spaced_repetition",
            defaultMessage: "Refresh keys that need reviewing",
          })}
          checked={settings.get(lessonProps.guided.spacedRepetition)}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.guided.spacedRepetition, value),
            );
          }}
        />
      </SettingRow>
    </>
  );
}
