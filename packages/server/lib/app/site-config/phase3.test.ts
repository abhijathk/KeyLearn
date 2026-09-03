import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { Application } from "@fastr/core";
import {
  LearnerResponse,
  SiteConfig,
  SiteConfigHistory,
  StaffAuditEvent,
  User,
} from "@keylearn/database";
import {
  REGISTRY,
  setSiteConfigValues,
  siteNumber,
} from "@keylearn/site-config";
import {
  deepEqual,
  equal,
  includes,
  isFalse,
  isNull,
  isTrue,
} from "rich-assert";
import { Controller as AuthController } from "../auth/controller.ts";
import { kMain } from "../module.ts";
import { LearnerResponseSweep } from "../support/learner-response-sweep.ts";
import { resetDeskNoticeCache } from "../support/qdesk-forward.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { SiteConfigRefused, SiteConfigService } from "./service.ts";

/**
 * Phase 3's KeyLearn side:
 *  3.1 polls — one vote per account, changeable until close, counted live;
 *  3.2 feedback — stars, comments, the contact-detail gate, the inbox,
 *      moderation, twelve-month retention, export and deletion;
 *  3.3 premium locked until the Paddle keys exist;
 *  3.4 learner overrides in the registry and page data, and operational
 *      tuning beyond bounds with a reason.
 */

const context = new TestContext();
const OPS_KEY = "Nq8s4Xb2m0PfTz1Lc7RkYw3Ve6Hd9Jg5";
const ENV_KEYS = [
  "PADDLE_API_KEY",
  "PADDLE_SECRET_KEY",
  "QDESK_RETRY_AFTER_MINUTES",
];

/** A stub desk: whatever `notices` holds is what `/_/apps/notices` answers. */
let notices: Record<string, unknown>[] = [];
let desk: Server;
let deskUrl = "";

before(async () => {
  desk = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/_/apps/notices") {
      res.end(JSON.stringify({ notices }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) => desk.listen(0, resolve));
  const address = desk.address();
  deskUrl = `http://127.0.0.1:${typeof address === "object" && address != null ? address.port : 0}`;
});

after(() => {
  desk.close();
});

