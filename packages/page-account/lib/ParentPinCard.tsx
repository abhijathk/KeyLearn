import { type UserDetails } from "@keylearn/pages-shared";
import { FloatingShell, PinField } from "@keylearn/widget";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
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
  const { formatMessage: fm } = useIntl();
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLDivElement | null>(null);

  // Support sends people here when they have no PIN yet. Landing on the
  // Security pane is only half the journey — the card is below the fold,
  // and "set one up in Security" with nothing visibly about a PIN is a
  // dead end.
  useEffect(() => {
    if (window.sessionStorage.getItem(SCROLL_TO_PIN) == null) {
      return;
    }
    window.sessionStorage.removeItem(SCROLL_TO_PIN);
    card.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    setOpen(true);
  }, []);

  return (
    <div className={styles.prefCard} ref={card}>
      <div className={styles.prefSect}>
        <FormattedMessage id="sec.pin.title" defaultMessage="Grown-up PIN" />
      </div>
      {/* One row, note left and action right — the same shape the password
          and email cards use, so the column of them lines up. */}
      <div className={styles.miniRow}>
        <p className={styles.note}>
          {user.parentPinSet ? (
            <FormattedMessage
              id="sec.pin.isSet"
              defaultMessage="A {n}-digit PIN is set."
              values={{ n: user.parentPinLength ?? 4 }}
            />
          ) : (
            <FormattedMessage
              id="sec.pin.notSet"
              defaultMessage="No PIN is set."
            />
          )}
        </p>
        <button
          type="button"
          className={styles.secBtn}
          onClick={() => setOpen(true)}
        >
          {user.parentPinSet ? (
            <FormattedMessage
              id="sec.pin.manage"
              defaultMessage="Change or remove"
            />
          ) : (
            <FormattedMessage id="sec.pin.setCard" defaultMessage="Set a PIN" />
          )}
        </button>
      </div>

      {open && (
        <FloatingShell
          title={fm({ id: "sec.pin.title", defaultMessage: "Grown-up PIN" })}
          onClose={() => setOpen(false)}
        >
          <PinWindow
            user={user}
            onChanged={onChanged}
            onDone={() => setOpen(false)}
          />
        </FloatingShell>
      )}
    </div>
  );
}

/** Where support sends somebody who has to make a PIN before writing in. */
export const SCROLL_TO_PIN = "keylearn.security.scrollToPin";

