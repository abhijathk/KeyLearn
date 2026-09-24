import { test } from "node:test";
import {
  parseReply,
  plainText,
} from "@keylearn/page-support/lib/reply-format.ts";
import { isFalse, isTrue } from "rich-assert";
import { messageThreadReply } from "../auth/email.ts";

/**
 * The guest email fallback's contract with the reply format.
 *
 * A signed-out guest has no ReplyBody to draw a route rail or a switch, so
 * `#notifyReply` (support/controller.ts) runs the reply through the shared
 * parser's own `plainText(parseReply(...))` reading before handing it to
 * `messageThreadReply` — the exact composition tested here. Without it, a
 * reply built from the newer directives ([ask], [status N], a bare toggle)
 * reached the guest's inbox as literal brackets and asterisks, which is
 * worse than no formatting at all: it looks like the email is broken
 * rather than merely plain.
 */

function toEmail(raw: string): {
  readonly text: string;
  readonly html: string;
} {
  const mail = messageThreadReply({
    to: "guest@example.com",
    subject: "How do I show CPM instead of WPM?",
    body: plainText(parseReply(raw)),
    threadLink: "https://www.keylearn.org/support/t/abc123",
    authorName: null,
  });
  // `Mailer.Message` leaves `text`/`html` optional for the builders that
  // only ever set one; `messageThreadReply` always sets both.
  return { text: mail.text ?? "", html: mail.html ?? "" };
}

test("a bold control reaches the email with its asterisks gone", () => {
  const mail = toEmail("Turn on **Prefer real words** under Settings.");
  isFalse(mail.text.includes("**"));
  isFalse(mail.html.includes("**"));
  isTrue(mail.text.includes("Prefer real words"));
});

test("a path reaches the email as a readable route, not an arrow chain of brackets", () => {
  const mail = toEmail("Account → Preferences → Typing speed shown as");
  isFalse(mail.text.includes("["));
  isTrue(mail.text.includes("Account"));
  isTrue(mail.text.includes("Typing speed shown as"));
});

test("a toggle reaches the email as words, never as [on]/[off]", () => {
  const mail = toEmail(
    "[on] Prefer real words\n[off] Pause cursor on mistakes",
  );
  isFalse(mail.text.includes("["));
  isFalse(mail.html.includes("["));
  isTrue(mail.text.includes("Prefer real words: on"));
  isTrue(mail.text.includes("Pause cursor on mistakes: off"));
});

test("a range reaches the email with its ends named, not [range ...]", () => {
  const mail = toEmail("[range 40 wpm | 15 wpm | 150 wpm] Target speed");
  isFalse(mail.text.includes("["));
  isTrue(mail.text.includes("Target speed: 40 wpm"));
  isTrue(mail.text.includes("15 wpm"));
  isTrue(mail.text.includes("150 wpm"));
});

test("[status N] reaches the email as stage — now, not as raw brackets", () => {
  const mail = toEmail(
    "[status 2] Ordered (12 Sep) | Shipped (14 Sep) | Delivered",
  );
  isFalse(mail.text.includes("["));
  isTrue(mail.text.includes("→ Shipped"));
});

test("[ask] options reach the email listed as text, not as pipes and brackets", () => {
  const mail = toEmail("[ask] Which platform? | Windows | macOS | Linux");
  isFalse(mail.text.includes("["));
  isTrue(mail.text.includes("Which platform?"));
  isTrue(mail.text.includes("Windows / macOS / Linux"));
});

test("numbered steps keep their own lines in the HTML body, not one run-on sentence", () => {
  const mail = toEmail("1. Open the menu\n2. Account\n3. Preferences");
  isTrue(mail.html.includes("white-space:pre-wrap"));
  isTrue(mail.html.includes("1. Open the menu"));
  isTrue(mail.html.includes("3. Preferences"));
});
