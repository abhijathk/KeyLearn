import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { flag, millis } from "./timestamp.ts";

const UTC = Date.UTC(2026, 7, 7, 2, 0, 9);

test("a Date comes back as itself", () => {
  equal(millis(new Date(UTC)), UTC);
});

test("SQLite's own format is read as UTC, not as local time", () => {
  // This is the one that mattered: issuing threw outright on `getTime is not
  // a function`, on the only database the dev environment uses. Reading it as
  // local time instead would be quieter and worse — every sitting would drift
  // by the machine's offset, which changes the order of the last three.
  equal(millis("2026-08-07 02:00:09"), UTC);
});

test("an ISO string is read as ISO", () => {
  equal(millis("2026-08-07T02:00:09.000Z"), UTC);
  equal(millis("2026-08-07T02:00:09Z"), UTC);
});

test("epoch milliseconds pass straight through", () => {
  equal(millis(UTC), UTC);
});

test("an unreadable timestamp sorts oldest rather than newest", () => {
  // A row that cannot be dated must not be able to masquerade as the most
  // recent sitting and displace a real one from the window.
  equal(millis(undefined), 0);
  equal(millis("not a date"), 0);
});

test("a stored flag is read as a boolean on either database", () => {
  // SQLite has no boolean type and returns the integer. A strict `=== true`
  // reported the name-visibility switch as off for a row that was plainly on,
  // which looked exactly like a setting that would not save.
  isTrue(flag(true));
  isTrue(flag(1));
  isTrue(flag("1"));
  isFalse(flag(false));
  isFalse(flag(0));
  isFalse(flag(null));
  isFalse(flag(undefined));
});
