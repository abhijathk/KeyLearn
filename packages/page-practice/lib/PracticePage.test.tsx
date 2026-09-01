import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { type PageData, PageDataContext } from "@keylearn/pages-shared";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeResultContext, ResultFaker } from "@keylearn/result";
import { uiProps } from "@keylearn/result";
import { FakeSettingsContext, Settings } from "@keylearn/settings";
import { fireEvent, render } from "@testing-library/react";
import { PracticePage } from "./PracticePage.tsx";

const faker = new ResultFaker();

test("render", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <PageDataContext.Provider
        value={{ publicUser: { id: "abc" } } as PageData}
      >
        {/* tourSeen, or the first-run tour opens over the page. The tour is
            not this test's subject, and its spotlight measures the layout —
            which jsdom cannot do — stalling the render loop long past the
            findBy window. The tour has its own coverage in PracticeTour. */}
        <FakeSettingsContext
          initialSettings={new Settings().set(uiProps.tourSeen, true)}
        >
          <FakeResultContext initialResults={faker.nextResultList(100)}>
            <PracticePage />
          </FakeResultContext>
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  fireEvent.click(
    // Seeding the progress model from 100 faked results is interleaved with
    // the event loop on purpose (see useProgress), and jsdom's loop is slow
    // enough that the default 1s wait expires mid-seed. The wait is for the
    // seed, not for a bug.
    await r.findByTitle("Adjust lesson settings", {
      exact: false,
      timeout: 10_000,
    }),
  );
  fireEvent.click(await r.findByText("Save & Close"));

  r.unmount();
});
