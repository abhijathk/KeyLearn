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

export function BottleneckDrillProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
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
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.bottleneckDrill.description"
            defaultMessage="Two keys can each be fast on their own yet drag when you type them back to back — an awkward roll or a same-finger jump. With this on, KeyLearn watches the gaps between your keystrokes, finds the slowest pair among your current keys, and steers the generated words toward it so you smooth out the transition."
          />
        </Description>
      </Explainer>
    </>
  );
}
