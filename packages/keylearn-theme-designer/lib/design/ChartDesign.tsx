import { Field, FieldList } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { prop } from "./accessors.ts";
import { ChartPreview } from "./ChartPreview.tsx";
import { Group } from "./Group.tsx";
import { ColorInput } from "./input/ColorInput.tsx";
import { PreviewPane } from "./PreviewPane.tsx";

export function ChartDesign() {
  const { formatMessage } = useIntl();
  return (
    <Group
      title={formatMessage({
        id: "designer.chart-colors",
        defaultMessage: "Chart Colors",
      })}
    >
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--Chart-speed__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.speed" defaultMessage="Speed" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--Chart-accuracy__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.accuracy" defaultMessage="Accuracy" />
        </Field>
        <Field>
          <ColorInput accessor={prop["--Chart-complexity__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.complexity"
            defaultMessage="Complexity"
          />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--Chart-threshold__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.threshold"
            defaultMessage="Threshold"
          />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--Chart-hist-h__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.color-n"
            defaultMessage="Color {n}"
            values={{ n: 1 }}
          />
        </Field>
        <Field>
          <ColorInput accessor={prop["--Chart-hist-m__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.color-n"
            defaultMessage="Color {n}"
            values={{ n: 2 }}
          />
        </Field>
        <Field>
          <ColorInput accessor={prop["--Chart-hist-r__color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage
            id="designer.color-n"
            defaultMessage="Color {n}"
            values={{ n: 3 }}
          />
        </Field>
      </FieldList>
      <PreviewPane>
        <ChartPreview />
      </PreviewPane>
    </Group>
  );
}
