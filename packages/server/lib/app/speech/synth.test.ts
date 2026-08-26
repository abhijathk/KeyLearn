import { test } from "node:test";
import { deepEqual, equal, isFalse, isTrue } from "rich-assert";
import { findSynth, installedVoices, isVoiceId, VOICES } from "./synth.ts";

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
  // The set itself rather than its size. A count says nothing about which
  // voices exist, and it went stale the moment a fourth was added for the nine
  // to thirteens — failing on a change that was entirely intended, while still
  // not noticing if one had been renamed.
  deepEqual([...VOICES], ["kid", "tween", "lady", "man"]);
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

test("a machine that can speak offers voices to choose from", async () => {
  // The check that would have caught the whole feature shipping dead.
  //
  // This first asked piper alone which voices existed. Production runs
  // espeak-ng, so the answer there would have been "none" — and the picker
  // hides itself when nothing is offered, so no parent could ever have chosen
  // a voice, while the endpoint behind it rendered all three perfectly well if
  // asked directly. A feature invisible on every deployment that matters.
  //
  // Whatever synthesiser this machine has, if it can speak at all it can speak
  // these, and the list must say so. (A machine with none returns an empty
  // list, which is also correct — hence the conditional rather than a flat
  // assertion about length.)
  const voices = await installedVoices();
  const synth = await findSynth();
  if (synth == null) {
    equal(voices.length, 0);
  } else {
    isTrue(voices.length > 0, "a machine that can speak must offer a voice");
    for (const id of voices) {
      isTrue(isVoiceId(id));
    }
  }
});
