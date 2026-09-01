import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { KeyFrequencyHeatmap } from "./KeyFrequencyHeatmap.tsx";

test("render", () => {
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();

  const r = render(
    <FakeSettingsContext>
      <FakeIntlProvider>
        <KeyFrequencyHeatmap keyboard={keyboard} model={model} />
      </FakeIntlProvider>
    </FakeSettingsContext>,
  );

  r.unmount();
});
