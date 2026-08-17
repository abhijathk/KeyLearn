import { Pages, usePageData } from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink, Navigate } from "react-router";
import * as styles from "./DeskShell.module.less";
import { SupportService } from "./service.ts";

export type DeskScreen =
  | "dashboard"
  | "inbox"
  | "accounts"
  | "answers"
  | "notices"
  | "audit"
  | "settings"
  | "about"
  | "platformSettings";

type NavEntry = {
  readonly screen: DeskScreen;
  readonly path: string;
  readonly label: ReactNode;
  readonly icon: ReactNode;
};

// Icon paths copied verbatim from the mock's own `.navitem` SVGs (§07) — the
// mock is the authoritative icon set for this console, not a generic
// widget icon.
const MAIN_NAV: readonly NavEntry[] = [
  {
    screen: "dashboard",
    path: Pages.desk.path,
    label: (
      <FormattedMessage id="deskNav.dashboard" defaultMessage="Dashboard" />
    ),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    screen: "inbox",
    path: Pages.deskInbox.path,
    label: <FormattedMessage id="deskNav.inbox" defaultMessage="Inbox" />,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <path d="M3 12h4l2 3h6l2-3h4" />
        <path d="M5.5 12 4 6.5A2 2 0 0 1 6 4h12a2 2 0 0 1 2 2.5L18.5 12" />
        <path d="M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" />
      </svg>
    ),
  },
  {
    screen: "accounts",
    path: Pages.deskAccounts.path,
    label: <FormattedMessage id="deskNav.accounts" defaultMessage="Accounts" />,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    screen: "answers",
    path: Pages.deskAnswers.path,
    label: <FormattedMessage id="deskNav.answers" defaultMessage="Answers" />,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <path d="M12 6.5C10.2 5 7.3 4.3 4 4.3v14.4c3.3 0 6.2.7 8 2.2 1.8-1.5 4.7-2.2 8-2.2V4.3c-3.3 0-6.2.7-8 2.2z" />
      </svg>
    ),
  },
  {
    screen: "notices",
    path: Pages.deskNotices.path,
    label: <FormattedMessage id="deskNav.notices" defaultMessage="Notices" />,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1z" />
        <path d="M17.5 8.5a5 5 0 0 1 0 7" />
      </svg>
    ),
  },
  {
    screen: "audit",
    path: Pages.deskAudit.path,
    label: <FormattedMessage id="deskNav.audit" defaultMessage="Audit" />,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    screen: "settings",
    path: Pages.deskSettings.path,
    label: <FormattedMessage id="deskNav.settings" defaultMessage="Settings" />,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    ),
  },
];

// Separated from MAIN_NAV: neither is day-to-day ticket work, so both sit
// pinned to the bottom of the nav rather than mixed in with it. This
// Settings is the desk *platform* — staff access and (once more than one
// app is assigned to the same staff email) which app is selected — not
// how the desk behaves, which is MAIN_NAV's own "Settings" now.
const BOTTOM_NAV: readonly NavEntry[] = [
  {
    screen: "about",
    path: Pages.deskAbout.path,
    label: <FormattedMessage id="deskNav.about" defaultMessage="About" />,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5M12 7.6h0" />
      </svg>
    ),
  },
  {
    screen: "platformSettings",
    path: Pages.deskPlatformSettings.path,
    label: (
      <FormattedMessage
        id="deskNav.platformSettings"
        defaultMessage="QDesk settings"
      />
    ),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden={true}>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M3 9h18" />
        <path d="M7.5 13.5h0M11.5 13.5h5" />
      </svg>
    ),
  },
];

const NAV: readonly NavEntry[] = [...MAIN_NAV, ...BOTTOM_NAV];

/**
 * The left-nav wrapper every staff screen mounts inside. Centralises the
 * staff-gate redirect that used to live at the top of `StaffDeskPage`/
 * `AuditLogPage` individually — every one of the six screens needs it now,
 * so it belongs here once.
 */
export function DeskShell({
  active,
  children,
}: {
  readonly active: DeskScreen;
  readonly children: ReactNode;
}): ReactNode {
  const { publicUser } = usePageData();
  const { formatMessage } = useIntl();
  // Server-side requireStaff() is the real boundary; this only spares a
  // non-eligible visitor a page full of controls that would all 403 anyway.
  // The sign-in screen re-checks the real reason (signed out, wrong
  // account, or missing a second factor) rather than this just guessing.
  if (!publicUser.staff) {
    const current =
      NAV.find((n) => n.screen === active)?.path ?? Pages.desk.path;
    return (
      <Navigate
        to={`${Pages.deskSignin.path}?returnTo=${encodeURIComponent(current)}`}
        replace={true}
      />
    );
  }
  return (
    <div className={styles.shell}>
      <nav
        className={styles.nav}
        aria-label={formatMessage({
          id: "staffDesk.headline",
          defaultMessage: "Support desk",
        })}
      >
        <ul className={styles.navList}>
          {MAIN_NAV.map((entry) => (
            <li key={entry.screen}>
              <RouterLink
                to={entry.path}
                className={
                  entry.screen === active ? styles.navItemOn : styles.navItem
                }
                aria-current={entry.screen === active ? "page" : undefined}
              >
                {entry.icon}
                {entry.label}
                {entry.screen === "inbox" && <InboxBadge />}
                {entry.screen === "notices" && <NoticesBadge />}
              </RouterLink>
            </li>
          ))}
        </ul>
        <ul className={styles.navListBottom}>
          {BOTTOM_NAV.map((entry) => (
            <li key={entry.screen}>
              <RouterLink
                to={entry.path}
                className={
                  entry.screen === active ? styles.navItemOn : styles.navItem
                }
                aria-current={entry.screen === active ? "page" : undefined}
              >
                {entry.icon}
                {entry.label}
              </RouterLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.main}>{children}</div>
    </div>
  );
}

function InboxBadge(): ReactNode {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      SupportService.listTickets({ status: "open" }),
      SupportService.listTickets({ status: "flagged" }),
    ])
      .then(([open, flagged]) => {
        if (!cancelled) {
          setCount(open.length + flagged.length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (count === 0) {
    return null;
  }
  return <span className={styles.navBadge}>{count}</span>;
}

function NoticesBadge(): ReactNode {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // NoticeDetails doesn't carry the row's `active` flag (a retracted
    // notice's response looks identical to a live one) — inferred here from
    // the scheduled window instead, which is right for every notice that
    // simply expires on its own and only wrong for one retracted early
    // mid-window, a rare, staff-visible action anyway.
    SupportService.listAllNotices()
      .then((notices) => {
        if (cancelled) {
          return;
        }
        const now = Date.now();
        const live = notices.filter((n) => {
          if (n.kind !== "incident") {
            return false;
          }
          const started =
            n.startsAt == null || new Date(n.startsAt).getTime() <= now;
          const notEnded =
            n.endsAt == null || new Date(n.endsAt).getTime() > now;
          return started && notEnded;
        });
        setCount(live.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (count === 0) {
    return null;
  }
  return <span className={styles.navBadgeAlert}>{count}</span>;
}
