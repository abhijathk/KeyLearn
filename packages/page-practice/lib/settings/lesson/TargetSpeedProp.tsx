import { Dir } from "@keylearn/intl";
import { lessonProps } from "@keylearn/lesson";
import { useFormatter } from "@keylearn/lesson-ui";
import { ManagedSetting } from "@keylearn/pages-shared";
import { useSettings } from "@keylearn/settings";
import {
  Description,
  Explainer,
  Icon,
  IconButton,
  Range,
  SettingRow,
} from "@keylearn/widget";
import { mdiSkipNext, mdiSkipPrevious } from "@mdi/js";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function TargetSpeedProp(): ReactNode {
  const { formatSpeed } = useFormatter();
  const { settings, updateSettings } = useSettings();
  const targetSpeed = settings.get(lessonProps.targetSpeed);
  return (
    <ManagedSetting prop="lesson.targetSpeed">
      <SettingRow
        label={
          <FormattedMessage
            id="settings.targetSpeed.label"
            defaultMessage="Target speed"
          />
        }
        description={
          <FormattedMessage
            id="settings.targetSpeed.short"
            defaultMessage="The speed a letter has to reach before the next one unlocks."
          />
        }
        value={formatSpeed(targetSpeed)}
      >
        <Range
          size={10}
          min={lessonProps.targetSpeed.min}
          max={lessonProps.targetSpeed.max}
          step={1}
          value={targetSpeed}
          onChange={(value) => {
            updateSettings(settings.set(lessonProps.targetSpeed, value));
          }}
        />
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
      </SettingRow>
    </ManagedSetting>
  );
}
