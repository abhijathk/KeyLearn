import {
  allLocales,
  defaultLocale,
  useIntlDisplayNames,
  usePreferredLocale,
} from "@keylearn/intl";
import { Pages, usePageData } from "@keylearn/pages-shared";
import { Link as StaticLink } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink } from "react-router";
import * as styles from "./SubMenu.module.less";

export function SubMenu({ currentPath }: { readonly currentPath: string }) {
  const { formatMessage } = useIntl();
  return (
    <div className={styles.root}>
      {/* The support desk (ticket queue, staff console) is built but held
          for phase 2 — the mailto link below is the only contact path for
          launch. Re-add these two links to bring it back. */}
      <SupportLink />
      <GithubLink />
      <RouterLink to={Pages.termsOfService.path}>
        {formatMessage(Pages.termsOfService.link.label)}
      </RouterLink>
      <RouterLink to={Pages.accessibility.path}>
        {formatMessage(Pages.accessibility.link.label)}
      </RouterLink>
      <RouterLink to={Pages.privacyPolicy.path}>
        {formatMessage(Pages.privacyPolicy.link.label)}
      </RouterLink>
      <LocaleSwitcher currentPath={currentPath} />
      <TranslateLink />
    </div>
  );
}

/**
 * The footer's way to a person.
 *
 * Was the support address as a `mailto:`. An address in a footer asks
 * somebody to leave the site and start a thread nobody here can see the
 * state of — no reference, no record they can come back to, and no way
 * to know it arrived. The support page is the same conversation kept
 * somewhere both sides can find it.
 */
function SupportLink() {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;
  return (
    <RouterLink
      to={signedIn ? "/account#support" : Pages.support.path}
      title={formatMessage({
        id: "footer.supportLink.description",
        defaultMessage: "Ask a question or tell us what went wrong",
      })}
    >
      {formatMessage({ id: "footer.supportLink", defaultMessage: "Support" })}
    </RouterLink>
  );
}

function GithubLink() {
  const { formatMessage } = useIntl();
  return (
    <StaticLink
      href="https://github.com/abhijathk/keylearn"
      target="github"
      title={formatMessage({
        id: "footer.githubLink.description",
        defaultMessage: "Browse KeyLearn’s source code on GitHub.",
      })}
    >
      Github
    </StaticLink>
  );
}

function TranslateLink() {
  const { formatMessage } = useIntl();
  return (
    <StaticLink
      href="https://github.com/abhijathk/keylearn/blob/master/docs/translations.md"
      target="github"
      title={formatMessage({
        id: "footer.translateLink.description",
        defaultMessage: "Help translate KeyLearn into your language.",
      })}
    >
      <FormattedMessage
        id="footer.translateLink.text"
        defaultMessage="Help translate"
      />
    </StaticLink>
  );
}

function LocaleSwitcher({ currentPath }: { readonly currentPath: string }) {
  const { formatLanguageName, formatLocalLanguageName } = useIntlDisplayNames();
  const preferredLocale = usePreferredLocale();
  const primary = [];
  primary.push(
    <StaticLink
      className={styles.localeLink}
      href={Pages.intlPath(currentPath, preferredLocale)}
    >
      {formatLocalLanguageName(preferredLocale)}
    </StaticLink>,
  );
  if (preferredLocale !== defaultLocale) {
    primary.push(
      <StaticLink
        className={styles.localeLink}
        href={Pages.intlPath(currentPath, defaultLocale)}
      >
        {formatLocalLanguageName(defaultLocale)}
      </StaticLink>,
    );
  }
  const secondary = [];
  for (const locale of allLocales) {
    if (locale !== preferredLocale && locale !== defaultLocale) {
      if (secondary.length > 0) {
        secondary.push(" ");
      }
      secondary.push(
        <StaticLink
          className={styles.localeLink}
          href={Pages.intlPath(currentPath, locale)}
          title={`${formatLocalLanguageName(locale)} / ${formatLanguageName(locale)}`}
        >
          {locale}
        </StaticLink>,
      );
    }
  }
  return (
    <>
      {...primary}
      <span className={styles.localeList}>{...secondary}</span>
    </>
  );
}
