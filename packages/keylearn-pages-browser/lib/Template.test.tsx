import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { ProfilesProvider } from "@keylearn/page-account";
import { PageDataContext } from "@keylearn/pages-shared";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull } from "rich-assert";
import { Template } from "./Template.tsx";

test("render", () => {
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
      <FakeIntlProvider>
        <MemoryRouter>
          <ProfilesProvider>
            <Template path="/page">
              <div>hello</div>
            </Template>
          </ProfilesProvider>
        </MemoryRouter>
      </FakeIntlProvider>
    </PageDataContext.Provider>,
  );

  isNotNull(r.queryByText("hello"));

  r.unmount();
});

test("render alt", () => {
  const r = render(
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
    </PageDataContext.Provider>,
  );

  isNotNull(r.queryByText("hello"));

  r.unmount();
});
