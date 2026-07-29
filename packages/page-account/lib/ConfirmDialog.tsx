import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./ConfirmDialog.module.less";

/**
 * A small custom confirmation modal — replaces the native window.confirm so
 * destructive actions get a styled, on-brand dialog. `danger` tints the
 * confirm button for irreversible actions like deleting the account.
 * `requireText` gates the confirm button behind typing an exact word (e.g.
 * "DELETE") for the most destructive, unrecoverable actions.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  requireText,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly requireText?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [typed, setTyped] = useState("");
  const matched =
    requireText == null ||
    typed.trim().toUpperCase() === requireText.toUpperCase();
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
        {requireText != null && (
          <>
            <p className={styles.typeHint}>
              <FormattedMessage
                id="confirm.typeToConfirm"
                defaultMessage="Type {word} to confirm."
                values={{ word: <strong>{requireText}</strong> }}
              />
            </p>
            <input
              className={styles.typeField}
              type="text"
              autoFocus={true}
              autoComplete="off"
              placeholder={requireText}
              value={typed}
              onChange={(ev) => setTyped(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && matched) {
                  onConfirm();
                }
              }}
            />
          </>
        )}
        <div className={styles.actions}>
          <button
            className={clsx(styles.btn, styles.cancel)}
            onClick={onCancel}
          >
            {formatMessage({ id: "t_Cancel", defaultMessage: "Cancel" })}
          </button>
          <button
            className={clsx(
              styles.btn,
              styles.confirm,
              danger && styles.confirmDanger,
            )}
            disabled={!matched}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
