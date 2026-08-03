import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { lessonProps, LessonType } from "@keylearn/lesson";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeResultContext, ResultFaker } from "@keylearn/result";
import { FakeSettingsContext, Settings } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { includes, isNotNull } from "rich-assert";
import { PracticeScreen } from "./PracticeScreen.tsx";

const faker = new ResultFaker();

test("render", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext
        initialSettings={new Settings()
          .set(lessonProps.type, LessonType.CUSTOM)
          .set(lessonProps.customText.content, "abcdefghij")}
      >
        <FakeResultContext initialResults={faker.nextResultList(100)}>
          <PracticeScreen />
        </FakeResultContext>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  isNotNull(await r.findByTitle("Adjust lesson settings", { exact: false }));
  includes(r.container.textContent!, "abcdefghij");

  r.unmount();
});
