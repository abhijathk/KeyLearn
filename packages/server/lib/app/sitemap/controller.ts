import { controller, http } from "@fastr/controller";
import { Context } from "@fastr/core";
import { inject, injectable } from "@fastr/invert";
import { allLocales, defaultLocale } from "@keylearn/intl";
import { Pages } from "@keylearn/pages-shared";
import { js2xml } from "xml-js";
import { multiplayerEnabled } from "../multiplayer.ts";

@injectable()
@controller()
export class Controller {
  readonly #body: string;
  readonly #robots: string;

  constructor(@inject("canonicalUrl") canonicalUrl: string) {
    this.#body = generateSitemapXml(canonicalUrl);
    this.#robots = generateRobotsTxt(canonicalUrl);
  }

  @http.GET("/sitemap.xml")
  async get(ctx: Context) {
    ctx.response.body = this.#body;
    ctx.response.type = "application/xml";
  }

  @http.GET("/robots.txt")
  async robots(ctx: Context) {
    ctx.response.body = this.#robots;
    ctx.response.type = "text/plain";
  }
}

/**
 * Which paths a crawler should not fetch, and where the sitemap is.
 *
 * Every page here already carries a `noindex` meta, but a meta only works on
 * a page the crawler has fetched, and the static file this replaces listed
 * only the auth paths and the API — so account pages and token links were
 * still being requested. Served by the app rather than as a static file so
 * the sitemap line follows the canonical URL on every deployment.
 * Nothing on this list is content: it is the signed-in surface, the
 * token-only surface and the API. Each path is listed twice, plain and under
 * a locale prefix, because every page has locale twins.
 */
export function generateRobotsTxt(canonicalUrl: string): string {
  const private_ = [
    "/_/",
    // Sign-in flows and magic-link tokens: the old static file listed these
    // two and nothing else, and it is folded in here.
    "/auth/",
    "/login/",
    Pages.account.path,
    Pages.profiles.path,
    Pages.profile.path,
    Pages.design.path,
    Pages.assessment.path,
    Pages.login.path,
    Pages.register.path,
    Pages.forgotPassword.path,
    "/reset-password/",
    Pages.org.path,
    "/join/",
    "/support/t/",
    "/support/deletion-cancel/",
  ];
  const lines = ["User-agent: *"];
  for (const path of private_) {
    lines.push(`Disallow: ${path}`);
    if (path !== "/_/") {
      lines.push(`Disallow: /*${path}`);
    }
  }
  lines.push(`Sitemap: ${String(new URL("/sitemap.xml", canonicalUrl))}`);
  return lines.join("\n") + "\n";
}

export function generateSitemapXml(canonicalUrl: string): any {
  const makeUrl = (path: string): string => {
    return String(new URL(path, canonicalUrl));
  };
  const sortedLocales = [...new Set([defaultLocale, ...allLocales])];
  const url: unknown[] = [];
  for (const page of [
    Pages.practice,
    Pages.help,
    Pages.highScores,
    Pages.layouts,
    // Only while the page exists: a sitemap entry that answers 404 is a
    // crawl error, not a listing. Read once, here, because the body is
    // built once in the constructor.
    ...(multiplayerEnabled() ? [Pages.multiplayer] : []),
    Pages.typingTest,
  ]) {
    for (const locale of sortedLocales) {
      const alternate: any[] = [];
      for (const alternateLocale of sortedLocales) {
        alternate.push({
          _attributes: {
            rel: "alternate",
            hreflang: alternateLocale,
            href: makeUrl(Pages.intlPath(page.path, alternateLocale)),
          },
        });
      }
      url.push({
        "loc": { _text: makeUrl(Pages.intlPath(page.path, locale)) },
        "xhtml:link": alternate,
      });
    }
  }
  return js2xml(
    {
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "utf-8",
        },
      },
      urlset: {
        _attributes: {
          "xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
          "xmlns:xhtml": "http://www.w3.org/1999/xhtml",
        },
        url,
      },
    },
    {
      compact: true,
      spaces: 2,
    },
  );
}
