import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { KeyboardProvider } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { TypingTestPage } from "./TypingTestPage.tsx";

test("render", () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <KeyboardProvider>
          <TypingTestPage />
        </KeyboardProvider>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  r.unmount();
});
