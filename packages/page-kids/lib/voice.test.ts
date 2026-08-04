import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { forSpeech, isSpoken } from "./voice.ts";

test("the moments speak and the chatter does not", () => {
  isTrue(isSpoken("grow"), "a new key is the whole point of the page");
  isTrue(isSpoken("hatch"));
  isTrue(isSpoken("stuck"), "help, said when they cannot read the help");
  isTrue(isSpoken("idle"), "and said exactly when they are not looking");

  // These two fire constantly — a cheer on up to a third of correct keys and a
  // miss on every wrong one. A voice on either would never stop talking.
  isFalse(isSpoken("cheer"));
  isFalse(isSpoken("miss"));
});

test("grown-up asides are not read to the child", () => {
  equal(
    forSpeech("An egg hatched — Vela joined the herd! (see settings)"),
    "An egg hatched, Vela joined the herd!",
  );
});

test("beats written for the eye become pauses for the ear", () => {
  equal(
    forSpeech("The trail is quiet… one glowing key starts it again!"),
    "The trail is quiet, one glowing key starts it again!",
  );
  equal(forSpeech("RAWWRR!! Take a breath!"), "RAWWRR! Take a breath!");
});

test("a line that was nothing but an aside is not spoken at all", () => {
  equal(forSpeech("(see settings)"), "");
});

test("ordinary lines survive untouched", () => {
  const line = "Baby Rexy wobbles up a size, so cute and growing!";
  equal(forSpeech(line), line);
});
