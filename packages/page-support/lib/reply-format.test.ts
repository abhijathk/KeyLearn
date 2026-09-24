import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import { parseReply, plainText } from "./reply-format.ts";

/**
 * The parser's contract with QDesk.
 *
 * The customer reads a reply here; a staff member reads the same reply in
 * the desk. Both parse it with a copy of this file, so these cases are
 * the agreement between two repositories — QDesk runs the same ones in
 * `scripts/reply-format.mjs`. If they drift, a customer and the agent
 * helping them are looking at different messages, and neither can see
 * that it has happened.
 *
 * Two properties matter more than any single case. NOTHING IS LOST: a
 * parser on the reply path must never drop a sentence, because a missing
 * line is a customer missing the step that would have fixed their
 * problem, and nothing raises an error. NOTHING IS PROMOTED BY ACCIDENT:
 * prose containing an arrow stays prose, since rendering a paragraph as a
 * keycap is worse than leaving the asterisks visible.
 */

test("a bare arrow line becomes a path", () => {
  const [block] = parseReply(
    "Practice → Settings → Display → Show typing speed as",
  );
  equal(block?.kind, "path");
  deepEqual(block?.kind === "path" ? [...block.segments] : [], [
    "Practice",
    "Settings",
    "Display",
    "Show typing speed as",
  ]);
});

test("a sentence that continues past the path stays prose", () => {
  // The rail would swallow "and turn it off", leaving the customer a path
  // and no idea what to do on arrival.
  const [block] = parseReply(
    "Open Account → Accessibility → Being measured and turn it on.",
  );
  equal(block?.kind, "paragraph");
});

test("two segments is a crumb, not a rail", () => {
  const [block] = parseReply("Account → Appearance");
  equal(block?.kind, "paragraph");
});

test("a numbered run becomes one step rail, with its asides split off", () => {
  const blocks = parseReply(
    "1. Open Practice — from the top navigation\n2. Settings → Display\n3. Change it",
  );
  equal(blocks.length, 1);
  equal(blocks[0]?.kind, "steps");
  if (blocks[0]?.kind === "steps") {
    equal(blocks[0].items.length, 3);
    equal(blocks[0].items[0]?.hint, "from the top navigation");
    equal(blocks[0].items[2]?.hint, null);
  }
});

test("a single numbered line is not a rail", () => {
  equal(parseReply("1. Just the one thing")[0]?.kind, "paragraph");
});

test("bold marks a control, and the sentence around it survives", () => {
  const [block] = parseReply(
    "Turn off **Pause cursor on mistakes** and you're done.",
  );
  const spans = block?.kind === "paragraph" ? block.spans : [];
  isTrue(
    spans.some(
      (s) => s.kind === "control" && s.text === "Pause cursor on mistakes",
    ),
  );
  isTrue(
    spans.some((s) => s.kind === "text" && s.text.includes("you're done")),
  );
});

test("a bolded sentence is not promoted to a control", () => {
  // It would render as a keycap the size of a paragraph, which looks broken.
  const [block] = parseReply(
    "**This is a whole sentence of emphasis that is plainly not the name of any control.**",
  );
  const spans = block?.kind === "paragraph" ? block.spans : [];
  isTrue(spans.every((s) => s.kind !== "control"));
});

test("a path inside a sentence becomes an inline crumb", () => {
  const [block] = parseReply(
    "That one lives under Practice → Settings → Display, by the way.",
  );
  const spans = block?.kind === "paragraph" ? block.spans : [];
  isTrue(spans.some((s) => s.kind === "crumb"));
  isTrue(spans.some((s) => s.kind === "text" && s.text.includes("by the way")));
});

