import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { type PageData, PageDataContext } from "@keylearn/pages-shared";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { FakeResultContext, ResultFaker } from "@keylearn/result";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { isNotNull } from "rich-assert";
import { ProfilePage } from "./ProfilePage.tsx";

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
            <ProfilePage />
          </FakeResultContext>
        </FakeSettingsContext>
      </PageDataContext.Provider>
    </FakeIntlProvider>,
  );

  isNotNull(await r.findByText("Lifetime Stats"));
  isNotNull(await r.findByText("Today’s Stats"));
  isNotNull(await r.findByText(/The speed story/));
  isNotNull(await r.findByText(/One key’s story/));
  isNotNull(await r.findByText("Your keys"));
  isNotNull(await r.findByText("Compared to everyone"));
  isNotNull(await r.findByText(/Practice calendar/));
  isNotNull(await r.findByText("Your data"));

  r.unmount();
});
