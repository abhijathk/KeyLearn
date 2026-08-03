import { lessonProps } from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import { CheckBox, Field, FieldList, Link } from "@keylearn/widget";
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
    </>
  );
}
