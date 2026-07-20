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

export function KeyboardOrderProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
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
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="setting.keyboardOrder.description"
            defaultMessage="Orders the letters so the home row comes first, followed by the top row, then everything else. The home row is the one with the CapsLock key; the top row is the one with the Tab key. Keeping your fingers on the home row makes typing faster and easier. This works best on optimized layouts such as Dvorak or Colemak. On a Qwerty layout, A is the only home-row vowel, which sharply narrows the choice of words, so the algorithm leans on more pseudo-words than usual."
          />
        </Description>
      </Explainer>
    </>
  );
}
