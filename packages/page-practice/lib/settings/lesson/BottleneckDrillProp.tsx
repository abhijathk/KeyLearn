import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, SettingRow, Switch } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function BottleneckDrillProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Bottleneck_drill"
            defaultMessage="Target slow key combinations"
          />
        }
        description={
          <FormattedMessage
            id="settings.bottleneckDrill.short"
            defaultMessage="Finds your slowest pair of keys and steers the words toward it."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Bottleneck_drill",
            defaultMessage: "Target slow key combinations",
          })}
          checked={settings.get(lessonProps.guided.bottleneckDrill)}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.guided.bottleneckDrill, value),
            );
          }}
        />
      </SettingRow>
    </>
  );
}
