import { type NotificationDetails, usePageData } from "@keylearn/pages-shared";
import { IconButton, StrokeIcon } from "@keylearn/widget";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { AccountService } from "../service.ts";
import * as styles from "./NotificationBell.module.less";

/**
 * The signed-in "you have an update" badge — currently only fired for a
 * support-ticket reply while signed in, in place of an email (see
 * page-support's email-vs-notification split). Nothing renders for a
 * signed-out visitor; there's nothing of theirs to show.
 *
 * Each row carries who replied, which conversation, what they said and
 * where it stands. The list used to lead with a timestamp, which put
 * *when* in front of *what* and wrapped mid-value at this width; the time
 * is now the quietest thing in the row.
 */
export function NotificationBell(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    readonly NotificationDetails[] | null
  >(null);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    AccountService.listNotifications().then((r) => {
      setNotifications(r.notifications);
      setUnread(r.unread);
    });
  }, [signedIn]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClickOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!signedIn) {
    return null;
  }

  const markRead = (n: NotificationDetails) => {
    if (n.read) {
      return;
    }
    setNotifications(
      (list) =>
        list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null,
    );
    setUnread((u) => Math.max(0, u - 1));
    void AccountService.markNotificationRead(n.id);
  };

  /**
   * Opening the conversation the notification is about.
   *
   * Clicking used only to mark it read, which is the one thing somebody
   * clicking a reply notification is not trying to do.
   */
  const openThread = (n: NotificationDetails) => {
    markRead(n);
    setOpen(false);
    window.location.href = "/account#support";
  };

  /** Removed from the list. The conversation it points at is untouched. */
  const dismiss = (n: NotificationDetails) => {
    setNotifications((list) => list?.filter((x) => x.id !== n.id) ?? null);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
    }
    void AccountService.dismissNotification(n.id);
  };

  const dismissAll = () => {
    setNotifications([]);
    setUnread(0);
    void AccountService.dismissAllNotifications();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <IconButton
        icon={<StrokeIcon name="bell" />}
        title={formatMessage(
          defineMessage({
            id: "notifications.bell.title",
            defaultMessage: "Notifications",
          }),
        )}
        onClick={() => setOpen((o) => !o)}
      />
      {unread > 0 && <span className={styles.dot} aria-hidden="true" />}
      {open && (
        <div className={styles.drop}>
          {notifications == null && (
            <p className={styles.empty}>
              <FormattedMessage
                id="staffDesk.loading"
                defaultMessage="Loading…"
              />
            </p>
          )}
          {notifications != null && notifications.length === 0 && (
            <p className={styles.empty}>
              <FormattedMessage
                id="notifications.empty"
                defaultMessage="Nothing here yet."
              />
            </p>
          )}

          {notifications != null && notifications.length > 0 && (
            <div className={styles.head}>
              <b className={styles.headTitle}>
                <FormattedMessage
                  id="notifications.bell.title"
                  defaultMessage="Notifications"
                />
              </b>
              <span className={styles.headActions}>
                <button
                  type="button"
                  className={styles.headLink}
                  onClick={dismissAll}
                >
                  <FormattedMessage
                    id="notifications.clearAll"
                    defaultMessage="Clear all"
                  />
                </button>
                {/* Shuts the panel. Clicking away does it too, but a
                    dropdown with no visible way out is a guess. */}
                <button
                  type="button"
                  className={styles.headClose}
                  aria-label={formatMessage(
                    defineMessage({
                      id: "notifications.close",
                      defaultMessage: "Close",
                    }),
                  )}
                  onClick={() => setOpen(false)}
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="11"
                    height="11"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            </div>
          )}

          {notifications?.map((n) => (
            <Row
              key={n.id}
              n={n}
              onOpen={() => openThread(n)}
              onRead={() => markRead(n)}
              onDismiss={() => dismiss(n)}
            />
          ))}

          {/* The way to everything, not just what is still unread here. */}
          {notifications != null && notifications.length > 0 && (
            <button
              type="button"
              className={styles.foot}
              onClick={() => {
                setOpen(false);
                window.location.href = "/account#support";
              }}
            >
              <FormattedMessage
                id="notifications.allMessages"
                defaultMessage="All messages"
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** How long ago, short enough not to compete with the message. */
function when(
  iso: string,
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
): string {
  const mins = Math.round((Date.now() - Number(new Date(iso))) / 60000);
  if (mins < 1) {
    return formatMessage({
      id: "notifications.now",
      defaultMessage: "just now",
    });
  }
  if (mins < 60) {
    return formatMessage(
      { id: "notifications.minutes", defaultMessage: "{n}m" },
      { n: mins },
    );
  }
  if (mins < 60 * 24) {
    return formatMessage(
      { id: "notifications.hours", defaultMessage: "{n}h" },
      { n: Math.round(mins / 60) },
    );
  }
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Each status writes itself out, or the extractor never sees the copy. */
function StatusChip({ status }: { readonly status: string }): ReactNode {
  switch (status) {
    case "waiting":
      return (
        <span className={`${styles.chip} ${styles.chipWaiting}`}>
          <FormattedMessage
            id="notifications.status.waiting"
            defaultMessage="Waiting on you"
          />
        </span>
      );
    case "flagged":
      return (
        <span className={`${styles.chip} ${styles.chipPerson}`}>
          <FormattedMessage
            id="notifications.status.flagged"
            defaultMessage="With a person"
          />
        </span>
      );
    case "closed":
      return (
        <span className={`${styles.chip} ${styles.chipDone}`}>
          <FormattedMessage
            id="notifications.status.closed"
            defaultMessage="Resolved"
          />
        </span>
      );
    default:
      return (
        <span className={`${styles.chip} ${styles.chipOpen}`}>
          <FormattedMessage
            id="notifications.status.open"
            defaultMessage="Open"
          />
        </span>
      );
  }
}

function Row({
  n,
  onOpen,
  onRead,
  onDismiss,
}: {
  readonly n: NotificationDetails;
  readonly onOpen: () => void;
  readonly onRead: () => void;
  readonly onDismiss: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();

  return (
    <div className={n.read ? styles.item : `${styles.item} ${styles.unread}`}>
      {/* The unread marker. A dot rather than a bolder row, so a list of
          mostly-unread entries still has somewhere for the eye to rest. */}
      <span
        className={n.read ? `${styles.mark} ${styles.markSpent}` : styles.mark}
        aria-hidden="true"
      />

      <div className={styles.body}>
        <button type="button" className={styles.itemMain} onClick={onOpen}>
          <span className={styles.line}>
            <span className={styles.who}>
              {n.authorName ??
                (n.fromAssistant
                  ? formatMessage({
                      id: "notifications.assistant",
                      defaultMessage: "KeyLearn assistant",
                    })
                  : formatMessage({
                      id: "notifications.staff",
                      defaultMessage: "KeyLearn support",
                    }))}
            </span>
            {/* Never passed off as a person, same rule the thread keeps. */}
            <span className={styles.role}>
              {n.fromAssistant ? (
                <FormattedMessage
                  id="notifications.roleAi"
                  defaultMessage="AI assistant"
                />
              ) : (
                <FormattedMessage
                  id="notifications.roleStaff"
                  defaultMessage="KeyLearn"
                />
              )}
            </span>
            <span className={styles.time}>
              {when(n.createdAt, formatMessage)}
            </span>
          </span>

          {(n.reference != null || n.status != null) && (
            <span className={styles.line}>
              {n.reference != null && (
                <span className={styles.ref}>{n.reference}</span>
              )}
              {n.status != null && <StatusChip status={n.status} />}
            </span>
          )}

          <span className={styles.excerpt}>
            {n.body ?? (
              <FormattedMessage
                id="notifications.ticketReply"
                defaultMessage="Your support ticket got a reply"
              />
            )}
          </span>
        </button>

        {/* Only on the unread row: there is nothing left to do on one
            already read, and buttons on every row make a list a form. */}
        {!n.read && (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.act} ${styles.actPrimary}`}
              onClick={onOpen}
            >
              <FormattedMessage id="notifications.open" defaultMessage="Open" />
            </button>
            <button type="button" className={styles.act} onClick={onRead}>
              <FormattedMessage
                id="notifications.markRead"
                defaultMessage="Mark read"
              />
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className={styles.dismiss}
        aria-label={formatMessage(
          defineMessage({
            id: "notifications.clear",
            defaultMessage: "Clear this notification",
          }),
        )}
        onClick={onDismiss}
      >
        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
