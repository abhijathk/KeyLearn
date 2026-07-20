import { test } from "node:test";
import { FakeIntlProvider } from "@keybr/intl";
import { render } from "@testing-library/react";
import { isNotNull } from "rich-assert";
import { type SignInActions } from "./actions.ts";
import { SignInSection } from "./SignInSection.tsx";

test("render", () => {
  const r = render(
    <FakeIntlProvider>
      <SignInSection actions={{} as SignInActions} />
    </FakeIntlProvider>,
  );

  isNotNull(
    r.queryByText("No passwords required", {
      exact: false,
    }),
  );
  isNotNull(
    r.queryByText("Log in using any social account you already have.", {
      exact: false,
    }),
  );
  isNotNull(r.queryByText("Google", { exact: false }));
  isNotNull(r.queryByText("Microsoft", { exact: false }));
  isNotNull(r.queryByText("Facebook", { exact: false }));

  r.unmount();
});
