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

export function SpacedRepetitionProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
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
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.spacedRepetition.description"
            defaultMessage="Skills fade when you stop using them. With this on, KeyLearn keeps an eye on how long it's been since you last drilled each key and quietly brings back the ones that are due — spaced-repetition review woven into your practice. Once every key is unlocked, your sessions turn into targeted refreshers of whatever has gone rusty, so your hard-won speed sticks."
          />
        </Description>
      </Explainer>
    </>
  );
}
