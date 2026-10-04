import { createHmac } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { Application } from "@fastr/core";
import { resetStaffEmails } from "@keylearn/config";
import {
  generateTotpSecret,
  StaffAuditEvent,
  type User,
} from "@keylearn/database";
import { UserDataFactory } from "@keylearn/result-userdata";
import { equal, isFalse, isNotNull, isNull, isTrue } from "rich-assert";
import { resetRateLimits } from "../auth/ratelimit.ts";
import {
  issuePasskeyChallenge,
  issueStepUpToken,
  readStepUpToken,
  resetStepUp,
  spendPasskeyChallenge,
} from "../auth/step-up.ts";
import { encryptTotpSecret } from "../auth/totp-crypto.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * Step-up: the ops key alone can no longer export, reveal, merge, delete or
 * re-plan. Each of those calls needs a fresh, single-use confirmation by the
 * acting staff member, minted by `staff-auth/step-up`.
 */

const context = new TestContext();
const KEY = "test-ops-key";
const ENV = [
  "OPS_API_KEY",
  "STAFF_EMAILS",
  "STAFF_STEP_UP",
  "KEYLEARN_STEP_UP_SECRET",
  "STAFF_DAILY_CAP_REVEAL_EMAIL",
] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env.OPS_API_KEY = KEY;
  process.env.STAFF_EMAILS = "user1@keylearn.org";
  delete process.env.STAFF_STEP_UP;
  delete process.env.KEYLEARN_STEP_UP_SECRET;
  delete process.env.STAFF_DAILY_CAP_REVEAL_EMAIL;
  resetStaffEmails();
  resetRateLimits();
  resetStepUp();
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] == null) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
  resetStaffEmails();
});

function totp(secret: string, at: number = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "")) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 1_000_000).padStart(6, "0");
}

function dataDir(): string {
  return context.get(UserDataFactory).dataDir.dataPath();
}

async function withTwoFactor(user: User): Promise<string> {
  const secret = generateTotpSecret();
  await user.$query().patch({
    totpSecret: encryptTotpSecret(secret, dataDir()),
    totpEnabled: true,
    totpLastStep: null,
  });
  return secret;
}

function app() {
  return startApp(context.get(Application, kMain));
}

async function stepUp(body: Record<string, unknown>) {
  const response = await app()
    .POST("/_/internal/staff-auth/step-up")
    .header("content-type", "application/json")
    .header("x-ops-api-key", KEY)
    .send(body);
  equal(response.status, 200);
  return await response.body.json<{
    ok: boolean;
    reason?: string;
    token?: string;
    expiresAt?: number;
  }>();
}

async function reveal(id: number, actor: number, token?: string) {
  const call = app()
    .POST(`/_/internal/accounts/${id}/reveal-email`)
    .header("content-type", "application/json")
    .header("x-ops-api-key", KEY);
  if (token != null) {
    call.header("x-staff-step-up", token);
  }
  return await call.send({ reason: "ticket 12", actingStaffUserId: actor });
}

