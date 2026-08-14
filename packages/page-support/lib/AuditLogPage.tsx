import {
  Pages,
  type StaffAuditEventDetails,
  usePageData,
} from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link as RouterLink, Navigate } from "react-router";
import * as styles from "./AuditLogPage.module.less";
import { SupportService } from "./service.ts";

/**
 * Read-only. Nothing on the desk edits or deletes a row here — a console
 * that can read every support message and put a banner in front of every
 * user is only trustworthy if its own actions leave a trail nobody on the
 * team, including the person who acted, can quietly edit afterwards.
 */
export function AuditLogPage(): ReactNode {
  const { publicUser } = usePageData();
  if (!publicUser.staff) {
    return (
      <Navigate
        to={`${Pages.supportDeskSignin.path}?returnTo=${encodeURIComponent(Pages.supportDeskAudit.path)}`}
        replace={true}
      />
    );
  }
  return <Audit />;
}

function Audit(): ReactNode {
  const [events, setEvents] = useState<StaffAuditEventDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SupportService.listAudit()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <RouterLink to={Pages.supportDesk.path} className={styles.back}>
        <FormattedMessage
          id="staffDesk.headline"
          defaultMessage="Support desk"
        />
      </RouterLink>
      <h1 className={styles.headline}>
        <FormattedMessage id="staffDesk.auditLink" defaultMessage="Audit log" />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="staffDesk.audit.intro"
          defaultMessage="Every sign-in, denied attempt, revealed address, reply, status change and notice — who, and when. Nothing here can be edited or deleted."
        />
      </p>

      {loading && (
        <p className={styles.empty}>
          <FormattedMessage id="staffDesk.loading" defaultMessage="Loading…" />
        </p>
      )}
      {!loading && events.length === 0 && (
        <p className={styles.empty}>
          <FormattedMessage
            id="staffDesk.empty"
            defaultMessage="Nothing here."
          />
        </p>
      )}

      <ul className={styles.list}>
        {events.map((e) => (
          <li
            key={e.id}
            className={styles.row}
            data-denied={e.action === "staff-access-denied"}
          >
            <span className={styles.when}>
              {new Date(e.createdAt).toLocaleString()}
            </span>
            <span className={styles.what}>
              <ActionLine event={e} />
            </span>
            <span className={styles.ip}>{e.ip ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionLine({
  event,
}: {
  readonly event: StaffAuditEventDetails;
}): ReactNode {
  const who = event.staffName ?? "unknown";
  switch (event.action) {
    case "staff-signin":
      return (
        <FormattedMessage
          id="staffDesk.audit.signin"
          defaultMessage="{who} signed in"
          values={{ who: <b>{who}</b> }}
        />
      );
    case "staff-access-denied":
      return (
        <FormattedMessage
          id="staffDesk.audit.denied"
          defaultMessage="Access denied — {detail}"
          values={{ detail: event.detail ?? "" }}
        />
      );
    case "reveal-email":
      return (
        <FormattedMessage
          id="staffDesk.audit.reveal"
          defaultMessage="{who} revealed an address on {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "reply-ticket":
      return (
        <FormattedMessage
          id="staffDesk.audit.reply"
          defaultMessage="{who} replied — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "ticket-status":
      return (
        <FormattedMessage
          id="staffDesk.audit.status"
          defaultMessage="{who} moved {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "notice-published":
      return (
        <FormattedMessage
          id="staffDesk.audit.noticePublished"
          defaultMessage="{who} published a notice — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "notice-retracted":
      return (
        <FormattedMessage
          id="staffDesk.audit.noticeRetracted"
          defaultMessage="{who} retracted {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    default:
      return event.action;
  }
}
