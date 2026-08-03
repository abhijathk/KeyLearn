import { useIntlDates } from "@keylearn/intl";
import {
  downloadBlob,
  exportFilename,
  type UserDetails,
} from "@keylearn/pages-shared";
import { TextField } from "@keylearn/widget";
import { type ReactNode, useState } from "react";
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
  const { formatStamp } = useIntlDates();
  const [step, setStep] = useState<"idle" | "scan" | "codes">("idle");
  const [uri, setUri] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>Two-step verification</div>
      <p className={styles.prefHint}>
        Ask for a code from an authenticator app as well as your password, so a
        stolen password is not enough on its own.
      </p>

      {user.twoFactorEnabled && step !== "codes" ? (
        <>
          <p className={styles.note}>Two-step verification is on.</p>
          {user.hasPassword ? (
            <PasswordField
              placeholder="Your password"
              value={password}
              autoComplete="current-password"
              onChange={setPassword}
            />
          ) : (
            <TextField
              size="full"
              placeholder="Current 6-digit code"
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
            Turn off two-step verification
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
            Set up two-step verification
          </button>
        </>
      ) : step === "scan" ? (
        <>
          <p className={styles.prefHint}>
            Add this key to your authenticator app — 1Password, Bitwarden,
            Google Authenticator, Aegis, or whichever you use — then type the
            6-digit code it shows.
          </p>
          <code className={styles.secretKey}>{secret}</code>
          <div className={styles.secActions}>
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                void navigator.clipboard?.writeText(secret);
              }}
            >
              Copy key
            </button>
            {/* Opens the authenticator directly, which beats scanning a QR
                shown on the same screen you are already using. */}
            <a className={styles.link} href={uri}>
              Open in authenticator app
            </a>
          </div>
          <TextField
            size="full"
            placeholder="6-digit code"
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
            Confirm and turn on
          </button>
        </>
      ) : (
        <>
          <p className={styles.note}>
            Two-step verification is on. Keep these recovery codes somewhere
            safe — each one signs you in once if you lose your phone. They are
            shown only now.
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
            Download codes
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => setStep("idle")}
          >
            I&rsquo;ve saved them
          </button>
        </>
      )}
    </div>
  );
}
