import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import { classify, MAX_LENGTH } from "./classify.ts";

/**
 * The cases that matter are the evasions and the false positives. A filter that
 * catches "fuck" and nothing else is decoration; a filter that eats "Scunthorpe"
 * is worse than none, because the people it annoys are the innocent ones.
 */

test("ordinary chat passes untouched", () => {
  for (const text of [
    "that semicolon run got me",
    "you'll get there!",
    "slow down on the capitals, worth it",
    "nice one Meera",
    "I got 71 wpm on that one",
  ]) {
    const v = classify(text);
    equal(v.action, "allow", text);
    equal(v.strikes, 0);
  }
});

test("innocent words that merely contain rude substrings survive", () => {
  // The Scunthorpe problem. Every one of these has bitten a real filter.
  for (const text of [
    "Scunthorpe is a town",
    "the analysis was hard",
    "an assassin in the story",
    "class assignment tomorrow",
    "I live in Sussex",
    "press the button",
  ]) {
    equal(classify(text).action, "allow", text);
  }
});

test("one rude word is blurred, not punished", () => {
  const v = classify("this is so fucking hard honestly");
  equal(v.action, "blur");
  equal(v.reason, "mild");
  equal(v.strikes, 0, "blurring is a courtesy, not an accusation");
  equal(v.spans.length, 1);
});

test("the blurred span covers the word and nothing else", () => {
  const text = "this is so fucking hard";
  const [[start, end]] = classify(text).spans;
  isTrue(text.slice(start, end).length > 0);
  // The span must not swallow the neighbouring words, or the message becomes
  // unreadable smudge rather than a censored word.
  isTrue(!text.slice(start, end).includes("this"));
  isTrue(!text.slice(start, end).includes("hard"));
});

test("padded, spaced and leetspoken evasions are still caught", () => {
  // Each of these gets past a plain wordlist.
  for (const text of [
    "you are a fuuuuuck",
    "f.u.c.k this passage",
    "f u c k this passage",
    "sh1t that was fast",
    "what the f-u-c-k",
  ]) {
    const v = classify(text);
    isTrue(v.action !== "allow", `not caught: ${text}`);
  }
});

test("a tirade is withheld rather than smudged", () => {
  const v = classify("fuck this fucking shit");
  equal(v.action, "withhold");
  equal(v.reason, "severe");
  equal(v.strikes, 1);
  deepEqual(v.spans, [], "nothing is sent, so there is nothing to blur");
});

test("slurs are withheld and count double", () => {
  const v = classify("you are a cunt");
  equal(v.action, "withhold");
  equal(v.reason, "slur");
  equal(v.strikes, 2, "‘please be nicer’ is the wrong answer to a slur");
});

test("an over-long message is dropped without blaming anybody", () => {
  const v = classify("a".repeat(MAX_LENGTH + 1));
  equal(v.action, "withhold");
  equal(v.strikes, 0, "length is not an offence");
});

test("an empty message is dropped", () => {
  equal(classify("   ").action, "withhold");
  equal(classify("   ").strikes, 0);
});
