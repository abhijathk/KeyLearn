import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { canUnlock, laggardAllowance } from "./unlock.ts";

test("early on, every key still has to be there", () => {
  // A small set is nearly all fundamentals; one weak key among six is a much
  // bigger hole than one among twenty-six, and forgiving it would let somebody
  // accumulate letters they cannot type.
  equal(laggardAllowance(6, 0), 0);
  equal(laggardAllowance(9, 0), 0);
  isFalse(canUnlock({ passed: 5, inPlay: 6, lessonsSinceUnlock: 0 }));
  isTrue(canUnlock({ passed: 6, inPlay: 6, lessonsSinceUnlock: 0 }));
});

test("one stubborn key stops holding the alphabet hostage", () => {
  // The case that sends people to a different app: everything else at speed,
  // practising daily, and nothing new for weeks because of a single key.
  isTrue(canUnlock({ passed: 19, inPlay: 20, lessonsSinceUnlock: 3 }));
  isTrue(canUnlock({ passed: 25, inPlay: 26, lessonsSinceUnlock: 3 }));
});

test("the allowance grows with the pile-up it exists to offset", () => {
  // Requiring every key at once is a conjunction, so the odds of the whole set
  // being green fall as the set grows — the gate got slower the further the
  // learner got, which is exactly backwards.
  equal(laggardAllowance(10, 0), 1);
  equal(laggardAllowance(20, 0), 2);
  equal(laggardAllowance(30, 0), 3);
});

test("it is never a free pass", () => {
  // Merit is the point. Nearly everything still has to be at the target, and
  // the allowance is capped however long anybody waits.
  isFalse(canUnlock({ passed: 15, inPlay: 26, lessonsSinceUnlock: 999 }));
  isFalse(canUnlock({ passed: 22, inPlay: 26, lessonsSinceUnlock: 999 }));
  equal(laggardAllowance(100, 999), 3, "capped, not proportional for ever");
});

test("being genuinely stuck buys one more key of patience", () => {
  // Somebody putting in real, consistent work whose one bad key would take
  // months. Twenty lessons is plainly a wall rather than a bad evening.
  // Twenty keys already forgive two, so it takes a third laggard to show the
  // valve doing anything.
  isFalse(canUnlock({ passed: 17, inPlay: 20, lessonsSinceUnlock: 5 }));
  isTrue(canUnlock({ passed: 17, inPlay: 20, lessonsSinceUnlock: 25 }));
});

test("the patience valve does not stack for ever", () => {
  equal(laggardAllowance(20, 20), 3);
  equal(laggardAllowance(20, 500), 3, "waiting longer does not keep buying");
});

test("a full set unlocks whatever the history", () => {
  isTrue(canUnlock({ passed: 26, inPlay: 26, lessonsSinceUnlock: 0 }));
});