async function auditRows(action: string, min: number): Promise<number> {
  // The routes record their audit rows without awaiting them.
  for (let i = 0; i < 50; i++) {
    const n = await StaffAuditEvent.query()
      .where("action", action)
      .resultSize();
    if (n >= min) {
      return n;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  return await StaffAuditEvent.query().where("action", action).resultSize();
}

test("the ops key alone cannot reveal an email: 428 asking for a step-up", async () => {
  const staff = await findUser("user1@keylearn.org");
  const target = await findUser("user2@keylearn.org");
  const response = await reveal(target.id!, staff.id!);
  equal(response.status, 428);
  const body = await response.body.json<any>();
  equal(body.error.stepUp, true);
  equal(
    body.error.message,
    "This action needs a fresh confirmation (passkey or authenticator code).",
  );
});

test("an authenticator code mints a token that works exactly once", async () => {
  const staff = await findUser("user1@keylearn.org");
  const target = await findUser("user2@keylearn.org");
  const secret = await withTwoFactor(staff);

  const minted = await stepUp({
    email: staff.email,
    action: "account-reveal-email",
    target: String(target.id),
    totp: totp(secret),
  });
  isTrue(minted.ok);
  isNotNull(minted.token);
  isTrue(minted.expiresAt! > Date.now() + 100_000);
  isTrue(minted.expiresAt! <= Date.now() + 120_000);

  const first = await reveal(target.id!, staff.id!, minted.token);
  equal(first.status, 200);
  equal((await first.body.json<any>()).email, target.email);

  // Spent.
  equal((await reveal(target.id!, staff.id!, minted.token)).status, 428);
  isTrue((await auditRows("desk-unlock", 1)) >= 1);
});

test("a token is bound to its action, its target and its staff member", async () => {
  const staff = await findUser("user1@keylearn.org");
  const target = await findUser("user2@keylearn.org");
  const other = await findUser("user3@keylearn.org");
  const mint = (act: any, tgt: string, sub: number) =>
    issueStepUpToken({ sub, em: "x", act, tgt }, dataDir()).token;

  equal(
    (
      await reveal(
        target.id!,
        staff.id!,
        mint("account-export", String(target.id), staff.id!),
      )
    ).status,
    428,
  );
  equal(
    (
      await reveal(
        target.id!,
        staff.id!,
        mint("account-reveal-email", String(other.id), staff.id!),
      )
    ).status,
    428,
  );
  equal(
    (
      await reveal(
        target.id!,
        staff.id!,
        mint("account-reveal-email", String(target.id), other.id!),
      )
    ).status,
    428,
  );
  // And the right one still works — none of the refusals spent anything.
  equal(
    (
      await reveal(
        target.id!,
        staff.id!,
        mint("account-reveal-email", String(target.id), staff.id!),
      )
    ).status,
    200,
  );
});

test("forged and expired tokens do not read", () => {
  const { token } = issueStepUpToken(
    { sub: 1, em: "a@b.c", act: "account-delete", tgt: "5" },
    dataDir(),
  );
  isNotNull(readStepUpToken(token, dataDir()));
  const [part] = token.split(".");
  isNull(readStepUpToken(`${part}.AAAA`, dataDir()));
  const tampered = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(part!, "base64url").toString()),
      tgt: "6",
    }),
  ).toString("base64url");
  isNull(readStepUpToken(`${tampered}.${token.split(".")[1]}`, dataDir()));
  isNull(readStepUpToken(token, dataDir(), Date.now() + 121_000));
  // A different secret (another deployment) does not verify it either.
  process.env.KEYLEARN_STEP_UP_SECRET = "another-secret";
  isNull(readStepUpToken(token, dataDir()));
});

test("step-up refuses a wrong code, a non-staff account and a missing factor", async () => {
  const staff = await findUser("user1@keylearn.org");
  const outsider = await findUser("user2@keylearn.org");
  const secret = await withTwoFactor(staff);
  await withTwoFactor(outsider);
  const good = totp(secret);
  const wrong = good === "000000" ? "111111" : "000000";

  equal(
    (
      await stepUp({
        email: staff.email,
        action: "account-delete",
        target: "7",
        totp: wrong,
      })
    ).reason,
    "invalid",
  );
  equal(
    (
      await stepUp({
        email: outsider.email,
        action: "account-delete",
        target: "7",
        totp: good,
      })
    ).reason,
    "not-staff",
  );
  equal(
    (
      await stepUp({
        email: staff.email,
        action: "account-delete",
        target: "7",
      })
    ).reason,
    "invalid",
  );
  equal(
    (
      await stepUp({
        email: "nobody@example.com",
        action: "account-delete",
        target: "7",
        totp: good,
      })
    ).reason,
    "invalid",
  );
  isTrue((await auditRows("desk-unlock-failed", 4)) >= 4);
});

test("a passkey assertion needs a challenge KeyLearn issued, spent once", async () => {
  const staff = await findUser("user1@keylearn.org");
  await withTwoFactor(staff);
  // A caller-made challenge is refused before any assertion is looked at.
  const result = await stepUp({
    email: staff.email,
    action: "account-export",
    target: "9",
    passkey: { response: { id: "nope" }, challenge: "Y2FsbGVyLW1hZGU" },
  });
  isFalse(result.ok);
  equal(result.reason, "invalid");

  const issued = Buffer.from(issuePasskeyChallenge(dataDir())).toString(
    "base64url",
  );
  isTrue(spendPasskeyChallenge(issued, dataDir()));
  isFalse(spendPasskeyChallenge(issued, dataDir()));
  const stale = Buffer.from(
    issuePasskeyChallenge(dataDir(), Date.now() - 301_000),
  ).toString("base64url");
  isFalse(spendPasskeyChallenge(stale, dataDir()));
  const bytes = Buffer.from(issuePasskeyChallenge(dataDir()));
  bytes[0]! ^= 1;
  isFalse(spendPasskeyChallenge(bytes.toString("base64url"), dataDir()));
});

