import { test } from "node:test";
import { FakeIntlProvider } from "@keybr/intl";
import { FakePhoneticModel } from "@keybr/phonetic-model";
import { PhoneticModelLoader } from "@keybr/phonetic-model-loader";
import { FakeResultContext, ResultFaker } from "@keybr/result";
import { FakeSettingsContext } from "@keybr/settings";
import { fireEvent, render } from "@testing-library/react";
import { isNotNull } from "rich-assert";
import { SettingsScreen } from "./SettingsScreen.tsx";

const faker = new ResultFaker();

test("render", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <FakeResultContext initialResults={faker.nextResultList(100)}>
          <SettingsScreen />
        </FakeResultContext>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  isNotNull(await r.findByText("Practice Content"));
  isNotNull(await r.findByText("Text Input"));
  isNotNull(await r.findByText("Keyboard Setup"));
  isNotNull(await r.findByText("Other Settings"));

  fireEvent.click(r.getByText("Practice Content"));

  isNotNull(r.queryByText("Lesson settings"));
  isNotNull(r.queryByText("Preview of your lesson"));

  fireEvent.click(r.getByText("Text Input"));

  isNotNull(r.queryByText("Typing helpers"));

  fireEvent.click(r.getByText("Keyboard Setup"));

  isNotNull(r.queryByText("Settings"));
  isNotNull(r.queryByText("Live Preview"));

  fireEvent.click(r.getByText("Other Settings"));

  isNotNull(r.queryByText("Display preferences"));

  r.unmount();
});
