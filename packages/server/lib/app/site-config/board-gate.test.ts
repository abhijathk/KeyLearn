import { test } from "node:test";
import { setSiteConfigValues } from "@keylearn/site-config";
import { isFalse, isTrue } from "rich-assert";
import { boardChoiceNeedsAccount } from "./readers.ts";

/**
 * Who may change the keyboard's finish.
 *
 * The gate is deliberately narrow, and the narrowness is the part worth
 * protecting: it covers the board's LOOK and nothing else. Layout, geometry,
 * language and zones stay open to everybody on either setting, because a
 * visitor typing on Dvorak or a non-Latin keyboard needs them to use the app
 * at all — take those away and the product reads as broken rather than as
 * locked, and the visitor leaves instead of signing up.
 *
 * Two halves decide the lock, and only one of them lives here: this reader
 * answers "does the site keep finishes for account holders", and the page
 * controller ands it with "is anybody signed in". Kept apart so the switch
 * can be tested without a session, and so the policy is computed once on the
 * server rather than reassembled on each screen.
 */

test("the shipped setting keeps the finish for account holders", () => {
  setSiteConfigValues(new Map());
  isTrue(boardChoiceNeedsAccount());
});

test("an admin can open it to everybody without a deploy", () => {
  setSiteConfigValues(new Map([["accounts.keyboardFinishes", "everyone"]]));
  isFalse(boardChoiceNeedsAccount());
  // And back again — the whole point of a switch over a constant is that the
  // decision can be reversed after watching what it does to signups.
  setSiteConfigValues(new Map([["accounts.keyboardFinishes", "account"]]));
  isTrue(boardChoiceNeedsAccount());
});

test("an unreadable value locks rather than opens", () => {
  // Fail closed on nonsense: a typo in the control centre should not quietly
  // hand out an account-only perk, and "account" is the shipped answer.
  setSiteConfigValues(new Map([["accounts.keyboardFinishes", "nonsense"]]));
  isTrue(boardChoiceNeedsAccount());
  setSiteConfigValues(new Map());
});
