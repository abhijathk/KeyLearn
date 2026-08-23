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
