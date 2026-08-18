import {
  Pages,
  type SavedReplyDetails,
  type SupportMessageDetails,
  type SupportTicketDetails,
} from "@keylearn/pages-shared";
import { Button, TextField } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink, useParams } from "react-router";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { linkify } from "./linkify.tsx";
import {
  type AccountLookupResult,
  SupportService,
  type TicketStatus,
} from "./service.ts";
import * as styles from "./ThreadPage.module.less";

export function ThreadPage(): ReactNode {
  return (
    <DeskShell active="inbox">
      <Thread />
    </DeskShell>
  );
}

function Thread(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const ticketId = Number(id);
  const [ticket, setTicket] = useState<SupportTicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = () => {
    if (!Number.isFinite(ticketId)) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    SupportService.getTicket(ticketId)
      .then((t) => {
        setTicket(t);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  // `ticketId` is derived from the URL param, which is the only thing this
  // effect should re-run on.
  useEffect(reload, [ticketId]);

  if (loading) {
    return (
      <p className={common.note}>
        <FormattedMessage id="staffDesk.loading" defaultMessage="Loading…" />
      </p>
    );
  }
  if (error || ticket == null) {
    return (
      <p className={common.note}>
        <FormattedMessage
          id="deskThread.notFound"
          defaultMessage="That ticket couldn't be found."
        />
      </p>
    );
  }

  return (
    <div className={common.split}>
      <div>
        <RouterLink to={Pages.deskInbox.path} className={styles.backLink}>
          <svg viewBox="0 0 24 24" aria-hidden={true}>
            <path d="M15 5 8 12l7 7" />
          </svg>
          <FormattedMessage
            id="deskThread.backToInbox"
            defaultMessage="Back to inbox"
          />
        </RouterLink>
        <div className={styles.headRow}>
          <h1 className={styles.subject}>{ticket.subject}</h1>
          {sentimentChip(ticket.sentiment)}
          {statusChip(ticket.status)}
        </div>

        <div className={styles.thread}>
          {ticket.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>

        <ReplyBox ticket={ticket} onChanged={setTicket} />
      </div>

      <div>
        <WhoWroteThis ticket={ticket} />

        <div className={common.card}>
          <p className={common.micro}>
            <FormattedMessage id="deskThread.moveIt" defaultMessage="Move it" />
          </p>
          <MoveIt ticket={ticket} onChanged={setTicket} />
        </div>
      </div>
    </div>
  );
}

function statusChip(
  status: TicketStatus | SupportTicketDetails["status"],
): ReactNode {
  switch (status) {
    case "open":
    case "flagged":
      return (
        <span className={clsx(common.chip, common.chipNew)}>
          <FormattedMessage
            id="deskInbox.status.needs"
            defaultMessage="needs a reply"
          />
        </span>
      );
    case "waiting":
      return (
        <span className={clsx(common.chip, common.chipWait)}>
          <FormattedMessage
            id="deskInbox.status.waiting"
            defaultMessage="waiting on them"
          />
        </span>
      );
    case "closed":
      return (
        <span className={clsx(common.chip, common.chipClosed)}>
          <FormattedMessage
            id="deskInbox.status.closed"
            defaultMessage="closed"
          />
        </span>
      );
    case "spam":
      return (
        <span className={clsx(common.chip, common.chipAlarm)}>
          <FormattedMessage id="deskInbox.status.spam" defaultMessage="spam" />
        </span>
      );
    default:
      return null;
  }
}

function sentimentChip(
  sentiment: SupportTicketDetails["sentiment"],
): ReactNode {
  switch (sentiment) {
    case "critical":
      return (
        <span className={clsx(common.chip, common.moodCritical)}>
          <FormattedMessage
            id="deskInbox.mood.critical"
            defaultMessage="critical"
          />
        </span>
      );
    case "frustrated":
      return (
        <span className={clsx(common.chip, common.moodFrustrated)}>
          <FormattedMessage
            id="deskInbox.mood.frustrated"
            defaultMessage="frustrated"
          />
        </span>
      );
    case "neutral":
      return (
        <span className={clsx(common.chip, common.moodNeutral)}>
          <FormattedMessage
            id="deskInbox.mood.neutral"
            defaultMessage="neutral"
          />
        </span>
      );
    default:
      return null;
  }
}

/**
 * This is the CUSTOMER's own view of the thread, so the labels are the
 * mirror of the desk's: "them" is the person reading this page, and
 * "us"/"agent" are the desk writing back. `authorName` is the name the
 * desk chose to be seen as — a staffer's working name or the
 * assistant's — and falls back to a generic label when an older desk
 * build sent none.
 */
function senderLabel(m: SupportMessageDetails): string {
  switch (m.sender) {
    case "them":
      return "You";
    case "us":
      return m.authorName ?? "KeyLearn Support";
    case "auto":
      return "Automatic";
    case "agent":
      return `${m.authorName ?? "Tab"} · AI`;
    case "system":
      return "System";
  }
}

function MessageBubble({
  message,
}: {
  readonly message: SupportMessageDetails;
}): ReactNode {
  const cls =
    message.sender === "them"
      ? styles.them
      : message.sender === "us"
        ? styles.us
        : message.sender === "auto"
          ? styles.auto
          : message.sender === "agent"
            ? styles.agent
            : styles.sys;
  return (
    <div className={clsx(styles.msg, cls)}>
      <span className={styles.head}>
        {senderLabel(message)}
        {" · "}
        {new Date(message.createdAt).toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {message.emailed && (
          <>
            {" · "}
            <FormattedMessage
              id="deskThread.emailed"
              defaultMessage="emailed"
            />
          </>
        )}
        {message.answerIds != null && message.answerIds.length > 0 && (
          <>
            {" · "}
            <FormattedMessage
              id="deskThread.draftedFrom"
              defaultMessage="drafted from {ids}"
              values={{
                ids: message.answerIds.map((id) => `#${id}`).join(", "),
              }}
            />
          </>
        )}
      </span>
      <p className={styles.body}>{linkify(message.body, styles.link)}</p>
    </div>
  );
}

function ReplyBox({
  ticket,
  onChanged,
}: {
  readonly ticket: SupportTicketDetails;
  readonly onChanged: (t: SupportTicketDetails) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replies, setReplies] = useState<SavedReplyDetails[] | null>(null);

  const send = (close: boolean) => {
    if (reply.trim() === "" || busy) {
      return;
    }
    setBusy(true);
    SupportService.postReply(ticket.id, { body: reply.trim(), close })
      .then((updated) => {
        onChanged(updated);
        setReply("");
      })
      .finally(() => setBusy(false));
  };

  const openPicker = () => {
    setPickerOpen((v) => !v);
    if (replies == null) {
      SupportService.listSavedReplies()
        .then(setReplies)
        .catch(() => setReplies([]));
    }
  };

  return (
    <div className={styles.replyBox}>
      <span className={common.lbl}>
        <FormattedMessage
          id="deskThread.reply.label"
          defaultMessage="Reply — goes out by email and appears in their thread"
        />
      </span>
      <TextField
        type="textarea"
        size="full"
        rows={5}
        maxLength={4000}
        placeholder={formatMessage({
          id: "deskThread.reply.placeholder",
          defaultMessage: "Write here…",
        })}
        value={reply}
        onChange={setReply}
      />
      <div className={common.btnRow}>
        <Button
          label={formatMessage({
            id: "staffDesk.sendReply",
            defaultMessage: "Send reply",
          })}
          disabled={busy || reply.trim() === ""}
          onClick={() => send(false)}
        />
        <Button
          label={formatMessage({
            id: "staffDesk.replyAndClose",
            defaultMessage: "Reply and close",
          })}
          disabled={busy || reply.trim() === ""}
          onClick={() => send(true)}
        />
        <button
          type="button"
          className={clsx(common.btn, common.ghost)}
          onClick={openPicker}
        >
          <FormattedMessage
            id="deskThread.savedReplies"
            defaultMessage="Saved replies"
          />
        </button>
      </div>

      {pickerOpen && (
        <div className={styles.savedRepliesPop}>
          {replies == null && (
            <p className={common.note}>
              <FormattedMessage
                id="staffDesk.loading"
                defaultMessage="Loading…"
              />
            </p>
          )}
          {replies != null && replies.length === 0 && (
            <p className={common.note}>
              <FormattedMessage
                id="deskThread.savedReplies.empty"
                defaultMessage="No saved replies yet — add some from Settings."
              />
            </p>
          )}
          {replies?.map((r) => (
            <button
              key={r.id}
              type="button"
              className={styles.savedReplyItem}
              onClick={() => {
                setReply(r.body);
                setPickerOpen(false);
                void SupportService.markSavedReplyUsed(r.id).catch(() => {});
              }}
            >
              <span>
                <span className={styles.savedReplyTitle}>{r.title}</span>
                <span className={styles.savedReplySub}>{r.body}</span>
              </span>
              <span className={styles.savedReplySub}>
                <FormattedMessage
                  id="deskThread.savedReplies.used"
                  defaultMessage="used {n} times"
                  values={{ n: r.usedCount }}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WhoWroteThis({
  ticket,
}: {
  readonly ticket: SupportTicketDetails;
}): ReactNode {
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [account, setAccount] = useState<
    AccountLookupResult | null | undefined
  >(undefined);

  useEffect(() => {
    setRevealedEmail(null);
    setAccount(undefined);
  }, [ticket.id]);

  const reveal = () => {
    setRevealing(true);
    SupportService.revealEmail(ticket.id)
      .then((email) => {
        setRevealedEmail(email);
        // A single exact match is treated as the same account; more than
        // one (or none) is left alone rather than guessed at — this lookup
        // is audited server-side either way.
        return SupportService.lookupAccounts(email).then((results) => {
          setAccount(results.length === 1 ? results[0] : null);
        });
      })
      .catch(() => {})
      .finally(() => setRevealing(false));
  };

  return (
    <div className={common.card} style={{ marginBlockStart: 0 }}>
      <p className={common.micro}>
        <FormattedMessage
          id="deskThread.who.title"
          defaultMessage="Who wrote this"
        />
      </p>
      <div className={common.facts}>
        <div className={common.fact}>
          <span className={common.factK}>
            <FormattedMessage id="deskThread.who.name" defaultMessage="Name" />
          </span>
          <span className={common.factV}>{ticket.name}</span>
        </div>
        <div className={common.fact}>
          <span className={common.factK}>
            <FormattedMessage
              id="deskThread.who.email"
              defaultMessage="Email"
            />
          </span>
          <span className={clsx(common.factV, common.factVMono)}>
            {revealedEmail ?? ticket.email}
          </span>
        </div>
        {account != null && (
          <>
            <div className={common.fact}>
              <span className={common.factK}>
                <FormattedMessage
                  id="deskThread.who.since"
                  defaultMessage="Account since"
                />
              </span>
              <span className={common.factV}>
                {new Date(account.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className={common.fact}>
              <span className={common.factK}>
                <FormattedMessage
                  id="deskThread.who.signIn"
                  defaultMessage="Sign-in"
                />
              </span>
              <span className={common.factV}>{account.signInMethod}</span>
            </div>
            <div className={common.fact}>
              <span className={common.factK}>
                <FormattedMessage
                  id="deskThread.who.profiles"
                  defaultMessage="Profiles"
                />
              </span>
              <span className={common.factV}>{account.profileCount}</span>
            </div>
            <div className={common.fact}>
              <span className={common.factK}>
                <FormattedMessage
                  id="deskThread.who.lastSeen"
                  defaultMessage="Last seen"
                />
              </span>
              <span className={common.factV}>
                {account.lastSeen == null
                  ? "—"
                  : new Date(account.lastSeen).toLocaleDateString()}
              </span>
            </div>
          </>
        )}
      </div>
      {revealedEmail == null && (
        <div className={common.btnRow}>
          <button
            type="button"
            className={clsx(common.btn, common.ghost, common.small)}
            disabled={revealing}
            onClick={reveal}
          >
            <FormattedMessage
              id="staffDesk.revealEmail"
              defaultMessage="Reveal full email"
            />
          </button>
        </div>
      )}
      <p className={common.noteSmall}>
        <FormattedMessage
          id="deskThread.who.revealNote"
          defaultMessage="Revealing it is written to the audit log with your name against it."
        />
      </p>
    </div>
  );
}

function MoveIt({
  ticket,
  onChanged,
}: {
  readonly ticket: SupportTicketDetails;
  readonly onChanged: (t: SupportTicketDetails) => void;
}): ReactNode {
  const [busy, setBusy] = useState(false);
  const move = (status: TicketStatus) => {
    setBusy(true);
    SupportService.setTicketStatus(ticket.id, status)
      .then(onChanged)
      .finally(() => setBusy(false));
  };
  const archive = () => {
    setBusy(true);
    SupportService.setTicketArchived(ticket.id, !ticket.archived)
      .then(onChanged)
      .finally(() => setBusy(false));
  };
  return (
    <div className={common.btnRow} style={{ marginBlockStart: 0 }}>
      <button
        type="button"
        className={clsx(common.btn, common.ghost, common.small)}
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
        className={clsx(common.btn, common.ghost, common.small)}
        disabled={busy}
        onClick={() => move("closed")}
      >
        <FormattedMessage id="staffDesk.status.close" defaultMessage="Close" />
      </button>
      <button
        type="button"
        className={clsx(common.btn, common.danger, common.small)}
        disabled={busy}
        onClick={() => move("spam")}
      >
        <FormattedMessage id="staffDesk.status.spam" defaultMessage="Spam" />
      </button>
      <button
        type="button"
        className={clsx(common.btn, common.ghost, common.small)}
        disabled={busy}
        onClick={archive}
      >
        {ticket.archived ? (
          <FormattedMessage
            id="staffDesk.status.unarchive"
            defaultMessage="Unarchive"
          />
        ) : (
          <FormattedMessage
            id="staffDesk.status.archive"
            defaultMessage="Archive"
          />
        )}
      </button>
    </div>
  );
}
