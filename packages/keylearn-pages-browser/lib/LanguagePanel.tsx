import {
  allLocales,
  defaultLocale,
  type LocaleId,
  useIntlDisplayNames,
  usePreferredLocale,
} from "@keylearn/intl";
import { Pages, usePageData } from "@keylearn/pages-shared";
import { Link as StaticLink } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as styles from "./LanguagePanel.module.less";

/**
 * A two-level language picker: a scrollable list of languages in their own
 * names, and a row of region pills when the chosen language has more than
 * one variant.
 */
export function LanguagePanel({
  currentPath,
}: {
  readonly currentPath: string;
}): ReactNode {
  const { formatLocalLanguageName } = useIntlDisplayNames();
  const { locale: activeLocale } = usePageData();
  const preferredLocale = usePreferredLocale();
  const [openBase, setOpenBase] = useState(() => baseOf(activeLocale));
  // Hide the "more below" fade and chevron once the list is scrolled to the
  // end (or if every language already fits without scrolling).
  const listRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (el == null) {
      return;
    }
    const update = () => {
      setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);

  const groups = new Map<string, LocaleId[]>();
  for (const locale of allLocales) {
    const base = baseOf(locale);
    groups.set(base, [...(groups.get(base) ?? []), locale]);
  }
  // Float the language you're viewing to the very top, then English, then the
  // rest in their original order — so your current language is one glance away.
  const activeBase = baseOf(activeLocale);
  const englishBase = baseOf(defaultLocale);
  const rank = (base: string) =>
    base === activeBase ? 0 : base === englishBase ? 1 : 2;
  const visible = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
  const openVariants = groups.get(openBase) ?? [];

  return (
    <div className={styles.root}>
      <div className={clsx(styles.listWrap, atEnd && styles.atEnd)}>
        <div className={styles.list} ref={listRef}>
          {visible.map(([base, locales]) => {
            const active = baseOf(activeLocale) === base;
            const single = locales.length === 1;
            const row = (
              <>
                <span className={styles.name}>
                  {formatLocalLanguageName(locales[0])}
                </span>
                <span className={styles.meta}>
                  <span className={styles.code}>{base}</span>
                  {active && (
                    <svg className={styles.check} viewBox="0 0 24 24">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
              </>
            );
            return single ? (
              <StaticLink
                key={base}
                className={styles.row}
                href={Pages.intlPath(currentPath, locales[0])}
              >
                {row}
              </StaticLink>
            ) : (
              <button
                key={base}
                className={styles.row}
                onClick={() => {
                  setOpenBase(openBase === base ? "" : base);
                }}
              >
                {row}
              </button>
            );
          })}
        </div>
        <span className={styles.more} aria-hidden={true} />
      </div>
      {openVariants.length > 1 && (
        <div className={styles.variants}>
          {openVariants.map((locale) => (
            <StaticLink
              key={locale}
              className={
                locale === activeLocale ? styles.variantOn : styles.variant
              }
              href={Pages.intlPath(currentPath, locale)}
            >
              {locale}
            </StaticLink>
          ))}
        </div>
      )}
      {preferredLocale !== activeLocale &&
        preferredLocale !== defaultLocale && (
          <StaticLink
            className={styles.suggest}
            href={Pages.intlPath(currentPath, preferredLocale)}
          >
            {formatLocalLanguageName(preferredLocale)}
          </StaticLink>
        )}
    </div>
  );
}

function baseOf(locale: string): string {
  return locale.split("-")[0];
}
