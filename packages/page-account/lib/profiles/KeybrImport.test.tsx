import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { act, fireEvent, render } from "@testing-library/react";
import { equal, isNotNull } from "rich-assert";
import { KeybrImport } from "./KeybrImport.tsx";
import { type Profile } from "./store.ts";

/**
 * The file window takes a moment to open and a big export takes a moment to
 * read; the button says so through both (owner, 5 Oct 2026), and lets go
 * whether the person picks a file or cancels.
 */

const profiles = [
  { id: "1", firstName: "Asha", kind: "adult" },
] as unknown as Profile[];

function setup() {
  const r = render(
    <FakeIntlProvider>
      <KeybrImport profiles={profiles} userId="u1" onClose={() => {}} />
    </FakeIntlProvider>,
  );
  const button = r.getByText("Choose file…").closest("button")!;
  const input =
    r.container.ownerDocument.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )!;
  // jsdom has no file window: stop the click from trying to open one.
  input.click = () => {};
  return { r, button, input };
}

test("clicking says Opening… until the file window is cancelled", async () => {
  const { r, button, input } = setup();
  fireEvent.click(button);
  isNotNull(r.queryByText("Opening…"));
  equal(button.getAttribute("aria-busy"), "true");
  await act(async () => {
    input.dispatchEvent(new input.ownerDocument.defaultView!.Event("cancel"));
  });
  isNotNull(r.queryByText("Choose file…"));
  equal(button.getAttribute("aria-busy"), "false");
  r.unmount();
});

test("a chosen file says Reading file… until it has been read", async () => {
  const { r, button, input } = setup();
  fireEvent.click(button);
  let finish!: (text: string) => void;
  const file = new File(["[]"], "typing-data.json", {
    type: "application/json",
  });
  // Held open, so the reading state can be seen before the read finishes.
  file.text = () => new Promise<string>((resolve) => (finish = resolve));
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  isNotNull(r.queryByText("Reading file…"));
  await act(async () => {
    finish("[]");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  isNotNull(r.queryByText("Choose file…"));
  isNotNull(r.queryByText(/Found 0 valid lessons/));
  r.unmount();
});
