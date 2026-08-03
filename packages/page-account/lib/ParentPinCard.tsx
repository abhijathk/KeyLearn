import { type UserDetails } from "@keylearn/pages-shared";
import { TextField } from "@keylearn/widget";
import { type ReactNode, useState } from "react";
import * as styles from "./AccountPage.module.less";
import { PasswordField } from "./AuthPage.tsx";
import { AccountService } from "./service.ts";

/**
 * The grown-up PIN.
 *
 * On a shared family tablet the account usually stays signed in, so "signed in"
 * cannot mean "allowed to delete a learner". This PIN is checked by the server
 * on every profile change, which the on-screen sums gate never was.
 */
export function ParentPinCard({
  user,
  onChanged,
}: {
  readonly user: UserDetails;
  readonly onChanged: () => void;
}): ReactNode {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm !== "" && pin !== confirm;
  const valid = /^\d{4,8}$/.test(pin) && pin === confirm;

  const save = async (next: string | null) => {
    setErr(null);
    setBusy(true);
    try {
      await AccountService.setParentPin({
        pin: next,
        ...(user.parentPinSet
          ? currentPin !== ""
            ? { currentPin }
            : { password }
          : {}),
      });
      setPin("");
      setConfirm("");
      setCurrentPin("");
      setPassword("");
      setDone(true);
      onChanged();
    } catch (e: any) {
      setErr(e?.body?.error?.message ?? "Could not save the PIN.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>Grown-up PIN</div>
      <p className={styles.prefHint}>
        Ask for a PIN before anyone can add, change or delete a learner profile.
        Useful on a device the children also use.
      </p>

      {user.parentPinSet && (
        <>
          <p className={styles.note}>A grown-up PIN is set.</p>
          <p className={styles.prefHint}>
            To change or remove it, confirm with the current PIN
            {user.hasPassword ? " or your password" : ""}.
          </p>
          <TextField
            size="full"
            type="password"
            placeholder="Current PIN"
            value={currentPin}
            onChange={setCurrentPin}
          />
          {user.hasPassword && (
            <PasswordField
              placeholder="…or your password"
              value={password}
              autoComplete="current-password"
              onChange={setPassword}
            />
          )}
        </>
      )}

      <TextField
        size="full"
        type="password"
        placeholder={
          user.parentPinSet ? "New PIN (4-8 digits)" : "PIN (4-8 digits)"
        }
        value={pin}
        onChange={(v) => {
          setPin(v.replace(/\D/g, "").slice(0, 8));
          setDone(false);
        }}
      />
      <TextField
        size="full"
        type="password"
        placeholder="Repeat the PIN"
        value={confirm}
        onChange={(v) => setConfirm(v.replace(/\D/g, "").slice(0, 8))}
      />
      {mismatch && <p className={styles.secErr}>The PINs don&rsquo;t match.</p>}
      {err != null && <p className={styles.secErr}>{err}</p>}
      {done && <p className={styles.note}>Saved.</p>}

      <div className={styles.secActions}>
        <button
          type="button"
          className={styles.secBtn}
          disabled={busy || !valid}
          onClick={() => save(pin)}
        >
          {user.parentPinSet ? "Change PIN" : "Set PIN"}
        </button>
        {user.parentPinSet && (
          <button
            type="button"
            className={styles.subtleBtnDanger}
            disabled={busy || (currentPin === "" && password === "")}
            onClick={() => save(null)}
          >
            Remove PIN
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Asks for the grown-up PIN when the server says one is needed. Shown in
 * response to a 428, so the prompt appears exactly when it is required rather
 * than on every visit.
 */
export function ParentPinPrompt({
  onPass,
  onCancel,
}: {
  readonly onPass: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await AccountService.verifyParentPin(pin);
      onPass();
    } catch (e: any) {
      setErr(e?.body?.error?.message ?? "That PIN is not right.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>Grown-ups only</div>
      <p className={styles.prefHint}>
        Enter the grown-up PIN to manage learner profiles.
      </p>
      <TextField
        size="full"
        type="password"
        placeholder="PIN"
        value={pin}
        onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 8))}
      />
      {err != null && <p className={styles.secErr}>{err}</p>}
      <div className={styles.secActions}>
        <button
          type="button"
          className={styles.secBtn}
          disabled={busy || pin.length < 4}
          onClick={submit}
        >
          Continue
        </button>
        <button type="button" className={styles.link} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
