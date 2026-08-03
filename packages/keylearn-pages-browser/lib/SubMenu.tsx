import {
  allLocales,
  defaultLocale,
  useIntlDisplayNames,
  usePreferredLocale,
} from "@keylearn/intl";
import { Pages } from "@keylearn/pages-shared";
import { Link as StaticLink } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink } from "react-router";
import * as styles from "./SubMenu.module.less";

export function SubMenu({ currentPath }: { readonly currentPath: string }) {
  const { formatMessage } = useIntl();
  return (
    <div className={styles.root}>
      <MailLink />
      <GithubLink />
      <RouterLink to={Pages.termsOfService.path}>
        {formatMessage(Pages.termsOfService.link.label)}
      </RouterLink>
      <RouterLink to={Pages.privacyPolicy.path}>
        {formatMessage(Pages.privacyPolicy.link.label)}
      </RouterLink>
      <LocaleSwitcher currentPath={currentPath} />
      <TranslateLink />
    </div>
  );
}

function MailLink() {
  const { formatMessage } = useIntl();
  return (
    <StaticLink
      href="mailto:abhijathka@gmail.com"
      target="email"
      title={formatMessage({
        id: "footer.emailLink.description",
        defaultMessage: "Share your feedback and ideas at abhijathka@gmail.com",
      })}
    >
      abhijathka@gmail.com
    </StaticLink>
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
