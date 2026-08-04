import { useIntlDates } from "@keylearn/intl";
import { type SecurityEventDetails } from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AccountPage.module.less";
import { AccountService } from "./service.ts";

// Plain-language wording for each recorded event. A parent should be able to
// read this list without knowing what a "session epoch" is.
const LABELS: Record<string, { id: string; defaultMessage: string }> = {
  "login": defineMessage({
    id: "activity.login",
    defaultMessage: "Signed in",
  }),
  "login-failed": defineMessage({
    id: "activity.loginFailed",
    defaultMessage: "Failed sign-in attempt",
  }),
  "password-changed": defineMessage({
    id: "activity.passwordChanged",
    defaultMessage: "Password changed",
  }),
  "password-reset": defineMessage({
    id: "activity.passwordReset",
    defaultMessage: "Password reset using an emailed link",
  }),
  "email-change-requested": defineMessage({
    id: "activity.emailChangeRequested",
    defaultMessage: "Email change requested",
  }),
  "email-changed": defineMessage({
    id: "activity.emailChanged",
    defaultMessage: "Email address changed",
  }),
  "passkey-added": defineMessage({
    id: "activity.passkeyAdded",
    defaultMessage: "Passkey added",
  }),
  "passkey-removed": defineMessage({
    id: "activity.passkeyRemoved",
    defaultMessage: "Passkey removed",
  }),
  "sso-link-refused": defineMessage({
    id: "activity.ssoLinkRefused",
    defaultMessage: "Blocked a sign-in that claimed your email address",
  }),
  "signed-out-everywhere": defineMessage({
    id: "activity.signedOutEverywhere",
    defaultMessage: "Signed out of all devices",
  }),
  "two-factor-enabled": defineMessage({
    id: "activity.twoFactorEnabled",
    defaultMessage: "Two-step verification turned on",
  }),
  "two-factor-disabled": defineMessage({
    id: "activity.twoFactorDisabled",
    defaultMessage: "Two-step verification turned off",
  }),
  "parent-pin-set": defineMessage({
    id: "activity.parentPinSet",
    defaultMessage: "Grown-up PIN changed",
  }),
  "profile-deleted": defineMessage({
    id: "activity.profileDeleted",
    defaultMessage: "Learner profile deleted",
  }),
};

// Events that should stand out — these are the ones worth a second look if the
// account owner does not recognise them.
const NOTABLE = new Set([
  "login-failed",
  "password-changed",
  "password-reset",
  "email-changed",
  "sso-link-refused",
  "two-factor-disabled",
]);

/** A short, readable device description from a user-agent string. */
function device(userAgent: string | null): string | null {
  if (!userAgent) {
    return null;
  }
  const ua = userAgent;
  let os = "";
  if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "Mac";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "Chromebook";
  else if (/Linux/.test(ua)) os = "Linux";
  let br = "";
  if (/Edg\//.test(ua)) br = "Edge";
  else if (/OPR\//.test(ua)) br = "Opera";
  else if (/Chrome\//.test(ua)) br = "Chrome";
  else if (/Firefox\//.test(ua)) br = "Firefox";
  else if (/Safari\//.test(ua)) br = "Safari";
  return [br, os].filter(Boolean).join(" on ") || null;
}

/**
 * Recent security activity on this account.
 *
 * Preventing a takeover is only half the job — this is how someone notices one
 * that got through, and reconstructs what was changed.
 */
/**
 * One event's timestamp, or nothing.
 *
 * A log is the one screen that must survive its own contents: this is a record
 * of what happened to an account, read by somebody who may be checking whether
 * they were broken into, and a single unparseable row must not be able to
 * replace the entire page with an error boundary.
 */
function useWhen() {
  const { formatDateTime } = useIntlDates();
  return (at: string): string => {
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? "" : formatDateTime(date);
  };
}

export function ActivityLog(): ReactNode {
  const { formatMessage } = useIntl();
  const when = useWhen();
  const [events, setEvents] = useState<SecurityEventDetails[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    AccountService.listSecurityEvents()
      .then((list) => {
        if (live) setEvents(list);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return null;
  }

  return (
    <div className={styles.activity}>
      <h3 className={styles.activityTitle}>
        <FormattedMessage
          id="activity.title"
          defaultMessage="Recent account activity"
        />
      </h3>
      <p className={styles.activityHint}>
        <FormattedMessage
          id="activity.hint"
          defaultMessage="The last 30 days. If you don’t recognise something here, change your password and sign out of all devices."
        />
      </p>
      {events == null ? (
        <p className={styles.activityEmpty}>
          <FormattedMessage id="activity.loading" defaultMessage="Loading…" />
        </p>
      ) : events.length === 0 ? (
        <p className={styles.activityEmpty}>
          <FormattedMessage
            id="activity.empty"
            defaultMessage="Nothing recorded yet."
          />
        </p>
      ) : (
        <ul className={styles.activityList}>
          {events.map((event) => {
            const label = LABELS[event.type];
            const where = device(event.userAgent);
            return (
              <li
                key={event.id}
                className={
                  NOTABLE.has(event.type)
                    ? styles.activityItemNotable
                    : styles.activityItem
                }
              >
                <span className={styles.activityWhat}>
                  {label ? formatMessage(label) : event.type}
                  {event.detail ? ` (${event.detail})` : ""}
                </span>
                <span className={styles.activityWhen}>
                  {when(event.createdAt)}
                  {where ? ` · ${where}` : ""}
                  {event.ip ? ` · ${event.ip}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
