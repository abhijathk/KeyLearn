import { Pages, type StaffSettingsDetails } from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink } from "react-router";
import * as styles from "./AccountsPage.module.less";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { type AccountLookupResult, SupportService } from "./service.ts";

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? "?" : trimmed.charAt(0).toUpperCase();
}

function age(iso: string | null): string {
  if (iso == null) {
    return "—";
  }
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) {
    return "<1h ago";
  }
  if (hours < 48) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export function AccountsPage(): ReactNode {
  return (
    <DeskShell active="accounts">
      <Accounts />
    </DeskShell>
  );
}

function Accounts(): ReactNode {
  const { formatMessage } = useIntl();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountLookupResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [settings, setSettings] = useState<StaffSettingsDetails | null>(null);

  useEffect(() => {
    SupportService.getAccountsTotal()
      .then(setTotal)
      .catch(() => {});
  }, []);

  useEffect(() => {
    SupportService.getSettings().then(setSettings);
  }, []);

  // Empty query still loads something — the 10 most recently registered
  // accounts — so landing on this screen never reads as a blank page.
  useEffect(() => {
    const term = query.trim();
    setSearching(true);
    const id = window.setTimeout(
      () => {
        SupportService.lookupAccounts(term)
          .then(setResults)
          .finally(() => setSearching(false));
      },
      term === "" ? 0 : 300,
    );
    return () => window.clearTimeout(id);
  }, [query]);

  return (
    <>
      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <svg viewBox="0 0 24 24" aria-hidden={true}>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M20 20l-4.8-4.8" />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            autoFocus={true}
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder={formatMessage({
              id: "deskAccounts.search.placeholder",
              defaultMessage: "Search by name, email or account ID",
            })}
          />
        </div>
        {total != null && (
          <span className={styles.totalCount}>
            <i className={styles.totalDot} />
            <b>{total.toLocaleString()}</b>
            <FormattedMessage
              id="deskAccounts.registered"
              defaultMessage="registered"
            />
          </span>
        )}
      </div>

      <p
        className={common.noteSmall}
        style={{ marginBlockStart: 0, marginBlockEnd: "0.9rem" }}
      >
        <FormattedMessage
          id="deskAccounts.hint"
          defaultMessage="Every registered account, searched directly — not just the ones who've written in. Same masked-email-by-default rule as a ticket thread: reveal is one click, and it's logged."
        />
      </p>

      {searching && (
        <p className={common.note}>
          <FormattedMessage id="staffDesk.loading" defaultMessage="Loading…" />
        </p>
      )}
      {!searching && results != null && results.length === 0 && (
        <p className={common.note}>
          <FormattedMessage
            id="staffDesk.empty"
            defaultMessage="Nothing here."
          />
        </p>
      )}
      {!searching &&
        query.trim() === "" &&
        results != null &&
        results.length > 0 && (
          <p className={styles.sectLabel}>
            <FormattedMessage
              id="deskAccounts.recentLabel"
              defaultMessage="Recently registered"
            />
          </p>
        )}

      <div className={styles.rows}>
        {!searching &&
          (results ?? []).map((r) => (
            <AccountRow
              key={r.id}
              account={r}
              compact={Boolean(settings?.compactDensity)}
            />
          ))}
      </div>
    </>
  );
}

function AccountRow({
  account,
  compact,
}: {
  readonly account: AccountLookupResult;
  readonly compact: boolean;
}): ReactNode {
  return (
    <RouterLink
      to={`${Pages.deskAccountDetail.path}/${account.id}`}
      className={clsx(styles.row, compact && styles.rowCompact)}
    >
      <span className={styles.who}>{initials(account.name)}</span>
      <span className={styles.rowBody}>
        <span className={clsx(styles.rowName, common.truncate)}>
          {account.name}
        </span>
        <span className={clsx(styles.rowEmail, common.truncate)}>
          {account.email}
        </span>
      </span>
      <span
        className={clsx(
          common.chip,
          account.emailVerified ? common.chipNew : common.chipAlarm,
        )}
      >
        {account.emailVerified ? (
          <FormattedMessage
            id="deskAccounts.verified"
            defaultMessage="verified"
          />
        ) : (
          <FormattedMessage
            id="deskAccounts.unverified"
            defaultMessage="unverified"
          />
        )}
      </span>
      <span className={styles.rowMeta}>
        <FormattedMessage
          id="deskAccounts.lastSeen"
          defaultMessage="last seen"
        />
        <b>{age(account.lastSeen)}</b>
      </span>
    </RouterLink>
  );
}
