import { test } from "node:test";
import { equal } from "rich-assert";
import { hashPassword, verifyPassword } from "./password.ts";

test("hash and verify a password", async () => {
  const hash = await hashPassword("correct horse battery");
  equal(hash.startsWith("scrypt$"), true);
  equal(await verifyPassword("correct horse battery", hash), true);
  equal(await verifyPassword("wrong password", hash), false);
});

test("two hashes of the same password differ (random salt)", async () => {
  const a = await hashPassword("same");
  const b = await hashPassword("same");
  equal(a === b, false);
  equal(await verifyPassword("same", a), true);
  equal(await verifyPassword("same", b), true);
});

test("verify rejects malformed and empty stored hashes", async () => {
  equal(await verifyPassword("x", null), false);
  equal(await verifyPassword("x", ""), false);
  equal(await verifyPassword("x", "garbage"), false);
  equal(await verifyPassword("x", "scrypt$deadbeef$cafe"), false);
});
