import { test } from "node:test";
import { Application } from "@fastr/core";
import { type CertificateEvidence } from "@keylearn/certificate";
import {
  Certificate,
  CertificateSitting,
  Profile,
  User,
} from "@keylearn/database";
import { equal, isTrue } from "rich-assert";
import { Controller as AuthController } from "../auth/controller.ts";
import { resetRateLimits } from "../auth/ratelimit.ts";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { EvidenceSource } from "./evidence.ts";

/**
 * Certificates are judged on what the server can see for itself — the
 * learner's synced practice, and sittings whose clock it started — and they
 * outlive the account that earned them (owner decisions, 25 Sep 2026).
 */

const context = new TestContext();

/** Practice that clears every condition for an adult, at 40 wpm. */
const READY: CertificateEvidence = {
  kind: "typing",
  audience: "adult",
  age: 30,
  learned: 26,
  total: 26,
  settled: 26,
  volume: 1000,
  daysPractised: 60,
  elapsedDays: 90,
  speed: 40,
  accuracy: 0.97,
};

/**
 * The server's own view of the learner's practice, for these tests: a fixed
 * evidence record, or — when null — the real source reading synced files.
 */
let real: EvidenceSource | null = null;
const practice = {
  evidence: null as CertificateEvidence | null,
  derive(profile: Profile, kind: "typing" | "braille") {
    real ??= context.get(EvidenceSource);
    return practice.evidence == null
      ? real.derive(profile, kind)
      : Promise.resolve({ evidence: practice.evidence, language: "en-us" });
  },
};

async function setUp(evidence: CertificateEvidence | null) {
  resetRateLimits();
  await Certificate.query().delete();
  await CertificateSitting.query().delete();
  real ??= context.get(EvidenceSource);
  practice.evidence = evidence;
  context.bind(EvidenceSource).toValue(practice as unknown as EvidenceSource);
  const user = await findUser("user1@keylearn.org");
  const profile = await Profile.query().insertAndFetch({
    userId: user.id!,
    kind: "adult",
    firstName: "Asha",
    lastName: "Menon",
  });
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);
  return { user, pid: profile.id!, request };
}

const SITTING = {
  kind: "typing",
  language: "en-us",
  speed: 41,
  accuracy: 0.97,
  runs: 3,
  seconds: 180,
};

test("the three-request forgery gets nothing", async () => {
  // No practice synced at all: the server derives the evidence itself.
  const { pid, request } = await setUp(null);

  // 1. A flattering sitting, never started.
  const unstarted = await request
    .POST(`/_/certificate/sitting/${pid}`)
    .send({ ...SITTING, speed: 120, accuracy: 1 });
  equal(unstarted.status, 409);
  equal(
    (await unstarted.body.json<{ reason: string }>()).reason,
    "not-started",
  );

  // 2. Started, then reported in the same second.
  await request.POST(`/_/certificate/sitting/${pid}/start`).send({});
  const instant = await request
    .POST(`/_/certificate/sitting/${pid}`)
    .send({ ...SITTING, speed: 120, accuracy: 1 });
  equal(instant.status, 409);

  // 3. An issue request claiming every threshold met.
  const issued = await request.POST(`/_/certificate/${pid}`).send({
    kind: "typing",
    language: "en-us",
    learned: 26,
    total: 26,
    settled: 26,
    volume: 5000,
    daysPractised: 90,
    elapsedDays: 120,
    speed: 120,
    accuracy: 1,
  });
  equal(issued.status, 409);
  equal((await issued.body.json<{ error: string }>()).error, "not-eligible");
  equal(await CertificateSitting.query().resultSize(), 0);
  equal(await Certificate.query().resultSize(), 0);
});

test("a sitting is held to the time that passed and to the learner's own pace", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const { pid, request } = await setUp(READY);
  const sit = async (seconds: number, body: object) => {
    await request.POST(`/_/certificate/sitting/${pid}/start`).send({});
    t.mock.timers.tick(seconds * 1000);
    const r = await request.POST(`/_/certificate/sitting/${pid}`).send(body);
    return {
      status: r.status,
      reason:
        r.status === 409
          ? (await r.body.json<{ reason: string }>()).reason
          : null,
    };
  };

  equal((await sit(20, SITTING)).reason, "too-fast");
  equal(
    (await sit(185, { ...SITTING, speed: 120 })).reason,
    "faster-than-practice",
  );
  equal(
    (await sit(185, { ...SITTING, seconds: 600 })).reason,
    "more-time-than-passed",
  );
  equal((await sit(185, { ...SITTING, runs: 5 })).reason, "too-many-runs");
  // A start is spent by the sitting that used it.
  const again = await request
    .POST(`/_/certificate/sitting/${pid}`)
    .send(SITTING);
  equal(again.status, 409);

  for (let i = 0; i < 3; i++) {
    equal((await sit(185, SITTING)).status, 204);
  }

  // Issued on the server's figures, whatever the request claims.
  const issued = await request.POST(`/_/certificate/${pid}`).send({
    kind: "typing",
    speed: 400,
    accuracy: 1,
    nameVisible: true,
  });
  equal(issued.status, 200);
  const cert = await issued.body.json<{
    number: string;
    speed: number;
    evidence: string;
  }>();
  equal(cert.speed, 41);
  equal(cert.evidence, "server");
  const row = await Certificate.query().findOne({ profileId: pid });
  equal(row?.evidence, "server");
});

