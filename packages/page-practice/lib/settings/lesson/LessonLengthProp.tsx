import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { Description, Explainer, Field, FieldList, Range } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function LessonLengthProp(): ReactNode {
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Add_words_to_lessons:"
            defaultMessage="Words per lesson:"
          />
        </Field>
        <Field>
          <Range
            size={16}
            min={1}
            max={100}
            step={1}
            value={Math.round(settings.get(lessonProps.length) * 100)}
            onChange={(value) => {
              updateSettings(settings.set(lessonProps.length, value / 100));
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.lessonLength.description"
            defaultMessage="Sets how many words appear in each lesson. Longer lessons can help you learn more effectively."
          />
        </Description>
      </Explainer>
    </>
  );
}
