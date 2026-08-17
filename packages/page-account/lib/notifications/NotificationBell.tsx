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

  const toggle = () => {
    setOpen((o) => !o);
  };

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
        onClick={toggle}
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
          {notifications?.map((n) => (
            <button
              key={n.id}
              type="button"
              className={
                n.read ? styles.item : `${styles.item} ${styles.unread}`
              }
              onClick={() => markRead(n)}
            >
              <span className={styles.time}>
                {new Date(n.createdAt).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className={styles.body}>
                {n.body ?? (
                  <FormattedMessage
                    id="notifications.ticketReply"
                    defaultMessage="Your support ticket got a reply"
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
