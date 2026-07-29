import { Pages, type UserDetails } from "@keybr/pages-shared";
import { TextField } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AccountPage.module.less";
import { PasswordField } from "./AuthPage.tsx";
import * as dlg from "./ConfirmDialog.module.less";
import { PasswordStrength } from "./PasswordStrength.tsx";
import { AccountService, type Passkey } from "./service.ts";

// A friendly automatic name for a new passkey, derived from the current device
// and browser — so the learner never has to think one up.
function deviceName(): string {
  const ua =
    typeof navigator !== "undefined" ? navigator.userAgent : "";
  let os = "this device";
  if (/iPhone/.test(ua)) os = "iPhone";
  else if (/iPad/.test(ua)) os = "iPad";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "Mac";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "Chromebook";
  else if (/Linux/.test(ua)) os = "Linux";
  let br = "";
  if (/Edg\//.test(ua)) br = "Edge";
  else if (/OPR\//.test(ua)) br = "Opera";
  else if (/Chrome\//.test(ua)) br = "Chrome";
  else if (/Firefox\//.test(ua)) br = "Firefox";
  else if (/Safari\//.test(ua)) br = "Safari";
  return br ? `${br} on ${os}` : os === "this device" ? "This device" : os;
}

export function SecurityCard({
  user,
}: {
  readonly user: UserDetails;
}): ReactNode {
  const { formatMessage } = useIntl();

  // ── Passkeys ──
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkError, setPkError] = useState<string | null>(null);
  const [pkMsg, setPkMsg] = useState<string | null>(null);
  const supported = AccountService.passkeysSupported();

  useEffect(() => {
    AccountService.listPasskeys()
      .then(setPasskeys)
      .catch(() => {});
  }, []);

  const addPasskey = () => {
    // No naming prompt — pick a sensible name automatically and confirm after.
    setPkBusy(true);
    setPkError(null);
    setPkMsg(null);
    AccountService.registerPasskey(deviceName())
      .then(() => AccountService.listPasskeys().then(setPasskeys))
      .then(() =>
        setPkMsg(
          formatMessage({
            id: "security.passkey.added",
            defaultMessage: "Passkey added — you can now sign in with it.",
          }),
        ),
      )
      .catch((err) =>
        setPkError(
          err?.message ??
            formatMessage({
              id: "security.passkey.addError",
              defaultMessage: "Could not add a passkey.",
            }),
        ),
      )
      .finally(() => setPkBusy(false));
  };

  const removePasskey = (id: string) => {
    setPkBusy(true);
    setPkMsg(null);
    AccountService.deletePasskey(id)
      .then(setPasskeys)
      .catch(() => {})
      .finally(() => setPkBusy(false));
  };

  // ── Password (edited in a small dialog) ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  // ── Email (changed in a small two-step dialog) ──
  const [emOpen, setEmOpen] = useState(false);
  const [emDone, setEmDone] = useState(false);

  return (
    <>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="security.title"
          defaultMessage="Sign-in & security"
        />
      </h2>

      {/* Passkeys */}
      <div className={styles.prefCard}>
        <div className={styles.prefSect}>
          <FormattedMessage id="security.passkeys" defaultMessage="Passkeys" />
        </div>
        <p className={styles.note}>
          <FormattedMessage
            id="security.passkeys.note"
            defaultMessage="Sign in with your face, fingerprint or device PIN — no password to remember."
          />
        </p>
        {passkeys.map((pk) => (
          <div key={pk.id} className={styles.miniRow}>
            <span>{pk.name}</span>
            <button
              className={clsx(styles.link, styles.linkDanger)}
              disabled={pkBusy}
              onClick={() => removePasskey(pk.id)}
            >
              <FormattedMessage
                id="security.passkey.remove"
                defaultMessage="Remove"
              />
            </button>
          </div>
        ))}
        {pkError != null && <p className={styles.secErr}>{pkError}</p>}
        {pkMsg != null && <p className={styles.note}>{pkMsg}</p>}
        {!supported ? (
          <p className={styles.note}>
            <FormattedMessage
              id="security.passkey.unsupported"
              defaultMessage="This browser doesn't support passkeys."
            />
          </p>
        ) : (
          // Once a passkey exists we hide the add link — the learner already
          // has one and can remove it above to add a different one.
          passkeys.length === 0 && (
            <button
              type="button"
              className={clsx(styles.link, styles.rightAction)}
              disabled={pkBusy}
              onClick={addPasskey}
            >
              <FormattedMessage
                id="security.passkey.add"
                defaultMessage="Add a passkey"
              />
            </button>
          )
        )}
      </div>

      {/* Password — a link that opens a small dialog, worded for the state */}
      <div className={styles.prefCard}>
        <div className={styles.prefSect}>
          {user.hasPassword ? (
            <FormattedMessage
              id="security.password.change"
              defaultMessage="Change password"
            />
          ) : (
            <FormattedMessage
              id="security.password.set"
              defaultMessage="Set a password"
            />
          )}
        </div>
        <p className={styles.note}>
          {user.hasPassword ? (
            <FormattedMessage
              id="security.password.changeNote"
              defaultMessage="Update the password you use to sign in."
            />
          ) : (
            <FormattedMessage
              id="security.password.setNote"
              defaultMessage="Add a password so you can also sign in without a social account."
            />
          )}
        </p>
        <button
          type="button"
          className={clsx(styles.link, styles.rightAction)}
          onClick={() => {
            setPwDone(false);
            setPwOpen(true);
          }}
        >
          {user.hasPassword ? (
            <FormattedMessage
              id="security.password.change"
              defaultMessage="Change password"
            />
          ) : (
            <FormattedMessage
              id="security.password.set"
              defaultMessage="Set a password"
            />
          )}
        </button>
        {pwDone && (
          <p className={styles.note}>
            <FormattedMessage
              id="security.password.done"
              defaultMessage="Password updated."
            />
          </p>
        )}
      </div>

      {/* Email address */}
      <div className={styles.prefCard}>
        <div className={styles.prefSect}>
          <FormattedMessage
            id="security.email.label"
            defaultMessage="Email address"
          />
        </div>
        <div className={styles.miniRow}>
          <span>{user.email}</span>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setEmDone(false);
              setEmOpen(true);
            }}
          >
            <FormattedMessage
              id="security.email.change"
              defaultMessage="Change email"
            />
          </button>
        </div>
        {emDone && (
          <p className={styles.note}>
            <FormattedMessage
              id="security.email.done"
              defaultMessage="Email address updated."
            />
          </p>
        )}
      </div>

      {/* Connected accounts */}
      {user.externalId.length > 0 && (
        <div className={styles.prefCard}>
          <div className={styles.prefSect}>
            <FormattedMessage
              id="security.connected"
              defaultMessage="Connected sign-in methods"
            />
          </div>
          {user.externalId.map((x, i) => (
            <div key={i} className={styles.miniRow}>
              <span className={styles.provider}>{x.provider}</span>
              <span className={styles.miniMuted}>
                <FormattedMessage
                  id="security.connected.connected"
                  defaultMessage="connected"
                />
              </span>
            </div>
          ))}
        </div>
      )}

      {pwOpen && (
        <PasswordDialog
          hasPassword={user.hasPassword}
          onClose={() => setPwOpen(false)}
          onDone={() => {
            setPwOpen(false);
            setPwDone(true);
          }}
        />
      )}

      {emOpen && (
        <ChangeEmailDialog
          currentEmail={user.email}
          hasPassword={user.hasPassword}
          onClose={() => setEmOpen(false)}
          onDone={() => {
            setEmOpen(false);
            setEmDone(true);
          }}
        />
      )}
    </>
  );
}

// Two-step email change: enter the new address (a code is sent to it), then the
// code. Shares the confirmation-dialog styling.
function ChangeEmailDialog({
  currentEmail,
  hasPassword,
  onClose,
  onDone,
}: {
  readonly currentEmail: string;
  readonly hasPassword: boolean;
  readonly onClose: () => void;
  readonly onDone: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  // Password accounts go email → code. SSO accounts insert an "identity" step
  // in between: a code sent to the current email proves ownership.
  const [step, setStep] = useState<"email" | "identity" | "code">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [identityCode, setIdentityCode] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // From the email step: password accounts start the change immediately; SSO
  // accounts first get an identity code sent to their current email.
  const proceedFromEmail = () => {
    if (email.trim() === "" || busy || (hasPassword && password === "")) {
      return;
    }
    setBusy(true);
    setErr(null);
    if (hasPassword) {
      AccountService.changeEmail(email.trim(), { password })
        .then(() => setStep("code"))
        .catch((e) => setErr(e?.message ?? "Could not start the email change."))
        .finally(() => setBusy(false));
    } else {
      AccountService.sendChangeEmailIdentityCode()
        .then(() => setStep("identity"))
        .catch((e) => setErr(e?.message ?? "Could not send a code."))
        .finally(() => setBusy(false));
    }
  };

  const submitIdentity = () => {
    if (identityCode.trim().length !== 6 || busy) {
      return;
    }
    setBusy(true);
    setErr(null);
    AccountService.changeEmail(email.trim(), {
      identityCode: identityCode.trim(),
    })
      .then(() => setStep("code"))
      .catch((e) => setErr(e?.message ?? "That code is incorrect."))
      .finally(() => setBusy(false));
  };

  const confirm = () => {
    if (code.trim().length !== 6 || busy) {
      return;
    }
    setBusy(true);
    setErr(null);
    AccountService.verifyEmailChange(code.trim())
      .then(() => onDone())
      .catch((e) => setErr(e?.message ?? "That code is incorrect."))
      .finally(() => setBusy(false));
  };

  return (
    <div
      className={dlg.scrim}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={dlg.dialog} role="dialog" aria-modal={true}>
        <h2 className={dlg.title}>
          <FormattedMessage
            id="security.email.change"
            defaultMessage="Change email"
          />
        </h2>
        {step === "email" && (
          <>
            <p className={dlg.message}>
              {hasPassword ? (
                <FormattedMessage
                  id="security.email.intro"
                  defaultMessage="Enter your new email address — we'll send a code to it to confirm it's yours."
                />
              ) : (
                <FormattedMessage
                  id="security.email.introSso"
                  defaultMessage="Enter your new email address. First we'll send a code to your current email to confirm it's you."
                />
              )}
            </p>
            <TextField
              size="full"
              type="email"
              autoComplete="email"
              autoFocus={true}
              placeholder={formatMessage({
                id: "security.email.new",
                defaultMessage: "New email address",
              })}
              value={email}
              onChange={setEmail}
            />
            {hasPassword && (
              <PasswordField
                autoComplete="current-password"
                placeholder={formatMessage({
                  id: "security.email.password",
                  defaultMessage: "Your current password",
                })}
                value={password}
                onChange={setPassword}
              />
            )}
          </>
        )}
        {step === "identity" && (
          <>
            <p className={dlg.message}>
              <FormattedMessage
                id="security.email.identityIntro"
                defaultMessage="Enter the 6-digit code we sent to your current email, {email}."
                values={{ email: <strong>{currentEmail}</strong> }}
              />
            </p>
            <TextField
              size="full"
              type="text"
              autoComplete="one-time-code"
              autoFocus={true}
              maxLength={6}
              placeholder={formatMessage({
                id: "auth.verify.codePlaceholder",
                defaultMessage: "6-digit code",
              })}
              value={identityCode}
              onChange={(v) => setIdentityCode(v.replace(/\D/g, "").slice(0, 6))}
            />
          </>
        )}
        {step === "code" && (
          <>
            <p className={dlg.message}>
              <FormattedMessage
                id="security.email.codeIntro"
                defaultMessage="Enter the 6-digit code we sent to {email}."
                values={{ email: <strong>{email.trim()}</strong> }}
              />
            </p>
            <TextField
              size="full"
              type="text"
              autoComplete="one-time-code"
              autoFocus={true}
              maxLength={6}
              placeholder={formatMessage({
                id: "auth.verify.codePlaceholder",
                defaultMessage: "6-digit code",
              })}
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            />
          </>
        )}
        {err != null && <p className={styles.secErr}>{err}</p>}
        <div className={dlg.actions}>
          <button className={`${dlg.btn} ${dlg.cancel}`} onClick={onClose}>
            {formatMessage({ id: "t_Cancel", defaultMessage: "Cancel" })}
          </button>
          {step === "email" && (
            <button
              className={`${dlg.btn} ${dlg.confirm}`}
              disabled={
                email.trim() === "" ||
                busy ||
                (hasPassword && password === "")
              }
              onClick={proceedFromEmail}
            >
              <FormattedMessage
                id="security.email.continue"
                defaultMessage="Continue"
              />
            </button>
          )}
          {step === "identity" && (
            <button
              className={`${dlg.btn} ${dlg.confirm}`}
              disabled={identityCode.trim().length !== 6 || busy}
              onClick={submitIdentity}
            >
              <FormattedMessage
                id="security.email.verifyIdentity"
                defaultMessage="Verify it's me"
              />
            </button>
          )}
          {step === "code" && (
            <button
              className={`${dlg.btn} ${dlg.confirm}`}
              disabled={code.trim().length !== 6 || busy}
              onClick={confirm}
            >
              <FormattedMessage
                id="security.email.confirm"
                defaultMessage="Confirm email"
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// A small report-card-style dialog to set or change the password. Shares the
// confirmation-dialog styling so every dialog feels like one family.
function PasswordDialog({
  hasPassword,
  onClose,
  onDone,
}: {
  readonly hasPassword: boolean;
  readonly onClose: () => void;
  readonly onDone: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mismatch = confirm !== "" && confirm !== next;

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    if (next === "" || busy) {
      return;
    }
    if (next !== confirm) {
      setErr(
        formatMessage({
          id: "auth.passwordMismatch",
          defaultMessage: "The passwords don't match.",
        }),
      );
      return;
    }
    setBusy(true);
    setErr(null);
    AccountService.changePassword({
      currentPassword: hasPassword ? current : undefined,
      newPassword: next,
    })
      .then(() => onDone())
      .catch((e) => setErr(e?.message ?? "Could not change password."))
      .finally(() => setBusy(false));
  };

  return (
    <div
      className={dlg.scrim}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={dlg.dialog} role="dialog" aria-modal={true}>
        <h2 className={dlg.title}>
          {hasPassword ? (
            <FormattedMessage
              id="security.password.change"
              defaultMessage="Change password"
            />
          ) : (
            <FormattedMessage
              id="security.password.set"
              defaultMessage="Set a password"
            />
          )}
        </h2>
        {hasPassword && (
          <PasswordField
            autoComplete="current-password"
            placeholder={formatMessage({
              id: "security.password.current",
              defaultMessage: "Current password",
            })}
            value={current}
            onChange={setCurrent}
          />
        )}
        {hasPassword && (
          <a
            className={styles.forgotLink}
            href={Pages.forgotPassword.path}
          >
            <FormattedMessage
              id="security.password.forgot"
              defaultMessage="Forgot your current password?"
            />
          </a>
        )}
        <PasswordField
          autoComplete="new-password"
          placeholder={formatMessage({
            id: "security.password.new",
            defaultMessage: "New password (8+ characters)",
          })}
          value={next}
          onChange={setNext}
        />
        <PasswordStrength password={next} />
        <PasswordField
          autoComplete="new-password"
          placeholder={formatMessage({
            id: "auth.confirmPassword",
            defaultMessage: "Confirm password",
          })}
          value={confirm}
          onChange={setConfirm}
        />
        {mismatch && (
          <p className={styles.secErr}>
            <FormattedMessage
              id="auth.passwordMismatch"
              defaultMessage="The passwords don't match."
            />
          </p>
        )}
        {err != null && <p className={styles.secErr}>{err}</p>}
        <div className={dlg.actions}>
          <button className={`${dlg.btn} ${dlg.cancel}`} onClick={onClose}>
            {formatMessage({ id: "t_Cancel", defaultMessage: "Cancel" })}
          </button>
          <button
            className={`${dlg.btn} ${dlg.confirm}`}
            disabled={next === "" || busy || mismatch}
            onClick={save}
          >
            {formatMessage({
              id: "security.password.save",
              defaultMessage: "Update password",
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
