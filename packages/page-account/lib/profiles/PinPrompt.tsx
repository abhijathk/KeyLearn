import { usePageData } from "@keylearn/pages-shared";
import { Button, PinField } from "@keylearn/widget";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Overlay } from "../Overlay.tsx";
import * as styles from "./Profiles.module.less";

/**
 * Asks for the grown-up PIN before a change to a learner goes through.
 *
 * The server has always required this on an account that has set a PIN —
 * adding, editing and deleting a learner all sit behind it, which is right:
 * these are the controls a child should not reach by picking up the tablet.
 * What was missing was anybody asking. The request came back 428, the provider
 * logged it, and the parent saw a Save button that did nothing at all.
 *
 * Deliberately not a route or a page. The parent is mid-edit with a form full
 * of their answers; sending them somewhere to prove themselves and back again
 * would lose the lot. They prove it here and the save they already asked for
 * completes on its own.
 *
 * ## Boxes, not a text field
 *
 * `PinField` is the same component the account's own PIN screens use, so this
 * looks and behaves like every other place the app asks for the PIN rather
 * than like a password box that happens to want digits. It also means the
 * number of boxes follows the PIN that was actually set — four to six — rather
 * than a guess made here.
 *
 * And it submits when the last box is filled. Somebody who has typed all the
 * digits has finished answering; a Continue button after that is a second
 * thing to press for no further information.
 */
export function PinPrompt({
  onProve,
  onCancel,
}: {
  readonly onProve: (pin: string) => Promise<boolean>;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { user } = usePageData();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async (value: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setWrong(false);
    const ok = await onProve(value);
    setBusy(false);
    if (ok) {
      return; // The held save is already running; this closes with it.
    }
    setWrong(true);
    setPin("");
  };

  return (
    // The same Overlay the editor uses, and for the same reason: it portals to
    // the body, so an in-tree dialog can never sit above it however it is
    // ordered or z-indexed. This one asks about the form behind it, so it has
    // to be the one on top — which is what the explicit z-index below settles,
    // rather than leaving it to which portal happened to mount last.
    <Overlay onClose={onCancel}>
      <div className={styles.pinGate}>
        <div className={styles.pinCard}>
          {/* The same lock and the same shape of sentence as the account's own
            PIN screen. Boxes alone say "type digits here" but not which digits
            or why they are being asked for, and somebody who pressed Save on a
            learner has no reason to expect a PIN at all. */}
          <svg
            className={styles.pinLock}
            viewBox="0 0 24 24"
            aria-hidden={true}
          >
            <path d="M7 10V7a5 5 0 0 1 10 0v3" />
            <rect x="4.6" y="10" width="14.8" height="10.4" rx="2.4" />
          </svg>
          {/* A div, not a paragraph. Something in the global stylesheet targets
              `p` more specifically than a module class can, so its 1em margins
              survived both `.pinAsk { margin: 0 }` and the card's own
              `> * { margin: 0 }` — which is why the button sat closer to the
              boxes than the boxes sat to this line. This is one line of prompt
              text, not prose, and a div has no margins to fight. */}
          <div className={styles.pinAsk}>
            <FormattedMessage
              id="profiles.pin.enter"
              defaultMessage="Enter the grown-up PIN"
            />
          </div>
          <PinField
            value={pin}
            // Null when the length was never recorded, which PinField draws as
            // an open-ended row rather than guessing a number and being wrong.
            length={user?.parentPinLength ?? null}
            disabled={busy}
            onChange={(next) => {
              setPin(next);
              setWrong(false);
            }}
            onComplete={(next) => void submit(next)}
          />
          {wrong && (
            <div className={styles.pinWrong}>
              <FormattedMessage
                id="profiles.pin.wrong"
                defaultMessage="That’s not the PIN. Try again."
              />
            </div>
          )}
          <div className={styles.pinActions}>
            <Button
              size={16}
              label={formatMessage({
                id: "t_Cancel",
                defaultMessage: "Cancel",
              })}
              onClick={onCancel}
            />
          </div>
        </div>
      </div>
    </Overlay>
  );
}
