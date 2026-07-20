import { Dir } from "@keybr/intl";
import { lessonProps } from "@keybr/lesson";
import { useFormatter } from "@keybr/lesson-ui";
import { useSettings } from "@keybr/settings";
import {
  Description,
  Explainer,
  Field,
  FieldList,
  Icon,
  IconButton,
  Range,
  Value,
} from "@keybr/widget";
import { mdiSkipNext, mdiSkipPrevious } from "@mdi/js";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function TargetSpeedProp(): ReactNode {
  const { formatSpeed } = useFormatter();
  const { settings, updateSettings } = useSettings();
  const targetSpeed = settings.get(lessonProps.targetSpeed);
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Target_typing_speed:"
            defaultMessage="Your target speed:"
          />
        </Field>
        <Field>
          <Range
            size={16}
            min={lessonProps.targetSpeed.min}
            max={lessonProps.targetSpeed.max}
            step={1}
            value={targetSpeed}
            onChange={(value) => {
              updateSettings(settings.set(lessonProps.targetSpeed, value));
            }}
          />
        </Field>
        <Field>
          <Dir swap="icon">
            <IconButton
              icon={<Icon shape={mdiSkipPrevious} />}
              disabled={targetSpeed === lessonProps.targetSpeed.min}
              onClick={() => {
                updateSettings(
                  settings.set(
                    lessonProps.targetSpeed,
                    Math.ceil(targetSpeed / 5) * 5 - 5,
                  ),
                );
              }}
            />
            <IconButton
              icon={<Icon shape={mdiSkipNext} />}
              disabled={targetSpeed === lessonProps.targetSpeed.max}
              onClick={() => {
                updateSettings(
                  settings.set(
                    lessonProps.targetSpeed,
                    Math.floor(targetSpeed / 5) * 5 + 5,
                  ),
                );
              }}
            />
          </Dir>
        </Field>
        <Field>
          <Value value={formatSpeed(targetSpeed)} />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.targetSpeed.description"
            defaultMessage="Your target speed sets the benchmark behind each letter’s confidence color — the closer you get to it, the greener the letter becomes. In guided mode, a letter unlocks only once you clear this speed threshold. Once every letter is unlocked, raising the target speed re-locks them so you can work toward a faster benchmark. Increase it in small steps, and only once every letter already sits above your current target."
          />
        </Description>
      </Explainer>
    </>
  );
}
