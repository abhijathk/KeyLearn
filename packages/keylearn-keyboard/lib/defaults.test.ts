import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { KeyboardColour, keyboardProps, KeyboardStyle } from "./settings.ts";

/**
 * What a learner sees on their very first lesson, before they have chosen
 * anything.
 *
 * These are two lines of code that nothing else in the app asserts, and they
 * decide the first impression of the product for every visitor and every new
 * account — which makes them exactly the kind of value that gets changed
 * while somebody is comparing boards and never changed back. The board that
 * ships is KeyLearn's own; the alternatives are alternatives.
 *
 * Note what is NOT pinned here: a stored choice. The default only applies
 * when nothing has been saved, so a learner who picks the mechanical board
 * keeps it, on this device and on the next one.
 */
test("the board a first-time learner meets is KeyLearn's own", () => {
  equal(keyboardProps.style.defaultValue, KeyboardStyle.KEYLEARN);
});

test("the round board's default colourway is graphite", () => {
  equal(keyboardProps.colour.defaultValue, KeyboardColour.GRAPHITE);
});

/**
 * The theme colourway is the one option in the list whose value comes from
 * outside the keyboard settings — it wears `--accent`, which belongs to the
 * account. A signed-out visitor cannot set an accent, so the settings page
 * removes this from the list for them (KeyboardSettings.tsx).
 *
 * Pinned here because the removal is done by identity: rename or re-create
 * the constant and the filter silently stops matching, leaving guests a
 * choice that does nothing again.
 */
test("the theme colourway is a distinct value the settings page can single out", () => {
  isTrue(KeyboardColour.ALL.get("theme") === KeyboardColour.THEME);
  isTrue(KeyboardColour.THEME !== KeyboardColour.GRAPHITE);
  // And it is not the default, so nobody lands on an account-only colourway
  // without asking for it.
  isTrue(keyboardProps.colour.defaultValue !== KeyboardColour.THEME);
});
