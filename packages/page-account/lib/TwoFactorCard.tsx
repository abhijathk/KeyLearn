import { useIntlDates } from "@keylearn/intl";
import {
  downloadBlob,
  exportFilename,
  type UserDetails,
} from "@keylearn/pages-shared";
import { FloatingShell, StrokeIcon, TextField } from "@keylearn/widget";
import { toDataURL } from "qrcode";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AccountPage.module.less";
import { PasswordField } from "./AuthPage.tsx";
import { AccountService } from "./service.ts";

/**
 * Two-step verification.
 *
 * Setup is deliberately three screens: scan, confirm, then keep the recovery
 * codes. Confirming before it is switched on means a mistyped secret cannot
 * lock anyone out, and the codes are shown once — losing a phone should not
 * mean losing the account.
 */
export function TwoFactorCard({
  user,
  onChanged,
}: {
  readonly user: UserDetails;
  readonly onChanged: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="sec.2fa.title"
          defaultMessage="Two-step verification"
        />
      </div>
      <div className={styles.miniRow}>
        <p className={styles.note}>
          {user.twoFactorEnabled ? (
            <FormattedMessage
              id="sec.2fa.on"
              defaultMessage="Two-step verification is on."
            />
          ) : (
            <FormattedMessage
              id="sec.2fa.off"
              defaultMessage="Two-step verification is off."
            />
          )}
        </p>
        <button
          type="button"
          className={styles.secBtn}
          onClick={() => setOpen(true)}
        >
          {user.twoFactorEnabled ? (
            <FormattedMessage id="sec.2fa.manage" defaultMessage="Manage" />
          ) : (
            <FormattedMessage
              id="sec.2fa.turnOnBtn"
              defaultMessage="Turn it on"
            />
          )}
        </button>
      </div>

      {open && (
        <FloatingShell
          title={formatMessage({
            id: "sec.2fa.title",
            defaultMessage: "Two-step verification",
          })}
          onClose={() => setOpen(false)}
        >
          <TwoFactorWindow user={user} onChanged={onChanged} />
        </FloatingShell>
      )}
    </div>
  );
}

