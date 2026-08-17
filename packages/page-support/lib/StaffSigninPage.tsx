import { logout, Pages } from "@keylearn/pages-shared";
import { Button, FloatingShell, TextField } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import supportSignin from "./assets/support-signin.png";
import supportSigninDark from "./assets/support-signin-dark.png";
import { type DeskAccessReason, SupportService } from "./service.ts";
import * as styles from "./StaffSigninPage.module.less";
import { isCaptchaRequired, useCaptcha } from "./turnstile.tsx";

// Only an internal path is a valid bounce target — anything that would leave
// the app's own origin is dropped in favour of the desk itself. Resolved
// through the URL parser rather than a raw startsWith("/")/startsWith("//")
// check: the browser normalises a backslash to a forward slash for special
// schemes, and strips embedded tab/CR/LF, before it navigates — so a value
// like "/\evil.com" passes a naive "one slash, not two" check yet still
// resolves to a scheme-relative "//evil.com" once handed to location.href.
// Letting URL do the same normalisation up front and comparing the
// resolved origin closes that, on the one screen reached right after a
// staff member authenticates.
function sanitizeReturnTo(raw: string | null): string {
  if (raw == null || typeof window === "undefined") {
    return Pages.desk.path;
  }
  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return Pages.desk.path;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return Pages.desk.path;
  }
}

function readReturnTo(): string {
  if (typeof window === "undefined") {
    return Pages.desk.path;
  }
  return sanitizeReturnTo(
    new URLSearchParams(window.location.search).get("returnTo"),
  );
}

// A person with a key — the same mark the main app's own passkey button
// uses (packages/page-account/lib/AuthPage.tsx), so staff see one
// consistent passkey glyph across both sign-in doors.
function PasskeyMark(): ReactNode {
  return (
    <svg
      className={styles.passkeyMark}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      <circle cx="9" cy="7.5" r="3.6" />
      <path d="M2.5 20.5c0-3.6 2.9-6 6.5-6 .9 0 1.7.1 2.5.4" />
      <circle cx="17.2" cy="14.6" r="2.6" />
      <path d="M17.2 17.2v4.1m0-1.5h1.9m-1.9-1.4h1.9" />
    </svg>
  );
}

type Screen = "checking" | "error" | DeskAccessReason;

/**
 * A door of its own — not the general `/login` window, not linked from
 * anywhere, and showing only what staff signing in need: a passkey first,
 * a password-and-authenticator fallback, and nothing a household member
 * would want (no OAuth, no registration, no magic link). `StaffDeskPage`/
 * `AuditLogPage` send a non-eligible visitor here instead of silently
 * bouncing them to practice.
 */
export function StaffSigninPage(): ReactNode {
  const { formatMessage } = useIntl();
  const [screen, setScreen] = useState<Screen>("checking");
  const target = readReturnTo();

  const check = () => {
    SupportService.deskAccess()
      .then((status) => {
        if (status.ok) {
          window.location.href = target;
        } else {
          setScreen(status.reason);
        }
      })
      .catch(() => setScreen("error"));
  };

  // `target` comes from the URL query string, which doesn't change for the
  // life of this component — re-running only on mount is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(check, []);

  return (
    <FloatingShell
      compact={true}
      width="47rem"
      hideClose={true}
      dismissible={false}
    >
      <div className={styles.page}>
        <h1 className={styles.headline}>
          <FormattedMessage
            id="staffDesk.signin.headline"
            defaultMessage="Staff sign-in"
          />
        </h1>
        <div className={styles.layout}>
          <div className={styles.form}>
            {screen === "checking" && (
              <p className={styles.intro}>
                <FormattedMessage
                  id="staffDesk.signin.checking"
                  defaultMessage="Checking your access…"
                />
              </p>
            )}
            {screen === "signed-out" && <SignedOutStep target={target} />}
            {screen === "not-staff" && (
              <>
                <p className={styles.intro}>
                  <FormattedMessage
                    id="staffDesk.signin.notStaff"
                    defaultMessage="This account isn't part of the support desk."
                  />
                </p>
                <Button
                  size="full"
                  label={formatMessage({
                    id: "staffDesk.signin.signOut",
                    defaultMessage: "Sign out and try a different account",
                  })}
                  onClick={() =>
                    void logout(
                      `${Pages.deskSignin.path}?returnTo=${encodeURIComponent(target)}`,
                      true,
                    )
                  }
                />
              </>
            )}
            {screen === "needs-2fa" && (
              <>
                <p className={styles.intro}>
                  <FormattedMessage
                    id="staffDesk.signin.needs2fa"
                    defaultMessage="This account can reach the desk once it has a passkey or two-step verification turned on."
                  />
                </p>
                <a
                  className={styles.link}
                  href={`${Pages.account.path}#security`}
                >
                  <FormattedMessage
                    id="staffDesk.signin.goToSecurity"
                    defaultMessage="Go to account security settings"
                  />
                </a>
              </>
            )}
            {screen === "error" && (
              <>
                <p className={styles.intro}>
                  <FormattedMessage
                    id="staffDesk.signin.error"
                    defaultMessage="Something went wrong. Try again."
                  />
                </p>
                <Button
                  size="full"
                  label={formatMessage({
                    id: "staffDesk.signin.retry",
                    defaultMessage: "Try again",
                  })}
                  onClick={check}
                />
              </>
            )}
          </div>
          <div className={styles.art} aria-hidden={true}>
            <img className={styles.artImg} src={supportSigninDark} alt="" />
            <img className={styles.artImgLight} src={supportSignin} alt="" />
          </div>
        </div>
        {screen !== "checking" && (
          <p className={styles.footnote}>
            <FormattedMessage
              id="staffDesk.signin.footnote"
              defaultMessage="Every attempt here, successful or not, is written to the security log with the IP that made it."
            />
          </p>
        )}
      </div>
    </FloatingShell>
  );
}

