import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  EmailVerification,
  SecurityEvent,
  SecurityReset,
  User,
} from "@keylearn/database";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { resetRateLimits } from "./ratelimit.ts";

/**
 * The way back in when a factor is lost.
 *
 * The property that matters most here is not that a reset works — it is
 * that a code can only ever perform the selection it was issued for. A
 * code obtained for "clear the forgotten PIN" must not turn off two-step
 * verification, because that is the change somebody who has stolen a
 * signed-in session actually wants.
 */

const context = new TestContext();

/**
 * The code that was just emailed.
 *
 * Only its hash is stored, so the plaintext is unavailable after issue.
 * These tests re-issue against a known code by writing the hash the model
 * would have written — which keeps the verification path itself
 * (expiry, attempt counting, purpose scoping) exactly as it ships.
 */
async function forceCode(email: string, code: string): Promise<void> {
  const { createHash } = await import("node:crypto");
  const codeHash = createHash("sha256").update(code).digest("hex");
  const row = await EmailVerification.query().findOne({
    email,
    purpose: "security-reset",
  });
  if (row == null) {
    throw new Error(
      "no security-reset code was issued — the request before this failed",
    );
  }
  await row.$query().patch({ codeHash, createdAt: new Date() });
}

async function signedIn() {
  // Every request in this file shares one IP, and asking for a code is
  // limited to five in five minutes — without this the later tests fail
  // on the limiter rather than on anything they are about.
  resetRateLimits();
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);
  return { user, request };
}

test("the options say what this account actually has", async () => {
  const { user, request } = await signedIn();
  await user.setParentPin("1234");

  const response = await request
    .GET("/_/account/security-reset/options")
    .send();

  equal(response.status, 200);
  const body = (await response.body.json()) as any;
  equal(body.parentPin.available, true);
  equal(body.parentPin.set, true);
  // Never turned on, so it is not offered as something to turn off.
  equal(body.twoFactor.available, false);
  equal(body.recoveryCodes.available, false);
  // Masked, so a shoulder-surfer learns nothing they did not already know.
  equal(String(body.email).includes("\u2022"), true);
  equal(String(body.email).includes("user1@"), false);
});

test("a code clears the PIN it was asked for", async () => {
  const { user, request } = await signedIn();
  await user.setParentPin("1234");

  const asked = await request
    .POST("/_/account/security-reset/code")
    .send({ parentPin: true });
  equal(asked.status, 200);

  await forceCode(user.email!, "123456");
  const done = await request
    .POST("/_/account/security-reset")
    .send({ code: "123456" });
  equal(done.status, 200);

  const after = await User.query().findById(user.id!);
  isNull(after!.parentPinHash ?? null);
  // The request is consumed, so the same choice cannot be performed twice.
  isNull(await SecurityReset.pendingFor(user.id!));
});

test("a code cannot be spent on something it was not issued for", async () => {
  // The whole reason the selection is recorded server-side. This asks to
  // clear the PIN, then tries to use that code to disable two-step.
  const { user, request } = await signedIn();
  await user.setParentPin("1234");
  await user.$query().patch({ totpEnabled: true, totpSecret: "secret" });

  await request
    .POST("/_/account/security-reset/code")
    .send({ parentPin: true });
  await forceCode(user.email!, "123456");

  // The client says "two-factor" on the confirm step — and is ignored,
  // because the confirm step does not take a selection at all.
  const done = await request
    .POST("/_/account/security-reset")
    .send({ code: "123456", twoFactor: true });
  equal(done.status, 200);

  const after = await User.query().findById(user.id!);
  isNull(after!.parentPinHash ?? null);
  // Untouched, which is the point.
  isTrue(Boolean(after!.totpEnabled));
});

test("a wrong code changes nothing", async () => {
  const { user, request } = await signedIn();
  await user.setParentPin("1234");

  await request
    .POST("/_/account/security-reset/code")
    .send({ parentPin: true });
  await forceCode(user.email!, "123456");

  const done = await request
    .POST("/_/account/security-reset")
    .send({ code: "000000" });
  equal(done.status, 403);

  const after = await User.query().findById(user.id!);
  isNotNull(after!.parentPinHash ?? null);
});

