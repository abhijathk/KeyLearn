import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  Certificate,
  CertificateSitting,
  SecurityEvent,
  SiteConfig,
  SiteConfigHistory,
  StaffAuditEvent,
} from "@keylearn/database";
import { setSiteConfigValues } from "@keylearn/site-config";
import {
  deepEqual,
  equal,
  includes,
  isNotNull,
  isNull,
  isTrue,
} from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { criteriaVersion } from "./criteria-version.ts";
import { impactCounts } from "./impact.ts";
import {
  certificateCriteria,
  learnerDefaultRows,
  learnerDefaults,
  minPasswordLength,
  parentPinWindowMs,
  profileCaps,
} from "./readers.ts";
import { SiteConfigRefused, SiteConfigService } from "./service.ts";

/**
 * Phase 2's KeyLearn side:
 *  2.1 caps, minimum age (raise-only), password length, PIN window, retention;
 *  2.2 certificates gated and versioned, kids certificates, speech, schools;
 *  2.3 sweeps and email read the registry with env precedence;
 *  2.4 learner defaults generated from the registry;
 *  2.5 impact counts for the confirmation.
 */

const context = new TestContext();
const OPS_KEY = "Nq8s4Xb2m0PfTz1Lc7RkYw3Ve6Hd9Jg5";
const ENV_KEYS = [
  "HOLDING_QUEUE_DAYS",
  "DIGEST_HOUR",
  "REMINDER_AFTER_DAYS",
  "PADDLE_API_KEY",
  "PADDLE_SECRET_KEY",
];

async function fresh() {
  await SiteConfig.query().delete();
  await SiteConfigHistory.query().delete();
  await StaffAuditEvent.query().delete();
  await Certificate.query().delete();
  await CertificateSitting.query().delete();
  setSiteConfigValues(new Map());
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  process.env.OPS_API_KEY = OPS_KEY;
  process.env.ADMIN_EMAILS = "user1@keylearn.org";
  context.mailer.dump();
  const admin = (await findUser("user1@keylearn.org"))!.id!;
  const service = context.get(SiteConfigService);
  const request = startApp(context.get(Application, kMain));
  const rawGet = request.GET.bind(request);
  (request as any).GET = (path: string) =>
    rawGet(path)
      .header("X-Forwarded-Host", "www.keylearn.org")
      .header("X-Forwarded-Proto", "https");
  return { admin, service, request };
}

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    if (err instanceof SiteConfigRefused) {
      return String(err.body.error["code"]);
    }
    throw err;
  }
  return "ok";
}

test("2.1 limits: caps and the one-way rules reach the readers; the password floor is live", async () => {
  const { admin, service, request } = await fresh();
  deepEqual(profileCaps(), { free: 4, premium: 8 });
  await service.set("profiles.placesFree", 2, { userId: admin });
  deepEqual(profileCaps(), { free: 2, premium: 8 });
  equal(
    await refusal(() =>
      service.set("profiles.placesPremium", 6, { userId: admin }),
    ),
    "direction",
    "premium is raise-only",
  );
  equal(
    await refusal(() => service.set("accounts.minAge", 12, { userId: admin })),
    "bounds",
  );
  await service.set("accounts.minAge", 16, { userId: admin });
  equal(
    await refusal(() => service.set("accounts.minAge", 14, { userId: admin })),
    "direction",
    "min age is raise-only",
  );

  await service.set("security.minPasswordLength", 12, { userId: admin });
  equal(minPasswordLength(), 12);
  const short = await request.POST("/auth/register-password").send({
    email: "short.pass@example.com",
    password: "only-nine!",
    firstName: "Short",
    lastName: "Pass",
    dateOfBirth: "1990-01-01",
  });
  // Application errors travel as an error body (the client reads it), not a status.
  includes(
    await short.body.text(),
    "at least 12 characters",
    "a password under the raised minimum is refused live",
  );
  isNull(
    await (
      await import("@keylearn/database")
    ).User.findByEmail("short.pass@example.com"),
  );
  const young = await request.POST("/auth/register-password").send({
    email: "young.person@example.com",
    password: "a-long-enough-password-12",
    firstName: "Young",
    lastName: "Person",
    dateOfBirth: new Date(Date.now() - 15 * 365.25 * 86_400_000)
      .toISOString()
      .slice(0, 10),
  });
  equal(young.status, 403, "a 15-year-old is refused once the minimum is 16");

  equal(
    await refusal(() =>
      service.set("security.parentPinWindowMin", 20, { userId: admin }),
    ),
    "bounds",
  );
  await service.set("security.parentPinWindowMin", 5, { userId: admin });
  equal(parentPinWindowMs(), 5 * 60 * 1000);
  equal(
    await refusal(() =>
      service.set("security.parentPinWindowMin", 10, { userId: admin }),
    ),
    "direction",
    "tighten-only",
  );

  await service.set("retention.securityEventDays", 7, { userId: admin });
  equal(
    SecurityEvent.retentionMs,
    7 * 24 * 3600 * 1000,
    "the database package reads the registry too",
  );
  equal(
    await refusal(() =>
      service.set("retention.securityEventDays", 14, { userId: admin }),
    ),
    "direction",
  );
});

