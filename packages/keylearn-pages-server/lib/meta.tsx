import { type FavIconLink } from "@keylearn/assets";
import { allLocales } from "@keylearn/intl";
import { type PageInfo, Pages, usePageData } from "@keylearn/pages-shared";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";

export function Metas({ page }: { readonly page: PageInfo }): ReactNode {
  const { formatMessage } = useIntl();
  return page.meta.map(({ name, property, content }, index) => {
    if (content != null && typeof content === "object") {
      content = formatMessage(content);
    }
    return (
      <meta key={index} name={name} property={property} content={content} />
    );
  });
}

export function AltLangLinks({ page }: { readonly page: PageInfo }): ReactNode {
  const { base } = usePageData();
  if (
    page.meta.some(
      ({ name, content }) =>
        name === "robots" &&
        typeof content === "string" &&
        content.includes("noindex"),
    )
  ) {
    return null;
  }
  return allLocales
    .map((locale) => ({
      href: String(new URL(Pages.intlPath(page.path, locale), base)),
      rel: "alternate",
      hrefLang: locale,
    }))
    .map((link) => <link key={link.href} {...link} />);
}

export const favIcons: readonly FavIconLink[] = [
  // First, so that any browser understanding SVG icons uses this one. The PNGs
  // below stay as the fallback for those that do not.
  {
    href: "/assets/favicon.svg",
    rel: "icon",
    type: "image/svg+xml",
    sizes: "any",
  },
  {
    href: "/assets/favicon-16x16.png",
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
  },
  {
    href: "/assets/favicon-32x32.png",
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
  },
  {
    href: "/assets/favicon-96x96.png",
    rel: "icon",
    type: "image/png",
    sizes: "96x96",
  },
];

/** The desk's own tab icon — its fixed headset mark in its fixed amber, never the visitor's own KeyLearn accent choice. */
export const favIconsDesk: readonly FavIconLink[] = [
  {
    href: "/assets/favicon-desk.svg",
    rel: "icon",
    type: "image/svg+xml",
    sizes: "any",
  },
  {
    href: "/assets/favicon-desk-16x16.png",
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
  },
  {
    href: "/assets/favicon-desk-32x32.png",
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
  },
  {
    href: "/assets/favicon-desk-96x96.png",
    rel: "icon",
    type: "image/png",
    sizes: "96x96",
  },
];