test("nothing is lost on the round trip", () => {
  const reply =
    "That's a rough way to lose months of work.\n\n" +
    "Practice → Settings → Display → Show typing speed as\n\n" +
    "1. Open Practice — from the top nav\n2. Pick Display\n\n" +
    "Turn on **A rest day keeps the streak** and tell me if it isn't there.";
  const back = plainText(parseReply(reply));
  for (const phrase of [
    "rough way to lose months",
    "Show typing speed as",
    "Open Practice",
    "A rest day keeps the streak",
    "tell me if it isn't there",
  ]) {
    isTrue(back.includes(phrase), phrase);
  }
});

test("odd input neither throws nor loses its words", () => {
  const weird =
    "Here's 100% of ** the ** asterisks -> and an arrow, plus a 1)b list.";
  // Totality is the property: any input produces blocks, and the words
  // come back out. A parser on the reply path that can throw is a reply
  // that can fail to render.
  isTrue(Array.isArray(parseReply(weird)));
  isTrue(plainText(parseReply(weird)).includes("asterisks"));
  equal(parseReply("").length, 0);
  equal(parseReply("   \n\n  ").length, 0);
});

test("a numbered run keeps its first number as start", () => {
  const [block] = parseReply("5. Scan the QR code\n6. Confirm on the phone");
  equal(block?.kind, "steps");
  equal(block?.kind === "steps" ? block.start : null, 5);
});

test("a numbered run starting at 1 has start 1", () => {
  const [block] = parseReply("1. Open Practice\n2. Pick Display");
  equal(block?.kind === "steps" ? block.start : null, 1);
});

test("a run of [cause] lines becomes one causes block", () => {
  const blocks = parseReply(
    "[cause] The key repeats | Lower the repeat delay\n[cause] Sticky keys is on | Turn it off",
  );
  equal(blocks.length, 1);
  equal(blocks[0]?.kind, "causes");
  if (blocks[0]?.kind === "causes") {
    equal(blocks[0].items.length, 2);
    equal(blocks[0].items[0]?.when, "The key repeats");
    isTrue(
      blocks[0].items[0]?.fix?.some(
        (s) => s.kind === "text" && s.text.includes("Lower the repeat delay"),
      ) ?? false,
    );
  }
});

test("a [cause] line without a fix has a null fix", () => {
  const [block] = parseReply("[cause] The key repeats");
  equal(block?.kind, "causes");
  equal(block?.kind === "causes" ? block.items[0]?.fix : "unset", null);
});

test("[nope] is a heading and a body", () => {
  const [block] = parseReply(
    "[nope] Can't refund that | It was used more than 30 days ago.",
  );
  equal(block?.kind, "nope");
  if (block?.kind === "nope") {
    equal(block.heading, "Can't refund that");
    isTrue(
      block.body.some(
        (s) => s.kind === "text" && s.text.includes("30 days ago"),
      ),
    );
  }
});

test("[nope] with no body has an empty body", () => {
  const [block] = parseReply("[nope] Can't do that");
  equal(block?.kind, "nope");
  deepEqual(block?.kind === "nope" ? [...block.body] : ["unset"], []);
});

test("a malformed [nope] with no heading stays a plain paragraph", () => {
  equal(parseReply("[nope]")[0]?.kind, "paragraph");
});

test("[status N] marks the current stage, 0-based", () => {
  const [block] = parseReply(
    "[status 2] Ordered (12 Sep) | Shipped (14 Sep) | Delivered",
  );
  equal(block?.kind, "status");
  if (block?.kind === "status") {
    equal(block.current, 1);
    equal(block.stages.length, 3);
    equal(block.stages[0]?.label, "Ordered");
    equal(block.stages[0]?.when, "12 Sep");
    equal(block.stages[2]?.when, null);
  }
});

test("a [status N] out of range stays a plain paragraph", () => {
  equal(parseReply("[status 5] A | B")[0]?.kind, "paragraph");
});

test("a [status N] with fewer than 2 stages stays a plain paragraph", () => {
  equal(parseReply("[status 1] Only one")[0]?.kind, "paragraph");
});

