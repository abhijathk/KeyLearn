import { type GuideTranslation } from "./guide-content.tsx";
import { af } from "./guide-i18n/af.ts";
import { ar } from "./guide-i18n/ar.ts";
import { as } from "./guide-i18n/as.ts";
import { bg } from "./guide-i18n/bg.ts";
import { bn } from "./guide-i18n/bn.ts";
import { ca } from "./guide-i18n/ca.ts";
import { cs } from "./guide-i18n/cs.ts";
import { da } from "./guide-i18n/da.ts";
import { de } from "./guide-i18n/de.ts";
import { el } from "./guide-i18n/el.ts";
import { es } from "./guide-i18n/es.ts";
import { et } from "./guide-i18n/et.ts";
import { fa } from "./guide-i18n/fa.ts";
import { fi } from "./guide-i18n/fi.ts";
import { fr } from "./guide-i18n/fr.ts";
import { gu } from "./guide-i18n/gu.ts";
import { he } from "./guide-i18n/he.ts";
import { hi } from "./guide-i18n/hi.ts";
import { hr } from "./guide-i18n/hr.ts";
import { hu } from "./guide-i18n/hu.ts";
import { id } from "./guide-i18n/id.ts";
import { is } from "./guide-i18n/is.ts";
import { it } from "./guide-i18n/it.ts";
import { ja } from "./guide-i18n/ja.ts";
import { kn } from "./guide-i18n/kn.ts";
import { ko } from "./guide-i18n/ko.ts";
import { lt } from "./guide-i18n/lt.ts";
import { lv } from "./guide-i18n/lv.ts";
import { ml } from "./guide-i18n/ml.ts";
import { mn } from "./guide-i18n/mn.ts";
import { mr } from "./guide-i18n/mr.ts";
import { nb } from "./guide-i18n/nb.ts";
import { ne } from "./guide-i18n/ne.ts";
import { nl } from "./guide-i18n/nl.ts";
import { or } from "./guide-i18n/or.ts";
import { pa } from "./guide-i18n/pa.ts";
import { pl } from "./guide-i18n/pl.ts";
import { ptBr } from "./guide-i18n/pt-br.ts";
import { ptPt } from "./guide-i18n/pt-pt.ts";
import { ro } from "./guide-i18n/ro.ts";
import { ru } from "./guide-i18n/ru.ts";
import { sk } from "./guide-i18n/sk.ts";
import { sl } from "./guide-i18n/sl.ts";
import { sq } from "./guide-i18n/sq.ts";
import { sv } from "./guide-i18n/sv.ts";
import { ta } from "./guide-i18n/ta.ts";
import { te } from "./guide-i18n/te.ts";
import { th } from "./guide-i18n/th.ts";
import { tr } from "./guide-i18n/tr.ts";
import { uk } from "./guide-i18n/uk.ts";
import { ur } from "./guide-i18n/ur.ts";
import { vi } from "./guide-i18n/vi.ts";
import { zhHans } from "./guide-i18n/zh-hans.ts";
import { zhHant } from "./guide-i18n/zh-hant.ts";

// User Guide translations, keyed by locale. A locale not listed here falls
// back to English (see guideFor() in guide-content.tsx).
export const GUIDE_BY_LOCALE: Record<string, GuideTranslation> = {
  af,
  ar,
  as,
  bg,
  bn,
  ca,
  cs,
  da,
  de,
  el,
  es,
  et,
  fa,
  fi,
  fr,
  gu,
  he,
  hi,
  hr,
  hu,
  id,
  is,
  it,
  ja,
  kn,
  ko,
  lt,
  lv,
  ml,
  mn,
  mr,
  nb,
  ne,
  nl,
  or,
  pa,
  pl,
  "pt-br": ptBr,
  "pt-pt": ptPt,
  ro,
  ru,
  sk,
  sl,
  sq,
  sv,
  ta,
  te,
  th,
  tr,
  uk,
  ur,
  vi,
  "zh-hans": zhHans,
  "zh-hant": zhHant,
};
