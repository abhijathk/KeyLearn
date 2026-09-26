import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as styles from "./AccountPage.module.less";

/** A pill toggle switch matching the account mock's `.tog`. */
export function Toggle({
  on,
  onChange,
  disabled = false,
  label,
}: {
  readonly on: boolean;
  readonly onChange: (next: boolean) => void;
  readonly disabled?: boolean;
  readonly label?: string;
}): ReactNode {
  // Almost every switch sits at the end of a row whose first line says what
  // it does, and almost none is given a `label` — so a screen reader heard
  // "switch, off" a dozen times over with nothing to tell them apart. With
  // no label, borrow the row's heading, the text the eye reads beside it.
  const ref = useRef<HTMLButtonElement>(null);
  const [rowName, setRowName] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (label != null) {
      return;
    }
    // Beside the row's text, or — when the switch shares a controls box with
    // a slider (cursor glow, artwork behind the stats) — beside that box.
    // Missing the second case left those two unnamed.
    const row =
      ref.current?.previousElementSibling ??
      ref.current?.parentElement?.previousElementSibling;
    const text = (
      row?.firstElementChild?.textContent ?? row?.textContent
    )?.trim();
    setRowName(text !== "" ? text : undefined);
  }, [label]);
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ?? rowName}
      disabled={disabled}
      className={clsx(
        styles.tog,
        on && styles.togOn,
        disabled && styles.togOff,
      )}
      onClick={() => {
        if (!disabled) {
          onChange(!on);
        }
      }}
    />
  );
}

/** A segmented control matching the account mock's `.seg`. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  readonly value: T;
  readonly onChange: (id: T) => void;
  readonly options: readonly { id: T; label: ReactNode }[];
}): ReactNode {
  return (
    <span className={styles.seg}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={clsx(styles.segBtn, value === o.id && styles.segOn)}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
