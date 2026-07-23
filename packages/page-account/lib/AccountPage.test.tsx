import { test } from "node:test";
import { FakeIntlProvider } from "@keybr/intl";
import { PageDataContext } from "@keybr/pages-shared";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull } from "rich-assert";
import { AccountPage } from "./AccountPage.tsx";
import { ProfilesProvider } from "./profiles/context.tsx";

test("render signed-out account page", () => {
  const r = render(
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
      }}
    >
      <MemoryRouter>
        <FakeIntlProvider>
          <ProfilesProvider>
            <AccountPage />
          </ProfilesProvider>
        </FakeIntlProvider>
      </MemoryRouter>
    </PageDataContext.Provider>,
  );

  isNotNull(r.queryByText("Register", { exact: false }));
  isNotNull(r.queryByText("Log In", { exact: false }));

  r.unmount();
});

test("render signed-in account page", () => {
  const r = render(
    <PageDataContext.Provider
      value={{
        base: "https://www.keybr.com/",
        locale: "en",
        user: {
          id: "xzy",
          email: "name@keybr.com",
          name: "name",
          anonymized: false,
          externalId: [],
          order: null,
          createdAt: "2001-02-03T04:05:06.789Z",
        },
        publicUser: {
          id: "xyz",
          name: "name",
          imageUrl: null,
          // Premium avoids the Paddle price-preview path, which needs the
          // third-party script that isn't loaded in tests.
          premium: true,
        },
        settings: null,
      }}
    >
      <MemoryRouter>
        <FakeIntlProvider>
          <ProfilesProvider>
            <AccountPage />
          </ProfilesProvider>
        </FakeIntlProvider>
      </MemoryRouter>
    </PageDataContext.Provider>,
  );

  isNotNull(r.queryByText("name@keybr.com", { exact: false }));
  isNotNull(r.queryByText("Hide my identity", { exact: false }));

  r.unmount();
});
