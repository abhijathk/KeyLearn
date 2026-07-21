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

export function SkillDecayProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Skill_decay",
              defaultMessage: "Let unused keys fade over time",
            })}
            checked={settings.get(lessonProps.guided.skillDecay)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.guided.skillDecay, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.skillDecay.description"
            defaultMessage="Skills rust when they go unused, and this makes the app honest about it. A key you haven't practised in a long while slowly loses a little confidence over real time, gently flagging it for a refresh before it truly slips. Your best-ever result is never wiped — only the current reading softens."
          />
        </Description>
      </Explainer>
    </>
  );
}
