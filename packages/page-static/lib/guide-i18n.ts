import { type GuideTranslation } from "./guide-content.tsx";

// User Guide translations, keyed by locale. A locale not listed here falls
// back to English (see guideFor() in guide-content.tsx). Loaded on demand —
// each locale is its own chunk — since statically importing all 54 up front
// bloated every /about, /terms, /privacy, /accessibility, and /guide page
// load with translations only the Guide page's active locale ever needs.
export async function loadGuideTranslation(
  locale: string,
): Promise<GuideTranslation | null> {
  switch (locale) {
    case "af":
      return (
        await import(/* webpackChunkName: "guide-af" */ "./guide-i18n/af.ts")
      ).af;
    case "ar":
      return (
        await import(/* webpackChunkName: "guide-ar" */ "./guide-i18n/ar.ts")
      ).ar;
    case "as":
      return (
        await import(/* webpackChunkName: "guide-as" */ "./guide-i18n/as.ts")
      ).as;
    case "bg":
      return (
        await import(/* webpackChunkName: "guide-bg" */ "./guide-i18n/bg.ts")
      ).bg;
    case "bn":
      return (
        await import(/* webpackChunkName: "guide-bn" */ "./guide-i18n/bn.ts")
      ).bn;
    case "ca":
      return (
        await import(/* webpackChunkName: "guide-ca" */ "./guide-i18n/ca.ts")
      ).ca;
    case "cs":
      return (
        await import(/* webpackChunkName: "guide-cs" */ "./guide-i18n/cs.ts")
      ).cs;
    case "da":
      return (
        await import(/* webpackChunkName: "guide-da" */ "./guide-i18n/da.ts")
      ).da;
    case "de":
      return (
        await import(/* webpackChunkName: "guide-de" */ "./guide-i18n/de.ts")
      ).de;
    case "el":
      return (
        await import(/* webpackChunkName: "guide-el" */ "./guide-i18n/el.ts")
      ).el;
    case "es":
      return (
        await import(/* webpackChunkName: "guide-es" */ "./guide-i18n/es.ts")
      ).es;
    case "et":
      return (
        await import(/* webpackChunkName: "guide-et" */ "./guide-i18n/et.ts")
      ).et;
    case "fa":
      return (
        await import(/* webpackChunkName: "guide-fa" */ "./guide-i18n/fa.ts")
      ).fa;
    case "fi":
      return (
        await import(/* webpackChunkName: "guide-fi" */ "./guide-i18n/fi.ts")
      ).fi;
    case "fr":
      return (
        await import(/* webpackChunkName: "guide-fr" */ "./guide-i18n/fr.ts")
      ).fr;
    case "gu":
      return (
        await import(/* webpackChunkName: "guide-gu" */ "./guide-i18n/gu.ts")
      ).gu;
    case "he":
      return (
        await import(/* webpackChunkName: "guide-he" */ "./guide-i18n/he.ts")
      ).he;
    case "hi":
      return (
        await import(/* webpackChunkName: "guide-hi" */ "./guide-i18n/hi.ts")
      ).hi;
    case "hr":
      return (
        await import(/* webpackChunkName: "guide-hr" */ "./guide-i18n/hr.ts")
      ).hr;
    case "hu":
      return (
        await import(/* webpackChunkName: "guide-hu" */ "./guide-i18n/hu.ts")
      ).hu;
    case "id":
      return (
        await import(/* webpackChunkName: "guide-id" */ "./guide-i18n/id.ts")
      ).id;
    case "is":
      return (
        await import(/* webpackChunkName: "guide-is" */ "./guide-i18n/is.ts")
      ).is;
    case "it":
      return (
        await import(/* webpackChunkName: "guide-it" */ "./guide-i18n/it.ts")
      ).it;
    case "ja":
      return (
        await import(/* webpackChunkName: "guide-ja" */ "./guide-i18n/ja.ts")
      ).ja;
    case "kn":
      return (
        await import(/* webpackChunkName: "guide-kn" */ "./guide-i18n/kn.ts")
      ).kn;
    case "ko":
      return (
        await import(/* webpackChunkName: "guide-ko" */ "./guide-i18n/ko.ts")
      ).ko;
    case "lt":
      return (
        await import(/* webpackChunkName: "guide-lt" */ "./guide-i18n/lt.ts")
      ).lt;
    case "lv":
      return (
        await import(/* webpackChunkName: "guide-lv" */ "./guide-i18n/lv.ts")
      ).lv;
    case "ml":
      return (
        await import(/* webpackChunkName: "guide-ml" */ "./guide-i18n/ml.ts")
      ).ml;
    case "mn":
      return (
        await import(/* webpackChunkName: "guide-mn" */ "./guide-i18n/mn.ts")
      ).mn;
    case "mr":
      return (
        await import(/* webpackChunkName: "guide-mr" */ "./guide-i18n/mr.ts")
      ).mr;
    case "nb":
      return (
        await import(/* webpackChunkName: "guide-nb" */ "./guide-i18n/nb.ts")
      ).nb;
    case "ne":
      return (
        await import(/* webpackChunkName: "guide-ne" */ "./guide-i18n/ne.ts")
      ).ne;
    case "nl":
      return (
        await import(/* webpackChunkName: "guide-nl" */ "./guide-i18n/nl.ts")
      ).nl;
    case "or":
      return (
        await import(/* webpackChunkName: "guide-or" */ "./guide-i18n/or.ts")
      ).or;
    case "pa":
      return (
        await import(/* webpackChunkName: "guide-pa" */ "./guide-i18n/pa.ts")
      ).pa;
    case "pl":
      return (
        await import(/* webpackChunkName: "guide-pl" */ "./guide-i18n/pl.ts")
      ).pl;
    case "pt-br":
      return (
        await import(
          /* webpackChunkName: "guide-pt-br" */ "./guide-i18n/pt-br.ts"
        )
      ).ptBr;
    case "pt-pt":
      return (
        await import(
          /* webpackChunkName: "guide-pt-pt" */ "./guide-i18n/pt-pt.ts"
        )
      ).ptPt;
    case "ro":
      return (
        await import(/* webpackChunkName: "guide-ro" */ "./guide-i18n/ro.ts")
      ).ro;
    case "ru":
      return (
        await import(/* webpackChunkName: "guide-ru" */ "./guide-i18n/ru.ts")
      ).ru;
    case "sk":
      return (
        await import(/* webpackChunkName: "guide-sk" */ "./guide-i18n/sk.ts")
      ).sk;
    case "sl":
      return (
        await import(/* webpackChunkName: "guide-sl" */ "./guide-i18n/sl.ts")
      ).sl;
    case "sq":
      return (
        await import(/* webpackChunkName: "guide-sq" */ "./guide-i18n/sq.ts")
      ).sq;
    case "sv":
      return (
        await import(/* webpackChunkName: "guide-sv" */ "./guide-i18n/sv.ts")
      ).sv;
    case "ta":
      return (
        await import(/* webpackChunkName: "guide-ta" */ "./guide-i18n/ta.ts")
      ).ta;
    case "te":
      return (
        await import(/* webpackChunkName: "guide-te" */ "./guide-i18n/te.ts")
      ).te;
    case "th":
      return (
        await import(/* webpackChunkName: "guide-th" */ "./guide-i18n/th.ts")
      ).th;
    case "tr":
      return (
        await import(/* webpackChunkName: "guide-tr" */ "./guide-i18n/tr.ts")
      ).tr;
    case "uk":
      return (
        await import(/* webpackChunkName: "guide-uk" */ "./guide-i18n/uk.ts")
      ).uk;
    case "ur":
      return (
        await import(/* webpackChunkName: "guide-ur" */ "./guide-i18n/ur.ts")
      ).ur;
    case "vi":
      return (
        await import(/* webpackChunkName: "guide-vi" */ "./guide-i18n/vi.ts")
      ).vi;
    case "zh-hans":
      return (
        await import(
          /* webpackChunkName: "guide-zh-hans" */ "./guide-i18n/zh-hans.ts"
        )
      ).zhHans;
    case "zh-hant":
      return (
        await import(
          /* webpackChunkName: "guide-zh-hant" */ "./guide-i18n/zh-hant.ts"
        )
      ).zhHant;
    default:
      return null;
  }
}
