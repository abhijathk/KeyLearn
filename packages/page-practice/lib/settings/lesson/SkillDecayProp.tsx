import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, SettingRow, Switch } from "@keybr/widget";
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
