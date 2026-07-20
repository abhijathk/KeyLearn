import { useIntlNumbers } from "@keybr/intl";
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

export function TextManglingProp(): ReactNode {
  const { formatPercents } = useIntlNumbers();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Add_capital_letters:"
            defaultMessage="Capital letter frequency:"
          />
        </Field>
        <Field>
          <Range
            size={16}
            min={0}
            max={100}
            step={1}
            value={Math.round(settings.get(lessonProps.capitals) * 100)}
            onChange={(value) => {
              updateSettings(settings.set(lessonProps.capitals, value / 100));
            }}
          />
        </Field>
        <Field>
          <Value value={formatPercents(settings.get(lessonProps.capitals))} />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.capitalLetters.description"
            defaultMessage="Controls how many capital letters show up in the lesson text, so you can practice typing them. Raise this only once every letter is already above your target speed."
          />
        </Description>
      </Explainer>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Add_punctuation_characters:"
            defaultMessage="Punctuation frequency:"
          />
        </Field>
        <Field>
          <Range
            size={16}
            min={0}
            max={100}
            step={1}
            value={Math.round(settings.get(lessonProps.punctuators) * 100)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.punctuators, value / 100),
              );
            }}
          />
        </Field>
        <Field>
          <Value
            value={formatPercents(settings.get(lessonProps.punctuators))}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.punctuation.description"
            defaultMessage="Controls how much basic punctuation shows up in the lesson text, so you can practice typing it. Raise this only once every letter is already above your target speed."
          />
        </Description>
      </Explainer>
    </>
  );
}
