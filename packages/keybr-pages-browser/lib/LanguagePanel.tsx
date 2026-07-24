import {
  allLocales,
  defaultLocale,
  type LocaleId,
  useIntlDisplayNames,
  usePreferredLocale,
} from "@keybr/intl";
import { Pages, usePageData } from "@keybr/pages-shared";
import { Link as StaticLink } from "@keybr/widget";
import { type ReactNode, useState } from "react";
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

  const groups = new Map<string, LocaleId[]>();
  for (const locale of allLocales) {
    const base = baseOf(locale);
    groups.set(base, [...(groups.get(base) ?? []), locale]);
  }
  const visible = [...groups.entries()];
  const openVariants = groups.get(openBase) ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.list}>
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
