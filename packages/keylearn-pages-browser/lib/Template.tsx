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

/**
 * What the reader actually closed — the message, not the row.
 *
 * This used to be the notice's id, on the reasoning that retracting one and
 * posting a DIFFERENT one should still show. That is right and the id is the
 * wrong way to say it: EDITING a notice keeps its id, so staff who fixed a
 * wrong date or a broken link published to everyone except the people who had
 * already read and closed the wrong version — the ones most in need of the
 * correction (owner, 4 Sep 2026).
 *
 * So it keys on what was on screen. Change the words, the display or a poll's
 * options and it is a different notice to a reader, whatever the database
 * calls it; leave them alone and the close still holds. The desk does carry an
 * `updated_at`, but it does not send it and an edit that fails to bump it
 * would fail silently — the content cannot lie about itself.
 */
function noticePrint(n: NoticeDetails): string {
  return JSON.stringify([
    n.id,
    n.message,
    n.display,
    n.level,
    n.options ?? null,
  ]);
}

function loadDismissed(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveDismissed(key: string, print: string): void {
  try {
    sessionStorage.setItem(key, print);
  } catch {
    // Storage may be unavailable; the notice will simply reappear.
  }
}

// How often an already-open tab re-checks for a retracted/changed notice —
// staff turning one off should clear it everywhere within this window, not
// just on the next full page load.
const NOTICE_POLL_MS = 30_000;

function SiteNoticeBanner({
  onShowing,
}: {
  /** Told whenever a notice starts or stops occupying the bar for this reader. */
  readonly onShowing?: (showing: boolean) => void;
}): ReactNode {
  const [notice, setNotice] = useState<NoticeDetails | null>(null);
  const [dismissed, setDismissed] = useState(() =>
    loadDismissed("keylearn.dismissedNotice"),
  );
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

  const showing = notice != null && noticePrint(notice) !== dismissed;
  useEffect(() => {
    onShowing?.(showing);
  }, [showing, onShowing]);
  if (!showing) {
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
          const print = noticePrint(notice);
          saveDismissed("keylearn.dismissedNotice", print);
          setDismissed(print);
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
function AdSlot({
  path,
  noticeShowing,
}: {
  readonly path: string;
  readonly noticeShowing: boolean;
}): ReactNode {
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

  // A campaign that asked to stand aside steps out only while a notice is
  // ACTUALLY on this reader's screen. Once they close it the bar is theirs
  // again — which is the whole point of standing aside rather than being
  // switched off, and what used to leave a reader with neither on every load
  // until the notice was retracted (owner, 4 Sep 2026).
  const free = ads.filter((ad) => !(ad.standsAside === true && noticeShowing));
  if (hidden || kind === "kid" || path === "/kids" || free.length === 0) {
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
        ads={free}
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

// The same rule as the banner: a card whose question or options were edited
// is a different card, and a reader who answered the old one has not seen it.
function loadDismissedCardPrint(): string | null {
  return loadDismissed("keylearn.dismissedCard");
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
  const [dismissed, setDismissed] = useState(loadDismissedCardPrint);
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
    noticePrint(notice) === dismissed ||
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
        const print = noticePrint(notice);
        saveDismissed("keylearn.dismissedCard", print);
        setDismissed(print);
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
  /**
   * Whether a site notice is on THIS reader's screen right now.
   *
   * The one thing the notice and the ad both need and neither owns: a campaign
   * that stands aside for notices must step out while one is up and come back
   * the moment the reader closes it. The server cannot answer that — it knows
   * only that a notice is live site-wide — so the answer is here, where the
   * banner either rendered or did not.
   */
  const [noticeShowing, setNoticeShowing] = useState(false);
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
      <SiteNoticeBanner onShowing={setNoticeShowing} />
      {/* Under the notice and still above the header: a message from us
          always outranks a message somebody paid for, and a campaign that
          asked to stand aside for one is not in this list at all. */}
      <AdSlot path={path} noticeShowing={noticeShowing} />
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
