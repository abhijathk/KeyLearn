import { useIntlDurations } from "@keybr/intl";
import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  Description,
  Explainer,
  Range,
  SettingRow,
  SettingsCard,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function DailyGoalSettings(): ReactNode {
  const { formatMessage } = useIntl();
  const { formatDuration } = useIntlDurations();
  const { settings, updateSettings } = useSettings();
  const dailyGoal = settings.get(lessonProps.dailyGoal);
  return (
    <SettingsCard
      caption={
        <FormattedMessage
          id="settings.group.goal"
          defaultMessage="Daily goal"
        />
      }
    >
      <SettingRow
        label={
          <FormattedMessage
            id="settings.dailyGoal.label"
            defaultMessage="Practice each day for"
          />
        }
        description={
          <FormattedMessage
            id="settings.dailyGoal.short"
            defaultMessage="A gentle reminder, never a limit — you can stop whenever you like."
          />
        }
        value={
          dailyGoal === 0
            ? formatMessage({ id: "t_Not_set", defaultMessage: "No goal set" })
            : formatDuration({ minutes: dailyGoal })
        }
      >
        <Range
          size={10}
          min={0}
          max={24}
          step={1}
          value={Math.round(dailyGoal / 5)}
          onChange={(value) => {
            updateSettings(settings.set(lessonProps.dailyGoal, value * 5));
          }}
        />
      </SettingRow>
    </SettingsCard>
  );
}
