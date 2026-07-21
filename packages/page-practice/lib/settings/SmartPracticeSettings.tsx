import { Description, Explainer, FieldSet } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { BottleneckDrillProp } from "./lesson/BottleneckDrillProp.tsx";
import { SkillDecayProp } from "./lesson/SkillDecayProp.tsx";
import { SmartConfidenceProp } from "./lesson/SmartConfidenceProp.tsx";
import { SpacedRepetitionProp } from "./lesson/SpacedRepetitionProp.tsx";

/**
 * The adaptive-engine layers, gathered in one place as first-class features
 * instead of being scattered through the guided-lesson options.
 */
export function SmartPracticeSettings(): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.smartPractice.description"
            defaultMessage="These helpers run on top of the core letter-by-letter algorithm during guided practice, quietly steering each session toward whatever pays off most. They're all on by default — switch any of them off if you'd rather keep things classic."
          />
        </Description>
      </Explainer>
      <FieldSet
        legend={formatMessage({
          id: "t_Adaptive_helpers",
          defaultMessage: "Adaptive helpers",
        })}
      >
        <SmartConfidenceProp />
        <SkillDecayProp />
        <SpacedRepetitionProp />
        <BottleneckDrillProp />
      </FieldSet>
    </>
  );
}
