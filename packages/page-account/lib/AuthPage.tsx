import { Pages } from "@keybr/pages-shared";
import {
  Article,
  Button,
  Field,
  FieldList,
  Header,
  Icon,
  Para,
  TextField,
} from "@keybr/widget";
import { mdiGoogle, mdiLoginVariant } from "@mdi/js";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AuthPage.module.less";
import { AccountService } from "./service.ts";

export type AuthMode = "login" | "register" | "forgot" | "reset";

function reload(url: string) {
  window.location.href = url;
}

export function AuthPage({
  mode,
  token,
}: {
  readonly mode: AuthMode;
  readonly token?: string;
}): ReactNode {
  switch (mode) {
    case "register":
      return <RegisterForm />;
    case "forgot":
      return <ForgotForm />;
    case "reset":
      return <ResetForm token={token ?? ""} />;
    default:
      return <LoginForm />;
  }
}

function GoogleButton({ label }: { readonly label: string }) {
  return (
    <Button
      size={16}
      icon={<Icon shape={mdiGoogle} />}
      label={label}
      onClick={() => {
        document.location = "/auth/oauth-init/google";
      }}
    />
  );
}

function LoginForm() {
  const { formatMessage } = useIntl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (email === "" || password === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.loginPassword({ email: email.trim(), password })
      .then(() => reload("/"))
      .catch((err) => {
        setError(err.message);
        setBusy(false);
      });
  };

  return (
    <Article>
      <Header level={1}>
        <FormattedMessage id="auth.login.title" defaultMessage="Welcome back" />
      </Header>
      <Para>
        <FormattedMessage
          id="auth.login.intro"
          defaultMessage="Log in to pick up your progress on any device."
        />
      </Para>

      <GoogleButton
        label={formatMessage({
          id: "auth.continueWithGoogle",
          defaultMessage: "Continue with Google",
        })}
      />

      <div className={styles.divider}>
        <FormattedMessage id="auth.or" defaultMessage="or" />
      </div>

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
            onChange={setEmail}
          />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <TextField
            size={24}
            type="password"
            placeholder={formatMessage({
              id: "auth.password",
              defaultMessage: "Password",
            })}
            value={password}
            onChange={setPassword}
          />
        </Field>
      </FieldList>

      {error != null && <Para className={styles.error}>{error}</Para>}

      <FieldList>
        <Field>
          <Button
            size={16}
            icon={<Icon shape={mdiLoginVariant} />}
            label={formatMessage({
              id: "auth.login.submit",
              defaultMessage: "Log in",
            })}
            disabled={busy}
            onClick={submit}
          />
        </Field>
      </FieldList>

      <Para className={styles.links}>
        <NavLink className={styles.link} to={Pages.forgotPassword.path}>
          <FormattedMessage
            id="auth.forgotLink"
            defaultMessage="Forgot your password?"
          />
        </NavLink>
        <span>
          <FormattedMessage id="auth.noAccount" defaultMessage="New here? " />
          <NavLink className={styles.link} to={Pages.register.path}>
            <FormattedMessage
              id="auth.createAccount"
              defaultMessage="Create an account"
            />
          </NavLink>
        </span>
      </Para>
    </Article>
  );
}

