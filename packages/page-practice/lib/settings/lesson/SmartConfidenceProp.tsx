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

export function SmartConfidenceProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
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
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.smartConfidence.description"
            defaultMessage="Speed alone can be misleading — a key you hit fast but sloppily isn't really learned. With this on, a Bayesian mastery estimate that watches how cleanly you type is blended into the classic speed reading (speed still leads two-to-one), so a letter only counts as mastered when you're both quick and accurate."
          />
        </Description>
      </Explainer>
    </>
  );
}
