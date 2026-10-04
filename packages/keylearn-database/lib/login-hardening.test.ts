import { createHmac } from "node:crypto";
import { test } from "node:test";
import { equal, isFalse, isNull, isTrue } from "rich-assert";
import { AuthThrottle } from "./auth-throttle.ts";
import { Credential, User, UserExternalId } from "./model.ts";
import {
  hashPassword,
  hashSlotStats,
  MAX_CONCURRENT_HASHES,
  MAX_QUEUED_HASHES,
  PasswordHashBusyError,
} from "./password.ts";
import { useDatabase } from "./testing.ts";
import { generateTotpSecret } from "./totp.ts";

useDatabase();

/** RFC 6238 computed independently of totp.ts, so the test checks it. */
function totpAt(secret: string, at: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return String(
    (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
  ).padStart(6, "0");
}

async function plantUnverifiedAccount(): Promise<User> {
  // The attacker registers the victim's address with their own password and
  // never verifies it — they cannot, the inbox is not theirs.
  const user = await User.registerWithPassword(
    "victim@keylearn.org",
    "attacker's password 1",
    "Mallory",
    "Mallory",
    "1990-01-01",
  );
  await Credential.query().insert({
    userId: user.id!,
    credentialId: "attacker-key",
    publicKey: "AAAA",
    counter: 0,
    name: "Attacker",
  });
  await UserExternalId.query().insert({
    userId: user.id!,
    provider: "facebook",
    externalId: "attacker-fb",
  } as UserExternalId);
  return user;
}

test("EXPLOIT: a verified provider sign-in drops what an unverified squatter set up", async () => {
  const planted = await plantUnverifiedAccount();
  const epochBefore = planted.sessionEpoch ?? 0;

  // Months later the real owner signs in with Google, which vouches for it.
  const result = await User.ensure({
    raw: {},
    provider: "google",
    id: "owner-google",
    email: "victim@keylearn.org",
    emailVerified: true,
    name: "Victim",
    url: null,
    imageUrl: null,
  });
  equal(result.kind, "ok");

  const after = (await User.findById(planted.id!))!;
  isTrue(Boolean(after.emailVerified));
  isNull(after.passwordHash ?? null);
  isTrue((after.sessionEpoch ?? 0) > epochBefore);
  equal((await Credential.listForUser(planted.id!)).length, 0);
  equal(after.externalIds!.map((x) => x.provider).join(","), "google");
  // And the attacker's password no longer opens it.
  isNull(
    await User.loginWithPassword(
      "victim@keylearn.org",
      "attacker's password 1",
    ),
  );
});

test("EXPLOIT: a magic link to an unverified account drops the squatter's password", async () => {
  const planted = await plantUnverifiedAccount();
  const user = await User.login("victim@keylearn.org");
  equal(user.id, planted.id);
  isTrue(Boolean(user.emailVerified));
  isNull(user.passwordHash ?? null);
  equal((await Credential.listForUser(planted.id!)).length, 0);
  equal(user.externalIds!.length, 0);
});

test("a verified account keeps its credentials on a new provider link", async () => {
  const user = await User.registerWithPassword(
    "owner@keylearn.org",
    "owner's password 1",
    "Owner",
    "Owner",
    "1990-01-01",
  );
  await user.$query().patch({ emailVerified: true });
  await User.ensure({
    raw: {},
    provider: "google",
    id: "owner-google-2",
    email: "owner@keylearn.org",
    emailVerified: true,
    name: "Owner",
    url: null,
    imageUrl: null,
  });
  isTrue((await User.findById(user.id!))!.passwordHash != null);
});

test("addresses are stored and found in one spelling", async () => {
  await User.registerWithPassword(
    "  Mixed.Case@KeyLearn.org ",
    "a fine password 1",
    "Mixed",
    "Case",
    "1990-01-01",
  );
  equal(
    (await User.findByEmail("mixed.case@keylearn.org"))?.email,
    "mixed.case@keylearn.org",
  );
  equal(
    (await User.findByEmail("MIXED.CASE@keylearn.org"))?.email,
    "mixed.case@keylearn.org",
  );
});

test("an authenticator code is accepted once, and never an older one", async () => {
  const user = (await User.findByEmail("user1@keylearn.org"))!;
  const secret = generateTotpSecret();
  const now = Date.now();
  const code: string | null = totpAt(secret, now);
  isTrue(code != null);
  isTrue(await user.acceptTotp(secret, code!, now));
  // The same code again — a replay.
  isFalse(await user.acceptTotp(secret, code!, now));
  // Still refused a step later, when it would otherwise still be in window.
  isFalse(await user.acceptTotp(secret, code!, now + 30_000));
});

test("ten wrong PINs lock the account's PIN, the right one included", async () => {
  const user = (await User.findByEmail("user2@keylearn.org"))!;
  await user.setParentPin("8317");
  for (let i = 0; i < 10; i++) {
    isFalse(await user.verifyParentPin(String(1000 + i)));
  }
  isFalse(await user.verifyParentPin("8317"));
  isTrue(
    (await AuthThrottle.lockedFor("pin", AuthThrottle.forUser(user.id!))) > 0,
  );
});

test("the lock escalates: the second lock is twice the first", async () => {
  const subject = AuthThrottle.forEmail("someone@keylearn.org");
  const t0 = 1_000_000_000_000;
  let lock = 0;
  for (let i = 0; i < 10; i++) {
    lock = await AuthThrottle.recordFailure("password", subject, undefined, t0);
  }
  equal(lock, 15 * 60_000);
  const t1 = t0 + lock + 1;
  for (let i = 0; i < 10; i++) {
    lock = await AuthThrottle.recordFailure("password", subject, undefined, t1);
  }
  equal(lock, 30 * 60_000);
});

test("password hashing refuses to queue without bound", async () => {
  const total = MAX_CONCURRENT_HASHES + MAX_QUEUED_HASHES + 4;
  const results = await Promise.allSettled(
    Array.from({ length: total }, () => hashPassword("x")),
  );
  const refused = results.filter(
    (r) => r.status === "rejected" && r.reason instanceof PasswordHashBusyError,
  ).length;
  equal(refused, 4);
  equal(hashSlotStats().running, 0);
  equal(hashSlotStats().waiting, 0);
});

test("a recovery code works once, then not again", async () => {
  const user = (await User.findByEmail("user3@keylearn.org"))!;
  await user.setRecoveryCodes(["ABCDE-FGHJK", "MNPQR-STVWX"]);
  isTrue(await user.useRecoveryCode("ABCDE-FGHJK"));
  // Spent: the same code is refused.
  isFalse(await user.useRecoveryCode("ABCDE-FGHJK"));
  // The other one still works.
  isTrue(await user.useRecoveryCode("MNPQR-STVWX"));
});

test("wrong recovery codes lock the account, on the same bucket as the authenticator", async () => {
  const user = (await User.findByEmail("user1@keylearn.org"))!;
  await user.setRecoveryCodes(["ABCDE-FGHJK"]);
  const subject = AuthThrottle.forUser(user.id!);
  await AuthThrottle.clear("totp", subject);
  // Ten wrong recovery codes (not six digits, so counted here).
  for (let i = 0; i < 10; i++) {
    isFalse(await user.useRecoveryCode(`ZZZZZ-${String(10000 + i)}`));
  }
  isTrue((await AuthThrottle.lockedFor("totp", subject)) > 0);
  // Locked: even the right recovery code is refused while the lock holds.
  isFalse(await user.useRecoveryCode("ABCDE-FGHJK"));
  await AuthThrottle.clear("totp", subject);
});

test("a six-digit miss is not charged twice across the two 2FA forms", async () => {
  const user = (await User.findByEmail("user2@keylearn.org"))!;
  await user.setRecoveryCodes(["ABCDE-FGHJK"]);
  const subject = AuthThrottle.forUser(user.id!);
  await AuthThrottle.clear("totp", subject);
  // A six-digit code is the authenticator's to count; useRecoveryCode must
  // not add a second failure for the same wrong entry.
  isFalse(await user.useRecoveryCode("000000"));
  isFalse((await AuthThrottle.lockedFor("totp", subject)) > 0);
  await AuthThrottle.clear("totp", subject);
});
