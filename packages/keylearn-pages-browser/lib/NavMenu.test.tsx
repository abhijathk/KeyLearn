import { test } from "node:test";
import { FakeIntlProvider, PreferredLocaleContext } from "@keylearn/intl";
import { ProfilesProvider } from "@keylearn/page-account";
import { PageDataContext } from "@keylearn/pages-shared";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull, isNull } from "rich-assert";
import { NavMenu } from "./NavMenu.tsx";

test("render", () => {
  const r = render(
    <PageDataContext.Provider
      value={{
        base: "https://www.keylearn.org/",
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

test("a kid profile is only offered the kids page", () => {
  // The adult drills are guarded off for kids, so listing them here would
  // only offer links that bounce.
  const profile = {
    id: "kidId",
    kind: "kid",
    name: "Dhruv",
    birthYear: 2021,
    avatar: null,
    visionSupport: false,
  };
  const pageData = {
    base: "https://www.keylearn.org/",
    locale: "en",
    user: null,
    publicUser: {
      id: "userId",
      name: "userName",
      imageUrl: "imageUrl",
      premium: false,
    },
    settings: null,
    profiles: [profile],
  };
  // The active selection is a per-device preference read from localStorage,
  // keyed by the account id that getPageData() reports.
  (globalThis as any)["__PAGE_DATA__"] = pageData;
  localStorage.setItem("keylearn.activeProfile.userId", "kidId");
  try {
    const r = render(
      <PageDataContext.Provider value={pageData as any}>
        <PreferredLocaleContext.Provider value="pl">
          <FakeIntlProvider>
            <MemoryRouter>
              <ProfilesProvider>
                <NavMenu currentPath="/kids" />
              </ProfilesProvider>
            </MemoryRouter>
          </FakeIntlProvider>
        </PreferredLocaleContext.Provider>
      </PageDataContext.Provider>,
    );

    isNotNull(r.queryByText("Kids"));
    isNotNull(r.queryByText("Profile"));
    isNotNull(r.queryByText("Help"));
    isNull(r.queryByText("Practice"));
    isNull(r.queryByText("Typing Test"));

    r.unmount();
  } finally {
    delete (globalThis as any)["__PAGE_DATA__"];
    localStorage.removeItem("keylearn.activeProfile.userId");
  }
});
