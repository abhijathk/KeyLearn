import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { keyboardProps, Layout, useKeyboard } from "@keylearn/keyboard";
import { FakePhoneticModel, Letter } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import {
  FakeResultContext,
  type KeyStatsMap,
  ResultFaker,
  useResults,
} from "@keylearn/result";
import { FakeSettingsContext, Settings } from "@keylearn/settings";
import { fireEvent, render } from "@testing-library/react";
import { equal, isNotNull, isNull } from "rich-assert";
import { ResultGrouper } from "./ResultGrouper.tsx";

const faker = new ResultFaker();

test("empty database", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext
        initialSettings={new Settings().set(
          keyboardProps.layout,
          Layout.EN_DVORAK,
        )}
      >
        <FakeResultContext>
          <ResultGrouper>
            {(keyStatsMap) => <TestChild keyStatsMap={keyStatsMap} />}
          </ResultGrouper>
        </FakeResultContext>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  equal((await r.findByTitle("layout")).textContent, "en-dvorak");

  r.unmount();
});

test("select default layout", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext
        initialSettings={new Settings().set(
          keyboardProps.layout,
          Layout.EN_DVORAK,
        )}
      >
        <FakeResultContext
          initialResults={[faker.nextResult({ layout: Layout.EN_COLEMAK })]}
        >
          <ResultGrouper>
            {(keyStatsMap) => <TestChild keyStatsMap={keyStatsMap} />}
          </ResultGrouper>
        </FakeResultContext>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  equal((await r.findByTitle("layout")).textContent, "en-colemak");

  fireEvent.click(await r.findByTitle("clear"));

  equal((await r.findByTitle("layout")).textContent, "en-dvorak");

  r.unmount();
});

test("select text type", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext
        initialSettings={new Settings().set(keyboardProps.layout, Layout.EN_US)}
      >
        <FakeResultContext
          initialResults={[
            faker.nextResult({ layout: Layout.EN_US }),
            // A session that actually contained digits, which is what puts the
            // Digits filter on screen.
            faker.nextResult({
              layout: Layout.EN_US,
              histogram: faker.nextHistogram(Letter.digits),
            }),
          ]}
        >
          <ResultGrouper>
            {(keyStatsMap) => <TestChild keyStatsMap={keyStatsMap} />}
          </ResultGrouper>
        </FakeResultContext>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  fireEvent.click(await r.findByText("Letters"));

  equal((await r.findByTitle("alphabet")).textContent, "ABCDEFGHIJ");

  fireEvent.click(await r.findByText("Digits"));

  equal((await r.findByTitle("alphabet")).textContent, "0123456789");

  r.unmount();
});

test("offer only the character classes that were practised", async () => {
  PhoneticModelLoader.loader = FakePhoneticModel.loader;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext
        initialSettings={new Settings().set(keyboardProps.layout, Layout.EN_US)}
      >
        <FakeResultContext
          initialResults={[faker.nextResult({ layout: Layout.EN_US })]}
        >
          <ResultGrouper>
            {(keyStatsMap) => <TestChild keyStatsMap={keyStatsMap} />}
          </ResultGrouper>
        </FakeResultContext>
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  // The faked session is letters only, so there is exactly one class on
  // offer — and one option is not a choice. The whole filter row stays off
  // the page (see `hasChoice` in ResultGrouper): a lone chip that cannot be
  // turned off is a label wearing a button's clothes. The child must still
  // render, filtered to letters, without the row existing.
  isNotNull(await r.findByTitle("alphabet"));
  isNull(r.queryByText("Letters"));
  isNull(r.queryByText("Digits"));
  isNull(r.queryByText("Punctuation marks"));
  isNull(r.queryByText("Symbols"));
  isNull(r.queryByText("Code craft"));

  r.unmount();
});

function TestChild({ keyStatsMap }: { keyStatsMap: KeyStatsMap }) {
  const { layout } = useKeyboard();
  const { clearResults } = useResults();
  return (
    <div>
      <div title="layout">{layout.id}</div>
      <div title="alphabet">{keyStatsMap.letters.map(String).join("")}</div>
      <button
        title="clear"
        onClick={() => {
          clearResults();
        }}
      >
        clear
      </button>
    </div>
  );
}
