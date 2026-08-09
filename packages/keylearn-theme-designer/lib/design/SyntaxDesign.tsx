import { Field, FieldList } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { prop } from "./accessors.ts";
import { Group } from "./Group.tsx";
import { ColorInput } from "./input/ColorInput.tsx";
import { PreviewPane } from "./PreviewPane.tsx";
import { SyntaxPreview } from "./SyntaxPreview.tsx";

export function SyntaxDesign() {
  const { formatMessage } = useIntl();
  return (
    <Group
      title={formatMessage({
        id: "designer.syntax-colors",
        defaultMessage: "Syntax Colors",
      })}
    >
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--syntax-keyword"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.keywords" defaultMessage="Keywords" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--syntax-number"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.numbers" defaultMessage="Numbers" />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--syntax-string"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.strings" defaultMessage="Strings" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--syntax-comment"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.comments" defaultMessage="Comments" />
        </Field>
      </FieldList>
      <PreviewPane>
        <SyntaxPreview />
      </PreviewPane>
    </Group>
  );
}
