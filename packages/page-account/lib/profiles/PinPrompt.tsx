import { Button } from "@keylearn/widget";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Profiles.module.less";

/**
 * Asks for the grown-up PIN before a change to a learner goes through.
 *
 * The server has always required this on an account that has set a PIN —
 * adding, editing and deleting a learner all sit behind it, which is right:
 * these are the controls a child should not be able to reach by picking up the
 * tablet. What was missing was anybody asking. The request came back 428, the
 * provider logged it, and the parent saw a Save button that did nothing at all.
 *
 * Deliberately not a route or a page. The parent is mid-edit with a form full
 * of their answers; sending them somewhere to prove themselves and back again
 * would lose the lot. They prove it here and the save they already asked for
 * completes on its own.
 */
export function PinPrompt({
  onProve,
  onCancel,
}: {
  readonly onProve: (pin: string) => Promise<boolean>;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async () => {
    if (busy || pin === "") {
      return;
    }
    setBusy(true);
    setWrong(false);
    const ok = await onProve(pin);
    setBusy(false);
    if (ok) {
      return; // The held save is already running; this closes with it.
    }
    setWrong(true);
    setPin("");
  };

  return (
    <div className={styles.gate}>
      <div className={styles.gateCard}>
        <h2 className={styles.editorTitle}>
          <FormattedMessage
            id="profiles.pin.title"
            defaultMessage="Grown-up PIN"
          />
        </h2>
        <p className={styles.editorHint}>
          <FormattedMessage
            id="profiles.pin.why"
            defaultMessage="Changing a learner needs the grown-up PIN. You'll only be asked once."
          />
        </p>
        <input
          className={styles.field}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          // The parent is already here to do this; not focusing it would mean
          // a click before they can start typing.
          autoFocus={true}
          value={pin}
          disabled={busy}
          aria-label={formatMessage({
            id: "profiles.pin.title",
            defaultMessage: "Grown-up PIN",
          })}
          onChange={(ev) => {
            setPin(ev.target.value);
            setWrong(false);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              void submit();
            }
          }}
        />
        {wrong && (
          <p className={styles.gateWrong}>
            <FormattedMessage
              id="profiles.pin.wrong"
              defaultMessage="That's not the PIN. Try again."
            />
          </p>
        )}
        <div className={styles.gateActions}>
          <Button
            size={16}
            label={formatMessage({ id: "t_Cancel", defaultMessage: "Cancel" })}
            onClick={onCancel}
          />
          <Button
            size={16}
            disabled={busy || pin === ""}
            label={formatMessage({
              id: "profiles.pin.confirm",
              defaultMessage: "Continue",
            })}
            onClick={() => void submit()}
          />
        </div>
      </div>
    </div>
  );
}