function RegisterForm() {
  const { formatMessage } = useIntl();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (email === "" || password === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.registerPassword({
      email: email.trim(),
      password,
      name: name.trim() || undefined,
    })
      .then(() => reload("/"))
      .catch((err) => {
        setError(err.message);
        setBusy(false);
      });
  };

  return (
    <Article>
      <Header level={1}>
        <FormattedMessage
          id="auth.register.title"
          defaultMessage="Create your account"
        />
      </Header>
      <Para>
        <FormattedMessage
          id="auth.register.intro"
          defaultMessage="One account for the whole household — you'll add each learner's profile next."
        />
      </Para>

      <GoogleButton
        label={formatMessage({
          id: "auth.registerWithGoogle",
          defaultMessage: "Sign up with Google",
        })}
      />

      <div className={styles.divider}>
        <FormattedMessage id="auth.or" defaultMessage="or" />
      </div>

      <FieldList>
        <Field>
          <TextField
            size={24}
            type="text"
            placeholder={formatMessage({
              id: "auth.yourName",
              defaultMessage: "Your name (optional)",
            })}
            value={name}
            onChange={setName}
          />
        </Field>
      </FieldList>
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
            onChange={setEmail}
          />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <TextField
            size={24}
            type="password"
            placeholder={formatMessage({
              id: "auth.choosePassword",
              defaultMessage: "Choose a password (8+ characters)",
            })}
            value={password}
            onChange={setPassword}
          />
        </Field>
      </FieldList>

      {error != null && <Para className={styles.error}>{error}</Para>}

      <FieldList>
        <Field>
          <Button
            size={16}
            icon={<Icon shape={mdiLoginVariant} />}
            label={formatMessage({
              id: "auth.register.submit",
              defaultMessage: "Create account",
            })}
            disabled={busy}
            onClick={submit}
          />
        </Field>
      </FieldList>

      <Para className={styles.links}>
        <span>
          <FormattedMessage
            id="auth.haveAccount"
            defaultMessage="Already have an account? "
          />
          <NavLink className={styles.link} to={Pages.login.path}>
            <FormattedMessage id="auth.login.submit" defaultMessage="Log in" />
          </NavLink>
        </span>
      </Para>
    </Article>
  );
}

function ForgotForm() {
  const { formatMessage } = useIntl();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (email === "" || busy) {
      return;
    }
    setBusy(true);
    // Always land on the same confirmation, whether or not the email exists.
    AccountService.forgotPassword(email.trim()).finally(() => {
      setSent(true);
      setBusy(false);
    });
  };

  if (sent) {
    return (
      <Article>
        <Header level={1}>
          <FormattedMessage
            id="auth.forgot.sentTitle"
            defaultMessage="Check your inbox"
          />
        </Header>
        <Para>
          <FormattedMessage
            id="auth.forgot.sentText"
            defaultMessage="If an account exists for <strong>{email}</strong>, a password reset link is on its way. The link expires in 24 hours."
            values={{ email }}
          />
        </Para>
        <Para>
          <NavLink className={styles.link} to={Pages.login.path}>
            <FormattedMessage
              id="auth.backToLogin"
              defaultMessage="Back to log in"
            />
          </NavLink>
        </Para>
      </Article>
    );
  }

  return (
    <Article>
      <Header level={1}>
        <FormattedMessage
          id="auth.forgot.title"
          defaultMessage="Reset your password"
        />
      </Header>
      <Para>
        <FormattedMessage
          id="auth.forgot.intro"
          defaultMessage="Enter your email and we'll send you a link to choose a new password."
        />
      </Para>
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
            onChange={setEmail}
          />
        </Field>
        <Field>
          <Button
            size={16}
            label={formatMessage({
              id: "auth.forgot.submit",
              defaultMessage: "Send reset link",
            })}
            disabled={busy}
            onClick={submit}
          />
        </Field>
      </FieldList>
      <Para>
        <NavLink className={styles.link} to={Pages.login.path}>
          <FormattedMessage
            id="auth.backToLogin"
            defaultMessage="Back to log in"
          />
        </NavLink>
      </Para>
    </Article>
  );
}

function ResetForm({ token }: { readonly token: string }) {
  const { formatMessage } = useIntl();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (password === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    AccountService.resetPassword({ token, password })
      .then(() => reload("/"))
      .catch((err) => {
        setError(err.message);
        setBusy(false);
      });
  };

  return (
    <Article>
      <Header level={1}>
        <FormattedMessage
          id="auth.reset.title"
          defaultMessage="Choose a new password"
        />
      </Header>
      <FieldList>
        <Field>
          <TextField
            size={24}
            type="password"
            placeholder={formatMessage({
              id: "auth.newPassword",
              defaultMessage: "New password (8+ characters)",
            })}
            value={password}
            onChange={setPassword}
          />
        </Field>
      </FieldList>

      {error != null && <Para className={styles.error}>{error}</Para>}

      <FieldList>
        <Field>
          <Button
            size={16}
            label={formatMessage({
              id: "auth.reset.submit",
              defaultMessage: "Set new password",
            })}
            disabled={busy}
            onClick={submit}
          />
        </Field>
      </FieldList>
    </Article>
  );
}
