import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { lessonProps, LessonType } from "@keylearn/lesson";
import { type PageData, PageDataContext } from "@keylearn/pages-shared";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeResultContext, ResultFaker, uiProps } from "@keylearn/result";
import { FakeSettingsContext, Settings } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { includes, isNotNull } from "rich-assert";
import { PracticeScreen } from "./PracticeScreen.tsx";

const faker = new ResultFaker();

test("render", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      {/* The screen reads page data, and without tourSeen the first-run
          tour measures a layout jsdom cannot give it — see PracticePage.test. */}
      <PageDataContext.Provider
        value={{ publicUser: { id: "abc" } } as PageData}
      >
        <FakeSettingsContext
          initialSettings={new Settings()
            .set(lessonProps.type, LessonType.CUSTOM)
            .set(lessonProps.customText.content, "abcdefghij")
            .set(uiProps.tourSeen, true)}
        >
          <FakeResultContext initialResults={faker.nextResultList(100)}>
            <PracticeScreen />
          </FakeResultContext>
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  // The progress model seeds from 100 faked results interleaved with the
  // event loop (see useProgress); jsdom's default 1s wait can expire mid-seed,
  // as PracticePage.test already notes. The wait is for the seed.
  isNotNull(
    await r.findByTitle(
      "Adjust lesson settings",
      { exact: false },
      { timeout: 10_000 },
    ),
  );
  includes(r.container.textContent!, "abcdefghij");

  r.unmount();
});