test("a certificate stays verifiable after its account is erased, and nothing else stays", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const { user, pid, request } = await setUp(READY);
  for (let i = 0; i < 3; i++) {
    await request.POST(`/_/certificate/sitting/${pid}/start`).send({});
    t.mock.timers.tick(185_000);
    await request.POST(`/_/certificate/sitting/${pid}`).send(SITTING);
  }
  const issued = await request.POST(`/_/certificate/${pid}`).send({
    kind: "typing",
    nameVisible: true,
  });
  equal(issued.status, 200);
  const { number } = await issued.body.json<{ number: string }>();

  await context.get(AuthController).deleteAccountById(user.id!);

  isTrue((await User.query().findById(user.id!)) == null);
  equal(await Profile.query().where("userId", user.id!).resultSize(), 0);
  equal(
    await CertificateSitting.query().where("profileId", pid).resultSize(),
    0,
  );
  const row = await Certificate.query().findOne({ level: "completion" });
  isTrue(row != null, "the certificate row is kept");
  equal(row!.userId, null, "no link to the account");
  equal(row!.profileId, null, "no link to the learner");

  await request.become(null);
  const checked = await request.GET(`/_/certificate/verify/${number}`).send();
  equal(checked.status, 200);
  const verdict = await checked.body.json<{
    valid: boolean;
    name: string | null;
    speed: number;
    issued: string;
    evidence: string;
  }>();
  equal(verdict.valid, true);
  equal(verdict.name, "Asha Menon");
  equal(verdict.speed, 41);
  equal(verdict.evidence, "server");
  isTrue(Number.isFinite(Date.parse(verdict.issued)));
});

test("an old certificate is verified and labelled self-reported", async () => {
  const { request } = await setUp(null);
  await Certificate.query().insert({
    sequence: 31337,
    profileId: null,
    userId: null,
    kind: "typing",
    audience: "adult",
    language: "en-us",
    level: "completion",
    sheet: "adult",
    speed: 38,
    accuracy: 0.96,
    name: "Old Holder",
    nameVisible: false,
  } as Partial<Certificate>);
  const { certificateNumber } = await import("@keylearn/certificate");
  const { numberingKey } = await import("./key.ts");
  const { DataDir } = await import("@keylearn/config");
  const number = certificateNumber(
    31337,
    numberingKey(context.get(DataDir).dataPath()),
  );
  await request.become(null);
  const checked = await request.GET(`/_/certificate/verify/${number}`).send();
  const verdict = await checked.body.json<{
    valid: boolean;
    evidence: string;
  }>();
  equal(verdict.valid, true);
  equal(verdict.evidence, "self-reported");
});

test("the server's evidence is the page's own reduction of the synced practice", async () => {
  const { pid } = await setUp(null);
  const { ResultFaker } = await import("@keylearn/result");
  const { typingEvidence } = await import("@keylearn/page-account");
  const { UserDataFactory } = await import("@keylearn/result-userdata");
  const faker = new ResultFaker();
  const results = faker.nextResultList(20);
  const profile = (await Profile.query().findById(pid))!;
  await context
    .get(UserDataFactory)
    .loadProfile(profile.userId!, pid)
    .append(results);
  const source = context.get(EvidenceSource) as unknown as {
    derive: EvidenceSource["derive"];
  };
  // The alphabet comes from the published language model; the reduction is
  // what this pins, so it is held empty on both sides.
  real!.alphabet = async () => [];
  const { evidence } = await source.derive(profile, "typing");
  const expected = typingEvidence(
    { kind: "adult", birthYear: null },
    await (async () => {
      const read = [];
      for await (const r of context
        .get(UserDataFactory)
        .loadProfile(profile.userId!, pid)
        .read()) {
        read.push(r);
      }
      return read;
    })(),
    [],
  );
  equal(JSON.stringify(evidence), JSON.stringify(expected));
  equal(evidence.volume, 20);
});
