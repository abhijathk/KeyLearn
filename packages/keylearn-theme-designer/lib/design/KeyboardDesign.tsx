import { Field, FieldList } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { prop } from "./accessors.ts";
import { Group } from "./Group.tsx";
import { ColorInput } from "./input/ColorInput.tsx";
import { KeyboardPreview } from "./KeyboardPreview.tsx";
import { PreviewPane } from "./PreviewPane.tsx";

export function KeyboardDesign() {
  const { formatMessage } = useIntl();
  return (
    <Group
      title={formatMessage({
        id: "designer.keyboard-colors",
        defaultMessage: "Keyboard Colors",
      })}
    >
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--pinky-zone-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.pinky" defaultMessage="Pinky" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--ring-zone-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.ring" defaultMessage="Ring" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--middle-zone-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.middle" defaultMessage="Middle" />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--left-index-zone-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.left-index"
            defaultMessage="Left index"
          />
        </Field>
        <Field>
          <ColorInput accessor={prop["--right-index-zone-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.right-index"
            defaultMessage="Right index"
          />
        </Field>
        <Field>
          <ColorInput accessor={prop["--thumb-zone-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.thumb" defaultMessage="Thumb" />
        </Field>
      </FieldList>
      <PreviewPane>
        <KeyboardPreview />
      </PreviewPane>
    </Group>
  );
}
