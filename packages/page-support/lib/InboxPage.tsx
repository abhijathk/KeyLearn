import { Pages, type SupportTicketDetails } from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink } from "react-router";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import * as styles from "./InboxPage.module.less";
import { SupportService, type TicketStatus } from "./service.ts";

type Chip = "needs" | "overdue" | "waiting" | "closed" | "archived";

const OVERDUE_MS = 48 * 60 * 60 * 1000;

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? "?" : trimmed.charAt(0).toUpperCase();
}

function age(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) {
    return "<1h";
  }
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

export function InboxPage(): ReactNode {
  return (
    <DeskShell active="inbox">
      <Inbox />
    </DeskShell>
  );
}

function Inbox(): ReactNode {
  const { formatMessage } = useIntl();
  const [all, setAll] = useState<SupportTicketDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    SupportTicketDetails[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [chip, setChip] = useState<Chip | null>("needs");
  const [holdingCount, setHoldingCount] = useState<number | null>(null);
  const [archivedRows, setArchivedRows] = useState<
    SupportTicketDetails[] | null
  >(null);
  const [archivedCount, setArchivedCount] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    SupportService.listTickets({})
      .then(setAll)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    SupportService.listTickets({ status: "holding" })
      .then((rows) => setHoldingCount(rows.length))
      .catch(() => {});
  }, []);

  const loadArchivedCount = () => {
    SupportService.listTickets({ archived: true })
      .then((rows) => setArchivedCount(rows.length))
      .catch(() => {});
  };
  useEffect(loadArchivedCount, []);

  // Archived tickets are excluded from the default load, so the "archived"
  // chip fetches its own list rather than filtering `all` client-side.
  useEffect(() => {
    if (chip !== "archived") {
      return;
    }
    SupportService.listTickets({ archived: true }).then(setArchivedRows);
  }, [chip]);

  // Debounced search — reaches closed tickets too, since the default load
  // above is capped to the newest 50 and search is meant to find "that one
  // from last month".
  useEffect(() => {
    const term = query.trim();
    if (term === "") {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(() => {
      SupportService.listTickets({ q: term })
        .then(setSearchResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const needs = all.filter(
    (t) => t.status === "open" || t.status === "flagged",
  );
  const overdue = needs.filter(
    (t) => Date.now() - new Date(t.createdAt).getTime() > OVERDUE_MS,
  );
  const waiting = all.filter((t) => t.status === "waiting");
  const closed = all.filter((t) => t.status === "closed");

  const chipRows = (c: Chip): SupportTicketDetails[] => {
    switch (c) {
      case "needs":
        return needs;
      case "overdue":
        return overdue;
      case "waiting":
        return waiting;
      case "closed":
        return closed;
      case "archived":
        return archivedRows ?? [];
    }
  };

  const showing =
    searchResults != null ? searchResults : chip != null ? chipRows(chip) : all;

  return (
    <>
      <div className={styles.searchBox}>
        <svg viewBox="0 0 24 24" aria-hidden={true}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M20 20l-4.8-4.8" />
        </svg>
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder={formatMessage({
            id: "deskInbox.search.placeholder",
            defaultMessage:
              "Search by name, email or keyword — reaches closed tickets too",
          })}
        />
      </div>

      <div className={styles.filters}>
        <ChipButton
          on={chip === "needs" && searchResults == null}
          className={common.chipNew}
          onClick={() => {
            setChip("needs");
            setQuery("");
          }}
        >
          <FormattedMessage
            id="deskInbox.chip.needs"
            defaultMessage="needs a reply · {n}"
            values={{ n: needs.length }}
          />
        </ChipButton>
        <ChipButton
          on={chip === "overdue" && searchResults == null}
          className={common.chipAlarm}
          onClick={() => {
            setChip("overdue");
            setQuery("");
          }}
        >
          <FormattedMessage
            id="deskInbox.chip.overdue"
            defaultMessage="over 48h · {n}"
            values={{ n: overdue.length }}
          />
        </ChipButton>
        <ChipButton
          on={chip === "waiting" && searchResults == null}
          className={common.chipWait}
          onClick={() => {
            setChip("waiting");
            setQuery("");
          }}
        >
          <FormattedMessage
            id="deskInbox.chip.waiting"
            defaultMessage="waiting on them · {n}"
            values={{ n: waiting.length }}
          />
        </ChipButton>
        <ChipButton
          on={chip === "closed" && searchResults == null}
          className={common.chipClosed}
          onClick={() => {
            setChip("closed");
            setQuery("");
          }}
        >
          <FormattedMessage
            id="deskInbox.chip.closed"
            defaultMessage="closed · {n}"
            values={{ n: closed.length }}
          />
        </ChipButton>
        {archivedCount != null && archivedCount > 0 && (
          <ChipButton
            on={chip === "archived" && searchResults == null}
            className={common.chipAnon}
            onClick={() => {
              setChip("archived");
              setQuery("");
            }}
          >
            <FormattedMessage
              id="deskInbox.chip.archived"
              defaultMessage="archived · {n}"
              values={{ n: archivedCount }}
            />
          </ChipButton>
        )}
        <span className={common.grow} />
        {holdingCount != null && holdingCount > 0 && (
          <span className={clsx(common.chip, common.chipAnon)}>
            <FormattedMessage
              id="deskInbox.chip.holding"
              defaultMessage="holding queue · {n}"
              values={{ n: holdingCount }}
            />
          </span>
        )}
      </div>

      <div className={styles.tickets}>
        {(loading || searching) && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.loading"
              defaultMessage="Loading…"
            />
          </p>
        )}
        {!loading && !searching && showing.length === 0 && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.empty"
              defaultMessage="Nothing here."
            />
          </p>
        )}
        {!searching && showing.map((t) => <TicketRow key={t.id} ticket={t} />)}
      </div>

      <div className={common.card} style={{ marginBlockStart: "1rem" }}>
        <p className={common.micro}>
          <FormattedMessage
            id="deskInbox.holding.title"
            defaultMessage="The holding queue"
          />
        </p>
        <p className={common.note}>
          <FormattedMessage
            id="deskInbox.holding.note"
            defaultMessage="Messages from addresses that haven't been confirmed yet aren't in the list above and never will be until somebody follows the link in their own email. Unconfirmed messages are deleted after seven days, so the queue can't grow into a mailbox you have to weed."
          />
        </p>
      </div>
    </>
  );
}

function ChipButton({
  on,
  className,
  onClick,
  children,
}: {
  readonly on: boolean;
  readonly className: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      className={clsx(common.chip, className, on && styles.chipOn)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function statusChip(status: TicketStatus): ReactNode {
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
    case "holding":
      return (
        <span className={clsx(common.chip, common.chipAnon)}>
          <FormattedMessage
            id="deskInbox.status.holding"
            defaultMessage="holding"
          />
        </span>
      );
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

function TicketRow({
  ticket,
}: {
  readonly ticket: SupportTicketDetails;
}): ReactNode {
  const last = ticket.messages[ticket.messages.length - 1];
  const overdue =
    (ticket.status === "open" || ticket.status === "flagged") &&
    Date.now() - new Date(ticket.createdAt).getTime() > OVERDUE_MS;
  return (
    <RouterLink
      to={`${Pages.deskThread.path}/${ticket.id}`}
      className={styles.ticket}
    >
      <span className={styles.who}>{initials(ticket.name)}</span>
      <span className={styles.ticketBody}>
        <span className={clsx(styles.subj, common.truncate)}>
          {ticket.subject}
        </span>
        <span className={clsx(styles.prev, common.truncate)}>
          {last?.body ?? ticket.message}
        </span>
      </span>
      <span className={styles.meta}>
        {sentimentChip(ticket.sentiment)}
        {overdue ? (
          <span className={clsx(common.chip, common.chipAlarm)}>
            <FormattedMessage
              id="deskInbox.status.needs"
              defaultMessage="needs a reply"
            />
          </span>
        ) : (
          statusChip(ticket.status)
        )}
        <span className={styles.when}>{age(ticket.createdAt)}</span>
      </span>
    </RouterLink>
  );
}
