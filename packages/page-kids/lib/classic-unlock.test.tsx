import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { render } from "@testing-library/react";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import { ClassicUnlock } from "./classic.tsx";

// The moment a key joins the trail. The trail games mark it with "tap it three
// times to wake it up"; Classic is for older learners and says it once, plainly.
test("name the key and the finger that reaches it", () => {
  const r = render(
    <FakeIntlProvider>
      <ClassicUnlock letter="r" finger="left index" />
    </FakeIntlProvider>,
  );
  isNotNull(r.queryByText("New key"));
  isNotNull(r.queryByText(/left index/));
  isNotNull(r.queryByText(/Press R to carry on/));
  // The keycap itself, shown once and hidden from screen readers so the
  // sentence beneath it is what gets announced rather than a stray letter.
  const cap = r.container.querySelector('[aria-hidden="true"]');
  isNotNull(cap);
  equal(cap!.textContent, "R");
  r.unmount();
});

// A key with no finger mapping must still be celebrated, rather than crash or
// claim a finger nobody knows.
test("celebrate a key even when no finger is known for it", () => {
  const r = render(
    <FakeIntlProvider>
      <ClassicUnlock letter="q" finger={null} />
    </FakeIntlProvider>,
  );
  isNotNull(r.queryByText("New key"));
  isNull(r.queryByText(/reaches it/));
  isNotNull(r.queryByText(/Press Q to carry on/));
  r.unmount();
});

// It interrupts the lesson, so it has to announce itself as a dialog.
test("announce itself the way a modal must", () => {
  const r = render(
    <FakeIntlProvider>
      <ClassicUnlock letter="r" finger="left index" />
    </FakeIntlProvider>,
  );
  const dialog = r.container.querySelector('[role="alertdialog"]');
  isNotNull(dialog);
  isTrue(dialog!.getAttribute("aria-modal") === "true");
  r.unmount();
});
