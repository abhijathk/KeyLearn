import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { isNotNull } from "rich-assert";
import { HelpPage } from "./HelpPage.tsx";

test("render", () => {
  const r = render(
    <FakeIntlProvider>
      <MemoryRouter>
        <FakeSettingsContext>
          <HelpPage />
        </FakeSettingsContext>
      </MemoryRouter>
    </FakeIntlProvider>,
  );

  isNotNull(r.queryByText("Type faster, the smart way"));

  r.unmount();
});
