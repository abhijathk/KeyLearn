import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { PageDataContext } from "@keylearn/pages-shared";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull } from "rich-assert";
import { AccountPage } from "./AccountPage.tsx";
import { ProfilesProvider } from "./profiles/context.tsx";

test("render signed-out account page", () => {
  const r = render(
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
        base: "https://www.keylearn.org/",
        locale: "en",
        user: {
          id: "xzy",
          email: "name@keylearn.org",
          name: "name",
          anonymized: false,
          publicProfile: false,
          externalId: [],
          order: null,
          createdAt: "2001-02-03T04:05:06.789Z",
          dateOfBirth: null,
          hasPassword: true,
          twoFactorEnabled: false,
          parentPinSet: false,
          parentPinLength: null,
          emailVerified: true,
          signupCountry: null,
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
        profiles: [],
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

  // The window lands on Appearance now, so the rail is what proves it
  // rendered. Scoped to the navigation, because the pane behind it uses
  // the same words as the rail item that opened it.
  const rail = r.container.querySelector("nav")!;
  isNotNull(rail);
  isNotNull(
    [...rail.querySelectorAll("button")].find((b) =>
      /Appearance/.test(b.textContent ?? ""),
    ),
  );

  act(() => {
    [...rail.querySelectorAll("button")]
      .find((b) => /Account/.test(b.textContent ?? ""))!
      .click();
  });

  isNotNull(r.queryByText("name@keylearn.org", { exact: false }));
  isNotNull(r.queryByText("Hide my identity", { exact: false }));

  r.unmount();
});
