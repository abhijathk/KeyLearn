import { lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import { Description, Explainer, SettingRow, Switch } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function SkillDecayProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Skill_decay"
            defaultMessage="Let unused keys fade over time"
          />
        }
        description={
          <FormattedMessage
            id="settings.skillDecay.short"
            defaultMessage="A key you have not practised in a long while slowly loses confidence, so it comes back for a refresh."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Skill_decay",
            defaultMessage: "Let unused keys fade over time",
          })}
          checked={settings.get(lessonProps.guided.skillDecay)}
          onChange={(value) => {
            updateSettings(settings.set(lessonProps.guided.skillDecay, value));
          }}
        />
      </SettingRow>
    </>
  );
}
