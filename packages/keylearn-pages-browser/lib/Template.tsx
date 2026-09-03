import { CompleteProfileGate } from "@keylearn/page-account";
import { SupportService } from "@keylearn/page-support";
import {
  activeProfileKind,
  AdBar,
  type AdView,
  type LearnerResponseState,
  LearnerVoiceCard,
  type LearnerVoiceInput,
  type NoticeDetails,
  pageNameOfPath,
  Pages,
  PROFILE_CHANGED_EVENT,
  SiteNotice,
  usePageComingSoon,
  usePageData,
} from "@keylearn/pages-shared";
import { PortalContainer, Toaster } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { ComingSoon } from "./ComingSoon.tsx";
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

/**
 * The paid line above the header (spec, phase 4).
 *
 * Three of the four reasons a reader does not see one are settled on the
 * server, which answers with an empty list; the two settled here are the
 * two the server cannot see. Which profile is active is a choice this
 * browser holds and never sends, and whether a lesson is running is a fact
 * about this second. So a child profile and the kids world are closed off
 * on this side, and the bar steps aside the moment keys start landing,
 * exactly as the site notice does.
 */
function AdSlot({ path }: { readonly path: string }): ReactNode {
  const [ads, setAds] = useState<readonly AdView[]>([]);
  const [dwell, setDwell] = useState(8);
  const [typing, setTyping] = useState(false);
  const [hidden, setHidden] = useState(() => adsHiddenThisLoad);
  const [kind, setKind] = useState(activeProfileKind);

  useEffect(() => {
    const onChange = () => setKind(activeProfileKind());
    window.addEventListener(PROFILE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    const onTyping = (ev: Event) => {
      setTyping(Boolean((ev as CustomEvent<boolean>).detail));
    };
    window.addEventListener("keylearn:typing", onTyping);
    return () => window.removeEventListener("keylearn:typing", onTyping);
  }, []);

  useEffect(() => {
    if (hidden || kind === "kid" || path === "/kids") {
      return;
    }
    let cancelled = false;
    const fetchAds = () => {
      SupportService.getAds()
        .then(({ ads, dwellSeconds }) => {
          if (!cancelled) {
            setAds(ads);
            setDwell(dwellSeconds);
          }
        })
        .catch(() => {
          // No line this load. Never worth an error on every page.
        });
    };
    fetchAds();
    const id = window.setInterval(fetchAds, NOTICE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hidden, kind, path]);

  if (hidden || kind === "kid" || path === "/kids" || ads.length === 0) {
    return null;
  }
  return (
    <div
      className={clsx(
        styles.noticeTransition,
        typing && styles.noticeTransitionHidden,
      )}
      aria-hidden={typing}
    >
      <AdBar
        ads={ads}
        dwellSeconds={dwell}
        onView={(id, screen) => {
          void SupportService.countAdView(id, screen).catch(() => {});
        }}
        onDismiss={() => {
          adsHiddenThisLoad = true;
          setHidden(true);
        }}
      />
    </div>
  );
}

/**
 * Whether the reader closed the paid line, for THIS page load only.
 *
 * A module variable rather than session storage, on purpose (owner, 4 Sep
 * 2026): closing it should quiet the line while somebody is working, and a
 * reload should bring it back. Session storage outlived the reload and made
 * the cross behave like an opt-out the advertiser had not agreed to. This
 * lives exactly as long as the page's JavaScript — so it survives a
 * client-side hop between pages, which would otherwise undo the close a
 * second after it was clicked, and dies on a real refresh.
 */
let adsHiddenThisLoad = false;

function loadDismissedCardId(): number | null {
  try {
    const raw = sessionStorage.getItem("keylearn.dismissedCard");
    return raw == null ? null : Number(raw);
  } catch {
    return null;
  }
}

/**
 * The corner slot for a poll or a feedback card (spec §8, phase 3). Shown
 * only to a signed-in account on an adult profile — a kid profile is never
 * asked — and gone for the session once its exit button is pressed.
 */
function LearnerVoiceSlot(): ReactNode {
  const { user } = usePageData();
  const [notice, setNotice] = useState<NoticeDetails | null>(null);
  const [state, setState] = useState<LearnerResponseState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(loadDismissedCardId);
  const [kind, setKind] = useState(activeProfileKind);

  useEffect(() => {
    const onChange = () => setKind(activeProfileKind());
    window.addEventListener(PROFILE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (user == null) {
      return;
    }
    let cancelled = false;
    const fetchCard = () => {
      SupportService.getLearnerVoiceNotice()
        .then((n) => {
          if (!cancelled) {
            setNotice((prev) => (prev?.id === n?.id ? prev : n));
          }
        })
        .catch(() => {});
    };
    fetchCard();
    const id = window.setInterval(fetchCard, NOTICE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    if (notice == null || user == null) {
      setState(null);
      return;
    }
    let cancelled = false;
    SupportService.getLearnerResponse(notice.id)
      .then((s) => {
        if (!cancelled) {
          setState(s);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [notice, user]);

  if (
    user == null ||
    kind === "kid" ||
    notice == null ||
    notice.id === dismissed ||
    (state != null && !state.open)
  ) {
    return null;
  }
  const submit = (input: LearnerVoiceInput) => {
    setBusy(true);
    setError(null);
    SupportService.putLearnerResponse(notice.id, input)
      .then((s) => setState(s))
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setBusy(false));
  };
  return (
    <LearnerVoiceCard
      notice={notice}
      state={state}
      busy={busy}
      error={error}
      onSubmit={submit}
      onExit={() => {
        try {
          sessionStorage.setItem("keylearn.dismissedCard", String(notice.id));
        } catch {
          // Storage unavailable; the card just returns next load.
        }
        setDismissed(notice.id);
      }}
    />
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
  const comingSoon = usePageComingSoon();
  const pageName = pageNameOfPath(path);
  const soon = pageName != null && comingSoon(pageName);
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
      {/* Above the header, not below it (owner decision 3 Sep 2026): a
          site-wide message is about the whole page, so it sits over the
          chrome rather than between the chrome and the work. */}
      <SiteNoticeBanner />
      {/* Under the notice and still above the header: a message from us
          always outranks a message somebody paid for, and a campaign that
          asked to stand aside for one is not in this list at all. */}
      <AdSlot path={path} />
      <Header
        onOpenMenu={() => setMenuOpen(true)}
        onOpenSupport={() => setSupportOpen(true)}
        showFocus={path === "/"}
        showBack={path !== "/"}
        kids={path === "/kids"}
        practice={path === "/"}
      />
      <LearnerVoiceSlot />
      <main className={styles.main} id="main" tabIndex={-1}>
        {/* A page the control centre has set to "coming soon" keeps its
            link, its route and all of this chrome, and shows the panel in
            place of itself. A page set to 404 never reaches here at all. */}
        {soon ? <ComingSoon /> : children}
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