function poll(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    message: "Which language should we add next?",
    kind: "feature",
    display: "poll",
    audience: "signed-in",
    dismissible: true,
    options: ["Kannada", "Telugu", "Tamil"],
    showResults: true,
    askComment: true,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function feedback(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    message: "How is KeyLearn working for you?",
    kind: "feature",
    display: "feedback",
    audience: "signed-in",
    dismissible: true,
    options: null,
    showResults: true,
    askComment: true,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

async function fresh() {
  await SiteConfig.query().delete();
  await SiteConfigHistory.query().delete();
  await StaffAuditEvent.query().delete();
  await LearnerResponse.query().delete();
  setSiteConfigValues(new Map());
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  process.env.OPS_API_KEY = OPS_KEY;
  process.env.ADMIN_EMAILS = "user1@keylearn.org";
  process.env.QDESK_URL = deskUrl;
  process.env.QDESK_APP_KEY = "stub-app-key";
  notices = [];
  resetDeskNoticeCache();
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

/** Registers a second account and returns its id; `become` signs it in. */
async function registerVoter(request: any, email: string): Promise<number> {
  const res = await request.POST("/auth/register-password").send({
    email,
    password: "a-long-enough-password-12",
    firstName: "Voter",
    lastName: "Person",
    dateOfBirth: "1990-01-01",
  });
  equal(res.status, 200, `registration answers 200 for ${email}`);
  const user = await User.findByEmail(email);
  isTrue(user != null, "the voter exists");
  return user!.id!;
}

test("3.4 overrides: registry rows reach the page, and only an operations number goes beyond bounds with a reason", async () => {
  const { admin, service, request } = await fresh();
  const overrides = REGISTRY.filter((def) => def.overrideOf != null);
  equal(overrides.length, 8, "one override row per learner-changeable default");
  isTrue(
    overrides.every(
      (def) => def.type === "choice" && def.default === "default",
    ),
  );

  await request.become("user1@keylearn.org");
  let page = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  includes(page, '"learnerOverrides":{}', "nothing forced on a fresh install");
  await service.set("practice.defaultTargetSpeedCpm.override", "forced", {
    userId: admin,
  });
  await service.set("a11y.defaultContrast.override", "hidden", {
    userId: admin,
  });
  page = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  includes(page, '"lesson.targetSpeed":"forced"');
  includes(page, '"a11y.contrast":"hidden"');
  const rows: any = await (
    await request
      .GET("/_/internal/site-config")
      .header("x-ops-api-key", OPS_KEY)
      .send()
  ).body.json();
  const speed = rows.learnerDefaults.find(
    (row: any) => row.key === "practice.defaultTargetSpeedCpm",
  );
  equal(speed.override, "forced", "the learner-defaults list carries the mode");
  equal(speed.overrideKey, "practice.defaultTargetSpeedCpm.override");
  isNull(
    rows.learnerDefaults.find((row: any) => row.key.endsWith(".override")) ??
      null,
    "override rows are not learner defaults themselves",
  );
  await request.become(null);

  // Beyond bounds.
  equal(
    await refusal(() =>
      service.set("ops.qdeskRetryAfterMin", 120, { userId: admin }),
    ),
    "bounds",
    "a plain write still respects the bounds",
  );
  equal(
    await refusal(() =>
      service.set("ops.qdeskRetryAfterMin", 120, { userId: admin }, null, {
        beyondBounds: true,
      }),
    ),
    "reason",
    "beyond bounds needs a reason",
  );
  const tuned = await service.set(
    "ops.qdeskRetryAfterMin",
    120,
    { userId: admin, reason: "desk outage, retry less often" },
    null,
    { beyondBounds: true },
  );
  isTrue(tuned.entry.beyondBounds, "the entry says it is beyond bounds");
  equal(siteNumber("ops.qdeskRetryAfterMin"), 120, "and the reader applies it");
  equal(tuned.history?.reason, "desk outage, retry less often");
  equal(
    await refusal(() =>
      service.set(
        "ops.qdeskRetryAfterMin",
        100_000,
        { userId: admin, reason: "typo" },
        null,
        { beyondBounds: true },
      ),
    ),
    "bounds",
    "the sanity ceiling holds",
  );
  equal(
    await refusal(() =>
      service.set(
        "profiles.placesFree",
        40,
        { userId: admin, reason: "no" },
        null,
        { beyondBounds: true },
      ),
    ),
    "beyond",
    "only an operations number may go beyond its bounds",
  );
  const viaApi = await request
    .PUT("/_/internal/site-config/ops.qdeskGiveUpHours")
    .header("x-ops-api-key", OPS_KEY)
    .send({
      value: 400,
      beyondBounds: true,
      reason: "long weekend",
      actingStaffUserId: admin,
    });
  equal(viaApi.status, 200, "the internal API carries the flag");
  isTrue(((await viaApi.body.json()) as any).entry.beyondBounds);
});

test("3.4 smart practice: off takes the adaptive layers away from every learner", async () => {
  const { admin, service, request } = await fresh();
  const { learnerDefaults, learnerOverrides, smartPractice } =
    await import("./readers.ts");
  isTrue(smartPractice(), "shipped on");
  deepEqual(learnerOverrides(), {}, "and nothing is hidden while it is on");

  await service.set("practice.smartPractice", false, { userId: admin });
  isFalse(smartPractice());
  const defaults = learnerDefaults();
  for (const prop of [
    "lesson.guided.smartConfidence",
    "lesson.guided.skillDecay",
    "lesson.guided.spacedRepetition",
    "lesson.guided.bottleneckDrill",
  ]) {
    equal(defaults[prop], false, `${prop} is off for everyone`);
    equal(learnerOverrides()[prop], "hidden", `${prop} loses its control`);
  }
  await request.become("user1@keylearn.org");
  const page = await (
    await request.GET("/").header("accept", "text/html").send()
  ).body.text();
  includes(page, '"lesson.guided.smartConfidence":false');
  includes(page, '"lesson.guided.smartConfidence":"hidden"');
  await request.become(null);
});

test("3.3 premium: locked until both Paddle keys exist, and the payload says so", async () => {
  const { service, request } = await fresh();
  let entry = await service.entry("premium.sell");
  equal(entry.locked?.code, "env");
  includes(entry.locked!.message, "PADDLE_API_KEY");
  let payload: any = await (
    await request
      .GET("/_/internal/site-config")
      .header("x-ops-api-key", OPS_KEY)
      .send()
  ).body.json();
  deepEqual(payload.paddle, { configured: false, partial: false });

  process.env.PADDLE_API_KEY = "one-key-only";
  payload = await (
    await request
      .GET("/_/internal/site-config")
      .header("x-ops-api-key", OPS_KEY)
      .send()
  ).body.json();
  deepEqual(
    payload.paddle,
    { configured: false, partial: true },
    "one key is a misconfiguration",
  );
  entry = await service.entry("premium.sell");
  equal(entry.locked?.code, "env", "still locked with one key");

  process.env.PADDLE_SECRET_KEY = "and-the-other";
  entry = await service.entry("premium.sell");
  isNull(entry.locked, "both keys set: the switch is enabled");
  payload = await (
    await request
      .GET("/_/internal/site-config")
      .header("x-ops-api-key", OPS_KEY)
      .send()
  ).body.json();
  deepEqual(payload.paddle, { configured: true, partial: false });
});

test("3.1 polls: one vote per account, changeable until close, counted live", async () => {
  const { request } = await fresh();
  notices = [poll(41)];
  resetDeskNoticeCache();

  const feed: any = await (
    await request.GET("/_/support/notice").send()
  ).body.json();
  const card = feed.notices.find((n: any) => n.display === "poll");
  isTrue(card != null, "the poll travels in the public feed");
  equal(card.id, -41, "with the desk id negated, like every desk notice");
  deepEqual(card.options, ["Kannada", "Telugu", "Tamil"]);

  const anonymous = await request
    .PUT("/_/support/my/voice/41")
    .send({ choice: 1 });
  isTrue(anonymous.status >= 400, "a visitor without an account cannot vote");

  await request.become("user1@keylearn.org");
  let res = await request.PUT("/_/support/my/voice/41").send({ choice: 1 });
  equal(res.status, 200);
  let body: any = await res.body.json();
  equal(body.response.choice, 1);
  deepEqual(body.results.choices, [0, 1, 0, 0]);
  equal(body.results.count, 1);

  res = await request.PUT("/_/support/my/voice/41").send({ choice: 2 });
  body = await res.body.json();
  equal(body.response.choice, 2, "the vote is changeable");
  equal(body.results.count, 1, "and still counts once");
  deepEqual(body.results.choices, [0, 0, 1, 0]);

  const bad = await request.PUT("/_/support/my/voice/41").send({ choice: 3 });
  includes(
    await bad.body.text(),
    "Pick one of the options",
    "an option that does not exist is refused",
  );

  const mine: any = await (
    await request.GET("/_/support/my/voice/41").send()
  ).body.json();
  equal(mine.open, true);
  equal(mine.response.choice, 2);
  equal(mine.results.count, 1);

  const voter = await registerVoter(request, "voter.one@example.com");
  await request.become("voter.one@example.com");
  res = await request.PUT("/_/support/my/voice/41").send({ choice: 2 });
  body = await res.body.json();
  equal(body.results.count, 2, "a second account is a second vote");
  deepEqual(body.results.choices, [0, 0, 2, 0]);
  equal((await LearnerResponse.query().where("userId", voter)).length, 1);

  const internal: any = await (
    await request
      .GET("/_/internal/notices/41/results")
      .header("x-ops-api-key", OPS_KEY)
      .send()
  ).body.json();
  equal(internal.results.count, 2, "the desk reads the same tally");

  // Closed on the desk: gone from the feed, and a vote is refused.
  notices = [];
  resetDeskNoticeCache();
  const closed = await request
    .PUT("/_/support/my/voice/41")
    .send({ choice: 0 });
  includes(await closed.body.text(), "closed");
  const after: any = await (
    await request.GET("/_/support/my/voice/41").send()
  ).body.json();
  equal(after.open, false, "the client is told the card has closed");
  await request.become(null);
});

test("3.2 feedback: stars, comments, the contact-detail gate, the inbox, moderation, retention, export and deletion", async () => {
  const { admin, request } = await fresh();
  notices = [feedback(42)];
  resetDeskNoticeCache();

  await request.become("user1@keylearn.org");
  let res = await request
    .PUT("/_/support/my/voice/42")
    .send({ stars: 4, text: "Lovely, but the kids world needs more songs." });
  equal(res.status, 200);
  let body: any = await res.body.json();
  equal(body.response.stars, 4);
  equal(body.results.average, 4);
  equal(body.results.comments, 1);

  const contact = await request
    .PUT("/_/support/my/voice/42")
    .send({ stars: 5, text: "Email me at someone@example.com" });
  includes(
    await contact.body.text(),
    "contact details",
    "a comment that would take someone off-platform is refused",
  );
  const kept = await LearnerResponse.findFor(42, admin);
  equal(kept!.stars, 4, "…and nothing was stored");
  includes(kept!.text!, "songs");

  const noStars = await request
    .PUT("/_/support/my/voice/42")
    .send({ text: "hi" });
  includes(await noStars.body.text(), "star rating");

  const voter = await registerVoter(request, "voter.two@example.com");
  await request.become("voter.two@example.com");
  res = await request.PUT("/_/support/my/voice/42").send({ stars: 2 });
  body = await res.body.json();
  equal(body.results.count, 2);
  equal(body.results.average, 3);
  deepEqual(body.results.stars, [0, 1, 0, 1, 0]);
  equal(body.results.comments, 1, "a star without a comment is not a comment");

  // The inbox, through the internal door.
  let inbox: any = await (
    await request
      .GET("/_/internal/feedback?noticeId=42")
      .header("x-ops-api-key", OPS_KEY)
      .send()
  ).body.json();
  equal(inbox.feedback.length, 1, "only rows with a comment are inbox rows");
  equal(inbox.feedback[0].account.email, "user1@keylearn.org");
  includes(inbox.feedback[0].text, "songs");

  // Moderation: a non-staff actor cannot, a staff member can; the star stays.
  const rowId = inbox.feedback[0].id;
  const notStaff = await request
    .POST(`/_/internal/feedback/${rowId}/hide`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ actingStaffUserId: voter });
  equal(notStaff.status, 403);
  const hidden = await request
    .POST(`/_/internal/feedback/${rowId}/hide`)
    .header("x-ops-api-key", OPS_KEY)
    .send({ actingStaffUserId: admin, reason: "names a colleague" });
  equal(hidden.status, 200);
  const moderated: any = await LearnerResponse.query().findById(rowId);
  isNull(moderated!.text, "the text is gone");
  equal(moderated!.stars, 4, "the star is kept");
  isTrue(moderated!.hiddenAt != null);
  inbox = await (
    await request
      .GET("/_/internal/feedback?noticeId=42")
      .header("x-ops-api-key", OPS_KEY)
      .send()
  ).body.json();
  equal(
    inbox.feedback[0].textDropped,
    true,
    "the inbox says the comment was removed",
  );
  equal(inbox.feedback[0].hidden, true);

  // Retention: twelve months, then the star alone.
  await request.become("voter.two@example.com");
  await request
    .PUT("/_/support/my/voice/42")
    .send({ stars: 2, text: "Old comment" });
  const old = await LearnerResponse.findFor(42, voter);
  await old!.$query().patch({
    createdAt: new Date(Date.now() - 400 * 24 * 3600 * 1000),
  } as any);
  const dropped = await new LearnerResponseSweep().runOnce();
  equal(dropped, 1, "the sweep drops the comment older than a year");
  const reduced = await LearnerResponse.findFor(42, voter);
  isNull(reduced!.text);
  equal(reduced!.stars, 2);
  isFalse(reduced!.hiddenAt != null, "retention is not moderation");

  // Export carries the answers; deletion takes them away.
  const exported: any = await (
    await request.GET("/_/account/export").send()
  ).body.json();
  equal(exported.responses.length, 1, "the export lists the account's answers");
  equal(exported.responses[0].noticeId, 42);
  await request.become(null);
  await context.get(AuthController).deleteAccountById(voter);
  equal(
    (await LearnerResponse.query().where("userId", voter)).length,
    0,
    "erased with the account",
  );
  equal(
    (await LearnerResponse.query().where("noticeId", 42)).length,
    1,
    "the other account's answer stands",
  );
});
