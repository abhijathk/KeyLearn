import { SpeedUnit, uiProps } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
  OptionList,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function MiscSettings(): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <FieldSet
        legend={formatMessage({
          id: "t_Interface_options",
          defaultMessage: "Display preferences",
        })}
      >
        <SpeedUnitProp />
        <GhostRaceProp />
        <HideHeaderProp />
      </FieldSet>
    </>
  );
}

function HideHeaderProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "settings.hideHeaderWhileTyping.label",
              defaultMessage: "Hide the header while typing",
            })}
            checked={settings.get(uiProps.hideHeaderWhileTyping)}
            onChange={(value) => {
              updateSettings(
                settings.set(uiProps.hideHeaderWhileTyping, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.hideHeaderWhileTyping.description"
            defaultMessage="Slides the page header out of the way the moment you start typing, so nothing competes with the practice text. It glides back in a few seconds after you stop."
          />
        </Description>
      </Explainer>
    </>
  );
}

function GhostRaceProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Ghost_race",
              defaultMessage: "Race against your last race",
            })}
            checked={settings.get(uiProps.ghostRace)}
            onChange={(value) => {
              updateSettings(settings.set(uiProps.ghostRace, value));
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.ghostRace.description"
            defaultMessage="Shows a slim lane above the text with a ghost marker that replays your last race. Stay ahead of it and your marker glows — a friendly race against your past self on every round."
          />
        </Description>
      </Explainer>
    </>
  );
}

function SpeedUnitProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Measure_typing_speed_in:"
            defaultMessage="Show typing speed as:"
          />
        </Field>
        <Field>
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
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.typingSpeedUnit.description"
            defaultMessage="When measuring typing speed, a word is standardized to five characters or keystrokes in English, counting spaces and punctuation."
          />
        </Description>
      </Explainer>
    </>
  );
}
