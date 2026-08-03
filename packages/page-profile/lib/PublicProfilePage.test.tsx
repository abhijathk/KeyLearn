import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { type PageData, PageDataContext } from "@keylearn/pages-shared";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeResultContext, ResultFaker } from "@keylearn/result";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { isNotNull } from "rich-assert";
import { PublicProfilePage } from "./PublicProfilePage.tsx";

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
            <PublicProfilePage
              user={{
                id: "abc",
                name: "somebody",
                imageUrl: null,
                premium: false,
              }}
            />
          </FakeResultContext>
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  // The named user's road profile renders with their identity band.
  isNotNull(await r.findByText("somebody"));
  isNotNull(await r.findByText(/The speed story/));
  isNotNull(await r.findByText(/One key’s story/));

  r.unmount();
});
