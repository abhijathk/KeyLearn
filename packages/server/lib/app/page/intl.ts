import { type Context } from "@fastr/core";
import { NotFoundError } from "@fastr/errors";
import {
  allLocales,
  defaultLocale,
  loadIntl,
  type LocaleId,
  selectLocale,
} from "@keylearn/intl";
import { type IntlShape } from "react-intl";
import {
  siteLocaleAllowed,
  siteLocalesAllowed,
} from "../site-config/readers.ts";

export const localePattern = `(${allLocales
  .filter((locale) => locale !== defaultLocale)
  .join("|")})`;

export async function pIntl(ctx: Context, value: LocaleId): Promise<IntlShape> {
  if (allLocales.includes(value)) {
    // A locale the control centre has switched off falls back to English
    // (spec §6.1): the URL still answers, in the language every other one
    // relies on, rather than 404 — nothing was deleted, only hidden.
    return await loadIntl(siteLocaleAllowed(value) ? value : defaultLocale);
  } else {
    throw new NotFoundError();
  }
}

export function preferredLocale(ctx: Context): LocaleId {
  // Negotiate only among the locales the control centre has switched on;
  // with everything on (the shipped state) the list is untouched. Candidate
  // tags arrive in whatever case the negotiator uses, so compare lowercased.
  const allowed = siteLocalesAllowed();
  const everything = allowed.length === allLocales.length;
  const allowedSet = new Set(allowed.map((locale) => locale.toLowerCase()));
  return selectLocale((...locales) =>
    ctx.request.negotiateLanguage(
      ...(everything
        ? locales
        : locales.filter((locale) => allowedSet.has(locale.toLowerCase()))),
    ),
  );
}

/** The locales the site offers right now, for the switcher and the sitemap. */
export function offeredLocales(): readonly LocaleId[] {
  return allLocales.filter((locale) => siteLocalesAllowed().includes(locale));
}