function TwoFactorWindow({
  user,
  onChanged,
}: {
  readonly user: UserDetails;
  readonly onChanged: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatStamp } = useIntlDates();
  const [step, setStep] = useState<"idle" | "scan" | "codes">("idle");
  const [uri, setUri] = useState("");
  const [secret, setSecret] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Rendered client-side from the otpauth URI so a phone can scan it — the
  // "open in app" link below only helps when the browser and the
  // authenticator are on the same device.
  useEffect(() => {
    if (uri === "") {
      setQrCode(null);
      return;
    }
    let cancelled = false;
    toDataURL(uri, { margin: 1, width: 200 })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrCode(dataUrl);
        }
      })
      .catch(() => {
        // No QR code is not fatal: the secret key and "open in app" link
        // below still let setup finish.
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const begin = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { uri, secret } = await AccountService.twoFactorBegin();
      setUri(uri);
      setSecret(secret);
      setStep("scan");
    } catch (e: any) {
      setErr(e?.body?.error?.message ?? "Could not start setup.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setErr(null);
    setBusy(true);
    try {
      setCodes(await AccountService.twoFactorEnable(code));
      setCode("");
      setStep("codes");
      onChanged();
    } catch (e: any) {
      setErr(e?.body?.error?.message ?? "That code is not right.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setErr(null);
    setBusy(true);
    try {
      await AccountService.twoFactorDisable(
        user.hasPassword ? { password } : { code },
      );
      setPassword("");
      setCode("");
      onChanged();
    } catch (e: any) {
      setErr(e?.body?.error?.message ?? "Could not turn it off.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.pinWindow}>
      {user.twoFactorEnabled && step !== "codes" ? (
        <>
          <p className={styles.note}>
            <FormattedMessage
              id="sec.2fa.on"
              defaultMessage="Two-step verification is on."
            />
          </p>
          {user.hasPassword ? (
            <PasswordField
              placeholder={formatMessage({
                id: "sec.yourPassword",
                defaultMessage: "Your password",
              })}
              value={password}
              autoComplete="current-password"
              onChange={setPassword}
            />
          ) : (
            <TextField
              size="full"
              placeholder={formatMessage({
                id: "sec.2fa.currentCode",
                defaultMessage: "Current 6-digit code",
              })}
              value={code}
              onChange={setCode}
            />
          )}
          {err != null && <p className={styles.secErr}>{err}</p>}
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={
              busy || (user.hasPassword ? password === "" : code === "")
            }
            onClick={disable}
          >
            <FormattedMessage
              id="sec.2fa.turnOff"
              defaultMessage="Turn off two-step verification"
            />
          </button>
        </>
      ) : step === "idle" ? (
        <>
          {err != null && <p className={styles.secErr}>{err}</p>}
          <button
            type="button"
            className={styles.secBtn}
            disabled={busy}
            onClick={begin}
          >
            <FormattedMessage
              id="sec.2fa.setUp"
              defaultMessage="Set up two-step verification"
            />
          </button>
        </>
      ) : step === "scan" ? (
        <>
          <p className={styles.prefHint}>
            <FormattedMessage
              id="sec.2fa.scan"
              defaultMessage="Scan this code with your authenticator app — 1Password, Bitwarden, Google Authenticator, Aegis, or whichever you use — or add the key below by hand, then type the 6-digit code it shows."
            />
          </p>
          {qrCode != null && (
            <img
              className={styles.qrCode}
              src={qrCode}
              width={200}
              height={200}
              alt={formatMessage({
                id: "sec.2fa.qrAlt",
                defaultMessage:
                  "QR code for two-step verification setup — scan it, or use the key below instead",
              })}
            />
          )}
          <div className={styles.secretKeyRow}>
            <code className={styles.secretKey}>{secret}</code>
            <button
              type="button"
              className={styles.copyKeyBtn}
              title={formatMessage({
                id: "sec.2fa.copyKey",
                defaultMessage: "Copy key",
              })}
              onClick={() => {
                void navigator.clipboard?.writeText(secret);
              }}
            >
              <StrokeIcon name="copy" />
            </button>
          </div>
          <TextField
            size="full"
            placeholder={formatMessage({
              id: "sec.2fa.code",
              defaultMessage: "6-digit code",
            })}
            value={code}
            onChange={setCode}
          />
          {err != null && <p className={styles.secErr}>{err}</p>}
          <button
            type="button"
            className={styles.secBtn}
            disabled={busy || code.length < 6}
            onClick={confirm}
          >
            <FormattedMessage
              id="sec.2fa.confirm"
              defaultMessage="Confirm and turn on"
            />
          </button>
        </>
      ) : (
        <>
          <p className={styles.note}>
            <FormattedMessage
              id="sec.2fa.codesNote"
              defaultMessage="Two-step verification is on. Keep these recovery codes somewhere safe — each one signs you in once if you lose your phone. They are shown only now."
            />
          </p>
          <ul className={styles.recoveryCodes}>
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            className={styles.secBtn}
            onClick={() => {
              const blob = new Blob([codes.join("\n") + "\n"], {
                type: "text/plain",
              });
              // Recovery codes are regenerated, so the date is what tells the
              // current set from the one saved before it was rotated.
              downloadBlob(
                blob,
                exportFilename(
                  "recovery-codes",
                  user.name,
                  "txt",
                  formatStamp(Date.now()),
                ),
              );
            }}
          >
            <FormattedMessage
              id="sec.2fa.download"
              defaultMessage="Download codes"
            />
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => setStep("idle")}
          >
            <FormattedMessage
              id="sec.2fa.saved"
              defaultMessage="I’ve saved them"
            />
          </button>
        </>
      )}
    </div>
  );
}
