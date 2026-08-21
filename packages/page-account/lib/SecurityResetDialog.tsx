import { FloatingShell, PinField } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./SecurityResetDialog.module.less";
import { AccountService } from "./service.ts";

/**
 * The way back in when the grown-up PIN, the authenticator, or the
 * recovery codes are gone.
 *
 * Two steps, and the order matters: choose what to reset, *then* ask for
 * a code. The server records the choice before the code goes out, so the
 * code can only perform what was asked for — a code obtained for "clear
 * the PIN" cannot later be spent turning off two-step verification.
 *
 * Nothing here can take an account over. The password is not set from
 * this dialog, only offered by the ordinary reset link, and the email
 * address is untouched — so the worst an intruder holding a signed-in
 * session can do is lock themselves out of the factors and leave a
 * message in the owner's inbox saying so.
 */
export function SecurityResetDialog({
  onClose,
  onDone,
}: {
  readonly onClose: () => void;
  /** Something was actually reset — the caller re-reads the account. */
  readonly onDone: () => void;
}): ReactNode {
  // Not renamed: the extractor finds messages by the name of the call,
  // and an aliased `fm(...)` leaves them out of the catalogue — where a
  // missing id renders as its hash in front of the user.
  const { formatMessage } = useIntl();
  const [options, setOptions] =
    useState<AccountService.SecurityResetOptions | null>(null);
  const [scope, setScope] = useState({
    password: false,
    twoFactor: false,
    recoveryCodes: false,
    parentPin: false,
  });
  const [step, setStep] = useState<"choose" | "code" | "done">("choose");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<readonly string[]>([]);

  useEffect(() => {
    AccountService.getSecurityResetOptions()
      .then((o) => {
        setOptions(o);
        // Pre-ticked, because it is overwhelmingly why anybody opens this
        // — and still shown, so it is never reset without being seen.
        setScope((s) => ({ ...s, parentPin: o.parentPin.available }));
      })
      .catch(() =>
        setErr(
          formatMessage({
            id: "sec.reset.loadFailed",
            defaultMessage: "We couldn't load your security settings just now.",
          }),
        ),
      );
  }, [formatMessage]);

  const chosen = Object.values(scope).some(Boolean);

  const sendCode = async () => {
    setBusy(true);
    setErr(null);
    try {
      await AccountService.sendSecurityResetCode(scope);
      setStep("code");
    } catch {
      setErr(
        formatMessage({
          id: "sec.reset.sendFailed",
          defaultMessage: "We couldn't send the code. Try again in a moment.",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await AccountService.confirmSecurityReset(value);
      setDone(result.done);
      setStep("done");
      onDone();
    } catch {
      setCode("");
      setErr(
        formatMessage({
          id: "sec.reset.wrongCode",
          defaultMessage: "That code is not right, or it has expired.",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingShell
      title={formatMessage({
        id: "sec.reset.title",
        defaultMessage: "Reset security settings",
      })}
      onClose={onClose}
    >
      <div className={styles.box}>
        {step === "choose" && (
          <>
            <p className={styles.lead}>
              <FormattedMessage
                id="sec.reset.lead"
                defaultMessage="Choose what to reset. We'll email a code to {email} to confirm it's you."
                values={{
                  email: <strong>{options?.email ?? "…"}</strong>,
                }}
              />
            </p>

            <div className={styles.rows}>
              <Row
                on={scope.parentPin}
                available={options?.parentPin.available ?? false}
                onToggle={(v) => setScope((s) => ({ ...s, parentPin: v }))}
                label={
                  <FormattedMessage
                    id="sec.reset.pin"
                    defaultMessage="Clear the grown-up PIN"
                  />
                }
                note={
                  (options?.parentPin.set ?? false) ? (
                    <FormattedMessage
                      id="sec.reset.pinSet"
                      defaultMessage="You can set a new one afterwards."
                    />
                  ) : (
                    <FormattedMessage
                      id="sec.reset.pinNone"
                      defaultMessage="No PIN is set."
                    />
                  )
                }
              />
              <Row
                on={scope.twoFactor}
                available={options?.twoFactor.available ?? false}
                onToggle={(v) => setScope((s) => ({ ...s, twoFactor: v }))}
                label={
                  <FormattedMessage
                    id="sec.reset.2fa"
                    defaultMessage="Turn off two-step verification"
                  />
                }
                note={
                  (options?.twoFactor.enabled ?? false) ? (
                    <FormattedMessage
                      id="sec.reset.2faOn"
                      defaultMessage="For a lost or wiped authenticator app. Your recovery codes go with it."
                    />
                  ) : (
                    <FormattedMessage
                      id="sec.reset.2faOff"
                      defaultMessage="Not turned on."
                    />
                  )
                }
              />
              <Row
                on={scope.recoveryCodes}
                // Pointless once two-step is going: that already voids them.
                available={
                  (options?.recoveryCodes.available ?? false) &&
                  !scope.twoFactor
                }
                onToggle={(v) => setScope((s) => ({ ...s, recoveryCodes: v }))}
                label={
                  <FormattedMessage
                    id="sec.reset.codes"
                    defaultMessage="Void your recovery codes"
                  />
                }
                note={
                  scope.twoFactor ? (
                    <FormattedMessage
                      id="sec.reset.codesWith2fa"
                      defaultMessage="Included with turning two-step off."
                    />
                  ) : (options?.recoveryCodes.left ?? 0) > 0 ? (
                    <FormattedMessage
                      id="sec.reset.codesLeft"
                      defaultMessage="{left, plural, one {# unused code} other {# unused codes}}. Keeps two-step on."
                      values={{ left: options?.recoveryCodes.left ?? 0 }}
                    />
                  ) : (
                    <FormattedMessage
                      id="sec.reset.codesNone"
                      defaultMessage="No codes to void."
                    />
                  )
                }
              />
              <Row
                on={scope.password}
                available={options?.password.available ?? false}
                onToggle={(v) => setScope((s) => ({ ...s, password: v }))}
                label={
                  (options?.password.hasPassword ?? false) ? (
                    <FormattedMessage
                      id="sec.reset.pwdChange"
                      defaultMessage="Send a link to set a new password"
                    />
                  ) : (
                    <FormattedMessage
                      id="sec.reset.pwdSet"
                      defaultMessage="Send a link to set a password"
                    />
                  )
                }
                note={
                  (options?.password.hasPassword ?? false) ? (
                    <FormattedMessage
                      id="sec.reset.pwdNote"
                      defaultMessage="Your current password keeps working until you use the link."
                    />
                  ) : (
                    <FormattedMessage
                      id="sec.reset.pwdNoteSso"
                      defaultMessage="You sign in with Google or Microsoft. A password is a second way in."
                    />
                  )
                }
              />
            </div>

            {err != null && <p className={styles.err}>{err}</p>}

            <div className={styles.actions}>
              <button type="button" className={styles.ghost} onClick={onClose}>
                <FormattedMessage
                  id="sec.reset.cancel"
                  defaultMessage="Cancel"
                />
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={!chosen || busy}
                onClick={() => void sendCode()}
              >
                <FormattedMessage
                  id="sec.reset.send"
                  defaultMessage="Email me a code"
                />
              </button>
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <p className={styles.lead}>
              <FormattedMessage
                id="sec.reset.codeLead"
                defaultMessage="Enter the 6-digit code we sent to {email}. It lists exactly what will change."
                values={{ email: <strong>{options?.email ?? "…"}</strong> }}
              />
            </p>
            <div className={styles.codeRow}>
              <PinField
                value={code}
                length={6}
                onChange={setCode}
                onComplete={(value) => void confirm(value)}
                disabled={busy}
                reveal={true}
              />
            </div>
            {err != null && <p className={styles.err}>{err}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  setErr(null);
                  setCode("");
                  setStep("choose");
                }}
              >
                <FormattedMessage id="sec.reset.back" defaultMessage="Back" />
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <p className={styles.lead}>
              <FormattedMessage
                id="sec.reset.doneLead"
                defaultMessage="Done. These were reset:"
              />
            </p>
            <ul className={styles.doneList}>
              {done.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className={styles.note}>
              <FormattedMessage
                id="sec.reset.doneNote"
                defaultMessage="Anyone else signed in to this account has been signed out. You're still signed in here."
              />
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={onClose}
              >
                <FormattedMessage id="sec.reset.close" defaultMessage="Close" />
              </button>
            </div>
          </>
        )}
      </div>
    </FloatingShell>
  );
}

/**
 * One thing that can be reset.
 *
 * An unavailable row stays visible rather than disappearing: "Not turned
 * on" is the answer to the question somebody opened this dialog with, and
 * a row that is simply absent reads as a bug.
 */
function Row({
  on,
  available,
  onToggle,
  label,
  note,
}: {
  readonly on: boolean;
  readonly available: boolean;
  readonly onToggle: (on: boolean) => void;
  readonly label: ReactNode;
  readonly note: ReactNode;
}): ReactNode {
  return (
    <label
      className={available ? styles.row : `${styles.row} ${styles.rowOff}`}
    >
      <input
        type="checkbox"
        checked={on && available}
        disabled={!available}
        onChange={(ev) => onToggle(ev.target.checked)}
      />
      <span>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowNote}>{note}</span>
      </span>
    </label>
  );
}