test("passkey-options hands out challenges step-up will accept", async () => {
  const response = await app()
    .POST("/_/internal/staff-auth/passkey-options")
    .header("x-ops-api-key", KEY)
    .send();
  equal(response.status, 200);
  const { options } = await response.body.json<any>();
  isTrue(spendPasskeyChallenge(options.challenge, dataDir()));
});

test("STAFF_STEP_UP=off lets the call through without a token", async () => {
  process.env.STAFF_STEP_UP = "off";
  const staff = await findUser("user1@keylearn.org");
  const target = await findUser("user2@keylearn.org");
  equal((await reveal(target.id!, staff.id!)).status, 200);
});

test("a staff member's daily cap refuses with 429 and is audited", async () => {
  // Enforcement off so the test is about the cap alone; caps apply either way.
  process.env.STAFF_STEP_UP = "off";
  process.env.STAFF_DAILY_CAP_REVEAL_EMAIL = "2";
  // The test database does not clear the audit table between tests, and the
  // earlier tests' reveals (written without awaiting) count against the cap.
  await new Promise((r) => setTimeout(r, 50));
  await StaffAuditEvent.query().delete();
  const staff = await findUser("user1@keylearn.org");
  const target = await findUser("user2@keylearn.org");
  equal((await reveal(target.id!, staff.id!)).status, 200);
  await auditRows("account-email-revealed", 1);
  equal((await reveal(target.id!, staff.id!)).status, 200);
  await auditRows("account-email-revealed", 2);
  const refused = await reveal(target.id!, staff.id!);
  equal(refused.status, 429);
  isTrue((await refused.body.json<any>()).error.message.includes("limit of 2"));
  // Another staff member is not affected by this one's count.
  const other = await findUser("user3@keylearn.org");
  equal((await reveal(target.id!, other.id!)).status, 200);
  await auditRows("staff-access-denied", 1);
  const denied = await StaffAuditEvent.query()
    .where("action", "staff-access-denied")
    .where("detail", "like", "daily cap for account-reveal-email%");
  equal(denied.length, 1);
});

test("every destructive route asks for a step-up", async () => {
  const staff = await findUser("user1@keylearn.org");
  const target = await findUser("user2@keylearn.org");
  const calls: [string, string, unknown][] = [
    [
      "GET",
      `/_/internal/accounts/${target.id}/export?actingStaffUserId=${staff.id}`,
      undefined,
    ],
    [
      "POST",
      `/_/internal/accounts/${target.id}/reveal-email`,
      { reason: "r", actingStaffUserId: staff.id },
    ],
    [
      "POST",
      `/_/internal/accounts/${target.id}/request-deletion`,
      { reason: "r", actingStaffUserId: staff.id },
    ],
    [
      "POST",
      `/_/internal/accounts/${target.id}/merge`,
      { fromId: staff.id, reason: "r", actingStaffUserId: staff.id },
    ],
    [
      "PUT",
      "/_/internal/organizations/1/plan",
      { kind: "paid", seats: 5, reason: "r", actingStaffUserId: staff.id },
    ],
    [
      "POST",
      "/_/internal/organizations",
      {
        name: "Step-up school",
        type: "school",
        owner: { mode: "existing", userId: target.id },
        reason: "r",
        actingStaffUserId: staff.id,
      },
    ],
  ];
  for (const [method, path, body] of calls) {
    const call = app()
      .method(method, path)
      .header("x-ops-api-key", KEY)
      .header("content-type", "application/json");
    const response = await (body === undefined
      ? call.send()
      : call.send(body as any));
    equal(response.status, 428, `${method} ${path}`);
  }
});
