import { lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import { Description, Explainer, SettingRow, Switch } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function KeyboardOrderProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="setting.keyboardOrder.label"
            defaultMessage="Order letters to match the keyboard layout"
          />
        }
        description={
          <FormattedMessage
            id="setting.keyboardOrder.short"
            defaultMessage="Introduce letters by where they sit — home row first — rather than by how common they are."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "setting.keyboardOrder.label",
            defaultMessage: "Order letters to match the keyboard layout",
          })}
          checked={settings.get(lessonProps.guided.keyboardOrder)}
          onChange={(value) => {
            updateSettings(
              settings.set(lessonProps.guided.keyboardOrder, value),
            );
          }}
        />
      </SettingRow>
    </>
  );
}
