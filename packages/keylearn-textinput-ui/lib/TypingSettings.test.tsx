import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { KeyboardProvider } from "@keylearn/keyboard";
import { FakeSettingsContext } from "@keylearn/settings";
import { fireEvent, render } from "@testing-library/react";
import { TypingSettings } from "./TypingSettings.tsx";

test("render", () => {
  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <KeyboardProvider>
          <TypingSettings />
        </KeyboardProvider>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  fireEvent.click(r.getByText("Pause cursor on mistakes"));
  fireEvent.click(r.getByText("Auto-correct mistakes"));

  fireEvent.click(r.getByText("Hidden"));
  fireEvent.click(r.getByText("As bars"));
  fireEvent.click(r.getByText("As dots"));

  fireEvent.click(r.getByText("Solid block"));
  fireEvent.click(r.getByText("Outlined box"));
  fireEvent.click(r.getByText("Thin line"));
  fireEvent.click(r.getByText("Underline"));

  fireEvent.click(r.getByText("Snap into place"));
  fireEvent.click(r.getByText("Glide smoothly"));

  r.unmount();
});
