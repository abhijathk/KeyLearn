import { uiProps } from "@keylearn/result";
import { useSettings } from "@keylearn/settings";
import {
  Description,
  Explainer,
  SettingRow,
  SettingsCard,
  Switch,
} from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

/**
 * Whether a lesson can be walked away from.
 *
 * Asked for by a customer who noticed their learners skipping every lesson
 * that got difficult — which is the lesson worth staying on, and the one the
 * guided course would have kept bringing back until it was learned. Turning
 * this off takes the control away and stops its shortcut, so the next lesson
 * is the one in front of them.
 *
 * On by default. A setting existing is not a reason to change what every
 * current learner already has.
 *
 * Grown-up practice only, and per profile like every other practice setting:
 * the kids world has no skip control to hide, and a household where one
 * learner needs to move past a lesson they cannot yet type should not have
 * that decided by a sibling's settings.
 */
export function SkipSettings(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const allowed = settings.get(uiProps.allowSkip);
  return (
    <SettingsCard
      caption={
        <FormattedMessage
          id="settings.skip.caption"
          defaultMessage="Difficult lessons"
        />
      }
    >
      <SettingRow
        label={
          <FormattedMessage
            id="settings.allowSkip.label"
            defaultMessage="Allow skipping a lesson"
          />
        }
        description={
          <FormattedMessage
            id="settings.allowSkip.short"
            defaultMessage="Shows the skip button in the practice toolbar."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "settings.allowSkip.label",
            defaultMessage: "Allow skipping a lesson",
          })}
          checked={allowed}
          onChange={(value) => {
            updateSettings(settings.set(uiProps.allowSkip, value));
          }}
        />
      </SettingRow>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.allowSkip.explain"
            defaultMessage="Turn this off and the skip button is hidden and its shortcut stops working, so a hard lesson has to be attempted rather than passed over. Restarting the lesson still works, and so does leaving the page."
          />
        </Description>
      </Explainer>
    </SettingsCard>
  );
}
