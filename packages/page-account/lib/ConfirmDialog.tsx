import { Button } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect } from "react";
import { useIntl } from "react-intl";
import * as styles from "./ConfirmDialog.module.less";

/**
 * A small custom confirmation modal — replaces the native window.confirm so
 * destructive actions get a styled, on-brand dialog. `danger` tints the
 * confirm button for irreversible actions like deleting the account.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  // Escape closes; the dialog owns focus while open.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className={styles.scrim}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal={true}
        aria-label={title}
      >
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button
            size={16}
            label={formatMessage({ id: "t_Cancel", defaultMessage: "Cancel" })}
            onClick={onCancel}
          />
          <button
            className={clsx(styles.confirm, danger && styles.confirmDanger)}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
