import { usePageData } from "@keylearn/pages-shared";
import {
  Description,
  Explainer,
  RowSeparator,
  SettingsCard,
} from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { BottleneckDrillProp } from "./lesson/BottleneckDrillProp.tsx";
import { SkillDecayProp } from "./lesson/SkillDecayProp.tsx";
import { SmartConfidenceProp } from "./lesson/SmartConfidenceProp.tsx";
import { SpacedRepetitionProp } from "./lesson/SpacedRepetitionProp.tsx";

/**
 * The adaptive-engine layers, gathered in one place as first-class features
 * instead of being scattered through the guided-lesson options.
 */
export function SmartPracticeSettings(): ReactNode {
  // The site can switch the adaptive engine off for everyone (control
  // centre, Practice & lessons). Then the card goes: four switches that
  // change nothing are worse than no card.
  if (usePageData().smartPractice === false) {
    return null;
  }
  return (
    <>
      <SettingsCard
        caption={
          <FormattedMessage
            id="t_Adaptive_helpers"
            defaultMessage="Adaptive helpers"
          />
        }
      >
        <SmartConfidenceProp />
        <RowSeparator />
        <SkillDecayProp />
        <RowSeparator />
        <SpacedRepetitionProp />
        <RowSeparator />
        <BottleneckDrillProp />
      </SettingsCard>
    </>
  );
}
