import { SpeedUnit, uiProps } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import {
  Description,
  Explainer,
  OptionList,
  RowSeparator,
  SettingRow,
  SettingsCard,
  Switch,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function MiscSettings(): ReactNode {
  return (
    <SettingsCard
      caption={
        <FormattedMessage
          id="t_Interface_options"
          defaultMessage="Display preferences"
        />
      }
    >
      <SpeedUnitProp />
      <RowSeparator />
      <GhostRaceProp />
      <RowSeparator />
      <HideHeaderProp />
    </SettingsCard>
  );
}

function HideHeaderProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.hideHeaderWhileTyping.label"
            defaultMessage="Hide the header while typing"
          />
        }
        description={
          <FormattedMessage
            id="settings.hideHeaderWhileTyping.short"
            defaultMessage="Slides the header away as you start, and back a few seconds after you stop."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "settings.hideHeaderWhileTyping.label",
            defaultMessage: "Hide the header while typing",
          })}
          checked={settings.get(uiProps.hideHeaderWhileTyping)}
          onChange={(value) => {
            updateSettings(settings.set(uiProps.hideHeaderWhileTyping, value));
          }}
        />
      </SettingRow>
    </>
  );
}

function GhostRaceProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Ghost_race"
            defaultMessage="Race against your last race"
          />
        }
        description={
          <FormattedMessage
            id="settings.ghostRace.short"
            defaultMessage="A marker replays your previous run above the text. Stay ahead of it and it glows."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Ghost_race",
            defaultMessage: "Race against your last race",
          })}
          checked={settings.get(uiProps.ghostRace)}
          onChange={(value) => {
            updateSettings(settings.set(uiProps.ghostRace, value));
          }}
        />
      </SettingRow>
    </>
  );
}

function SpeedUnitProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.typingSpeedUnit.label"
            defaultMessage="Show typing speed as"
          />
        }
        description={
          <FormattedMessage
            id="settings.typingSpeedUnit.short"
            defaultMessage="A word counts as five characters, including spaces and punctuation."
          />
        }
      >
        <OptionList
          options={SpeedUnit.ALL.map((item) => ({
            value: item.id,
            name: formatMessage(item.name),
          }))}
          value={settings.get(uiProps.speedUnit).id}
          onSelect={(id) => {
            updateSettings(
              settings.set(uiProps.speedUnit, SpeedUnit.ALL.get(id)),
            );
          }}
        />
      </SettingRow>
    </>
  );
}
