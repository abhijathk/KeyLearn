import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import {
  markSignedOutJustNow,
  markTourSeenOnThisMachine,
  takeSignedOutJustNow,
  tourSeenOnThisMachine,
} from "./first-run.ts";

/**
 * The tour once per browser, and nothing floating on the page sign-out lands
 * on (owner, 5 Oct 2026).
 */

test("the tour, once seen in this browser, stays seen", () => {
  localStorage.removeItem("keylearn.tourSeen");
  isFalse(tourSeenOnThisMachine());
  markTourSeenOnThisMachine();
  isTrue(tourSeenOnThisMachine());
  // Survives the account changing: it is not in the settings store.
  equal(localStorage.getItem("keylearn.tourSeen"), "1");
});

test("the sign-out marker covers exactly one page load", () => {
  sessionStorage.removeItem("keylearn.signedOutJustNow");
  isFalse(takeSignedOutJustNow());
  markSignedOutJustNow();
  // The load sign-out lands on sees it...
  isTrue(takeSignedOutJustNow());
  // ...and the next refresh is an ordinary load again.
  isFalse(takeSignedOutJustNow());
});
