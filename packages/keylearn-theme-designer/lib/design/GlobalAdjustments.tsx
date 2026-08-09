import { Field, FieldList, Icon, IconButton } from "@keylearn/widget";
import { mdiMinusCircleOutline, mdiPlusCircleOutline } from "@mdi/js";
import { FormattedMessage, useIntl } from "react-intl";
import { adjustColors } from "./adjust-colors.ts";
import { useCustomTheme } from "./context.ts";
import { Group } from "./Group.tsx";
import { PreviewPane } from "./PreviewPane.tsx";
import { WidgetsPreview } from "./WidgetsPreview.tsx";

export function GlobalAdjustments() {
  const { formatMessage } = useIntl();
  const { theme, setTheme } = useCustomTheme();
  return (
    <Group
      title={formatMessage({
        id: "designer.global-adjustments",
        defaultMessage: "Global Adjustments",
      })}
    >
      <FieldList>
        <Field.Filler />
        <Field>
          <IconButton
            icon={<Icon shape={mdiMinusCircleOutline} />}
            onClick={() => {
              setTheme(adjustColors(theme, "saturation", -0.05));
            }}
          />
        </Field>
        <Field>
          <FormattedMessage
            id="designer.saturation"
            defaultMessage="Saturation"
          />
        </Field>
        <Field>
          <IconButton
            icon={<Icon shape={mdiPlusCircleOutline} />}
            onClick={() => {
              setTheme(adjustColors(theme, "saturation", +0.05));
            }}
          />
        </Field>
        <Field.Filler />
      </FieldList>
      <FieldList>
        <Field.Filler />
        <Field>
          <IconButton
            icon={<Icon shape={mdiMinusCircleOutline} />}
            onClick={() => {
              setTheme(adjustColors(theme, "brightness", -0.05));
            }}
          />
        </Field>
        <Field>
          <FormattedMessage
            id="designer.brightness"
            defaultMessage="Brightness"
          />
        </Field>
        <Field>
          <IconButton
            icon={<Icon shape={mdiPlusCircleOutline} />}
            onClick={() => {
              setTheme(adjustColors(theme, "brightness", +0.05));
            }}
          />
        </Field>
        <Field.Filler />
      </FieldList>
      <PreviewPane>
        <WidgetsPreview />
      </PreviewPane>
    </Group>
  );
}
