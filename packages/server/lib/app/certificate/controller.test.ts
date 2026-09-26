import { test } from "node:test";
import { Application } from "@fastr/core";
import {
  type CertificateEvidence,
  measure,
  type SittingLog,
} from "@keylearn/certificate";
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

/** The text the fake source serves every sitting. */
const SERVED =
  "stone river maple quiet lantern orbit velvet harbor candle meadow " +
  "pebble thunder willow crimson falcon garden silver morning shadow ember " +
  "copper island winter harvest beacon cedar glacier summit";

/**
 * The server's own view of the learner's practice, for these tests: a fixed
 * evidence record and served text, or — when null — the real source reading
 * synced files.
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
  serve(profile: Profile, kind: "typing" | "braille") {
    real ??= context.get(EvidenceSource);
    return practice.evidence == null
      ? real.serve(profile, kind)
      : Promise.resolve(SERVED);
  },
  unitsOf() {
    return (text: string) => [...text].length;
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

/** A person's rhythm: about 300 ms a key, varying — roughly 40 wpm. */
function rhythm(n: number, seed: number, scale = 1): [number, number][] {
  let x = seed;
  const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const steps: [number, number][] = [];
  let t = 10_000;
  for (let i = 0; i < n; i++) {
    steps.push([Math.round(t * scale), rnd() < 0.03 ? 1 : 0]);
    t += 180 + Math.round(rnd() * 240);
  }
  return steps;
}

/** Three runs typed on the served text, each a stretch of five words. */
function typed(seed: number, scale = 1): SittingLog {
  const words = SERVED.split(" ");
  return {
    runs: [0, 1, 2].map((r) => {
      const text = words.slice(r * 5, r * 5 + 5).join(" ");
      return [{ text, steps: rhythm([...text].length, seed + r, scale) }];
    }),
  };
}

/** What an honest page posts for a log: its own figures, and the log. */
function sittingOf(log: SittingLog, override: object = {}) {
  const figures = measure(log, {
    kind: "typing",
    served: SERVED,
    unitsOf: (t) => [...t].length,
    plan: { runs: 3, seconds: 60 },
    elapsedMs: Number.MAX_SAFE_INTEGER,
  });
  return {
    kind: "typing",
    language: "en-us",
    speed: figures.ok ? figures.speed : 0,
    accuracy: figures.ok ? figures.accuracy : 0,
    runs: 3,
    seconds: 180,
    log,
    ...override,
  };
}

const SITTING = sittingOf(typed(1));

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

test("a sitting is checked key by key against the text the server served", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const { pid, request } = await setUp(READY);
  const sit = async (seconds: number, body: object) => {
    const started = await request
      .POST(`/_/certificate/sitting/${pid}/start`)
      .send({});
    equal((await started.body.json<{ text: string }>()).text, SERVED);
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

  // More typing than the server-timed sitting had room for.
  equal((await sit(10, SITTING)).reason, "more-typing-than-time");
  // Sped up: a real rhythm replayed six times faster reads as a hand no
  // person has, or — if it stays above that floor — as far beyond this
  // learner's own practice pace. Either way it is refused.
  isTrue(
    ["faster-than-a-hand", "faster-than-practice"].includes(
      (await sit(185, sittingOf(typed(2, 1 / 6)))).reason ?? "",
    ),
  );
  equal(
    (await sit(185, sittingOf(typed(3, 1 / 12)))).reason,
    "faster-than-a-hand",
  );
  // Pasted: the whole stretch at once.
  const stretch = SERVED.split(" ").slice(0, 6).join(" ");
  equal(
    (
      await sit(
        185,
        sittingOf({
          runs: [
            [
              {
                text: stretch,
                steps: [...stretch].map((_, i) => [9000 + (i >> 4), 0]),
              },
            ],
          ],
        }),
      )
    ).reason,
    "faster-than-a-hand",
  );
  // A bot at a fixed 150 ms.
  equal(
    (
      await sit(
        185,
        sittingOf({
          runs: [
            [
              {
                text: stretch,
                steps: [...stretch].map((_, i) => [9000 + i * 150, 0]),
              },
            ],
          ],
        }),
      )
    ).reason,
    "machine-regular",
  );
  // Text the server never served.
  equal(
    (
      await sit(
        185,
        sittingOf({
          runs: [
            [
              {
                text: "the quick brown fox jumps",
                steps: rhythm(25, 5),
              },
            ],
          ],
        }),
      )
    ).reason,
    "not-the-served-text",
  );
  // Honest keystrokes, flattering figures.
  equal(
    (await sit(185, { ...SITTING, speed: 50 })).reason,
    "figures-do-not-match-keystrokes",
  );
  // No keystrokes at all.
  equal((await sit(185, { ...SITTING, log: undefined })).reason, "no-log");

  // A genuine sitting counts; the same keystrokes sent again do not.
  equal((await sit(185, SITTING)).status, 204);
  equal((await sit(185, SITTING)).reason, "replayed");
  for (const seed of [11, 21]) {
    equal((await sit(185, sittingOf(typed(seed)))).status, 204);
  }
  // Only a hash of each log is kept, never the keystrokes.
  const rows = await CertificateSitting.query().where({ profileId: pid });
  equal(rows.length, 3);
  isTrue(rows.every((row) => /^[0-9a-f]{64}$/.test(row.logHash ?? "")));

  // Issued on the keystrokes' figures, whatever the request claims.
  const issued = await request.POST(`/_/certificate/${pid}`).send({
    kind: "typing",
    speed: 400,
    accuracy: 1,
    nameVisible: true,
  });
  equal(issued.status, 200);
  const cert = await issued.body.json<{ speed: number; evidence: string }>();
  const speeds = [1, 11, 21]
    .map((seed) => sittingOf(typed(seed)).speed)
    .sort((a, b) => a - b);
  isTrue(Math.abs(cert.speed - speeds[1]) < 1e-6, String(cert.speed));
  equal(cert.evidence, "keystroke");
});

test("a certificate stays verifiable after its account is erased, and nothing else stays", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const { user, pid, request } = await setUp(READY);
  for (const seed of [1, 11, 21]) {
    await request.POST(`/_/certificate/sitting/${pid}/start`).send({});
    t.mock.timers.tick(185_000);
    await request
      .POST(`/_/certificate/sitting/${pid}`)
      .send(sittingOf(typed(seed)));
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
  isTrue(verdict.speed > 20 && verdict.speed < 60, String(verdict.speed));
  equal(verdict.evidence, "keystroke");
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