test("2.2 certificates: gates, attempts per day, and a version the certificate keeps", async () => {
  const { admin, service, request } = await fresh();
  equal(await criteriaVersion(), 1, "shipped criteria are version 1");
  await service.set("certificates.adultTyping.wpm", 40, { userId: admin });
  equal(await criteriaVersion(), 2, "each criteria change bumps the version");
  equal(certificateCriteria().adultTyping.speed, 40);

  await request.become("user1@keylearn.org");
  const mine = await request.GET("/_/certificate/mine").send();
  equal(mine.status, 200);
  const profiles = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  const pid = Number(
    /"profiles":\[\{"id":"?(\d+)/.exec(profiles)?.[1] ??
      /"id":(\d+),"kind":"adult"/.exec(profiles)?.[1],
  );
  isTrue(
    Number.isFinite(pid),
    "the seeded adult profile id is in the page data",
  );

  const sitting = {
    kind: "typing",
    language: "en",
    speed: 45,
    accuracy: 0.97,
    runs: 3,
    seconds: 180,
  };
  equal(
    (await request.POST(`/_/certificate/sitting/${pid}`).send(sitting)).status,
    204,
  );
  const rows = await CertificateSitting.query();
  equal(rows[0].criteriaVersion, 2, "a sitting records the criteria version");

  await service.set("certificates.attemptsPerDay", 3, { userId: admin });
  equal(
    (await request.POST(`/_/certificate/sitting/${pid}`).send(sitting)).status,
    204,
  );
  equal(
    (await request.POST(`/_/certificate/sitting/${pid}`).send(sitting)).status,
    204,
  );
  equal(
    (await request.POST(`/_/certificate/sitting/${pid}`).send(sitting)).status,
    429,
    "the daily limit holds",
  );
  await service.set("certificates.attemptsPerDay", 0, { userId: admin });

  await service.set("certificates.issue", false, { userId: admin });
  equal(
    (await request.POST(`/_/certificate/sitting/${pid}`).send(sitting)).status,
    403,
    "certificates off",
  );
  await service.set("certificates.issue", true, { userId: admin });

  await service.set("certificates.publicVerify", false, { userId: admin });
  equal(
    (await request.GET("/_/certificate/verify/ABC123").send()).status,
    404,
    "the check API is gone",
  );
  equal(
    (await request.GET("/verify").header("accept", "text/html").send()).status,
    200,
    "an admin still previews the page",
  );
  await request.become(null);
  equal(
    (await request.GET("/verify").header("accept", "text/html").send()).status,
    404,
    "the public gets 404",
  );
  await service.set("certificates.publicVerify", true, { userId: admin });
  equal(
    (await request.GET("/verify").header("accept", "text/html").send()).status,
    200,
  );

  const page = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  includes(
    page,
    '"certificates":{"version":',
    "the client gets the criteria and version",
  );
  includes(page, '"speed":40');
});

test("2.2 features: speech, schools and premium follow their switches", async () => {
  const { admin, service, request } = await fresh();
  await service.set("braille.serverSpeech", false, { userId: admin });
  equal(
    (await request.GET("/_/speech.wav?text=hello&lang=en").send()).status,
    404,
  );
  await service.set("braille.serverSpeech", true, { userId: admin });

  await request.become("user1@keylearn.org");
  await service.set("schools.acceptInvites", false, { userId: admin });
  const invite = await request
    .POST("/_/org/invites/accept")
    .send({ token: "no-such-token-1234567890abcd" });
  equal(
    invite.status,
    403,
    "invites off is refused before the token is even looked at",
  );
  await service.set("schools.acceptInvites", true, { userId: admin });
  await request.become(null);

  equal(
    await refusal(() => service.set("premium.sell", true, { userId: admin })),
    "env",
    "no Paddle keys, no premium",
  );
  process.env.PADDLE_API_KEY = "test-paddle-key";
  process.env.PADDLE_SECRET_KEY = "test-paddle-secret";
  await service.set("premium.sell", true, { userId: admin });
  const page = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  includes(page, '"premiumSell":true');
});

test("2.3 operations and email switches read the registry with env precedence", async () => {
  const { admin, service } = await fresh();
  const { holdingDays, digestHour } = await import("../support/sweep.ts");
  const { quietDays } = await import("../mail/sweep.ts");
  equal(holdingDays(), 7);
  await service.set("retention.holdingQueueDays", 3, { userId: admin });
  equal(holdingDays(), 3);
  process.env.HOLDING_QUEUE_DAYS = "14";
  equal(holdingDays(), 14, "env wins");
  equal(
    await refusal(() =>
      service.set("retention.holdingQueueDays", 7, { userId: admin }),
    ),
    "env",
  );
  delete process.env.HOLDING_QUEUE_DAYS;

  equal(digestHour(), 8);
  await service.set("ops.digestHour", 6, { userId: admin });
  equal(digestHour(), 6);
  equal(quietDays(), 3);
  await service.set("ops.reminderAfterDays", 5, { userId: admin });
  equal(quietDays(), 5);

  const { ReminderSweep } = await import("../mail/sweep.ts");
  await service.set("email.practiceReminders", false, { userId: admin });
  equal(
    await context.get(ReminderSweep).runOnce(),
    0,
    "the site-wide gate sends nothing",
  );
});

test("2.4 learner defaults are generated from the registry", async () => {
  const { admin, service } = await fresh();
  equal(learnerDefaults()["lesson.targetSpeed"], 175);
  await service.set("practice.defaultTargetSpeedCpm", 200, { userId: admin });
  equal(learnerDefaults()["lesson.targetSpeed"], 200);
  const rows = learnerDefaultRows();
  isTrue(rows.length >= 10);
  const speed = rows.find(
    (row) => row.key === "practice.defaultTargetSpeedCpm",
  );
  isNotNull(speed);
  equal(speed!.value, 200);
  isNull(
    rows.find((row) => row.key === "certificates.bands") ?? null,
    "table rows are not learner defaults",
  );
});

test("2.5 impact counts are honest numbers", async () => {
  const { admin, service } = await fresh();
  const before = await impactCounts();
  isTrue(before.verifiedAccounts >= 0 && before.kidProfiles >= 0);
  equal(
    before.householdsAtFreeCap,
    0,
    "nobody sits at four profiles in the seed",
  );
  await service.set("profiles.placesFree", 1, { userId: admin });
  const after = await impactCounts();
  isTrue(
    after.householdsAtFreeCap >= before.householdsAtFreeCap,
    "a lower cap can only put more households at it",
  );
});
