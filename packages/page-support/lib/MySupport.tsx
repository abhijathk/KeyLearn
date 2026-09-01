import { Button } from "@keylearn/widget";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FormattedMessage, type IntlShape, useIntl } from "react-intl";
import { Icon } from "./icons.tsx";
import { SupportService } from "./service.ts";
import * as styles from "./SupportPage.module.less";

/** The pieces the three views share. */

/**
 * How long one message may be.
 *
 * Two thousand characters is roughly 350 words — long enough for a
 * problem with steps and an error message pasted in, short enough that
 * the counter means something. Four thousand never bit anybody, which is
 * another way of saying it was not a limit.
 */
export const MAX_BODY = 2000;
/** How long after the last keystroke the draft is written. */
export const DRAFT_DEBOUNCE_MS = 700;

/**
 * Each status is written out as its own literal `<FormattedMessage>`.
 *
 * A message chosen by a variable id is invisible to the extractor — the
 * build refuses it outright, and the earlier shape of this (an id held in
 * a lookup table) is exactly what it refuses. So the table carries only
 * the class, and the copy lives in the switch.
 */
const STATUS_CLASS: Record<string, string> = {
  open: styles.badgeOpen,
  waiting: styles.badgeWaiting,
  flagged: styles.badgePerson,
  closed: styles.badgeResolved,
  spam: styles.badgeClosed,
  holding: styles.badgeClosed,
};

function StatusText({ status }: { readonly status: string }): ReactNode {
  switch (status) {
    case "waiting":
      return (
        <FormattedMessage
          id="support.my.status.waiting"
          defaultMessage="Waiting on you"
        />
      );
    case "flagged":
      return (
        <FormattedMessage
          id="support.my.status.flagged"
          defaultMessage="With a person"
        />
      );
    case "closed":
      return (
        <FormattedMessage
          id="support.my.status.closed"
          defaultMessage="Resolved"
        />
      );
    case "spam":
      return (
        <FormattedMessage id="support.my.status.spam" defaultMessage="Closed" />
      );
    case "holding":
      return (
        <FormattedMessage
          id="support.my.status.holding"
          defaultMessage="Confirming"
        />
      );
    default:
      return (
        <FormattedMessage id="support.my.status.open" defaultMessage="Open" />
      );
  }
}

export function StatusBadge({
  status,
}: {
  readonly status: string;
}): ReactNode {
  return (
    <span
      className={`${styles.badge} ${STATUS_CLASS[status] ?? styles.badgeOpen}`}
    >
      <StatusText status={status} />
    </span>
  );
}

/** Short enough to scan; the exact time stays on hover and for a reader. */
export function When({ iso }: { readonly iso: string }): ReactNode {
  const { formatMessage } = useIntl();
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  // Each branch names its own message. Interpolating a unit into one shared
  // string would force every locale to use the same suffix grammar.
  let short: string;
  if (mins < 1) {
    short = formatMessage({
      id: "support.my.when.now",
      defaultMessage: "just now",
    });
  } else if (mins < 60) {
    short = formatMessage(
      { id: "support.my.when.minutes", defaultMessage: "{n}m" },
      { n: mins },
    );
  } else if (mins < 60 * 24) {
    short = formatMessage(
      { id: "support.my.when.hours", defaultMessage: "{n}h" },
      { n: Math.round(mins / 60) },
    );
  } else {
    short = then.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  }
  return (
    <time className={styles.when} dateTime={iso} title={then.toLocaleString()}>
      {short}
    </time>
  );
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

/**
 * Checked here as well as on the server.
 *
 * Not instead of: the server's answer is the one that counts. But a 12 MB
 * screenshot rejected after a full upload is a minute of somebody's life
 * and a progress bar that meant nothing.
 */
/**
 * A file that did not make it, and — when there is any point retrying —
 * the file itself, so the person does not have to produce the screenshot
 * a second time.
 */
export type AttachFailure = {
  readonly name: string;
  readonly why: string;
  /** Absent when retrying cannot help: wrong type, or over the limit. */
  readonly file?: File;
};

export function screenFiles(
  files: FileList,
  intl: IntlShape,
): {
  readonly ok: readonly File[];
  readonly rejected: readonly AttachFailure[];
} {
  const ok: File[] = [];
  const rejected: AttachFailure[] = [];
  for (const file of Array.from(files)) {
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      // No `file`: retrying a PDF-that-isn't will fail the same way.
      rejected.push({
        name: file.name,
        why: intl.formatMessage({
          id: "support.my.badType",
          defaultMessage: "Only PNG, JPG, WEBP, GIF and PDF",
        }),
      });
    } else if (file.size > MAX_ATTACHMENT_BYTES) {
      rejected.push({
        name: file.name,
        why: intl.formatMessage(
          {
            id: "support.my.tooBig",
            defaultMessage: "Larger than 10 MB ({size})",
          },
          { size: formatSize(file.size) },
        ),
      });
    } else {
      ok.push(file);
    }
  }
  return { ok, rejected };
}

export const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;

