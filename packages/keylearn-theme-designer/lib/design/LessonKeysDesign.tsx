import { Field, FieldList } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { prop } from "./accessors.ts";
import { Group } from "./Group.tsx";
import { ColorInput } from "./input/ColorInput.tsx";
import { LessonKeysPreview } from "./LessonKeysPreview.tsx";
import { PreviewPane } from "./PreviewPane.tsx";

export function LessonKeysDesign() {
  const { formatMessage } = useIntl();
  return (
    <Group
      title={formatMessage({
        id: "designer.lesson-key-colors",
        defaultMessage: "Lesson Key Colors",
      })}
    >
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--slow-key-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.slow-key" defaultMessage="Slow key" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--fast-key-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.fast-key" defaultMessage="Fast key" />
        </Field>
      </FieldList>
      <PreviewPane>
        <LessonKeysPreview />
      </PreviewPane>
    </Group>
  );
}
