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

  // "Cursor look" is an OptionList, not a row of buttons like the two settings
  // above it: its menu exists in the DOM only while it is open, and choosing an
  // option closes it again. So each choice opens the list by clicking whatever
  // is currently selected, then clicks the option wanted.
  const chooseShape = (current: string, next: string) => {
    fireEvent.click(r.getByText(current));
    fireEvent.click(r.getByText(next));
  };
  chooseShape("Solid block", "Outlined box");
  chooseShape("Outlined box", "Thin line");
  chooseShape("Thin line", "Underline");

  fireEvent.click(r.getByText("Snap into place"));
  fireEvent.click(r.getByText("Glide smoothly"));

  r.unmount();
});
