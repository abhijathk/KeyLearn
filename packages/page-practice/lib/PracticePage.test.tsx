import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { type PageData, PageDataContext } from "@keylearn/pages-shared";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeResultContext, ResultFaker } from "@keylearn/result";
import { FakeSettingsContext } from "@keylearn/settings";
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
        <FakeSettingsContext>
          <FakeResultContext initialResults={faker.nextResultList(100)}>
            <PracticePage />
          </FakeResultContext>
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  fireEvent.click(
    await r.findByTitle("Adjust lesson settings", { exact: false }),
  );
  fireEvent.click(await r.findByText("Save & Close"));

  r.unmount();
});
