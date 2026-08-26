import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { isVoiceId, VOICES } from "./synth.ts";

/**
 * The voice name, checked where it has to be checked.
 *
 * This value picks a model file and becomes an argument to a subprocess. The
 * picker in the account page only ever offers the three, but the picker is not
 * what calls this endpoint — a URL is, and a URL is written by whoever wants
 * to. So the allow-list is the boundary, and a shape check ("looks like a
 * voice name") would be a weaker promise than membership.
 */

test("only the curated voices are accepted", () => {
  for (const id of VOICES) {
    isTrue(isVoiceId(id));
  }
  equal(VOICES.length, 3);
});

test("anything else is refused, including the near misses", () => {
  // Case and whitespace variants are the ones a permissive check waves
  // through, and each would reach the synthesiser as a distinct string.
  isFalse(isVoiceId("Kid"));
  isFalse(isVoiceId("kid "));
  isFalse(isVoiceId(""));

  // Path traversal is the reason this is an allow-list rather than a pattern:
  // the value selects a file, so a name that escapes the models directory is
  // the whole attack, and "matches [a-z]+" would not have stopped a name that
  // was simply an unintended model.
  isFalse(isVoiceId("../../etc/passwd"));
  isFalse(isVoiceId("kid/../../secret"));

  // And a shell metacharacter, which the argument array already defeats — but
  // defence that rests on one layer is defence that a refactor removes.
  isFalse(isVoiceId("kid; rm -rf /"));
  isFalse(isVoiceId("kid$(id)"));
});
