import { allLocales, type LocaleId } from "@keylearn/intl";
import { useEffect, useSyncExternalStore } from "react";
import { usePageData } from "./pagedata.tsx";
import { Pages } from "./pages.ts";

/**
 * The client's view of the control centre's switches, from page data.
 *
 * The server refuses a switched-off page and negotiates only switched-on
 * locales; these hooks keep the in-app router, the menus and the language
 * lists in step so the two never disagree. An admin sees every page (so a
 * page can be checked before it goes live) but the same language lists as
 * everyone else.
 */

export type PageState = "live" | "404" | "soon";

/**
 * The page states as they are NOW, not as they were when the page loaded.
 *
 * Page data is read once, so a page switched off in the control centre kept
 * working in every tab that was already open until somebody refreshed it
 * (owner, 1 Oct 2026). A newer answer, fetched by `usePageStatesSync`, is
 * held here and wins over what the page loaded with.
 */
let livePages: Readonly<Record<string, PageState>> | null = null;
const liveListeners = new Set<() => void>();
const subscribeLive = (listener: () => void) => {
  liveListeners.add(listener);
  return () => {
    liveListeners.delete(listener);
  };
};
const readLive = () => livePages;

export function usePageStates(): Readonly<Record<string, PageState>> {
  const loaded = usePageData().pages ?? {};
  const fresh = useSyncExternalStore(subscribeLive, readLive, readLive);
  return fresh ?? loaded;
}

/** How often an open tab asks whether a page has been switched on or off. */
const PAGE_SYNC_MS = 30_000;

/**
 * Keeps this tab's page states current: asks now, then every half minute
 * while the tab is visible, and again the moment it comes back into view.
 * The server's answer is the same table it enforces on every request.
 */
export function usePageStatesSync(): void {
  useEffect(() => {
    let stopped = false;
    const ask = async () => {
      if (stopped || document.visibilityState === "hidden") {
        return;
      }
      try {
        const response = await fetch("/_/pages/state", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as {
          readonly pages?: Record<string, PageState>;
        };
        if (!stopped && body.pages != null) {
          const next = body.pages;
          const same =
            livePages != null &&
            Object.keys(next).length === Object.keys(livePages).length &&
            Object.keys(next).every((key) => livePages![key] === next[key]);
          if (!same) {
            livePages = next;
            liveListeners.forEach((listener) => listener());
          }
        }
      } catch {
        // Offline or the server restarting: keep what we had.
      }
    };
    const timer = window.setInterval(() => void ask(), PAGE_SYNC_MS);
    const onVisible = () => void ask();
    document.addEventListener("visibilitychange", onVisible);
    void ask();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

/**
 * Whether the client should offer a page at all: its link in the menus and
 * its route in the in-app router.
 *
 * "Coming soon" counts as offered, and that is the whole difference between
 * the two off states. A page set to 404 is gone: no link, no route, nothing
 * to find. A page set to coming soon is announced: the link stays where it
 * was and leads to a page that says it is not open yet. Hiding the link
 * would make the two states identical to a visitor, and then one of them
 * would have no reason to exist.
 */
export function usePageOffered(): (name: string) => boolean {
  const { admin } = usePageData();
  const pages = usePageStates();
  return (name) => {
    const state = pages?.[name] ?? "live";
    return adminPreview(admin) || state === "live" || state === "soon";
  };
}

/**
 * An admin looking at pages that are not open — only when they ask to, with
 * `?preview` on the address (owner, 7 Oct 2026). Without it an admin gets
 * exactly what everybody else gets, so switching a page off is seen to work.
 * The server applies the same rule.
 */
function adminPreview(admin: boolean | undefined): boolean {
  return (
    admin === true &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("preview")
  );
}

/**
 * Whether this page should show the coming-soon panel instead of itself.
 *
 * An admin is excluded on purpose: they can open a page that is not open
 * yet, which is how it gets checked before it goes live.
 */
export function usePageComingSoon(): (name: string) => boolean {
  const { admin } = usePageData();
  const pages = usePageStates();
  return (name) => !adminPreview(admin) && (pages?.[name] ?? "live") === "soon";
}

/**
 * Is this path a page that is switched OFF (404) for this visitor?
 *
 * The router has no route for such a page, so an in-app move to it (a kid
 * profile sent to the kids page, a menu click in a tab opened before the
 * switch was flipped) used to fall through to the catch-all, which draws
 * adult practice under the wrong address. The caller answers this by asking
 * the server, which gives the real 404 a refresh would.
 */
export function usePageRefused(): (path: string) => boolean {
  const { admin } = usePageData();
  const pages = usePageStates();
  return (path) => {
    const name = pageNameOfPath(path);
    return name != null && !adminPreview(admin) && pages[name] === "404";
  };
}

/**
 * The registry page name for a route path, or null for a page that has no
 * switch of its own (account, legal, sign-in).
 *
 * Shared with the server, which gates the same paths on the same names; one
 * map so the router and the menus cannot disagree about which page a path
 * belongs to.
 */
export function pageNameOfPath(path: string): string | null {
  return PAGE_NAME_BY_PATH.get(path) ?? null;
}

const PAGE_NAME_BY_PATH: ReadonlyMap<string, string> = new Map([
  [Pages.practice.path, "practice"],
  [Pages.kids.path, "kids"],
  [Pages.braille.path, "braille"],
  [Pages.typingTest.path, "typingTest"],
  [Pages.multiplayer.path, "multiplayer"],
  [Pages.texts.path, "texts"],
  [Pages.highScores.path, "highScores"],
  [Pages.support.path, "support"],
  [Pages.helpCentre.path, "helpCentre"],
  [Pages.forSchools.path, "forSchools"],
  [Pages.verify.path, "verify"],
  [Pages.layouts.path, "layouts"],
  [Pages.profile.path, "profile"],
  [Pages.guide.path, "guide"],
  [Pages.about.path, "about"],
]);

/** The site locales switched on, in registry order. */
export function useSiteLocales(): readonly LocaleId[] {
  const { siteLocales } = usePageData();
  if (siteLocales == null) {
    return allLocales;
  }
  const allowed = new Set(siteLocales);
  return allLocales.filter((locale) => allowed.has(locale));
}

/** The typing language ids switched on, or null for "all". */
export function useTypingLanguages(): ReadonlySet<string> | null {
  const { typingLanguages } = usePageData();
  return typingLanguages == null ? null : new Set(typingLanguages);
}

/** The site-wide learner defaults, or an empty object. */
export function useLearnerDefaults(): Readonly<Record<string, unknown>> {
  return usePageData().learnerDefaults ?? {};
}

/**
 * How the site applies one learner default (phase 3.4): the learner decides
 * ("default"), the site value replaces their choice ("forced"), or it is
 * forced and the control is removed too ("hidden").
 */
export function useLearnerOverride(
  key: string,
): "default" | "forced" | "hidden" {
  return usePageData().learnerOverrides?.[key] ?? "default";
}

/** A page-level learner default by key, with a fallback. */
export function useLearnerDefault<T>(key: string, fallback: T): T {
  const value = usePageData().learnerDefaults?.[key];
  return (value === undefined ? fallback : value) as T;
}
