import { lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import { Description, Explainer, SettingRow, Switch } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function SmartConfidenceProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Smart_confidence"
            defaultMessage="Count accuracy toward mastery"
          />
        }
        description={
          <FormattedMessage
            id="settings.smartConfidence.short"
            defaultMessage="A letter only counts as mastered when you are both quick and accurate, not just quick."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Smart_confidence",
            defaultMessage: "Count accuracy toward mastery",
          })}
          checked={settings.get(lessonProps.guided.smartConfidence)}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.guided.smartConfidence, value),
            );
          }}
        />
      </SettingRow>
    </>
  );
}
