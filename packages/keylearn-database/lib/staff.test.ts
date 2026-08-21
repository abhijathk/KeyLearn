import { test } from "node:test";
import {
  isAdminEmail,
  isStaffEmail,
  resetStaffEmails,
  setStaffEmails,
} from "@keylearn/config";
import { deepEqual, equal, isFalse, isTrue } from "rich-assert";
import { checkUnlockPasscode,DeskUnlock } from "./desk-unlock.ts";
import { Staff } from "./staff.ts";
import { clearTable, useDatabase } from "./testing.ts";

useDatabase();

// `clearTables()` covers only the four user tables, so these two are cleared
// by name. Without it the roster and the failure counter carry across tests,
// and a lockout raised by one leaks into the next.
test.beforeEach(async () => {
  await clearTable(Staff.tableName);
  await clearTable(DeskUnlock.tableName);
  resetStaffEmails();
  delete process.env["ADMIN_EMAILS"];
  delete process.env["STAFF_EMAILS"];
});

test("adds, removes and reinstates an address", async () => {
  await Staff.add("Sam@Example.com", 7);
  deepEqual([...(await Staff.activeEmails())], ["sam@example.com"]);

  isTrue(await Staff.remove("sam@example.com"));
  deepEqual([...(await Staff.activeEmails())], []);
  // Removed, not deleted — the audit log still refers to them.
  equal((await Staff.listAll()).length, 1);

  // Reinstating must not collide with the unique index on the old row.
  await Staff.add("sam@example.com", 7);
  deepEqual([...(await Staff.activeEmails())], ["sam@example.com"]);
  equal((await Staff.listAll()).length, 1);
});

test("normalises case, so a mixed-case address cannot slip past the roster", async () => {
  await Staff.add("Sam@Example.com", null);
  // The second add finds the first rather than inserting a duplicate.
  await Staff.add("SAM@EXAMPLE.COM", null);
  equal((await Staff.listAll()).length, 1);
  isTrue(await Staff.remove("sam@EXAMPLE.com"));
});

test("removing an address that was never on the list reports it", async () => {
  isFalse(await Staff.remove("nobody@example.com"));
});

test("no row can make anyone an admin", async () => {
  process.env["ADMIN_EMAILS"] = "boss@example.com";
  await Staff.add("sam@example.com", null);
  setStaffEmails(await Staff.activeEmails());

  isTrue(isStaffEmail("sam@example.com"));
  // The whole point of the design: staff is a row, admin is not.
  isFalse(isAdminEmail("sam@example.com"));
  isTrue(isAdminEmail("boss@example.com"));
  // An admin is staff whether or not anybody added them.
  isTrue(isStaffEmail("boss@example.com"));
});

test("the seed copies STAFF_EMAILS in", async () => {
  equal(await Staff.seed(["a@example.com", " B@Example.com ", ""]), 2);
  deepEqual([...(await Staff.activeEmails())].sort(), [
    "a@example.com",
    "b@example.com",
  ]);
});

test("a wrong passcode locks out after five tries, and a right one clears the count", async () => {
  await DeskUnlock.setPasscode("123456");

  for (let i = 1; i <= 4; i++) {
    const result = await checkUnlockPasscode("000000", "10.0.0.1");
    equal(result.ok, false);
    equal(result.ok === false && result.reason, "wrong");
    equal(
      result.ok === false && result.reason === "wrong" && result.remaining,
      5 - i,
    );
  }
  // The fifth stops it answering at all.
  const locked = await checkUnlockPasscode("000000", "10.0.0.1");
  equal(locked.ok === false && locked.reason, "locked");
  // …including for the correct passcode, or the lockout would mean nothing.
  const during = await checkUnlockPasscode("123456", "10.0.0.1");
  equal(during.ok === false && during.reason, "locked");

  // Once it lapses, the right passcode works and resets the counter.
  await DeskUnlock.query().findById(1).patch({ lockedUntil: null });
  isTrue((await checkUnlockPasscode("123456", "10.0.0.1")).ok);
  equal((await DeskUnlock.current()).failedCount, 0);
});

test("the lockout lengthens each time rather than staying at fifteen minutes", async () => {
  equal(DeskUnlock.lockoutMs(0), 15 * 60_000);
  equal(DeskUnlock.lockoutMs(1), 30 * 60_000);
  equal(DeskUnlock.lockoutMs(2), 60 * 60_000);
  // Flat after that — an admin who fat-fingers it must not be shut out for a week.
  equal(DeskUnlock.lockoutMs(9), 60 * 60_000);
});

test("the passcode bootstrap runs once and never overwrites a changed one", async () => {
  isTrue(await DeskUnlock.bootstrap("111111"));
  isTrue((await checkUnlockPasscode("111111", null)).ok);

  // An admin changes it in the app while a stale env var lingers on the server.
  await DeskUnlock.setPasscode("222222");
  isFalse(await DeskUnlock.bootstrap("111111"));
  isTrue((await checkUnlockPasscode("222222", null)).ok);
});

test("an empty ADMIN_UNLOCK_PASSCODE does not create a passcode", async () => {
  isFalse(await DeskUnlock.bootstrap("   "));
  isFalse(await DeskUnlock.hasPasscode());
  const result = await checkUnlockPasscode("123456", null);
  equal(result.ok === false && result.reason, "no-passcode");
});