function PinWindow({
  user,
  onChanged,
  onDone,
}: {
  readonly user: UserDetails;
  readonly onChanged: () => void;
  readonly onDone: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  /**
   * How long the new PIN will be. Chosen up front rather than inferred
   * from typing, because the boxes have to exist before there is anything
   * to count — and because deciding "four or six" is a different thought
   * from choosing the digits.
   */
  const [size, setSize] = useState(user.parentPinLength ?? 4);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm !== "" && pin !== confirm;
  const valid = pin.length === size && pin === confirm;

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
      onDone();
    } catch (e: any) {
      setErr(e?.body?.error?.message ?? "Could not save the PIN.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.pinWindow}>
      {user.parentPinSet && (
        <p className={styles.note}>
          {user.hasPassword ? (
            <FormattedMessage
              id="sec.pin.setBoth"
              defaultMessage="A PIN is set. Confirm with it, or your password, to change or remove it."
            />
          ) : (
            <FormattedMessage
              id="sec.pin.setPinOnly"
              defaultMessage="A PIN is set. Confirm with it to change or remove it."
            />
          )}
        </p>
      )}

      {/* Label and control on one line each. Stacked captions turned four
          fields into eleven rows of mostly empty card. */}
      <div className={styles.pinRows}>
        {user.parentPinSet && (
          <>
            <span className={styles.pinLabel}>
              <FormattedMessage
                id="sec.pin.current"
                defaultMessage="Current PIN"
              />
            </span>
            <PinField
              value={currentPin}
              length={user.parentPinLength}
              onChange={setCurrentPin}
              autoFocus={false}
            />

            {user.hasPassword && (
              <>
                <span className={styles.pinLabel}>
                  <FormattedMessage
                    id="sec.pin.orPassword"
                    defaultMessage="…or your password"
                  />
                </span>
                <PasswordField
                  placeholder=""
                  value={password}
                  autoComplete="current-password"
                  onChange={setPassword}
                />
              </>
            )}
          </>
        )}

        <span className={styles.pinLabel}>
          <FormattedMessage id="sec.pin.howLong" defaultMessage="Digits" />
        </span>
        <div className={styles.pinSizes}>
          {[4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              className={n === size ? styles.pinSizeOn : styles.pinSize}
              aria-pressed={n === size}
              onClick={() => {
                setSize(n);
                // The boxes change shape underneath; anything half-typed
                // into the old ones is not the PIN they mean.
                setPin("");
                setConfirm("");
                setDone(false);
              }}
            >
              {n}
            </button>
          ))}
        </div>

        <span className={styles.pinLabel}>
          {user.parentPinSet ? (
            <FormattedMessage id="sec.pin.new" defaultMessage="New PIN" />
          ) : (
            <FormattedMessage
              id="sec.pin.fresh"
              defaultMessage="Choose a PIN"
            />
          )}
        </span>
        <PinField
          value={pin}
          length={size}
          autoFocus={false}
          onChange={(v) => {
            setPin(v);
            setDone(false);
          }}
        />

        <span className={styles.pinLabel}>
          <FormattedMessage id="sec.pin.repeat" defaultMessage="Repeat it" />
        </span>
        <PinField
          value={confirm}
          length={size}
          autoFocus={false}
          onChange={setConfirm}
        />
      </div>

      {mismatch && (
        <p className={styles.secErr}>
          <FormattedMessage
            id="sec.pin.mismatch"
            defaultMessage="The PINs don’t match."
          />
        </p>
      )}
      {err != null && <p className={styles.secErr}>{err}</p>}
      {done && (
        <p className={styles.note}>
          <FormattedMessage id="sec.saved" defaultMessage="Saved." />
        </p>
      )}

      <div className={styles.secActions}>
        <button
          type="button"
          className={styles.secBtn}
          disabled={busy || !valid}
          onClick={() => save(pin)}
        >
          {user.parentPinSet ? (
            <FormattedMessage id="sec.pin.change" defaultMessage="Change PIN" />
          ) : (
            <FormattedMessage id="sec.pin.setBtn" defaultMessage="Set PIN" />
          )}
        </button>
        {user.parentPinSet && (
          <button
            type="button"
            className={styles.subtleBtnDanger}
            disabled={busy || (currentPin === "" && password === "")}
            onClick={() => save(null)}
          >
            <FormattedMessage id="sec.pin.remove" defaultMessage="Remove PIN" />
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
  length,
  onPass,
  onCancel,
}: {
  /** One box per digit; null falls back to a single free-length field. */
  readonly length: number | null;
  readonly onPass: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
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
      <div className={styles.prefSect}>
        <FormattedMessage
          id="sec.pin.gateTitle"
          defaultMessage="Grown-ups only"
        />
      </div>
      <p className={styles.prefHint}>
        <FormattedMessage
          id="sec.pin.gateIntro"
          defaultMessage="Enter the grown-up PIN to manage learner profiles."
        />
      </p>
      <PinField
        value={pin}
        length={length}
        onChange={setPin}
        onComplete={() => void submit()}
        disabled={busy}
      />
      {err != null && <p className={styles.secErr}>{err}</p>}
      <div className={styles.secActions}>
        <button
          type="button"
          className={styles.secBtn}
          disabled={busy || pin.length < (length ?? 4)}
          onClick={submit}
        >
          <FormattedMessage id="sec.continue" defaultMessage="Continue" />
        </button>
        <button type="button" className={styles.link} onClick={onCancel}>
          <FormattedMessage id="sec.cancel" defaultMessage="Cancel" />
        </button>
      </div>
    </div>
  );
}
