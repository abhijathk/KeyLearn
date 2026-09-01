import { clsx } from "clsx";
import { type ReactNode, useRef } from "react";
import { sizeClassName, type SizeName } from "../../styles/index.ts";
import {
  type FocusProps,
  type KeyboardProps,
  type MouseProps,
} from "../types.ts";
import { type OptionListOption } from "./OptionList.types.ts";
import * as styles from "./OptionListButton.module.less";

export function OptionListButton({
  children,
  size,
  disabled,
  focused,
  open,
  option,
  tabIndex,
  title,
  elementRef,
  onClick,
  ...props
}: {
  readonly children: ReactNode;
  readonly size?: SizeName;
  readonly focused: boolean;
  readonly open: boolean;
  readonly option: OptionListOption;
  readonly title?: string;
  /** Reports the rendered element, so a portalled menu can be placed on it. */
  readonly elementRef?: (element: HTMLSpanElement | null) => void;
} & FocusProps &
  MouseProps &
  KeyboardProps): ReactNode {
  const element = useRef<HTMLSpanElement>(null);
  return (
    <span
      {...props}
      ref={(node) => {
        element.current = node;
        elementRef?.(node);
      }}
      className={clsx(
        styles.root,
        focused && styles.focused,
        disabled && styles.disabled,
        sizeClassName(size),
      )}
      tabIndex={disabled ? undefined : (tabIndex ?? 0)}
      title={title}
    >
      <span className={styles.placeholder} onClick={onClick}>
        <span className={styles.placeholderName}>{option.name}</span>
        {/* A drawn chevron, not the \u25BC/\u25BA glyphs this used to set. Those are
            solid triangles from the text font: they take the text colour at
            full strength, sit on the baseline rather than centred, and end up
            the heaviest mark in a field whose job is to show a value. A
            stroked chevron reads as an affordance rather than as punctuation. */}
        <span className={styles.placeholderArrow}>
          <svg
            className={clsx(styles.chevron, open && styles.chevronOpen)}
            viewBox="0 0 24 24"
            aria-hidden={true}
          >
            <path d="m7 10 5 5 5-5" />
          </svg>
        </span>
      </span>
      {children}
    </span>
  );
}
