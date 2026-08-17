import { type StaffAuditEventDetails } from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./AuditLogPage.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { SupportService } from "./service.ts";

/**
 * Read-only. Nothing on the desk edits or deletes a row here — a console
 * that can read every support message and put a banner in front of every
 * user is only trustworthy if its own actions leave a trail nobody on the
 * team, including the person who acted, can quietly edit afterwards.
 */
export function AuditLogPage(): ReactNode {
  return (
    <DeskShell active="audit">
      <Audit />
    </DeskShell>
  );
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
    case "ticket-archived":
      return (
        <FormattedMessage
          id="staffDesk.audit.archived"
          defaultMessage="{who} {detail}"
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
    case "account-lookup":
      return (
        <FormattedMessage
          id="staffDesk.audit.accountLookup"
          defaultMessage="{who} looked up an account — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "account-viewed":
      return (
        <FormattedMessage
          id="staffDesk.audit.accountViewed"
          defaultMessage="{who} opened {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "account-email-revealed":
      return (
        <FormattedMessage
          id="staffDesk.audit.accountEmailRevealed"
          defaultMessage="{who} revealed the email on {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "account-deletion-requested":
      return (
        <FormattedMessage
          id="staffDesk.audit.accountDeletionRequested"
          defaultMessage="{who} scheduled a deletion for {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "account-deletion-cancelled":
      return (
        <FormattedMessage
          id="staffDesk.audit.accountDeletionCancelled"
          defaultMessage="{who} cancelled a scheduled deletion — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "answer-changed":
      return (
        <FormattedMessage
          id="staffDesk.audit.answerChanged"
          defaultMessage="{who} edited an answer — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "rule-changed":
      return (
        <FormattedMessage
          id="staffDesk.audit.ruleChanged"
          defaultMessage="{who} edited a rule — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "notice-updated":
      return (
        <FormattedMessage
          id="staffDesk.audit.noticeUpdated"
          defaultMessage="{who} updated a notice — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "notice-deleted":
      return (
        <FormattedMessage
          id="staffDesk.audit.noticeDeleted"
          defaultMessage="{who} deleted a notice — {detail}"
          values={{ who: <b>{who}</b>, detail: event.detail ?? "" }}
        />
      );
    case "settings-changed":
      return (
        <FormattedMessage
          id="staffDesk.audit.settingsChanged"
          defaultMessage="{who} changed a desk setting"
          values={{ who: <b>{who}</b> }}
        />
      );
    case "agent-access-denied":
      return (
        <FormattedMessage
          id="staffDesk.audit.agentDenied"
          defaultMessage="Agent access denied — wrong or missing key"
        />
      );
    case "agent-reply":
      return (
        <FormattedMessage
          id="staffDesk.audit.agentReply"
          defaultMessage="Tab replied — {detail}"
          values={{ detail: event.detail ?? "" }}
        />
      );
    case "agent-sentiment":
      return (
        <FormattedMessage
          id="staffDesk.audit.agentSentiment"
          defaultMessage="Tab read sentiment — {detail}"
          values={{ detail: event.detail ?? "" }}
        />
      );
    case "agent-flag":
      return (
        <FormattedMessage
          id="staffDesk.audit.agentFlag"
          defaultMessage="Tab flagged a ticket — {detail}"
          values={{ detail: event.detail ?? "" }}
        />
      );
    case "automation-toggled":
      return (
        <FormattedMessage
          id="staffDesk.audit.automationToggled"
          defaultMessage="Automation switched {detail}"
          values={{ detail: event.detail ?? "" }}
        />
      );
    case "agent-close-spam":
      return (
        <FormattedMessage
          id="staffDesk.audit.agentCloseSpam"
          defaultMessage="Tab closed a ticket as spam — {detail}"
          values={{ detail: event.detail ?? "" }}
        />
      );
    case "agent-quota-paused":
      return (
        <FormattedMessage
          id="staffDesk.audit.agentQuotaPaused"
          defaultMessage="Tab paused — {detail}"
          values={{ detail: event.detail ?? "" }}
        />
      );
    default:
      return event.action;
  }
}
