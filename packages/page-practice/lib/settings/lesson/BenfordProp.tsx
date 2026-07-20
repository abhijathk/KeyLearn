import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  Link,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function BenfordProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "settings.benfordsLaw.label",
              defaultMessage: "Benford’s law",
            })}
            checked={settings.get(lessonProps.numbers.benford)}
            onChange={(value) => {
              updateSettings(settings.set(lessonProps.numbers.benford, value));
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.benfordsLaw.description"
            defaultMessage="<a>Benford’s law</a> describes a pattern found in many real-world sets of numbers: the first digit tends to be small far more often than not."
            values={{
              a: (chunks) => (
                <Link
                  href="https://en.wikipedia.org/wiki/Benford's_law"
                  target="_blank"
                >
                  {chunks}
                </Link>
              ),
            }}
          />
        </Description>
      </Explainer>
    </>
  );
}
