import { Field, FieldList } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { prop } from "./accessors.ts";
import { ContrastNote } from "./ContrastNote.tsx";
import { Group } from "./Group.tsx";
import { ColorInput, gray } from "./input/ColorInput.tsx";
import { PreviewPane } from "./PreviewPane.tsx";
import { TextInputPreview } from "./TextInputPreview.tsx";

export function TextInputDesign() {
  const { formatMessage } = useIntl();
  return (
    <Group
      title={formatMessage({
        id: "designer.text-input-colors",
        defaultMessage: "Text Input Colors",
      })}
    >
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--textinput__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.text" defaultMessage="Text" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--textinput--special__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.whitespace"
            defaultMessage="Whitespace"
          />
        </Field>
      </FieldList>
      {/*
        The one pairing worth checking by default: the practice text against
        the surface it sits on. Everything else in this pane is an accent on
        top of it.
      */}
      <ContrastNote
        label={
          <FormattedMessage
            id="designer.contrast.text"
            defaultMessage="Text on the page:"
          />
        }
        text={(theme) => theme.getColor("--textinput__color") ?? gray}
        ground={(theme) => theme.getColor("--primary") ?? gray}
      />
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--textinput--hit__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.good-input"
            defaultMessage="Good Input"
          />
        </Field>
        <Field>
          <ColorInput accessor={prop["--textinput--miss__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.bad-input"
            defaultMessage="Bad Input"
          />
        </Field>
      </FieldList>
      <PreviewPane>
        <TextInputPreview />
      </PreviewPane>
    </Group>
  );
}
