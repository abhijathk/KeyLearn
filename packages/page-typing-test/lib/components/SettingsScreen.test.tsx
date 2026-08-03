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
  await r.findByText("Text settings");

  fireEvent.click(r.getByText("Common words", { selector: "button" }));
  fireEvent.click(r.getByText("Pseudo words", { selector: "button" }));
  fireEvent.click(r.getByText("Book paragraphs", { selector: "button" }));

  r.unmount();
});