test("[ask] is a question with its options", () => {
  const [block] = parseReply("[ask] Which platform? | Windows | macOS | Linux");
  equal(block?.kind, "ask");
  if (block?.kind === "ask") {
    equal(block.question, "Which platform?");
    deepEqual([...block.options], ["Windows", "macOS", "Linux"]);
  }
});

test("an [ask] option over 40 characters stays a plain paragraph", () => {
  const long = "x".repeat(41);
  equal(parseReply(`[ask] Q? | ${long} | fine`)[0]?.kind, "paragraph");
});

test("an [ask] with only one option stays a plain paragraph", () => {
  equal(parseReply("[ask] Q? | only one")[0]?.kind, "paragraph");
});

test("a run of past/now/next lines becomes one timeline block", () => {
  const blocks = parseReply(
    "[past] 1 Sep | Ticket opened\n[now] 3 Sep | Investigating | Checking logs\n[next] — | Fix ships",
  );
  equal(blocks.length, 1);
  equal(blocks[0]?.kind, "timeline");
  if (blocks[0]?.kind === "timeline") {
    equal(blocks[0].items.length, 3);
    equal(blocks[0].items[0]?.state, "past");
    equal(blocks[0].items[1]?.detail, "Checking logs");
    equal(blocks[0].items[2]?.detail, null);
  }
});

test("a run of [contact] lines becomes one contacts block", () => {
  const blocks = parseReply(
    "[contact] Billing | can issue refunds\n[contact] Security | can reset your 2FA",
  );
  equal(blocks.length, 1);
  equal(blocks[0]?.kind, "contacts");
  if (blocks[0]?.kind === "contacts") {
    equal(blocks[0].items.length, 2);
    equal(blocks[0].items[0]?.who, "Billing");
    isTrue(
      blocks[0].items[0]?.detail.some(
        (s) => s.kind === "text" && s.text.includes("refunds"),
      ) ?? false,
    );
  }
});

test("a [contact] line with no detail stays a plain paragraph", () => {
  equal(parseReply("[contact] Billing")[0]?.kind, "paragraph");
});

test("an unknown bracket keyword is left as plain text", () => {
  const [block] = parseReply("[banner] not a real directive");
  equal(block?.kind, "paragraph");
});

test("markup in the source cannot become markup on the page", () => {
  // Replies quote customers, and customers can write anything. The parser
  // only ever emits text nodes, so this is a property of the design
  // rather than an escaping routine that has to be kept correct.
  const [block] = parseReply(
    "<img src=x onerror=alert(1)> and [a](javascript:alert(1))",
  );
  const spans = block?.kind === "paragraph" ? block.spans : [];
  isTrue(spans.every((s) => s.kind === "text" || s.kind === "crumb"));
  isTrue(plainText(parseReply("<img src=x>")).includes("<img src=x"));
});

// KEY0000084, 24 Sep 2026: both of these arrived as plain numbered text.
test("steps followed by a closing sentence are still a step rail", () => {
  const blocks = parseReply(
    "1. Open **Account** → **Learners** → **Add a profile**.\n2. Under **Who is this**, choose **Kid**.\n3. Press **Add learner**.\nIf the **Add a profile** option isn't there, tell me.",
  );
  equal(blocks[0]?.kind, "steps");
  equal(blocks[0]?.kind === "steps" ? blocks[0].items.length : 0, 3);
  equal(blocks[1]?.kind, "paragraph");
});

test("blank lines between numbered items don't break the rail", () => {
  const [block] = parseReply(
    "2. Under **Who is this**, choose **Kid**.\n\n3. Fill in **First name**.",
  );
  equal(block?.kind, "steps");
  equal(block?.kind === "steps" ? block.start : 0, 2);
});

test("a lead-in and a closing line sit either side of the rail", () => {
  const kinds = parseReply("Here's how:\n1. One\n2. Two\nThanks.").map(
    (b) => b.kind,
  );
  equal(kinds.join(","), "paragraph,steps,paragraph");
});
