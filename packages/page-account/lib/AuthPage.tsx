import { Pages } from "@keybr/pages-shared";
import { Button, Icon, TextField } from "@keybr/widget";
import {
  mdiAccountPlus,
  mdiEmailFastOutline,
  mdiKeyVariant,
  mdiLoginVariant,
} from "@mdi/js";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AuthPage.module.less";
import { AnimatedHeight, FloatingShell } from "./FloatingShell.tsx";
import { AccountService } from "./service.ts";

export type AuthMode = "login" | "register" | "forgot" | "reset";

function reload(url: string) {
  window.location.href = url;
}

/**
 * All four auth screens live in one compact floating window. Switching
 * between them swaps the form in place (with the window gliding to the new
 * height) and rewrites the URL, so /login and /register stay deep-linkable
 * without a jarring page swap.
 */
export function AuthPage({
  mode: initialMode,
  token,
}: {
  readonly mode: AuthMode;
  readonly token?: string;
}): ReactNode {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const go = (next: AuthMode, path: string) => {
    setMode(next);
    window.history.replaceState({}, "", path);
  };
  const toLogin = () => go("login", Pages.login.path);
  const toRegister = () => go("register", Pages.register.path);
  const toForgot = () => go("forgot", Pages.forgotPassword.path);

  return (
    <FloatingShell compact={true} title={<ModeTitle mode={mode} />}>
      <AnimatedHeight>
        <div key={mode} className={styles.swap}>
          {mode === "register" ? (
            <RegisterForm toLogin={toLogin} />
          ) : mode === "forgot" ? (
            <ForgotForm toLogin={toLogin} />
          ) : mode === "reset" ? (
            <ResetForm token={token ?? ""} />
          ) : (
            <LoginForm toRegister={toRegister} toForgot={toForgot} />
          )}
        </div>
      </AnimatedHeight>
    </FloatingShell>
  );
}

function ModeTitle({ mode }: { readonly mode: AuthMode }): ReactNode {
  switch (mode) {
    case "register":
      return (
        <FormattedMessage
          id="auth.register.submit"
          defaultMessage="Create account"
        />
      );
    case "forgot":
      return (
        <FormattedMessage
          id="auth.forgot.title"
          defaultMessage="Reset your password"
        />
      );
    case "reset":
      return (
        <FormattedMessage
          id="auth.reset.title"
          defaultMessage="Choose a new password"
        />
      );
    default:
      return (
        <FormattedMessage id="auth.login.submit" defaultMessage="Log in" />
      );
  }
}

