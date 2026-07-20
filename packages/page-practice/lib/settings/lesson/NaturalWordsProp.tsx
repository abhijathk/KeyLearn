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

export function NaturalWordsProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Prefer_natural_words",
              defaultMessage: "Favor real dictionary words",
            })}
            checked={settings.get(lessonProps.guided.naturalWords)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.guided.naturalWords, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.naturalWords.description"
            defaultMessage="Prioritizes real dictionary words, falling back to computer-generated pseudo-words when there aren’t enough real ones available. Real words tend to be easier to type, while pseudo-words offer a far wider variety of letter combinations. With this enabled, you’ll still see plenty of pseudo-words early on, while your letter set is small, but dictionary words are likely to take over almost entirely once you’ve unlocked a few more letters."
          />
        </Description>
      </Explainer>
    </>
  );
}
