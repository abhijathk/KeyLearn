import { type NotificationDetails, usePageData } from "@keylearn/pages-shared";
import { IconButton, renderMessageText, StrokeIcon } from "@keylearn/widget";
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
 * Deliberately plain: a line of the reply, when it arrived, and a way to
 * be rid of it. A richer card carrying the author, the reference and the
 * ticket's status was built and then set aside as more than a bell needs
 * — see `docs/deferred/rich-notifications` for it, the designs it came
 * from, and the one trap to know about before picking it up.
 */
/** Unhurried on purpose — see the effect below. */
const POLL_MS = 60_000;

export function NotificationBell(): ReactNode {
  const { formatMessage, locale } = useIntl();
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    readonly NotificationDetails[] | null
  >(null);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Polled, and refreshed the moment the tab comes back.
   *
   * It used to fetch once on mount, so a bell opened in a tab left open
   * all afternoon showed whatever was true when the page loaded — the
   * one case a notification exists for.
   *
   * A minute is deliberately unhurried, and a socket would be the wrong
   * tool: there is no WebSocket layer in this server, a notification
   * arrives a handful of times a day per person, and the workers are
   * forked — so pushing to the right one would need pub/sub or sticky
   * routing before a single badge could light up. The focus listener
   * covers the case that actually feels slow, which is coming back to
   * the tab, and costs nothing while the tab is hidden.
   */
  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let live = true;
    const load = () => {
      AccountService.listNotifications()
        .then((r) => {
          if (!live) {
            return;
          }
          setNotifications(r.notifications);
          setUnread(r.unread);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(() => {
      // Nothing to see while the tab is in the background, and a poll
      // there is a request nobody asked for.
      if (document.visibilityState === "visible") {
        load();
      }
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
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

  /**
   * Opens the conversation it is about, marking it read on the way.
   *
   * Clicking used only to mark it read, which is the one thing somebody
   * clicking a reply notification is not trying to do.
   */
  const openThread = (n: NotificationDetails) => {
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      void AccountService.markNotificationRead(n.id);
    }
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

          {notifications?.map((n) => (
            <div
              key={n.id}
              className={
                n.read ? styles.item : `${styles.item} ${styles.unread}`
              }
            >
              <button
                type="button"
                className={styles.itemMain}
                onClick={() => openThread(n)}
              >
                <span className={styles.body}>
                  {n.body != null ? (
                    renderMessageText(n.body, undefined, locale)
                  ) : (
                    <FormattedMessage
                      id="notifications.ticketReply"
                      defaultMessage="Your support ticket got a reply"
                    />
                  )}
                </span>
                {/* Under the message, not above it: leading with the date
                    put "when" in front of "what", and wrapped it mid-value
                    at this width. */}
                <span className={styles.time}>
                  {new Date(n.createdAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>

              <button
                type="button"
                className={styles.dismiss}
                aria-label={formatMessage(
                  defineMessage({
                    id: "notifications.clear",
                    defaultMessage: "Clear this notification",
                  }),
                )}
                onClick={() => dismiss(n)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
