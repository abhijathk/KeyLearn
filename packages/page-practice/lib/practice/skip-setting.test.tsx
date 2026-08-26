import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { uiProps } from "@keylearn/result";
import { FakeSettingsContext, Settings } from "@keylearn/settings";
import { fireEvent, render } from "@testing-library/react";
import { isNotNull, isNull } from "rich-assert";
import { Controls } from "./Controls.tsx";

/**
 * Turning the skip control off, and having it stay off.
 *
 * A customer asked for this because their learners were skipping every lesson
 * that got hard — the lesson worth staying on, and the one guided practice
 * would otherwise have kept bringing back until it was learned.
 *
 * Against `Controls` rather than the whole practice screen, because that is
 * where the decision is made. (The screen's own render test is red on this
 * branch for unrelated reasons — its lesson loader resolves to nothing under
 * the test harness — so building on it would have proved nothing either way.)
 */

function renderControls(allowSkip: boolean) {
  return render(
    <FakeIntlProvider>
      <FakeSettingsContext
        initialSettings={new Settings().set(uiProps.allowSkip, allowSkip)}
      >
        <Controls
          onResetLesson={() => {}}
          onSkipLesson={() => {}}
          onHelp={() => {}}
        />
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );
}

/** The toolbar keeps its tools folded away until the toggle opens them. */
async function openTools(r: ReturnType<typeof render>) {
  fireEvent.click(
    await r.findByTitle("Show or hide the practice tools", { exact: false }),
  );
  return r;
}

test("skipping is offered by default", async () => {
  // The default stays as it was. A setting existing is not a reason to take a
  // control away from every learner who already had one.
  const r = await openTools(renderControls(true));
  isNotNull(r.queryByTitle("Move to the next lesson", { exact: false }));
  r.unmount();
});

test("turning it off removes the skip control", async () => {
  const r = await openTools(renderControls(false));
  isNull(r.queryByTitle("Move to the next lesson", { exact: false }));
  // Restarting is a different thing and stays. The learner may still begin the
  // lesson again — they simply may not walk past it.
  isNotNull(r.queryByTitle("Restart this lesson", { exact: false }));
  r.unmount();
});
