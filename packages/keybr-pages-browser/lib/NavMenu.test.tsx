import { test } from "node:test";
import { FakeIntlProvider, PreferredLocaleContext } from "@keybr/intl";
import { ProfilesProvider } from "@keybr/page-account";
import { PageDataContext } from "@keybr/pages-shared";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull } from "rich-assert";
import { NavMenu } from "./NavMenu.tsx";

test("render", () => {
  const r = render(
    <PageDataContext.Provider
      value={{
        base: "https://www.keybr.com/",
        locale: "en",
        user: null,
        publicUser: {
          id: "userId",
          name: "userName",
          imageUrl: "imageUrl",
          premium: false,
        },
        settings: null,
        profiles: [],
      }}
    >
      <PreferredLocaleContext.Provider value="pl">
        <FakeIntlProvider>
          <MemoryRouter>
            <ProfilesProvider>
              <NavMenu currentPath="/page" />
            </ProfilesProvider>
          </MemoryRouter>
        </FakeIntlProvider>
      </PreferredLocaleContext.Provider>
    </PageDataContext.Provider>,
  );

  isNotNull(r.queryByText("Practice"));
  isNotNull(r.queryByText("Profile"));
  isNotNull(r.queryByText("Help"));

  r.unmount();
});