// Passkey first, with a "password and authenticator code" fallback that
// stays on this same screen — the mock is explicit that this page shows only
// what a staff sign-in needs, not the general login window's OAuth buttons,
// registration, or magic link.
function SignedOutStep({ target }: { readonly target: string }): ReactNode {
  const [mode, setMode] = useState<"start" | "password">("start");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recheck = () => {
    SupportService.deskAccess().then((status) => {
      if (status.ok) {
        window.location.href = target;
      }
      // A non-ok result here (e.g. the account turns out not to be staff)
      // is caught by the parent's own check() on its next call — this
      // component only needs to know whether to send the browser onward.
    });
  };

  if (mode === "start") {
    return (
      <>
        <p className={styles.intro}>
          <FormattedMessage
            id="staffDesk.signin.notLinked"
            defaultMessage="This sign-in is reserved for KeyLearn support staff."
          />
        </p>
        <button
          type="button"
          className={styles.passkeyBtn}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            SupportService.loginPasskey()
              .then(recheck)
              .catch(() => setBusy(false));
          }}
        >
          <PasskeyMark />
          <FormattedMessage
            id="staffDesk.signin.usePasskey"
            defaultMessage="Use a passkey"
          />
        </button>
        {error != null && <p className={styles.error}>{error}</p>}
        <div className={styles.orRule}>
          <FormattedMessage id="auth.or" defaultMessage="OR" />
        </div>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => setMode("password")}
        >
          <FormattedMessage
            id="staffDesk.signin.usePassword"
            defaultMessage="Password and authenticator code"
          />
        </button>
      </>
    );
  }

  return <PasswordStep onBack={() => setMode("start")} onSignedIn={recheck} />;
}

function PasswordStep({
  onBack,
  onSignedIn,
}: {
  readonly onBack: () => void;
  readonly onSignedIn: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  const submitCredentials = () => {
    if (email.trim() === "" || password === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    SupportService.loginPassword({
      email: email.trim(),
      password,
      turnstileToken: captcha.token,
    })
      .then((result) => {
        setBusy(false);
        if ("twoFactor" in result) {
          setStep("code");
        } else if ("verify" in result) {
          setError(
            formatMessage({
              id: "staffDesk.signin.verifyFirst",
              defaultMessage: "Check your email to verify this account first.",
            }),
          );
        } else {
          onSignedIn();
        }
      })
      .catch((err) => {
        if (isCaptchaRequired(err)) {
          captcha.require();
        }
        setError(err.message);
        setBusy(false);
      });
  };

  const submitCode = () => {
    if (code.trim() === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    SupportService.verifyTwoFactor(code.trim())
      .then(() => {
        setBusy(false);
        onSignedIn();
      })
      .catch((err) => {
        setError(err.message);
        setBusy(false);
      });
  };

  if (step === "code") {
    return (
      <form
        className={styles.form}
        onSubmit={(ev) => {
          ev.preventDefault();
          submitCode();
        }}
      >
        <p className={styles.intro}>
          <FormattedMessage
            id="staffDesk.signin.codeIntro"
            defaultMessage="Enter the code from your authenticator app."
          />
        </p>
        <TextField
          size="full"
          type="text"
          autoComplete="one-time-code"
          autoFocus={true}
          maxLength={10}
          placeholder={formatMessage({
            id: "staffDesk.signin.codePlaceholder",
            defaultMessage: "Authenticator code",
          })}
          value={code}
          onChange={setCode}
        />
        {error != null && <p className={styles.error}>{error}</p>}
        <Button
          size="full"
          label={formatMessage({
            id: "staffDesk.signin.verify",
            defaultMessage: "Verify",
          })}
          disabled={code.trim() === "" || busy}
        />
        <button type="button" className={styles.link} onClick={onBack}>
          <FormattedMessage
            id="staffDesk.signin.startOver"
            defaultMessage="Start over"
          />
        </button>
      </form>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        submitCredentials();
      }}
    >
      <TextField
        size="full"
        type="email"
        autoComplete="email"
        autoFocus={true}
        placeholder={formatMessage({
          id: "staffDesk.signin.emailPlaceholder",
          defaultMessage: "Email address",
        })}
        value={email}
        onChange={setEmail}
      />
      <TextField
        size="full"
        type="password"
        autoComplete="current-password"
        placeholder={formatMessage({
          id: "staffDesk.signin.passwordPlaceholder",
          defaultMessage: "Password",
        })}
        value={password}
        onChange={setPassword}
      />
      {captcha.widget}
      {error != null && <p className={styles.error}>{error}</p>}
      <Button
        size="full"
        label={formatMessage({
          id: "staffDesk.signin.continue",
          defaultMessage: "Continue",
        })}
        disabled={email.trim() === "" || password === "" || busy}
      />
      <button type="button" className={styles.link} onClick={onBack}>
        <FormattedMessage
          id="staffDesk.signin.startOver"
          defaultMessage="Start over"
        />
      </button>
    </form>
  );
}
