import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { ResultFaker } from "@keylearn/result";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { isNotNull, isNull } from "rich-assert";
import { AccuracyStreaksSection } from "./AccuracyStreaksSection.tsx";

test("no streaks", () => {
  // Act.

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <AccuracyStreaksSection results={[]} />
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  // Assert.

  isNull(r.queryByText("Minimum Accuracy", { exact: false }));

  r.unmount();
});

test("one streak", () => {
  // Arrange.

  const faker = new ResultFaker();
  const r1 = faker.nextResult({ length: 100, errors: 0 });

  // Act.

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <AccuracyStreaksSection results={[r1]} />
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  // Assert.

  isNotNull(r.queryByText("Minimum Accuracy", { exact: false }));

  r.unmount();
});
