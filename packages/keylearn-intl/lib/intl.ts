import { createIntl, createIntlCache, type IntlShape } from "react-intl";
import { defaultLocale, type LocaleId } from "./locale.ts";
import { defaultRichTextElements } from "./markup.tsx";
import { loadMessages } from "./messages.ts";

const cache = new Map<LocaleId, IntlShape>(); // Server loads multiple intls.

export async function loadIntl(locale: LocaleId): Promise<IntlShape> {
  let intl = cache.get(locale);
  if (intl == null) {
    const messages = await loadMessages(locale);
    cache.set(
      locale,
      (intl = createIntl(
        {
          locale,
          defaultLocale,
          defaultRichTextElements,
          messages,
          onWarn,
          onError,
        },
        createIntlCache(),
      )),
    );
  }
  return intl;
}

function onWarn(warn: any): void {
  console.warn(warn);
}

function onError(err: any): void {
  if (process.env.NODE_ENV === "test") {
    if (err.code === "MISSING_TRANSLATION") {
      // Error: [@formatjs/intl Error MISSING_TRANSLATION]
      // Missing message: "page.multiplayer.link.name" for locale "pl",
      // using default message (Multiplayer) as fallback.
      //
      // When we bundle the sources we rewrite message ids so that
      // ids in the input code never match ids in the bundled output.
      // Tests are run on the input code and therefore all ids are invalid.
      return;
    }
  }
  if (err.code === "MISSING_DATA") {
    // Not a fault in KeyLearn: Chrome ships no number, date or list data for
    // as, is, mn, ne, or and sq (Intl.NumberFormat.supportedLocalesOf returns
    // nothing; PluralRules does have them, so messages still pluralise in the
    // learner's language). react-intl then formats numbers and dates the
    // English way, which is the fallback we want, and reported it as an error
    // on every page load in those six languages. Nothing to fix at runtime
    // short of shipping the formatjs locale-data polyfills.
    return;
  }
  console.error("I18N error:", err);
}
