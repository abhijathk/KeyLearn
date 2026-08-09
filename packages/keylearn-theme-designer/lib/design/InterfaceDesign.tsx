import { Field, FieldList } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { prop } from "./accessors.ts";
import { Group } from "./Group.tsx";
import { ColorInput } from "./input/ColorInput.tsx";
import { InterfacePreview } from "./InterfacePreview.tsx";
import { PreviewPane } from "./PreviewPane.tsx";

export function InterfaceDesign() {
  const { formatMessage } = useIntl();
  return (
    <Group
      title={formatMessage({
        id: "designer.interface-colors",
        defaultMessage: "Interface Colors",
      })}
    >
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--Name-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.name" defaultMessage="Name" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--Value-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.value" defaultMessage="Value" />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--Value--more__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.increased-value"
            defaultMessage="Increased value"
          />
        </Field>
        <Field>
          <ColorInput accessor={prop["--Value--less__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.decreased-value"
            defaultMessage="Decreased value"
          />
        </Field>
      </FieldList>
      <PreviewPane>
        <InterfacePreview />
      </PreviewPane>
    </Group>
  );
}
