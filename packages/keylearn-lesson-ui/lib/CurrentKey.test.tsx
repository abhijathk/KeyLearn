import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { LessonKey, LessonKeys } from "@keylearn/lesson";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { FakeSettingsContext } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { isNotNull, isNull } from "rich-assert";
import { CurrentKey } from "./CurrentKey.tsx";

const { letters } = FakePhoneticModel;

test("render no key", () => {
  const lessonKeys = new LessonKeys([
    new LessonKey({
      letter: letters[0],
      samples: [],
      timeToType: 100,
      bestTimeToType: 100,
      confidence: 1.0,
      bestConfidence: 1.0,
    }).asIncluded(),
  ]);

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <CurrentKey lessonKeys={lessonKeys} />
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  isNotNull(r.queryByText("Every key is unlocked."));
  isNull(r.queryByText("Progress rate:"));

  r.unmount();
});

test("render key", () => {
  const lessonKeys = new LessonKeys([
    new LessonKey({
      letter: letters[0],
      samples: [],
      timeToType: 100,
      bestTimeToType: 100,
      confidence: 1.0,
      bestConfidence: 1.0,
    }).asFocused(),
  ]);

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <CurrentKey lessonKeys={lessonKeys} />
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  isNull(r.queryByText("Every key is unlocked."));
  isNotNull(r.queryByText("Progress rate:"));

  r.unmount();
});
