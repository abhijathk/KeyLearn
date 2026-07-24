import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  Description,
  Explainer,
  Field,
  FieldList,
  Range,
  Value,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function StageSizeProp(): ReactNode {
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="settings.curriculum.stageSize.label"
            defaultMessage="New keys per stage:"
          />
        </Field>
        <Field>
          <Range
            min={lessonProps.curriculum.stageSize.min}
            max={lessonProps.curriculum.stageSize.max}
            step={1}
            value={settings.get(lessonProps.curriculum.stageSize)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.curriculum.stageSize, value),
              );
            }}
          />
        </Field>
        <Field>
          <Value value={settings.get(lessonProps.curriculum.stageSize)} />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.curriculum.stageSize.description"
            defaultMessage="How many new keys the curriculum unlocks at a time once you’ve mastered the current ones. Two is the classic pace — a left- and right-hand pair; raise it to move faster."
          />
        </Description>
      </Explainer>
    </>
  );
}
