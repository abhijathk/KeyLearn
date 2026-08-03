import { lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import { Field, FieldList, Range, Value } from "@keylearn/widget";
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
    </>
  );
}
