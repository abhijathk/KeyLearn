import { clsx } from "clsx";
import { type ReactNode, useImperativeHandle, useRef } from "react";
import * as styles from "./CheckBox.module.less";
import { type CheckBoxProps } from "./CheckBox.types.ts";

export function CheckBox({
  checked,
  children,
  disabled,
  label,
  name,
  ref,
  tabIndex,
  title,
  value,
  onBlur,
  onChange,
  onFocus,
  ...props
}: CheckBoxProps): ReactNode {
  const element = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({
    focus() {
      element.current?.focus();
    },
    blur() {
      element.current?.blur();
    },
  }));
  return (
    <label
      {...props}
      className={clsx(styles.root, disabled && styles.disabled)}
      title={title}
    >
      <input
        ref={element}
        checked={checked}
        disabled={disabled}
        name={name}
        tabIndex={tabIndex}
        type="checkbox"
        value={value}
        onBlur={onBlur}
        onChange={(event) => {
          const { checked } = event.target as HTMLInputElement;
          onChange?.(checked);
        }}
        onFocus={onFocus}
      />
      {/* A modern switch: a pill track with a sliding knob. */}
      <span className={clsx(styles.track, checked && styles.checked)}>
        <span className={styles.knob} />
      </span>
      <span className={styles.label}>{label || children}</span>
    </label>
  );
}
