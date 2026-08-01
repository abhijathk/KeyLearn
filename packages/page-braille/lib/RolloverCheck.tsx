import { REQUIRED_ROLLOVER, RolloverProbe } from "@keybr/braille";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./BraillePage.module.less";

/**
 * Measures how many of the six dot keys this keyboard can report at once,
 * before any lesson starts.
 *
 * Most laptop and membrane keyboards ghost past two or three simultaneous
 * keys. Without this check a learner on such a keyboard would find certain
 * cells simply refusing to register and would reasonably conclude they were
 * chording wrongly — so the hardware is tested first and reported plainly.
 */
export function RolloverCheck({
  onDone,
}: {
  readonly onDone: (best: number) => void;
}): ReactNode {
  const probe = useRef(new RolloverProbe());
  const [best, setBest] = useState(0);

  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      probe.current.keyDown(ev.code);
      setBest(probe.current.best);
    };
    const up = (ev: KeyboardEvent) => {
      probe.current.keyUp(ev.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const ready = best >= REQUIRED_ROLLOVER;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        <FormattedMessage
          id="braille.check.title"
          defaultMessage="First, a quick keyboard check"
        />
      </h1>
      <p className={styles.intro} role="status" aria-live="polite">
        <FormattedMessage
          id="braille.check.intro"
          defaultMessage="Hold down all six dot keys at once — F D S and J K L — and let go. Braille cells need all six to register together, and not every keyboard can manage it."
        />
      </p>

      <p className={styles.bigCount} role="status" aria-live="assertive">
        <FormattedMessage
          id="braille.check.count"
          defaultMessage="{best} of {need} keys registered"
          values={{ best, need: REQUIRED_ROLLOVER }}
        />
      </p>

      {ready ? (
        <p className={styles.good}>
          <FormattedMessage
            id="braille.check.ok"
            defaultMessage="This keyboard handles all six. You are ready."
          />
        </p>
      ) : (
        best > 0 && (
          <p className={styles.warn}>
            <FormattedMessage
              id="braille.check.limited"
              defaultMessage="Keep trying — and if it never reaches six, this keyboard cannot send them together. You can still practise the cells it can manage, or use an external keyboard."
            />
          </p>
        )
      )}

      <button
        type="button"
        className={styles.startBtn}
        onClick={() => onDone(probe.current.best)}
      >
        {ready ? (
          <FormattedMessage
            id="braille.check.start"
            defaultMessage="Start practising"
          />
        ) : (
          <FormattedMessage
            id="braille.check.skip"
            defaultMessage="Practise anyway"
          />
        )}
      </button>
    </div>
  );
}
