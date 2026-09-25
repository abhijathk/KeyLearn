import { test, type TestContext } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { AccountService, ProfilesProvider } from "@keylearn/page-account";
import { SupportService } from "@keylearn/page-support";
import { PageDataContext } from "@keylearn/pages-shared";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull } from "rich-assert";
import { Template } from "./Template.tsx";

// Template mounts NoticeBanner, which calls SupportService.getActiveNotice()
// on mount. Left unmocked, that's a real network request that's still in
// flight when the test unmounts synchronously below — the environment
// aborts it during teardown, and the abort surfaces as an unhandled
// rejection that fails the file even though every assertion passed. Mocking
// the service call directly (rather than the underlying fetch) works
// regardless of which fetch implementation @keylearn/request resolves to.
//
// The same goes for every other request the chrome makes on mount: the ad
// bar (SupportService.getAds) and, when signed in, the notification bell
// (AccountService.listNotifications). Those two were left real, and whether
// they finished before the unmount was a race — on a loaded machine they
// did not, and the file failed about one run in two.
function stubNoticeFetch(ctx: TestContext): void {
  ctx.mock.method(SupportService, "getActiveNotice", async () => null);
  ctx.mock.method(SupportService, "getAds", async () => ({
    ads: [],
    dwellSeconds: 0,
  }));
  ctx.mock.method(AccountService, "listNotifications", async () => ({
    notifications: [],
    unread: 0,
  }));
}

test("render", (ctx) => {
  stubNoticeFetch(ctx);
  const r = render(
    <FakeSettingsContext>
      <PageDataContext.Provider
        value={{
          base: "https://www.keylearn.org/",
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
          <MemoryRouter>
            <ProfilesProvider>
              <Template path="/page">
                <div>hello</div>
              </Template>
            </ProfilesProvider>
          </MemoryRouter>
        </FakeIntlProvider>
      </PageDataContext.Provider>
    </FakeSettingsContext>,
  );

  isNotNull(r.queryByText("hello"));

  r.unmount();
});

test("render alt", (ctx) => {
  stubNoticeFetch(ctx);
  const r = render(
    <FakeSettingsContext>
      <PageDataContext.Provider
        value={{
          base: "https://www.keylearn.org/",
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
          <MemoryRouter>
            <ProfilesProvider>
              <Template path="/page">
                <div>hello</div>
              </Template>
            </ProfilesProvider>
          </MemoryRouter>
        </FakeIntlProvider>
      </PageDataContext.Provider>
    </FakeSettingsContext>,
  );

  isNotNull(r.queryByText("hello"));

  r.unmount();
});
