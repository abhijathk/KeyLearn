import { test } from "node:test";
import { type IncomingHeaders } from "@fastr/headers";
import { Manifest, ManifestContext } from "@keybr/assets";
import { FakeIntlProvider } from "@keybr/intl";
import { PageDataContext, Pages } from "@keybr/pages-shared";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { equal, isFalse, isTrue, like } from "rich-assert";
import { Shell } from "./Shell.tsx";

test("render", () => {
  const html = renderToStaticMarkup(
    <ManifestContext.Provider value={Manifest.fake}>
      <PageDataContext.Provider
        value={{
          base: "https://www.keybr.com/",
          locale: "en",
          user: null,
          publicUser: {
            id: null,
            name: "name",
            imageUrl: null,
          },
          settings: null,
          profiles: [],
        }}
      >
        <FakeIntlProvider>
          <Shell page={Pages.practice} headers={fakeHeaders()} />
        </FakeIntlProvider>
      </PageDataContext.Provider>
    </ManifestContext.Provider>,
  );

  const $ = load(html);

  like($("html").attr(), {
    "prefix": "og: http://ogp.me/ns#",
    "lang": "en",
    "dir": "ltr",
    "data-color": "auto",
    "data-font": "open-sans",
  });
  // The ad and analytics injection was taken out deliberately (commit
  // 2141f451). Asserting the absence keeps it out: a tracker reintroduced into
  // the shell would otherwise reach every page, signed in or not, silently.
  isFalse(html.includes("googletagmanager"));
  isFalse(html.includes("cloudflareinsights"));
  equal($("nav").length, 0);
});

test("render alt", () => {
  const html = renderToStaticMarkup(
    <ManifestContext.Provider value={Manifest.fake}>
      <PageDataContext.Provider
        value={{
          base: "https://www.keybr.com/",
          locale: "en",
          user: null,
          publicUser: {
            id: "abc",
            name: "name",
            imageUrl: null,
            premium: true,
          },
          settings: null,
          profiles: [],
        }}
      >
        <FakeIntlProvider>
          <Shell page={Pages.practice} headers={fakeHeaders()} />
        </FakeIntlProvider>
      </PageDataContext.Provider>
    </ManifestContext.Provider>,
  );

  const $ = load(html);

  like($("html").attr(), {
    "prefix": "og: http://ogp.me/ns#",
    "lang": "en",
    "dir": "ltr",
    "data-color": "auto",
    "data-font": "open-sans",
  });
  isFalse(html.includes("google"));
  isFalse(html.includes("cloudflare"));
  equal($("nav").length, 0);
});

test("render for a bot", () => {
  const html = renderToStaticMarkup(
    <ManifestContext.Provider value={Manifest.fake}>
      <PageDataContext.Provider
        value={{
          base: "https://www.keybr.com/",
          locale: "en",
          user: null,
          publicUser: {
            id: null,
            name: "name",
            imageUrl: null,
          },
          settings: null,
          profiles: [],
        }}
      >
        <FakeIntlProvider>
          <Shell
            page={Pages.practice}
            headers={fakeHeaders({ useragent: "Googlebot" })}
          />
        </FakeIntlProvider>
      </PageDataContext.Provider>
    </ManifestContext.Provider>,
  );

  const $ = load(html);

  like($("html").attr(), {
    "prefix": "og: http://ogp.me/ns#",
    "lang": "en",
    "dir": "ltr",
    "data-color": "auto",
    "data-font": "open-sans",
  });
  equal($("nav").length, 1);
});

function fakeHeaders(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get(name) {
      return map.get(name.toLowerCase()) ?? null;
    },
  } as IncomingHeaders;
}
