import { test } from "node:test";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import { ChatWarden } from "./warden.ts";

const T = 1_700_000_000_000;

test("ordinary chat reaches the room untouched", () => {
  const w = new ChatWarden();
  const { post, notice } = w.say("a", "that semicolon run got me", T);
  isNotNull(post);
  equal(post!.text, "that semicolon run got me");
  equal(post!.blurred.length, 0);
  isNull(notice);
});

test("a borderline word is delivered blurred, and costs nothing", () => {
  const w = new ChatWarden();
  const { post, notice } = w.say("a", "this is so fucking hard", T);
  isNotNull(post, "the sentence still reads");
  isTrue(post!.blurred.length > 0, "with the word smudged");
  isNull(notice, "blurring is a courtesy, not an accusation");
});

test("the ladder is warn, then mute, then out", () => {
  const w = new ChatWarden();
  const one = w.say("a", "fuck this fucking shit", T);
  isNull(one.post, "nothing reaches the room");
  equal(one.notice!.kind, "warn");

  const two = w.say("a", "fuck this fucking shit again", T + 1000);
  equal(two.notice!.kind, "mute");
  isTrue(two.notice!.untilMs > T);

  // Muted: even a polite message is held until it lifts.
  const held = w.say("a", "sorry", T + 2000);
  isNull(held.post);
  equal(held.notice!.kind, "mute");
});

test("contact details skip the ladder on the very first message", () => {
  const w = new ChatWarden();
  const { post, notice } = w.say("a", "add me on discord", T);
  isNull(post);
  equal(notice!.kind, "blocked");
  // And the block is what keeps them out of the room, not just out of chat.
  isTrue(w.blockedUntil("a", T) > T);
});

test("a block keeps someone out until it lifts", () => {
  const w = new ChatWarden();
  w.say("a", "hmu on snapchat", T);
  const until = w.blockedUntil("a", T);
  isTrue(until > T);
  equal(w.blockedUntil("a", until + 1), 0, "and no longer");
});

test("flooding is throttled without a strike", () => {
  const w = new ChatWarden();
  for (let i = 0; i < 5; i++) {
    isNotNull(w.say("a", `message ${i}`, T + i).post);
  }
  const sixth = w.say("a", "message 6", T + 6);
  isNull(sixth.post);
  equal(sixth.notice!.kind, "slowdown");
  // A nuisance, not an offence — it must not push anybody up the ladder.
  const later = w.say("a", "hello again", T + 20_000);
  isNotNull(later.post);
});

test("the same line twice running is dropped in silence", () => {
  const w = new ChatWarden();
  isNotNull(w.say("a", "go on", T).post);
  const again = w.say("a", "go on", T + 100);
  isNull(again.post, "not repeated to the room");
  isNull(again.notice, "and not remarked upon either");
});

test("standing follows the person, not the socket", () => {
  const w = new ChatWarden();
  w.say("user:7", "fuck this fucking shit", T);
  // Same account, new connection: the warning still counts, or the ladder is
  // one refresh deep and means nothing.
  const second = w.say("user:7", "fuck this fucking shit again", T + 1000);
  equal(second.notice!.kind, "mute");
});

test("one person's standing does not touch another's", () => {
  const w = new ChatWarden();
  w.say("a", "fuck this fucking shit", T);
  const other = w.say("b", "fuck this fucking shit", T);
  equal(other.notice!.kind, "warn", "b is on their first, not a's second");
});