/** Thousands separated: 3,742 reads as a number, 3742 reads as an id. */
export const formatCount = (n: number): string => n.toLocaleString();

export function Attachment({
  file,
  onView,
}: {
  readonly file: SupportService.MyAttachment;
  readonly onView: (file: SupportService.MyAttachment) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  if (file.isImage) {
    return (
      <button
        type="button"
        className={styles.attImageButton}
        onClick={() => onView(file)}
        aria-label={formatMessage(
          { id: "support.my.openFile", defaultMessage: "Open {name}" },
          { name: file.fileName },
        )}
      >
        <img
          className={styles.attImage}
          src={SupportService.attachmentUrl(file.id)}
          alt={file.fileName}
          loading="lazy"
        />
      </button>
    );
  }
  return (
    <a
      className={styles.attFile}
      href={SupportService.attachmentDownloadUrl(file.id)}
    >
      <span className={styles.ext}>
        {file.fileName.split(".").pop()?.toUpperCase() ?? "FILE"}
      </span>
      <span>{file.fileName}</span>
      <span className={styles.fileSize}>{formatSize(file.size)}</span>
    </a>
  );
}

/** Full size, in the pane — the conversation stays behind it. */
export function Lightbox({
  file,
  onClose,
}: {
  readonly file: SupportService.MyAttachment;
  readonly onClose: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.lightbox}>
      <img
        className={styles.lightboxImage}
        src={SupportService.attachmentUrl(file.id)}
        alt={file.fileName}
      />
      <div className={styles.lightboxBar}>
        <span>{file.fileName}</span>
        <span className={styles.fileSize}>{formatSize(file.size)}</span>
        <a
          className={styles.attFile}
          href={SupportService.attachmentDownloadUrl(file.id)}
          style={{ marginInlineStart: "auto" }}
        >
          <Icon name="download" />
          <FormattedMessage
            id="support.my.download"
            defaultMessage="Download"
          />
        </a>
        <Button
          label={formatMessage({
            id: "support.my.closeView",
            defaultMessage: "Close",
          })}
          onClick={onClose}
        />
      </div>
    </div>
  );
}

export function OfflineNote({
  onReconnect,
}: {
  /** Flushing whatever could not be sent is the point of noticing. */
  readonly onReconnect?: () => void;
}): ReactNode {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => {
      setOffline(false);
      onReconnect?.();
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [onReconnect]);
  if (!offline) {
    return null;
  }
  return (
    <div className={styles.offline}>
      <Icon name="wifiOff" />
      <FormattedMessage
        id="support.my.offline"
        defaultMessage="You’re offline. Anything you write is kept here and will send when you’re back."
      />
    </div>
  );
}

/**
 * The delivery mark on your own messages.
 *
 * One tick: it is on our server. Two: the desk has taken it. There is
 * deliberately no third, "read" state — that would need the desk to
 * report when a person opened a thread, which is surveillance of the
 * staff to no benefit of the customer, and it is the state everyone
 * misreads anyway.
 */
export function Ticks({
  delivered,
  className,
}: {
  readonly delivered: boolean;
  readonly className?: string;
}): ReactNode {
  const { formatMessage } = useIntl();
  const label = delivered
    ? formatMessage({
        id: "support.my.tickDelivered",
        defaultMessage: "Delivered to support",
      })
    : formatMessage({ id: "support.my.tickSent", defaultMessage: "Sent" });
  return (
    <span className={className} title={label} aria-label={label} role="img">
      {/* Two ticks always occupy the same width as one, so a message does
          not shift sideways the moment it is delivered. */}
      <svg viewBox="0 0 19 12" width="18" height="11" aria-hidden={true}>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.4 6.6 4.5 9.8 10 2.6" />
          {delivered && <path d="M9.6 9.8 16.6 2.4" />}
        </g>
      </svg>
    </span>
  );
}

