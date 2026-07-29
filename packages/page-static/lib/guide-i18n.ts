import { type GuideTranslation } from "./guide-content.tsx";
import { ar } from "./guide-i18n/ar.ts";
import { de } from "./guide-i18n/de.ts";
import { es } from "./guide-i18n/es.ts";
import { fr } from "./guide-i18n/fr.ts";
import { hi } from "./guide-i18n/hi.ts";
import { it } from "./guide-i18n/it.ts";
import { ja } from "./guide-i18n/ja.ts";
import { ko } from "./guide-i18n/ko.ts";
import { nl } from "./guide-i18n/nl.ts";
import { ptBr } from "./guide-i18n/pt-br.ts";
import { ru } from "./guide-i18n/ru.ts";
import { zhHans } from "./guide-i18n/zh-hans.ts";

// User Guide translations, keyed by locale. The guide is translated into a
// priority set of languages; every other locale falls back to English.
export const GUIDE_BY_LOCALE: Record<string, GuideTranslation> = {
  es,
  fr,
  de,
  "pt-br": ptBr,
  it,
  ru,
  ja,
  "zh-hans": zhHans,
  ko,
  hi,
  ar,
  nl,
};
