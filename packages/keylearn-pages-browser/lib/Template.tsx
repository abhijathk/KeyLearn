import { CompleteProfileGate, useProfiles } from "@keylearn/page-account";
import { SupportService } from "@keylearn/page-support";
import { type NoticeDetails } from "@keylearn/pages-shared";
import { AdBanner, adSenseClientId } from "@keylearn/thirdparties";
import { PortalContainer, Toaster } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { showAds } from "./ads.ts";
import { Header } from "./Header.tsx";
import { LoginPrompt } from "./LoginPrompt.tsx";
import { MenuDrawer } from "./MenuDrawer.tsx";
import { SmallScreenGate } from "./SmallScreenGate.tsx";
import { SupportDialog } from "./SupportDialog.tsx";
import * as styles from "./Template.module.less";

// Which notice the visitor already dismissed, so retracting and reposting a
// DIFFERENT notice still shows — only the exact one they closed stays hidden.
function loadDismissedNoticeId(): number | null {
  try {
    const raw = sessionStorage.getItem("keylearn.dismissedNotice");
    return raw == null ? null : Number(raw);
  } catch {
    return null;
  }
}

function saveDismissedNoticeId(id: number): void {
  try {
    sessionStorage.setItem("keylearn.dismissedNotice", String(id));
  } catch {
    // Storage may be unavailable; the banner will simply reappear.
  }
}

function NoticeBanner(): ReactNode {
  const { formatMessage } = useIntl();
  const [notice, setNotice] = useState<NoticeDetails | null>(null);
  const [dismissed, setDismissed] = useState(loadDismissedNoticeId);

  useEffect(() => {
    let cancelled = false;
    SupportService.getActiveNotice()
      .then((n) => {
        if (!cancelled) {
          setNotice(n);
        }
      })
      .catch(() => {
        // A failed fetch just means no banner this load — never worth
        // surfacing as an error on every single page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (notice == null || notice.id === dismissed) {
    return null;
  }
  return (
    <div className={styles.notice} data-level={notice.level} role="status">
      <span className={styles.noticeText}>{notice.message}</span>
      <button
        type="button"
        className={styles.noticeClose}
        aria-label={formatMessage({
          id: "notice.dismiss",
          defaultMessage: "Dismiss",
        })}
        onClick={() => {
          saveDismissedNoticeId(notice.id);
          setDismissed(notice.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}

// The household's remembered grown-ups/kids preference. Absent for most of
// them — it is only written when somebody uses the drawer's switch — which is
// exactly why it cannot be the only thing the ad gate consults (see ads.ts).
function storedMode(): string | null {
  try {
    return localStorage.getItem("keylearn.mode");
  } catch {
    // Storage unavailable (private mode, an embedded webview). Unknown, which
    // showAds() already treats as a reason for caution rather than a green
    // light.
    return null;
  }
}

// The drawer's open state survives the subtree remount that a learner
// switch triggers, so flipping profiles doesn't slam the panel shut.
function loadMenuOpen(): boolean {
  try {
    return sessionStorage.getItem("keylearn.drawer") === "open";
  } catch {
    return false;
  }
}

function saveMenuOpen(open: boolean): void {
  try {
    sessionStorage.setItem("keylearn.drawer", open ? "open" : "closed");
  } catch {
    // Storage may be unavailable.
  }
}

export function Template({
  path,
  children,
}: {
  readonly path: string;
  readonly children: ReactNode;
}) {
  const [menuOpen, setMenuOpenState] = useState(loadMenuOpen);
  const setMenuOpen = (open: boolean) => {
    saveMenuOpen(open);
    setMenuOpenState(open);
  };
  const [supportOpen, setSupportOpen] = useState(false);
  const { active } = useProfiles();
  const ads = showAds({
    adNetworkConfigured: adSenseClientId !== "0",
    path,
    activeProfileKind: active?.kind ?? null,
    storedMode: storedMode(),
  });
  return (
    <div className={styles.body}>
      {/*
        First in the document, so a keyboard or screen-reader user can reach
        the lesson without walking the header, the profile menu and the drawer
        on every single page. Invisible until focused (WCAG 2.4.1).
      */}
      <a className={styles.skipLink} href="#main">
        <FormattedMessage
          id="nav.skipToContent"
          defaultMessage="Skip to the main content"
        />
      </a>
      <Header
        onOpenMenu={() => setMenuOpen(true)}
        onOpenSupport={() => setSupportOpen(true)}
        showFocus={path === "/"}
        showBack={path !== "/"}
        kids={path === "/kids"}
        practice={path === "/"}
      />
      <NoticeBanner />
      <main className={styles.main} id="main" tabIndex={-1}>
        {children}
        <PortalContainer />
        <Toaster />
      </main>
      {ads && (
        <div className={styles.adSlot}>
          <div className={styles.adLabel}>
            <FormattedMessage
              id="template.adLabel"
              defaultMessage="Advertisement"
            />
          </div>
          <AdBanner />
        </div>
      )}
      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        path={path}
      />
      <LoginPrompt path={path} />
      <SupportDialog open={supportOpen} onClose={() => setSupportOpen(false)} />
      <EnvName />
      <CompleteProfileGate />
      <SmallScreenGate />
    </div>
  );
}

function EnvName() {
  return process.env.NODE_ENV === "production" ? null : (
    <div
      style={{
        position: "fixed",
        zIndex: "1",
        insetInlineEnd: "0px",
        insetBlockEnd: "0px",
        padding: "5px",
        margin: "5px",
        border: "1px solid red",
        color: "red",
      }}
    >
      {`process.env.NODE_ENV=${process.env.NODE_ENV}`}
    </div>
  );
}
