import { test } from "node:test";
import { FakeIntlProvider, PreferredLocaleContext } from "@keylearn/intl";
import { PageDataContext } from "@keylearn/pages-shared";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull } from "rich-assert";
import { SubMenu } from "./SubMenu.tsx";

test("render", () => {
  const r = render(
    <PageDataContext.Provider
      value={{
        base: "https://www.keylearn.com/",
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
            <SubMenu currentPath="/page" />
          </MemoryRouter>
        </FakeIntlProvider>
      </PreferredLocaleContext.Provider>
    </PageDataContext.Provider>,
  );

  isNotNull(r.queryByText("Polski"));
  isNotNull(r.queryByText("English"));

  r.unmount();
});
