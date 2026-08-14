import {
  type NoticeDetails,
  Pages,
  type SupportTicketDetails,
  usePageData,
} from "@keylearn/pages-shared";
import { Button, TextField, toast } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink, Navigate } from "react-router";
import {
  SupportService,
  type TicketKind,
  type TicketStatus,
} from "./service.ts";
import * as styles from "./StaffDeskPage.module.less";

export function StaffDeskPage(): ReactNode {
  const { publicUser } = usePageData();
  // Server-side requireStaff() is the real boundary; this only spares a
  // non-eligible visitor a page full of controls that would all 403 anyway.
  // The sign-in screen re-checks the real reason (signed out, wrong
  // account, or missing a second factor) rather than this just guessing.
  if (!publicUser.staff) {
    return (
      <Navigate
        to={`${Pages.supportDeskSignin.path}?returnTo=${encodeURIComponent(Pages.supportDesk.path)}`}
        replace={true}
      />
    );
  }
  return <Desk />;
}

function Desk(): ReactNode {
  const { formatMessage } = useIntl();
  const [kindFilter, setKindFilter] = useState<TicketKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">(
    "open",
  );
  const [tickets, setTickets] = useState<SupportTicketDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState<NoticeDetails | null>(null);

  const load = () => {
    setLoading(true);
    SupportService.listTickets({
      kind: kindFilter === "all" ? undefined : kindFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    })
      .then(setTickets)
      .finally(() => setLoading(false));
  };

  useEffect(load, [kindFilter, statusFilter]);
  useEffect(() => {
    SupportService.getActiveNotice()
      .then(setNotice)
      .catch(() => {});
  }, []);

  const activeTicket = tickets.find((t) => t.id === selected) ?? null;

  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        <FormattedMessage
          id="staffDesk.headline"
          defaultMessage="Support desk"
        />
      </h1>

      <NoticeComposer notice={notice} onChange={setNotice} />

      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={kindFilter}
          onChange={(ev) =>
            setKindFilter(ev.target.value as TicketKind | "all")
          }
        >
          <option value="all">
            {formatMessage({
              id: "staffDesk.filter.allKinds",
              defaultMessage: "All kinds",
            })}
          </option>
          <option value="support">
            {formatMessage({
              id: "support.form.kind.support",
              defaultMessage: "General support",
            })}
          </option>
          <option value="business">
            {formatMessage({
              id: "support.form.kind.business",
              defaultMessage: "Business enquiry",
            })}
          </option>
        </select>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(ev) =>
            setStatusFilter(ev.target.value as TicketStatus | "all")
          }
        >
          {(
            ["all", "open", "flagged", "waiting", "closed", "spam"] as const
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className={styles.grow} />
        <RouterLink to={Pages.supportDeskAudit.path} className={styles.link}>
          <FormattedMessage
            id="staffDesk.auditLink"
            defaultMessage="Audit log"
          />
        </RouterLink>
      </div>

      <div className={styles.layout}>
        <ul className={styles.queue}>
          {loading && (
            <li className={styles.empty}>
              <FormattedMessage
                id="staffDesk.loading"
                defaultMessage="Loading…"
              />
            </li>
          )}
          {!loading && tickets.length === 0 && (
            <li className={styles.empty}>
              <FormattedMessage
                id="staffDesk.empty"
                defaultMessage="Nothing here."
              />
            </li>
          )}
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={
                  t.id === selected ? styles.queueItemOn : styles.queueItem
                }
                onClick={() => setSelected(t.id)}
              >
                <span className={styles.queueBadge} data-status={t.status}>
                  {t.status}
                </span>
                <span className={styles.queueSubject}>{t.subject}</span>
                <span className={styles.queueFrom}>{t.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.detail}>
          {activeTicket == null ? (
            <p className={styles.emptyDetail}>
              <FormattedMessage
                id="staffDesk.pickOne"
                defaultMessage="Pick a ticket from the queue."
              />
            </p>
          ) : (
            <TicketDetail
              ticket={activeTicket}
              onReplied={(updated) => {
                setTickets((prev) =>
                  prev.map((t) => (t.id === updated.id ? updated : t)),
                );
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TicketDetail({
  ticket,
  onReplied,
}: {
  readonly ticket: SupportTicketDetails;
  readonly onReplied: (updated: SupportTicketDetails) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [reply, setReply] = useState(ticket.staffReply ?? "");
  const [busy, setBusy] = useState(false);
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    setReply(ticket.staffReply ?? "");
    setRevealedEmail(null);
  }, [ticket.id, ticket.staffReply]);

  const move = (status: TicketStatus) => {
    setBusy(true);
    SupportService.setTicketStatus(ticket.id, status)
      .then(onReplied)
      .finally(() => setBusy(false));
  };

  const send = (status: TicketStatus) => {
    setBusy(true);
    SupportService.replyToTicket(ticket.id, { reply, status })
      .then((updated) => {
        onReplied(updated);
        toast(
          <FormattedMessage
            id="staffDesk.replySaved"
            defaultMessage="Reply saved."
          />,
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className={styles.ticket}>
      <div className={styles.ticketMeta}>
        <span>
          {ticket.name} &lt;{revealedEmail ?? ticket.email}&gt;{" "}
          {revealedEmail == null && (
            <button
              type="button"
              className={styles.link}
              disabled={revealing}
              onClick={() => {
                setRevealing(true);
                SupportService.revealEmail(ticket.id)
                  .then(setRevealedEmail)
                  .finally(() => setRevealing(false));
              }}
            >
              <FormattedMessage
                id="staffDesk.revealEmail"
                defaultMessage="Reveal full email"
              />
            </button>
          )}
        </span>
        <span className={styles.queueBadge} data-status={ticket.status}>
          {ticket.status}
        </span>
      </div>
      <h2 className={styles.ticketSubject}>{ticket.subject}</h2>
      <p className={styles.ticketMessage}>{ticket.message}</p>

      <TextField
        type="textarea"
        size="full"
        rows={5}
        maxLength={4000}
        placeholder={formatMessage({
          id: "staffDesk.replyPlaceholder",
          defaultMessage: "Reply…",
        })}
        value={reply}
        onChange={setReply}
      />
      <div className={styles.replyRow}>
        <Button
          label={formatMessage({
            id: "staffDesk.sendReply",
            defaultMessage: "Send reply",
          })}
          disabled={busy || reply.trim() === ""}
          onClick={() => send("waiting")}
        />
        <Button
          label={formatMessage({
            id: "staffDesk.replyAndClose",
            defaultMessage: "Reply and close",
          })}
          disabled={busy || reply.trim() === ""}
          onClick={() => send("closed")}
        />
      </div>

      <p className={styles.moveLabel}>
        <FormattedMessage id="staffDesk.moveIt" defaultMessage="Move it" />
      </p>
      <div className={styles.replyRow}>
        <button
          type="button"
          className={styles.kindBtn}
          disabled={busy}
          onClick={() => move("waiting")}
        >
          <FormattedMessage
            id="staffDesk.status.waiting"
            defaultMessage="Waiting on them"
          />
        </button>
        <button
          type="button"
          className={styles.kindBtn}
          disabled={busy}
          onClick={() => move("closed")}
        >
          <FormattedMessage
            id="staffDesk.status.close"
            defaultMessage="Close"
          />
        </button>
        <button
          type="button"
          className={styles.kindBtnDanger}
          disabled={busy}
          onClick={() => move("spam")}
        >
          <FormattedMessage id="staffDesk.status.spam" defaultMessage="Spam" />
        </button>
      </div>
    </div>
  );
}

function NoticeComposer({
  notice,
  onChange,
}: {
  readonly notice: NoticeDetails | null;
  readonly onChange: (notice: NoticeDetails | null) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className={styles.noticeBox}>
      {notice != null && (
        <p className={styles.activeNotice}>
          <FormattedMessage
            id="staffDesk.notice.current"
            defaultMessage="Live now: {message}"
            values={{ message: notice.message }}
          />{" "}
          <button
            type="button"
            className={styles.link}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              SupportService.setNoticeActive(notice.id, false)
                .then(() => onChange(null))
                .finally(() => setBusy(false));
            }}
          >
            <FormattedMessage
              id="staffDesk.notice.retract"
              defaultMessage="Retract"
            />
          </button>
        </p>
      )}
      <div className={styles.noticeRow}>
        <TextField
          type="text"
          maxLength={280}
          placeholder={formatMessage({
            id: "staffDesk.notice.placeholder",
            defaultMessage: "Post a site-wide notice…",
          })}
          value={message}
          onChange={setMessage}
        />
        <Button
          label={formatMessage({
            id: "staffDesk.notice.post",
            defaultMessage: "Post",
          })}
          disabled={busy || message.trim() === ""}
          onClick={() => {
            setBusy(true);
            SupportService.createNotice({ message: message.trim() })
              .then((created) => {
                onChange(created);
                setMessage("");
              })
              .finally(() => setBusy(false));
          }}
        />
      </div>
    </div>
  );
}
