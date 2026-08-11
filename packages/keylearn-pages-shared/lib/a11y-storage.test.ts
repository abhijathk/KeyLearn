import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import {
  a11yAdapted,
  defaultA11y,
  hasA11y,
  loadA11y,
  saveA11y,
} from "./a11y-storage.ts";

test("a learner who has asked for nothing gets the app as it ships", () => {
  localStorage.clear();
  const prefs = loadA11y("19");
  equal(prefs.motion, "system");
  equal(prefs.typeface, "default");
  equal(prefs.targets, "default");
  isFalse(prefs.cues);
  // The one that defaults on: hiding the clock is the adaptation, showing it
  // is the app.
  isTrue(prefs.timers);
  isFalse(hasA11y("19"));
  isFalse(a11yAdapted("19"));
});

test("settings belong to one learner, not to the household", () => {
  localStorage.clear();
  saveA11y({ targets: "large" }, "19");
  equal(loadA11y("19").targets, "large");
  equal(loadA11y("8").targets, "default");
  isTrue(a11yAdapted("19"));
  isFalse(a11yAdapted("8"));
});

test("a patch changes one setting and leaves the rest alone", () => {
  localStorage.clear();
  saveA11y({ typeface: "dyslexic", cues: true }, "19");
  saveA11y({ motion: "reduce" }, "19");
  const prefs = loadA11y("19");
  equal(prefs.typeface, "dyslexic");
  isTrue(prefs.cues);
  equal(prefs.motion, "reduce");
});

test("having answered is not the same as having answered the default", () => {
  // Anything carrying an older setting across depends on telling these apart:
  // overwriting a deliberate default would undo a choice somebody made.
  localStorage.clear();
  isFalse(hasA11y("19"));
  saveA11y({ speechRate: 1 }, "19");
  isTrue(hasA11y("19"));
  isFalse(a11yAdapted("19"));
});

test("a reading speed is held to what a voice can actually do", () => {
  localStorage.clear();
  saveA11y({ speechRate: 99 }, "19");
  equal(loadA11y("19").speechRate, 3);
  saveA11y({ speechRate: 0 }, "19");
  equal(loadA11y("19").speechRate, 0.5);
});

test("nonsense in storage reads as the defaults rather than throwing", () => {
  localStorage.clear();
  localStorage.setItem("profile-19.keylearn.a11y", "{ not json");
  equal(loadA11y("19").motion, defaultA11y.motion);
});
