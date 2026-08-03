import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { classify } from "./classify.ts";
import { hasContactDetails } from "./contact.ts";

/**
 * The half of this that actually matters.
 *
 * A rude word is unpleasant. A handle offered to a stranger in an app children
 * have open is the start of something else, so these patterns are broad on
 * purpose: a false positive costs one retyped message.
 */

test("anything that leads off the site is caught", () => {
  for (const text of [
    "check https://example.com",
    "go to www.example.com",
    "my site is example.com",
    "find me at example (dot) com",
    "email me at bob@example.com",
    "bob (at) example (dot) com",
    "call me on 07700 900123",
    "my number is 555 123 4567",
    "add me on discord",
    "hmu on snapchat",
    "discord: someone#1234",
    "dm me on insta",
    "join me on telegram",
  ]) {
    isTrue(hasContactDetails(text), `missed: ${text}`);
  }
});

test("ordinary chat is not mistaken for contact details", () => {
  for (const text of [
    "I got 71 wpm",
    "that took me 3 tries",
    "born in 1990",
    "I use discord sometimes",
    "the score was 2400",
    "meet you at 5",
    "chapter 12 verse 4",
  ]) {
    isFalse(hasContactDetails(text), `false positive: ${text}`);
  }
});

test("contact details are withheld, never blurred, and skip the ladder", () => {
  const v = classify("add me on discord");
  equal(v.action, "withhold");
  equal(v.reason, "contact");
  equal(v.strikes, 3, "no warning ladder for this one");
  equal(v.spans.length, 0, "a blurred phone number is still a phone number");
});