// The official multicolour Google mark, drawn inline so it is always crisp
// and never fetched from a CDN.
function GoogleMark(): ReactNode {
  return (
    <svg className={styles.googleMark} viewBox="0 0 48 48" aria-hidden={true}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GoogleButton({ label }: { readonly label: string }) {
  return (
    <button
      type="button"
      className={styles.googleBtn}
      onClick={() => {
        document.location = "/auth/oauth-init/google";
      }}
    >
      <GoogleMark />
      {label}
    </button>
  );
}

function LinkButton({
  onClick,
  children,
}: {
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button type="button" className={styles.link} onClick={onClick}>
      {children}
    </button>
  );
}

function LoginForm({
  toRegister,
  toForgot,
}: {
  readonly toRegister: () => void;
  readonly toForgot: () => void;
}) {
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
    <div className={styles.form}>
      <p className={styles.intro}>
        <FormattedMessage
          id="auth.login.intro"
          defaultMessage="Log in to pick up your progress on any device."
        />
      </p>
      <GoogleButton
        label={formatMessage({
          id: "auth.continueWithGoogle",
          defaultMessage: "Continue with Google",
        })}
      />
      <div className={styles.divider}>
        <FormattedMessage id="auth.or" defaultMessage="or" />
      </div>
      <TextField
        size="full"
        type="email"
        placeholder={formatMessage({
          id: "t_Your_email_address",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={setEmail}
      />
      <TextField
        size="full"
        type="password"
        placeholder={formatMessage({
          id: "auth.password",
          defaultMessage: "Password",
        })}
        value={password}
        onChange={setPassword}
      />
      {error != null && <p className={styles.error}>{error}</p>}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiLoginVariant} />}
          label={formatMessage({
            id: "auth.login.submit",
            defaultMessage: "Log in",
          })}
          disabled={busy}
          onClick={submit}
        />
      </div>
      <div className={styles.links}>
        <LinkButton onClick={toForgot}>
          <FormattedMessage
            id="auth.forgotLink"
            defaultMessage="Forgot your password?"
          />
        </LinkButton>
        <span className={styles.linkRow}>
          <FormattedMessage id="auth.noAccount" defaultMessage="New here? " />
          <LinkButton onClick={toRegister}>
            <FormattedMessage
              id="auth.createAccount"
              defaultMessage="Create an account"
            />
          </LinkButton>
        </span>
      </div>
    </div>
  );
}

function RegisterForm({ toLogin }: { readonly toLogin: () => void }) {
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
    <div className={styles.form}>
      <p className={styles.intro}>
        <FormattedMessage
          id="auth.register.intro"
          defaultMessage="One account for the whole household — you'll add each learner's profile next."
        />
      </p>
      <GoogleButton
        label={formatMessage({
          id: "auth.registerWithGoogle",
          defaultMessage: "Sign up with Google",
        })}
      />
      <div className={styles.divider}>
        <FormattedMessage id="auth.or" defaultMessage="or" />
      </div>
      <TextField
        size="full"
        type="text"
        placeholder={formatMessage({
          id: "auth.yourName",
          defaultMessage: "Your name (optional)",
        })}
        value={name}
        onChange={setName}
      />
      <TextField
        size="full"
        type="email"
        placeholder={formatMessage({
          id: "t_Your_email_address",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={setEmail}
      />
      <TextField
        size="full"
        type="password"
        placeholder={formatMessage({
          id: "auth.choosePassword",
          defaultMessage: "Choose a password (8+ characters)",
        })}
        value={password}
        onChange={setPassword}
      />
      {error != null && <p className={styles.error}>{error}</p>}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiAccountPlus} />}
          label={formatMessage({
            id: "auth.register.submit",
            defaultMessage: "Create account",
          })}
          disabled={busy}
          onClick={submit}
        />
      </div>
      <div className={styles.links}>
        <span className={styles.linkRow}>
          <FormattedMessage
            id="auth.haveAccount"
            defaultMessage="Already have an account? "
          />
          <LinkButton onClick={toLogin}>
            <FormattedMessage id="auth.login.submit" defaultMessage="Log in" />
          </LinkButton>
        </span>
      </div>
    </div>
  );
}

function ForgotForm({ toLogin }: { readonly toLogin: () => void }) {
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
      <div className={styles.form}>
        <p className={styles.intro}>
          <FormattedMessage
            id="auth.forgot.sentText"
            defaultMessage="If an account exists for <strong>{email}</strong>, a password reset link is on its way. The link expires in 24 hours."
            values={{
              email,
              strong: (chunks) => <strong>{chunks}</strong>,
            }}
          />
        </p>
        <div className={styles.links}>
          <LinkButton onClick={toLogin}>
            <FormattedMessage
              id="auth.backToLogin"
              defaultMessage="Back to log in"
            />
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <p className={styles.intro}>
        <FormattedMessage
          id="auth.forgot.intro"
          defaultMessage="Enter your email and we'll send you a link to choose a new password."
        />
      </p>
      <TextField
        size="full"
        type="email"
        placeholder={formatMessage({
          id: "t_Your_email_address",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={setEmail}
      />
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiEmailFastOutline} />}
          label={formatMessage({
            id: "auth.forgot.submit",
            defaultMessage: "Send reset link",
          })}
          disabled={busy}
          onClick={submit}
        />
      </div>
      <div className={styles.links}>
        <LinkButton onClick={toLogin}>
          <FormattedMessage
            id="auth.backToLogin"
            defaultMessage="Back to log in"
          />
        </LinkButton>
      </div>
    </div>
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
    <div className={styles.form}>
      <TextField
        size="full"
        type="password"
        placeholder={formatMessage({
          id: "auth.newPassword",
          defaultMessage: "New password (8+ characters)",
        })}
        value={password}
        onChange={setPassword}
      />
      {error != null && <p className={styles.error}>{error}</p>}
      <div className={styles.primary}>
        <Button
          size="full"
          icon={<Icon shape={mdiKeyVariant} />}
          label={formatMessage({
            id: "auth.reset.submit",
            defaultMessage: "Set new password",
          })}
          disabled={busy}
          onClick={submit}
        />
      </div>
    </div>
  );
}
