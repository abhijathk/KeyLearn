import { CompleteProfileGate } from "@keylearn/page-account";
import { SupportService } from "@keylearn/page-support";
import { type NoticeDetails, Pages, SiteNotice } from "@keylearn/pages-shared";
import { PortalContainer, Toaster } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
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

// How often an already-open tab re-checks for a retracted/changed notice —
// staff turning one off should clear it everywhere within this window, not
// just on the next full page load.
const NOTICE_POLL_MS = 30_000;

function SiteNoticeBanner(): ReactNode {
  const [notice, setNotice] = useState<NoticeDetails | null>(null);
  const [dismissed, setDismissed] = useState(loadDismissedNoticeId);
  // Steps aside the moment keys start landing — an incident notice has no
  // close button by design (see NoticeBanner.tsx), so without this it would
  // sit fixed over (or above) the practice text for the entire session.
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const onTyping = (ev: Event) => {
      setTyping(Boolean((ev as CustomEvent<boolean>).detail));
    };
    window.addEventListener("keylearn:typing", onTyping);
    return () => window.removeEventListener("keylearn:typing", onTyping);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchNotice = () => {
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
    };
    fetchNotice();
    const id = window.setInterval(fetchNotice, NOTICE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (notice == null || notice.id === dismissed) {
    return null;
  }
  // Stays mounted and fades/collapses via CSS rather than unmounting outright
  // — an instant pop in and out (React mounting/unmounting the DOM node) is
  // what read as "choppy"; a transitioned opacity + height glides instead.
  return (
    <div
      className={clsx(
        styles.noticeTransition,
        typing && styles.noticeTransitionHidden,
      )}
      aria-hidden={typing}
    >
      <SiteNotice
        notice={notice}
        onDismiss={() => {
          saveDismissedNoticeId(notice.id);
          setDismissed(notice.id);
        }}
      />
    </div>
  );
}

// Whether the drawer is open, held OUTSIDE the component on purpose. Each
// route wraps its page in its own <Template>, so a client-side navigation
// unmounts one Template and mounts another — and drawer state kept in
// useState died with the old one. That is why switching learners closed the
// panel: the first hop was saved by a one-shot sessionStorage flag, and the
// second hop found the flag already spent.
//
// A module variable has exactly the wanted lifetime. It survives every SPA
// hop, because the module lives as long as the page's JS — and it dies on a
// real reload, so the drawer never reopens on a fresh visit, which is the
// problem the old flag's one-hop design existed to avoid.
let drawerOpen = false;

export function Template({
  path,
  children,
}: {
  readonly path: string;
  readonly children: ReactNode;
}) {
  const [menuOpen, setMenuOpenState] = useState(() => drawerOpen);
  const setMenuOpen = (open: boolean) => {
    drawerOpen = open;
    setMenuOpenState(open);
  };
  const [supportOpen, setSupportOpen] = useState(false);
  return (
    // "desk-app" is a plain, un-hashed marker class (not a CSS-module one):
    // accents.less reaches for it via `html:has(.desk-app)` from a different
    // package, which only works if the name survives compilation unhashed.
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
      <SiteNoticeBanner />
      <main className={styles.main} id="main" tabIndex={-1}>
        {children}
        <PortalContainer />
        <Toaster />
      </main>
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
