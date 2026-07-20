import { type NamedUser } from "@keybr/pages-shared";
import {
  Button,
  Field,
  FieldList,
  Icon,
  TextField,
  type TextFieldRef,
  useClipboard,
} from "@keybr/widget";
import { mdiContentCopy, mdiOpenInNew } from "@mdi/js";
import { useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function ShareProfileLink({ user }: { user: NamedUser }) {
  const { formatMessage } = useIntl();
  const textFieldRef = useRef<TextFieldRef>(null);
  const { copyText } = useClipboard();

  const url = new URL(window.location.href);
  url.pathname = `/profile/${user.id}`;
  const href = String(url);

  return (
    <FieldList>
      <Field>
        <FormattedMessage
          id="t_Share_your_profile:"
          defaultMessage="Your profile link:"
        />
      </Field>
      <Field>
        <TextField
          ref={textFieldRef}
          size={24}
          value={href}
          onFocus={() => {
            const { current } = textFieldRef;
            if (current != null) {
              current.select();
            }
          }}
        />
      </Field>
      <Field>
        <Button
          icon={<Icon shape={mdiContentCopy} />}
          label={formatMessage({
            id: "t_Copy",
            defaultMessage: "Copy",
          })}
          title={formatMessage({
            id: "profile.widget.share.description",
            defaultMessage: "Copies your profile link to the clipboard.",
          })}
          onClick={() => {
            const { current } = textFieldRef;
            if (current != null) {
              current.select();
              copyText(href);
            }
          }}
        />
      </Field>
      <Field>
        <Button
          icon={<Icon shape={mdiOpenInNew} />}
          label={formatMessage({
            id: "t_Visit_profile",
            defaultMessage: "Open",
          })}
          title={formatMessage({
            id: "profile.widget.visit.description",
            defaultMessage: "Opens your public profile page.",
          })}
          onClick={() => {
            document.location = href;
          }}
        />
      </Field>
    </FieldList>
  );
}
