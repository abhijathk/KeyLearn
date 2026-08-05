import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { KeyboardProvider } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeSettingsContext } from "@keylearn/settings";
import { fireEvent, render } from "@testing-library/react";
import { SettingsScreen } from "./SettingsScreen.tsx";

test("render", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <KeyboardProvider>
          <SettingsScreen />
        </KeyboardProvider>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  fireEvent.click(r.getByText("Text"));
  // Asserted on the generators the tab offers rather than on a heading. The
  // heading was renamed when settings were rebuilt and this test went red
  // against a screen that was working, which is how a suite stops meaning
  // anything.
  await r.findByText("Common words");

  fireEvent.click(r.getByText("Common words"));
  fireEvent.click(r.getByText("Pseudo words"));
  fireEvent.click(r.getByText("Book paragraphs"));

  r.unmount();
});
