import { test } from "node:test";
import { fakeAdapter } from "@fastr/fetch";
import { FakeIntlProvider } from "@keylearn/intl";
import { type UserDetails } from "@keylearn/pages-shared";
import { act, fireEvent, render } from "@testing-library/react";
import { equal, isNotNull, isNull } from "rich-assert";
import { ParentPinCard } from "./ParentPinCard.tsx";

/**
 * The kids-page lock asks before it changes, both ways round (owner, 4 Oct
 * 2026): a cancelled confirmation saves nothing, a confirmed one saves.
 */

test.beforeEach(() => {
  fakeAdapter.reset();
  fakeAdapter.on
    .PATCH("/_/account")
    .replyWith(JSON.stringify({ user: {}, publicUser: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
});

test.afterEach(() => {
  fakeAdapter.reset();
});

const user = (kidsExitPin: boolean) =>
  ({
    parentPinSet: true,
    parentPinLength: 4,
    kidsExitPin,
  }) as unknown as UserDetails;

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

test("turning the kids-page lock on asks first; cancel saves nothing", async () => {
  let saved = 0;
  const r = render(
    <FakeIntlProvider>
      <ParentPinCard user={user(false)} onChanged={() => saved++} />
    </FakeIntlProvider>,
  );
  const sw = r.getByRole("switch");

  fireEvent.click(sw);
  isNotNull(r.queryByText("Lock the kids page?"));
  fireEvent.click(r.getByText("Cancel"));
  await settle();
  isNull(r.queryByText("Lock the kids page?"));
  equal(saved, 0);

  fireEvent.click(sw);
  fireEvent.click(r.getByText("Turn on"));
  await settle();
  equal(saved, 1);
  r.unmount();
});

test("turning it off asks too, in its own words", async () => {
  let saved = 0;
  const r = render(
    <FakeIntlProvider>
      <ParentPinCard user={user(true)} onChanged={() => saved++} />
    </FakeIntlProvider>,
  );
  fireEvent.click(r.getByRole("switch"));
  isNotNull(r.queryByText("Unlock the kids page?"));
  fireEvent.click(r.getByText("Turn off"));
  await settle();
  equal(saved, 1);
  r.unmount();
});
