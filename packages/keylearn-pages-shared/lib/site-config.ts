import { allLocales, type LocaleId } from "@keylearn/intl";
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

export function usePageStates(): Readonly<Record<string, PageState>> {
  return usePageData().pages ?? {};
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
  const { pages, admin } = usePageData();
  return (name) => {
    const state = pages?.[name] ?? "live";
    return admin === true || state === "live" || state === "soon";
  };
}

/**
 * Whether this page should show the coming-soon panel instead of itself.
 *
 * An admin is excluded on purpose: they can open a page that is not open
 * yet, which is how it gets checked before it goes live.
 */
export function usePageComingSoon(): (name: string) => boolean {
  const { pages, admin } = usePageData();
  return (name) => admin !== true && (pages?.[name] ?? "live") === "soon";
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
