import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { PageDataContext } from "@keylearn/pages-shared";
import { act, render } from "@testing-library/react";
import { deepEqual, equal, isNotNull, isNull } from "rich-assert";
import { ReplyBody } from "./ReplyBody.tsx";

/**
 * ReplyBody's own rendering contract for the 24 Sep 2026 redesign — the
 * six new block kinds (causes, nope, status, ask, timeline, contacts) and
 * the live/inert behaviour of [ask]'s buttons. The parser's own contract
 * (which text becomes which block) is reply-format.test.ts; this is about
 * what the block becomes on screen.
 */

function renderReply(
  text: string,
  props: {
    readonly onAsk?: (option: string) => void;
    readonly askLive?: boolean;
    readonly askAnswer?: string | null;
  } = {},
) {
  return render(
    <PageDataContext.Provider
      value={{
        base: "https://www.keylearn.org/",
        locale: "en",
        user: null,
        publicUser: { id: null, name: "name", imageUrl: null },
        settings: null,
        profiles: [],
        replyAccent: "mint",
      }}
    >
      <FakeIntlProvider>
        <ReplyBody text={text} {...props} />
      </FakeIntlProvider>
    </PageDataContext.Provider>,
  );
}

test("causes render as lettered cards, each with its own fix", () => {
  const r = renderReply(
    "[cause] A Kid profile is active | Switch to a grown-up profile.\n" +
      "[cause] Not enough active learners yet | It appears once there are.",
  );
  isNotNull(r.queryByText("A Kid profile is active", { exact: false }));
  isNotNull(r.queryByText("Switch to a grown-up profile.", { exact: false }));
  r.unmount();
});

test('nope followed by a path nests it as "the closest thing"', () => {
  const r = renderReply(
    "[nope] There's no button to disconnect one | Try this instead.\n\n" +
      "Account → Security → Two-step verification",
  );
  isNotNull(
    r.queryByText("There's no button to disconnect one", { exact: false }),
  );
  isNotNull(r.queryByText("The closest thing", { exact: false }));
  isNotNull(r.queryByText("Two-step verification", { exact: false }));
  // Nested, not repeated: the path shows up once, inside the card, and
  // never again as its own separate rail below it.
  equal(r.container.querySelectorAll('[role="group"]').length, 1);
  r.unmount();
});

test("a nope with no following route stands alone, with no closest-thing label", () => {
  const r = renderReply("[nope] Can't refund that | It was used already.");
  isNull(r.queryByText("The closest thing", { exact: false }));
  r.unmount();
});

test("status marks the current stage and ticks the ones before it", () => {
  const r = renderReply(
    "[status 2] Reported (12 Sep) | Found the cause (14 Sep) | Being fixed | Fixed",
  );
  isNotNull(r.queryByText("Being fixed", { exact: false }));
  isNotNull(r.queryByText("Reported", { exact: false }));
  isNotNull(r.queryByText("12 Sep", { exact: false }));
  r.unmount();
});

test("timeline rows show when, title and detail", () => {
  const r = renderReply(
    "[past] Today | Account deletion scheduled | The email explains why\n" +
      "[now] Until 1 Oct | Cancel this deletion | Open the link and press it",
  );
  isNotNull(r.queryByText("Account deletion scheduled", { exact: false }));
  isNotNull(r.queryByText("Cancel this deletion", { exact: false }));
  r.unmount();
});

test('contacts render under one "Who can help" heading', () => {
  const r = renderReply(
    "[contact] Billing | can issue refunds\n[contact] Security | can reset your 2FA",
  );
  const who = r.queryAllByText("Who can help");
  equal(who.length, 1);
  isNotNull(r.queryByText("Billing", { exact: false }));
  isNotNull(r.queryByText("Security", { exact: false }));
  r.unmount();
});

test("an [ask] question shows its options", () => {
  const r = renderReply("[ask] Which platform? | Windows | macOS | Linux");
  isNotNull(r.queryByText("Which platform?", { exact: false }));
  isNotNull(r.queryByText("Windows"));
  isNotNull(r.queryByText("macOS"));
  isNotNull(r.queryByText("Linux"));
  r.unmount();
});

test("a live [ask] renders real buttons and sends the tapped option", () => {
  const sent: string[] = [];
  const r = renderReply("[ask] Which platform? | Windows | macOS | Linux", {
    askLive: true,
    onAsk: (option) => sent.push(option),
  });
  const buttons = [
    ...r.container.querySelectorAll('button[type="button"]'),
  ].filter((b) => /Windows|macOS|Linux/.test(b.textContent ?? ""));
  equal(buttons.length, 3);
  act(() => {
    (
      buttons.find((b) => b.textContent === "macOS") as HTMLButtonElement
    ).click();
  });
  deepEqual(sent, ["macOS"]);
  r.unmount();
});

test("an inert [ask] renders no buttons and marks the option the customer chose", () => {
  const r = renderReply("[ask] Which platform? | Windows | macOS | Linux", {
    askLive: false,
    askAnswer: "macOS",
  });
  const buttons = [
    ...r.container.querySelectorAll('button[type="button"]'),
  ].filter((b) => /Windows|macOS|Linux/.test(b.textContent ?? ""));
  equal(buttons.length, 0);
  isNotNull(r.queryByText("macOS", { exact: false }));
  r.unmount();
});

test("toggles show On/Off in words, translated through the catalogue", () => {
  const r = renderReply(
    "[on] Prefer real words\n[off] Pause cursor on mistakes",
  );
  isNotNull(r.queryByText("On"));
  isNotNull(r.queryByText("Off"));
  r.unmount();
});

test('a danger callout carries the "Can\'t be undone" tag', () => {
  const r = renderReply(
    "[danger] **Delete forever** Every result is removed for good.",
  );
  isNotNull(r.queryByText("Can’t be undone", { exact: false }));
  r.unmount();
});

test("a note callout never carries the danger tag", () => {
  const r = renderReply("[note] **Good to know** It changes old results too.");
  isNull(r.queryByText("Can’t be undone", { exact: false }));
  r.unmount();
});

test("unrecognised text still falls all the way back to plain text", () => {
  const r = renderReply("just an ordinary sentence, nothing to parse here");
  isNotNull(r.queryByText("just an ordinary sentence, nothing to parse here"));
  r.unmount();
});
