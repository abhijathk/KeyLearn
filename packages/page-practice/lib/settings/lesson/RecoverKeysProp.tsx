import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function RecoverKeysProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Unlock_a_next_key_:"
            defaultMessage="Only unlock the next key once:"
          />
        </Field>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_The_previous_keys_are_",
              defaultMessage:
                "All previously unlocked keys are also above the target speed",
            })}
            checked={settings.get(lessonProps.guided.recoverKeys)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.guided.recoverKeys, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.recoverKeys.description"
            defaultMessage="While you’re focused on a new key, your speed on earlier keys will often dip a little. With this option off, a key unlocks as soon as the one you’re focusing on clears the target speed. With it on, every previously unlocked key must also stay above the target speed before a new one unlocks — harder to progress, but it also helps keep you from losing your grip on older keys."
          />
        </Description>
      </Explainer>
    </>
  );
}
