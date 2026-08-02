import { clsx } from "clsx";
import { type ReactNode } from "react";
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
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
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
