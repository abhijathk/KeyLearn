import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { EmailVerification } from "./model.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

const email = "user@keylearn.com";

test("a code only authorises the purpose it was issued for", async () => {
  // The user is asked to confirm their address...
  const code = await EmailVerification.issue(email, "verify-email");

  // ...and that code must not double as authorisation to delete the account,
  // change the address, or prove identity.
  isFalse(await EmailVerification.verify(email, "delete-account", code));
  isFalse(await EmailVerification.verify(email, "change-email", code));
  isFalse(await EmailVerification.verify(email, "identity", code));

  // It still works for what it was meant for.
  isTrue(await EmailVerification.verify(email, "verify-email", code));
});

test("codes for different purposes coexist", async () => {
  const verify = await EmailVerification.issue(email, "verify-email");
  const del = await EmailVerification.issue(email, "delete-account");

  // Issuing the second must not have clobbered the first.
  isTrue(await EmailVerification.verify(email, "verify-email", verify));
  isTrue(await EmailVerification.verify(email, "delete-account", del));
});

test("a consumed code cannot be replayed", async () => {
  const code = await EmailVerification.issue(email, "verify-email");
  isTrue(await EmailVerification.verify(email, "verify-email", code));
  isFalse(await EmailVerification.verify(email, "verify-email", code));
});

test("reissuing does not refill the guess budget", async () => {
  await EmailVerification.issue(email, "verify-email");

  // Burn the whole budget on wrong guesses.
  for (let i = 0; i < EmailVerification.maxAttempts; i++) {
    isFalse(await EmailVerification.verify(email, "verify-email", "000000"));
  }

  // Ask for a fresh code. If this reset the counter, an attacker could alternate
  // resend-and-guess and walk the whole 10^6 space.
  const fresh = await EmailVerification.issue(email, "verify-email");

  // Even the CORRECT code is refused while the failure window is open.
  isFalse(await EmailVerification.verify(email, "verify-email", fresh));

  const rec = await EmailVerification.query().findOne({
    email,
    purpose: "verify-email",
  });
  equal(rec!.attempts, EmailVerification.maxAttempts);
});

test("an expired code is refused", async () => {
  const code = await EmailVerification.issue(email, "verify-email");
  const rec = await EmailVerification.query().findOne({
    email,
    purpose: "verify-email",
  });
  await rec!.$query().patch({
    createdAt: new Date(Date.now() - EmailVerification.expireTime - 1000),
  });
  isFalse(await EmailVerification.verify(email, "verify-email", code));
});

test("the failure window rolls over", async () => {
  await EmailVerification.issue(email, "verify-email");
  for (let i = 0; i < EmailVerification.maxAttempts; i++) {
    isFalse(await EmailVerification.verify(email, "verify-email", "000000"));
  }

  // Age the failure window out.
  const rec = await EmailVerification.query().findOne({
    email,
    purpose: "verify-email",
  });
  await rec!.$query().patch({
    attemptsAt: new Date(Date.now() - EmailVerification.attemptWindow - 1000),
  });

  const fresh = await EmailVerification.issue(email, "verify-email");
  isTrue(await EmailVerification.verify(email, "verify-email", fresh));
});
