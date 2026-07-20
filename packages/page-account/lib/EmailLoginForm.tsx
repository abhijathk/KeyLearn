import { Button, Field, FieldList, Icon, Para, TextField } from "@keybr/widget";
import { mdiRepeat, mdiSend } from "@mdi/js";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { type SignInActions } from "./actions.ts";

export function EmailLoginForm({ actions }: { actions: SignInActions }) {
  const { formatMessage } = useIntl();
  const [email, setEmail] = useState("");
  const [{ state, message }, setState] = useState<{
    state: "normal" | "sending" | "success" | "error";
    message: string | null;
  }>({ state: "normal", message: null });

  const handleChangeEmail = (value: string) => {
    setEmail(value);
  };

  const handleClickLogin = () => {
    if (email !== "") {
      setState({ state: "sending", message: null });
      actions
        .registerEmail(email.trim())
        .then(() => {
          setState({ state: "success", message: null });
        })
        .catch((error) => {
          setState({ state: "error", message: error.message });
        });
    }
  };

  const handleClickRetry = () => {
    setState({ state: "normal", message: null });
  };

  switch (state) {
    case "sending":
      return (
        <>
          <Para>
            <FormattedMessage
              id="account.emailState.sendingText"
              defaultMessage="Sending your login link to <strong>{email}</strong>… hang tight."
              values={{ email }}
            />
          </Para>
        </>
      );

    case "success":
      return (
        <>
          <Para>
            <FormattedMessage
              id="account.emailState.sentText"
              defaultMessage="Your login link is on its way to <strong>{email}</strong>. Give it a minute or two, then check your inbox."
              values={{ email }}
            />
          </Para>

          <Para>
            <Button
              size={16}
              icon={<Icon shape={mdiRepeat} />}
              label={formatMessage({
                id: "t_Resend",
                defaultMessage: "Send again",
              })}
              onClick={handleClickRetry}
            />
          </Para>
        </>
      );

    case "error":
      return (
        <>
          <Para>
            <FormattedMessage
              id="account.emailState.errorText"
              defaultMessage="Couldn't send an email to <strong>{email}</strong>: {message}"
              values={{ email, message }}
            />
          </Para>

          <Para>
            <Button
              size={16}
              icon={<Icon shape={mdiRepeat} />}
              label={formatMessage({
                id: "t_Retry",
                defaultMessage: "Try again",
              })}
              onClick={handleClickRetry}
            />
          </Para>
        </>
      );

    default:
      return (
        <>
          <FieldList>
            <Field>
              <TextField
                size={24}
                type="email"
                placeholder={formatMessage({
                  id: "t_Your_email_address",
                  defaultMessage: "Email address",
                })}
                value={email}
                onChange={handleChangeEmail}
              />
            </Field>
            <Field>
              <Button
                size={16}
                icon={<Icon shape={mdiSend} />}
                label={formatMessage({
                  id: "t_Send_a_signin_link",
                  defaultMessage: "Email me a login link",
                })}
                onClick={handleClickLogin}
              />
            </Field>
          </FieldList>

          <Para>
            <FormattedMessage
              id="account.emailForm.description"
              defaultMessage={
                "No passwords required — enter your email address and we'll send you a one-time login link. " +
                "Open your inbox and click the link to create a new account or access an existing one tied to that address. " +
                "The link expires after a few hours for security. " +
                "Need to log in again later? Just enter the same email address and we'll send a fresh link."
              }
            />
          </Para>
        </>
      );
  }
}
