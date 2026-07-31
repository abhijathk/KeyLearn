import { clsx } from "clsx";
import { type ReactNode } from "react";
import * as styles from "./Switch.module.less";

/** A pill toggle switch. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  readonly disabled?: boolean;
  /** Required when no visible label sits beside the switch. */
  readonly label?: string;
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={clsx(
        styles.tog,
        checked && styles.togOn,
        disabled && styles.togOff,
      )}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
    />
  );
}

/** A segmented control — a small, always-visible set of exclusive choices. */
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
          aria-pressed={value === o.id}
          onClick={() => {
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
