import { useIntlDurations } from "@keybr/intl";
import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
  Range,
  Value,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function DailyGoalSettings(): ReactNode {
  const { formatMessage } = useIntl();
  const { formatDuration } = useIntlDurations();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldSet>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Daily_goal:"
            defaultMessage="Daily practice goal:"
          />
        </Field>
        <Field>
          <Range
            size={16}
            min={0}
            max={24}
            step={1}
            value={Math.round(settings.get(lessonProps.dailyGoal) / 5)}
            onChange={(value) => {
              updateSettings(settings.set(lessonProps.dailyGoal, value * 5));
            }}
          />
        </Field>
        <Field>
          {settings.get(lessonProps.dailyGoal) === 0 ? (
            formatMessage({
              id: "t_Not_set",
              defaultMessage: "No goal set",
            })
          ) : (
            <Value
              value={formatDuration({
                minutes: settings.get(lessonProps.dailyGoal),
              })}
            />
          )}
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.dailyGoal.description"
            defaultMessage="Choose how much time you’d like to spend practicing each day. It’s just a gentle reminder, not a limit — you can stop whenever you like."
          />
        </Description>
      </Explainer>
    </FieldSet>
  );
}