test("turning two-step off takes the recovery codes with it", async () => {
  const { user, request } = await signedIn();
  await user.$query().patch({ totpEnabled: true, totpSecret: "secret" });
  await user.setRecoveryCodes(["aaaa-bbbb", "cccc-dddd"]);

  await request
    .POST("/_/account/security-reset/code")
    .send({ twoFactor: true });
  await forceCode(user.email!, "123456");
  const done = await request
    .POST("/_/account/security-reset")
    .send({ code: "123456" });
  equal(done.status, 200);

  const after = await User.query().findById(user.id!);
  equal(Boolean(after!.totpEnabled), false);
  isNull(after!.totpSecret ?? null);
  // They exist only to get past the thing that was just removed.
  equal(after!.countRecoveryCodes(), 0);
});

test("voiding recovery codes on their own leaves two-step alone", async () => {
  const { user, request } = await signedIn();
  await user.$query().patch({ totpEnabled: true, totpSecret: "secret" });
  await user.setRecoveryCodes(["aaaa-bbbb", "cccc-dddd"]);

  await request
    .POST("/_/account/security-reset/code")
    .send({ recoveryCodes: true });
  await forceCode(user.email!, "123456");
  await request.POST("/_/account/security-reset").send({ code: "123456" });

  const after = await User.query().findById(user.id!);
  equal(after!.countRecoveryCodes(), 0);
  // Still on: this is "my codes leaked", not "I lost my phone".
  isTrue(Boolean(after!.totpEnabled));
});

test("asking to reset something the account hasn't got is refused", async () => {
  // Nothing is set up, so there is nothing to reset — and an empty
  // request must not send a code that would then do nothing.
  const { user, request } = await signedIn();
  // Stated rather than assumed: the fixture database is not rebuilt
  // between tests in a file, so an earlier test's two-step verification
  // is still on this account unless it is taken off here.
  await user.$query().patch({
    totpEnabled: false,
    totpSecret: null,
    recoveryCodes: null,
  });
  await user.setParentPin(null);

  const asked = await request
    .POST("/_/account/security-reset/code")
    .send({ twoFactor: true, recoveryCodes: true });

  // ApplicationError is this framework's "the request was understood and
  // refused" — a 200 carrying an error body, not a 4xx. Asserting the
  // status alone would pass on a success.
  const body = (await asked.body.json()) as any;
  isNotNull(body.error);
  // And nothing was sent: a code for an empty selection is a code that
  // does nothing, which is worse than no code at all.
  isNull(
    (await EmailVerification.query().findOne({
      email: user.email!,
      purpose: "security-reset",
    })) ?? null,
  );
});

test("everyone else is signed out, and this session is not", async () => {
  const { user, request } = await signedIn();
  await user.setParentPin("1234");
  const before = (await User.query().findById(user.id!))!.sessionEpoch ?? 0;

  await request
    .POST("/_/account/security-reset/code")
    .send({ parentPin: true });
  await forceCode(user.email!, "123456");
  await request.POST("/_/account/security-reset").send({ code: "123456" });

  const after = (await User.query().findById(user.id!))!.sessionEpoch ?? 0;
  equal(after, before + 1);
  // Still ours: the next request on this session is still signed in.
  const still = await request.GET("/_/account/security-reset/options").send();
  equal(still.status, 200);
});

test("the reset is recorded in the security log", async () => {
  const { user, request } = await signedIn();
  await user.setParentPin("1234");

  await request
    .POST("/_/account/security-reset/code")
    .send({ parentPin: true });
  await forceCode(user.email!, "123456");
  await request.POST("/_/account/security-reset").send({ code: "123456" });

  // The newest one: the log is append-only and shared with every other
  // test in this file, so a count would be asserting about them too.
  const latest = await SecurityEvent.query()
    .where("userId", user.id!)
    .andWhere("type", "security-reset")
    .orderBy("id", "desc")
    .first();
  isNotNull(latest);
  // Says what was done, not just that something was.
  equal(String(latest!.detail).includes("PIN"), true);
});

test("signed out, there is nothing to reset", async () => {
  const request = startApp(context.get(Application, kMain));

  const response = await request
    .POST("/_/account/security-reset/code")
    .send({ parentPin: true });

  equal(response.status >= 400, true);
});
