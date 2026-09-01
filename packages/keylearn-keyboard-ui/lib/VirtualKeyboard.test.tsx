import { test } from "node:test";
import { Geometry, Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { VirtualKeyboard } from "./VirtualKeyboard.tsx";

test("render standard 101", () => {
  const keyboard = loadKeyboard(Layout.EN_US, Geometry.ANSI_101);

  const r = render(
    <FakeSettingsContext>
      <VirtualKeyboard keyboard={keyboard} />
    </FakeSettingsContext>,
  );

  r.unmount();
});

test("render standard 101 full", () => {
  const keyboard = loadKeyboard(Layout.EN_US, Geometry.ANSI_101_FULL);

  const r = render(
    <FakeSettingsContext>
      <VirtualKeyboard keyboard={keyboard} />
    </FakeSettingsContext>,
  );

  r.unmount();
});
