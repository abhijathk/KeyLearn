import { Field, FieldList } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { prop } from "./accessors.ts";
import { Group } from "./Group.tsx";
import { ColorInput } from "./input/ColorInput.tsx";
import { PreviewPane } from "./PreviewPane.tsx";
import { ProfilePreview } from "./ProfilePreview.tsx";

export function ProfileDesign() {
  const { formatMessage } = useIntl();
  return (
    <Group
      title={formatMessage({
        id: "designer.profile-colors",
        defaultMessage: "Profile Colors",
      })}
    >
      <FieldList>
        <Field>
          <ColorInput accessor={prop["--effort-color"]} />
        </Field>
        <Field size={6}>
          <FormattedMessage id="designer.effort" defaultMessage="Effort" />
        </Field>
      </FieldList>
      <PreviewPane>
        <ProfilePreview />
      </PreviewPane>
    </Group>
  );
}
