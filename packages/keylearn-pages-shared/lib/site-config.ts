import { allLocales, type LocaleId } from "@keylearn/intl";
import { usePageData } from "./pagedata.tsx";

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

/** Whether the client should offer a page: live, or the viewer is an admin. */
export function usePageLive(): (name: string) => boolean {
  const { pages, admin } = usePageData();
  return (name) => admin === true || (pages?.[name] ?? "live") === "live";
}

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
