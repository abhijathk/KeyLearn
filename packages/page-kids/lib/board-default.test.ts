import { readFileSync } from "node:fs";
import { test } from "node:test";
import { equal } from "rich-assert";

/**
 * The board a child meets on their first lesson is Crayon.
 *
 * Read out of the source rather than by calling `defaultPrefs()`, which is
 * not exported and reaches for `localStorage` and the active profile's age
 * the moment it runs. The value is a literal in one place; asserting the
 * literal is honest about what is being protected, and needs no browser.
 *
 * Worth an assertion of its own because Crayon and Rainbow are equally
 * finished, so nothing breaks when the default flips — a learner simply
 * meets the wrong one, and there is no test failure and no error to notice.
 * That is precisely the kind of regression that survives a release.
 *
 * The default applies to a first-time learner only, signed in or not. A
 * child who picks Rainbow in the toy box keeps Rainbow; this says nothing
 * about a stored choice, and must not.
 */
test("a first-time learner's board is Crayon", () => {
  const source = readFileSync(
    new URL("./KidsPage.tsx", import.meta.url),
    "utf8",
  );
  const inDefaults =
    /function defaultPrefs\(\)[\s\S]*?\n}/.exec(source)?.[0] ?? "";
  const board = /\n\s*board:\s*"(\w+)"/.exec(inDefaults)?.[1];
  equal(board, "crayon");
});