export function Composer({
  value,
  onChange,
  pending,
  onAttach,
  onRemoveAttachment,
  onSend,
  busy,
  placeholder,
  hint,
  uploading,
  errors,
  onDismissError,
  onRetry,
  hideSend = false,
  focusSignal,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly pending: readonly SupportService.MyAttachment[];
  readonly onAttach: (files: FileList) => void;
  readonly onRemoveAttachment: (id: number) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly placeholder: string;
  readonly hint?: ReactNode;
  readonly uploading?: readonly string[];
  /** One entry per file that could not be attached, and why. */
  readonly errors?: readonly AttachFailure[];
  readonly onDismissError?: (name: string) => void;
  /** Only offered for failures that carried their file. */
  readonly onRetry?: (file: File) => void;
  /**
   * The new-ticket form has its own Send below the title field, because the
   * title is part of what is being sent. Two Send buttons on one form is a
   * question about which one is real.
   */
  readonly hideSend?: boolean;
  /**
   * Bumped by the parent to put the cursor in the box — used when "Not
   * really" reopens a conversation, where the next thing that has to
   * happen is somebody typing.
   */
  readonly focusSignal?: number;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [dragDepth, setDragDepth] = useState(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  const over = value.length > MAX_BODY;
  const near = !over && value.length > MAX_BODY - 500;
  const dragging = dragDepth > 0;

  useEffect(() => {
    if (focusSignal != null && focusSignal > 0) {
      box.current?.focus();
    }
  }, [focusSignal]);

  return (
    <div
      className={`${styles.composer} ${dragging ? styles.composerDragging : ""}`}
      // Counted rather than toggled: dragleave fires when the pointer
      // crosses a child, so a boolean flickers the whole box while
      // somebody is still holding a file over it.
      onDragEnter={(e) => {
        e.preventDefault();
        setDragDepth((d) => d + 1);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
      onDrop={(e) => {
        e.preventDefault();
        setDragDepth(0);
        if (e.dataTransfer.files.length > 0) {
          onAttach(e.dataTransfer.files);
        }
      }}
      // Pasting is how screenshots actually get attached — nobody saves to
      // the desktop and then browses for it.
      onPaste={(e) => {
        if (e.clipboardData.files.length > 0) {
          e.preventDefault();
          onAttach(e.clipboardData.files);
        }
      }}
    >
      {(pending.length > 0 ||
        (uploading?.length ?? 0) > 0 ||
        (errors?.length ?? 0) > 0) && (
        <div className={styles.tray}>
          {(errors ?? []).map((bad) => (
            <span
              key={bad.name}
              className={`${styles.pending} ${styles.pendingBad}`}
            >
              {bad.name}
              <span className={styles.pendingWhy}>{bad.why}</span>
              {bad.file != null && onRetry != null && (
                <button
                  type="button"
                  className={styles.retryFile}
                  onClick={() => onRetry(bad.file!)}
                >
                  <FormattedMessage
                    id="support.my.retryFile"
                    defaultMessage="Retry"
                  />
                </button>
              )}
              {onDismissError != null && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={formatMessage(
                    {
                      id: "support.my.dismissError",
                      defaultMessage: "Dismiss {name}",
                    },
                    { name: bad.name },
                  )}
                  onClick={() => onDismissError(bad.name)}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </span>
          ))}
          {(uploading ?? []).map((name) => (
            <span key={name} className={styles.pending}>
              {name}
              <span className={styles.progress}>
                <i />
              </span>
            </span>
          ))}
          {pending.map((f) => (
            <span key={f.id} className={styles.pending}>
              {f.fileName}
              <span className={styles.fileSize}>{formatSize(f.size)}</span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={formatMessage(
                  {
                    id: "support.my.removeFile",
                    defaultMessage: "Remove {name}",
                  },
                  { name: f.fileName },
                )}
                onClick={() => onRemoveAttachment(f.id)}
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* The drop note is an addition, not a replacement: swapping the
          textarea out would lose focus and cursor on every drag-over. */}
      {dragging && (
        <div className={styles.dropNote}>
          <Icon name="clip" />
          <FormattedMessage
            id="support.my.dropHere"
            defaultMessage="Drop to attach — PNG, JPG or PDF"
          />
        </div>
      )}

      {/* The input and its Send on one row, so the button can stand the
          full height of what it sends. */}
      <div className={styles.composerRow}>
        <textarea
          ref={box}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={placeholder}
        />
        {!hideSend && (
          <button
            type="button"
            className={styles.sendButton}
            disabled={busy || over || value.trim() === ""}
            aria-busy={busy ? "true" : undefined}
            title={formatMessage({
              id: "support.my.send",
              defaultMessage: "Send",
            })}
            aria-label={formatMessage({
              id: "support.my.send",
              defaultMessage: "Send",
            })}
            onClick={onSend}
          >
            {busy ? (
              <span className="qk-spinner" />
            ) : (
              <Icon name="send" size={16} filled={true} />
            )}
          </button>
        )}
      </div>

      <div className={styles.composerBar}>
        <input
          ref={fileInput}
          type="file"
          multiple={true}
          hidden={true}
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          onChange={(e) => {
            if (e.target.files != null && e.target.files.length > 0) {
              onAttach(e.target.files);
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => fileInput.current?.click()}
          aria-label={formatMessage({
            id: "support.my.attach",
            defaultMessage: "Attach a file",
          })}
        >
          <Icon name="clip" />
        </button>
        <span
          className={`${styles.count} ${over ? styles.countOver : near ? styles.countNear : ""}`}
        >
          {formatCount(value.length)} / {formatCount(MAX_BODY)}
        </span>
        {/* On the row, after the counter. Its own line cost the chat a
            line of height for a sentence that fits here. */}
        <span className={styles.composerHint}>
          {hint ??
            (pending.length > 0 ? (
              <FormattedMessage
                id="support.my.filesReady"
                defaultMessage="{n, plural, one {# file ready} other {# files ready}} · 10 MB each"
                values={{ n: pending.length }}
              />
            ) : (
              <FormattedMessage
                id="support.my.attachHint"
                defaultMessage="Drag or paste — PNG, JPG, PDF · 10 MB"
              />
            ))}
        </span>
      </div>
    </div>
  );
}
