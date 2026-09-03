import {
  body,
  controller,
  http,
  pathParam,
  queryParam,
} from "@fastr/controller";
import { Context } from "@fastr/core";
import { ApplicationError, HttpError } from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { type SessionState } from "@fastr/middleware-session";
import { Env, listStaffEmails } from "@keylearn/config";
import {
  AccountDeletionRequest,
  AgentStatus,
  Answer,
  AnswerRule,
  Credential,
  LEARNER_COMMENT_MAX,
  LearnerResponse,
  maskEmail,
  Notice,
  Notification,
  PracticeSession,
  Profile,
  SavedReply,
  SecurityEvent,
  StaffAuditEvent,
  StaffSettings,
  SupportBlock,
  SupportMessage,
  SupportTicket,
  type SupportTicketKind,
  type SupportTicketSentiment,
  type SupportTicketStatus,
  User,
} from "@keylearn/database";
import { hasContactDetails } from "@keylearn/moderation";
import { type NoticeKind, resolveDateMarks } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { z } from "zod";
import {
  messageAccountDeletionRequested,
  messageBusinessEnquiry,
  messageConfirmSupportTicket,
  messageThreadReply,
  messageUrgentFlag,
} from "../auth/email.ts";
import {
  requireParentPinForSupport,
  supportGateStatus,
} from "../auth/parent-pin.ts";
import { clientIp, rateLimit } from "../auth/ratelimit.ts";
import { staffAccessStatus } from "../auth/staff-access.ts";
import {
  recordFailure,
  requireCaptcha,
  requireCaptchaIfSuspicious,
} from "../auth/turnstile.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import { Mailer } from "../mail/index.ts";
import { threadLinkMs } from "../site-config/readers.ts";
import { matchAnswers } from "./matching.ts";
import {
  fetchDeskNotice,
  fetchDeskNotices,
  fetchHelpArticles,
  forwardReplyToQdesk,
  forwardTicketToQdesk,
  qdeskConfigured,
} from "./qdesk-forward.ts";
import { digestHour } from "./sweep.ts";

const jsonOpts = { maxLength: 4096 };

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a closed thread's guest link keeps working. */
export const THREAD_EXPIRY_MS = 90 * DAY_MS;
/** How long a duplicate resubmission is folded into an existing ticket. */
const DEDUP_WINDOW_MS = DAY_MS;
/** The lookback window for counting an email's recent spam-closed tickets. */
const SPAM_WINDOW_MS = DAY_MS;
/** How long a cooldown blocks new submissions from a spamming email. */
const SPAM_BLOCK_DURATION_MS = DAY_MS;

// A submission is flagged rather than rejected when it looks like spam or
// phishing — it still reaches a human, just sorted for extra scrutiny. A
// hard reject would also catch a real user whose question happens to
// mention a link, and there is no way to tell the two apart from the text
// alone.
const URL_RE = /https?:\/\/[^\s]+/gi;
const ALLOWED_HOSTS = new Set(["keylearn.org", "www.keylearn.org"]);
const URGENT_WORDS =
  /\b(urgent|verify now|act now|click here|limited time|password (?:has )?expired?|you'?ve won|claim your prize)\b/i;

function looksSuspicious(message: string): boolean {
  const urls = message.match(URL_RE) ?? [];
  if (urls.length >= 3) {
    return true;
  }
  const offSiteLink = urls.some((raw) => {
    try {
      return !ALLOWED_HOSTS.has(new URL(raw).hostname.toLowerCase());
    } catch {
      return true;
    }
  });
  return offSiteLink && URGENT_WORDS.test(message);
}

/** Every status a ticket may be in. */
const ALL_STATUSES = [
  "open",
  "flagged",
  "waiting",
  "closed",
  "spam",
  "holding",
] as const;
/**
 * What staff may set a ticket TO directly. "holding" is deliberately
 * excluded — it is a system-only state a ticket enters at creation and
 * leaves via email confirmation, not something a staff move produces.
 */
const STAFF_STATUSES = [
  "open",
  "flagged",
  "waiting",
  "closed",
  "spam",
] as const;

const TCreateTicket = z.object({
  kind: z.enum(["support", "business"]),
  name: z.string().trim().min(1).max(64),
  email: z.string().trim().min(1).max(128).email(),
  subject: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(2000),
  turnstileToken: z.string().max(4096).optional(),
  /**
   * The browser's own IANA zone, same field and same reasoning as the
   * signed-in form (my-controller). Optional: an older client that does
   * not send it still files a ticket, it just arrives without a local
   * time.
   */
  timeZone: z.string().trim().max(64).nullable().optional(),
  // Hidden form field a real visitor never fills in. Any value here means a
  // bot filled out every field it could find — accepted-and-dropped rather
  // than rejected, so it never learns which signal caught it.
  website: z.string().max(256).optional(),
});
type TCreateTicket = z.infer<typeof TCreateTicket>;
const PCreateTicket = zod(TCreateTicket, () => {
  throw new ApplicationError("Check the form and try again");
});

const TReply = z.object({
  reply: z.string().trim().min(1).max(4000),
  status: z.enum(STAFF_STATUSES),
});
type TReply = z.infer<typeof TReply>;
const PReply = zod(TReply);

const TStaffMessage = z.object({
  body: z.string().trim().min(1).max(4000),
  /** Send and close in one move, rather than a separate status change. */
  close: z.boolean().optional(),
});
type TStaffMessage = z.infer<typeof TStaffMessage>;
const PStaffMessage = zod(TStaffMessage);

const TDeliverReply = z.object({
  body: z.string().trim().min(1).max(4000),
  // "us" = a QDesk staff member, "agent" = Tab running on QDesk's side —
  // preserved so the guest thread view renders the right sender label.
  sender: z.enum(["us", "agent"]),
  close: z.boolean().optional(),
  // The name the customer will see above this reply — the desk sends
  // whatever the staffer or the assistant is called there. Bounded and
  // optional: an older desk build simply omits it and the thread falls
  // back to the generic label it always used.
  authorName: z.string().trim().max(64).nullable().optional(),
  /**
   * "crisis" marks the fixed §6.7 emergency redirect, which the account
   * section renders as an alert with the number set large rather than as
   * a chat bubble. Nothing about an emergency number should read as the
   * assistant making conversation. Optional so an older desk build simply
   * sends an ordinary message.
   */
  kind: z.enum(["crisis", "handover"]).nullable().optional(),
  /**
   * The desk's own message id — the handle the per-reply thumbs post
   * back with. Optional so an older desk build simply omits it.
   */
  qdeskMessageId: z.number().int().positive().nullable().optional(),
});
type TDeliverReply = z.infer<typeof TDeliverReply>;
const PDeliverReply = zod(TDeliverReply);

const TGuestMessage = z.object({
  message: z.string().trim().min(1).max(2000),
});
type TGuestMessage = z.infer<typeof TGuestMessage>;
const PGuestMessage = zod(TGuestMessage);

const TStatus = z.object({ status: z.enum(STAFF_STATUSES) });
type TStatus = z.infer<typeof TStatus>;
const PStatus = zod(TStatus);

const TArchive = z.object({ archived: z.boolean() });
type TArchive = z.infer<typeof TArchive>;
const PArchive = zod(TArchive);

const TSuggest = z.object({ text: z.string().trim().min(1).max(4000) });
type TSuggest = z.infer<typeof TSuggest>;
const PSuggest = zod(TSuggest);

// ── Automation agent request shapes — deliberately narrower than the
// staff equivalents above: no `close` on a reply (the agent can never
// close a ticket), no arbitrary status on a flag (always "flagged").

const TAgentMessage = z.object({
  body: z.string().trim().min(1).max(4000),
  /** Which Answer(s) the reply was drafted from — desk attribution only, see mockup step 02. */
  usedAnswerIds: z.array(z.number().int()).max(10).optional(),
});
type TAgentMessage = z.infer<typeof TAgentMessage>;
const PAgentMessage = zod(TAgentMessage);

const AGENT_SENTIMENTS = ["neutral", "frustrated", "critical"] as const;
const TAgentSentiment = z.object({
  sentiment: z.enum(AGENT_SENTIMENTS),
});
type TAgentSentiment = z.infer<typeof TAgentSentiment>;
const PAgentSentiment = zod(TAgentSentiment);

const TAgentFlag = z.object({
  reason: z.string().trim().min(1).max(256),
  /** Whether this reason warrants an immediate alert, not just the daily digest — see the mockup's step 05 "fires now" list. */
  urgent: z.boolean().optional(),
});
type TAgentFlag = z.infer<typeof TAgentFlag>;
const PAgentFlag = zod(TAgentFlag);

const TAgentQuota = z.object({
  model: z.string().trim().min(1).max(64),
});
type TAgentQuota = z.infer<typeof TAgentQuota>;
const PAgentQuota = zod(TAgentQuota);

const TDeskAutomationEnabled = z.object({
  enabled: z.boolean(),
});
type TDeskAutomationEnabled = z.infer<typeof TDeskAutomationEnabled>;
const PDeskAutomationEnabled = zod(TDeskAutomationEnabled);

const NoticeFields = {
  message: z.string().trim().min(1).max(280),
  level: z.enum(["info", "warning"]).optional(),
  kind: z.enum(["incident", "maintenance", "feature"]).optional(),
  display: z.enum(["banner", "window"]).optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  audience: z.string().trim().min(1).max(16).optional(),
  dismissible: z.boolean().optional(),
};
const TNoticeCreate = z.object(NoticeFields);
type TNoticeCreate = z.infer<typeof TNoticeCreate>;
const PNoticeCreate = zod(TNoticeCreate);

const TNoticeUpdate = z.object({
  ...NoticeFields,
  message: NoticeFields.message.optional(),
  active: z.boolean().optional(),
});
type TNoticeUpdate = z.infer<typeof TNoticeUpdate>;
const PNoticeUpdate = zod(TNoticeUpdate);

/** A learner's answer to a poll (choice) or a feedback card (stars, optional text). */
const TLearnerResponse = z.object({
  choice: z.number().int().min(0).max(3).optional(),
  stars: z.number().int().min(1).max(5).optional(),
  text: z.string().trim().max(LEARNER_COMMENT_MAX).optional(),
});
type TLearnerResponse = z.infer<typeof TLearnerResponse>;
const PLearnerResponse = zod(TLearnerResponse);

const TAnswerCreate = z.object({
  title: z.string().trim().min(1).max(128),
  body: z.string().trim().min(1).max(4000),
  published: z.boolean().optional(),
});
type TAnswerCreate = z.infer<typeof TAnswerCreate>;
const PAnswerCreate = zod(TAnswerCreate);

const TAnswerUpdate = z.object({
  title: z.string().trim().min(1).max(128).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
  published: z.boolean().optional(),
});
type TAnswerUpdate = z.infer<typeof TAnswerUpdate>;
const PAnswerUpdate = zod(TAnswerUpdate);

const TRuleCreate = z.object({
  answerId: z.coerce.number().int().positive(),
  keywords: z.string().trim().min(1).max(1000),
  suggestOnly: z.boolean().optional(),
});
type TRuleCreate = z.infer<typeof TRuleCreate>;
const PRuleCreate = zod(TRuleCreate);

const TRuleUpdate = z.object({
  keywords: z.string().trim().min(1).max(1000).optional(),
  suggestOnly: z.boolean().optional(),
});
type TRuleUpdate = z.infer<typeof TRuleUpdate>;
const PRuleUpdate = zod(TRuleUpdate);

const TSavedReplyCreate = z.object({
  title: z.string().trim().min(1).max(128),
  body: z.string().trim().min(1).max(4000),
});
type TSavedReplyCreate = z.infer<typeof TSavedReplyCreate>;
const PSavedReplyCreate = zod(TSavedReplyCreate);

const TSavedReplyUpdate = z.object({
  title: z.string().trim().min(1).max(128).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
});
type TSavedReplyUpdate = z.infer<typeof TSavedReplyUpdate>;
const PSavedReplyUpdate = zod(TSavedReplyUpdate);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TSettings = z.object({
  signature: z.string().trim().max(500).nullable().optional(),
  notifyNew: z.boolean().optional(),
  quietFrom: z.string().regex(TIME_RE).nullable().optional(),
  quietTo: z.string().regex(TIME_RE).nullable().optional(),
  awayUntil: z.string().regex(DATE_RE).nullable().optional(),
  confidenceThreshold: z.coerce.number().int().min(0).max(100).optional(),
  overdueHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .optional(),
  requireRevealReason: z.boolean().optional(),
  showLastLoginLocation: z.boolean().optional(),
  compactDensity: z.boolean().optional(),
  relativeTimestamps: z.boolean().optional(),
  showCountryFlag: z.boolean().optional(),
  desktopPush: z.boolean().optional(),
  soundAlert: z.boolean().optional(),
  escalationOnly: z.boolean().optional(),
  defaultLandingPage: z.enum(["dashboard", "inbox"]).optional(),
  secondReopenAutoFlag: z.boolean().optional(),
  autoCloseIdleDays: z.coerce.number().int().min(0).max(90).optional(),
  sentimentSensitivity: z.enum(["mild", "moderate", "strict"]).optional(),
});

const TAccountReveal = z.object({
  reason: z.string().trim().max(200).optional(),
});
type TAccountReveal = z.infer<typeof TAccountReveal>;
const PAccountReveal = zod(TAccountReveal);

const TAccountRequestDeletion = z.object({
  reason: z.string().trim().min(1).max(500),
});
type TAccountRequestDeletion = z.infer<typeof TAccountRequestDeletion>;
const PAccountRequestDeletion = zod(TAccountRequestDeletion);
type TSettings = z.infer<typeof TSettings>;
const PSettings = zod(TSettings);

const pId = zod(z.coerce.number().int().positive());
const pToken = zod(z.string().trim().min(1).max(128));
// A missing query param arrives as `null`, not `undefined` — `.optional()`
// only accepts the latter, so an absent filter would 400 rather than mean
// "no filter". `.catch(undefined)` absorbs that (and anything else
// unparseable) into "no filter" instead of rejecting the request.
const pKind = zod(z.enum(["support", "business"]).optional().catch(undefined));
const pStatus = zod(z.enum(ALL_STATUSES).optional().catch(undefined));
const pQuery = zod(z.string().trim().max(200).optional().catch(undefined));
const pArchived = zod(
  z
    .enum(["true", "false"])
    .optional()
    .catch(undefined)
    .transform((v) => (v === undefined ? undefined : v === "true")),
);
const pAudience = zod(z.string().trim().max(16).optional().catch(undefined));

// ── Dashboard: computed on request, cached in-process ──
//
// The mock's own copy ("next refresh in N minutes") describes a scheduled
// refresh rather than a live one — a two-person team's traffic does not
// justify a cron job or queue for this, so a plain module-level cache with a
// TTL gets the same behaviour with no new infrastructure.

type DashboardData = {
  readonly accountsTotal: number;
  readonly newLast7Days: number;
  readonly avgLoginsPerActiveUserPerWeek: number;
  readonly avgSessionsPerActiveUserPerWeek: number;
  /** One count per day, oldest to newest, over the trailing 14 days. */
  readonly signupTrend: readonly number[];
  /** One count per hour, oldest to newest, over the last 24 hours. */
  readonly signupTrendToday: readonly number[];
  /** One count per calendar month, oldest to newest, since the first signup. */
  readonly signupTrendAllTime: readonly number[];
  readonly byCountry: readonly {
    readonly country: string;
    readonly count: number;
  }[];
  readonly byLanguage: readonly {
    readonly language: string;
    readonly count: number;
  }[];
  readonly bySignupMethod: readonly {
    readonly method: string;
    readonly count: number;
  }[];
  readonly kidsVsGrownups: readonly {
    readonly kind: string;
    readonly count: number;
  }[];
  /** Tab's own performance, trailing 7 days — mockup step 08. */
  readonly automation: {
    readonly autoResolved: number;
    readonly escalated: number;
    readonly reopened: number;
    readonly autoResolvedPct: number;
    readonly escalatedPct: number;
    readonly reopenedPct: number;
  };
  /** The single top signup country, for the "Needs a look" rail — null if no country data yet. */
  readonly topCountry: string | null;
  /** Server-local hour the daily digest goes out — {@link digestHour} — so the client can render "next digest …". */
  readonly digestHour: number;
  /** The most recently flagged ticket still open, plus how many others are waiting — null if the queue is clear. */
  readonly urgent: {
    readonly count: number;
    readonly ticketId: number;
    readonly subject: string;
    readonly ageHours: number;
  } | null;
  /** Every notice currently live, same shape the real site-wide banner reads. */
  readonly notices: readonly {
    readonly id: number;
    readonly message: string;
    readonly kind: NoticeKind;
    readonly dismissible: boolean;
    readonly createdAt: string;
  }[];
  readonly computedAt: string;
};

const DASHBOARD_TTL_MS = 10 * 60 * 1000;
let dashboardCache: {
  readonly data: DashboardData;
  readonly at: number;
} | null = null;

async function getDashboard(): Promise<DashboardData> {
  const now = Date.now();
  if (dashboardCache != null && now - dashboardCache.at < DASHBOARD_TTL_MS) {
    return dashboardCache.data;
  }
  const data = await computeDashboard(now);
  dashboardCache = { data, at: now };
  return data;
}

async function computeDashboard(now: number): Promise<DashboardData> {
  const knex = User.knex();

  const accountsTotal = await User.query().resultSize();
  const since7 = new Date(now - 7 * DAY_MS);
  const newLast7Days = await User.query()
    .where("createdAt", ">=", since7)
    .resultSize();

  // Signup trend: fetch the (small, bounded-by-14-days) set of recent
  // signups and bucket them by calendar day in JS — the two database
  // engines this app supports (mysql/sqlite) don't share a portable
  // GROUP-BY-date syntax, and this table's rows are cheap to just read.
  const since14 = new Date(now - 14 * DAY_MS);
  const recentUsers = await User.query()
    .select("createdAt")
    .where("createdAt", ">=", since14);
  const byDay = new Map<string, number>();
  for (const u of recentUsers) {
    const day = new Date(u.createdAt!).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const signupTrend: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    signupTrend.push(byDay.get(day) ?? 0);
  }

  // Today: the last 24 hours, bucketed by hour — same fetch-and-bucket-in-JS
  // approach as the 14-day trend, just a narrower window and a finer key.
  const HOUR_MS = 60 * 60 * 1000;
  const since24h = new Date(now - 24 * HOUR_MS);
  const todayUsers = await User.query()
    .select("createdAt")
    .where("createdAt", ">=", since24h);
  const byHour = new Map<string, number>();
  for (const u of todayUsers) {
    const d = new Date(u.createdAt!);
    const hourKey = `${d.toISOString().slice(0, 13)}`; // "YYYY-MM-DDTHH"
    byHour.set(hourKey, (byHour.get(hourKey) ?? 0) + 1);
  }
  const signupTrendToday: number[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourKey = new Date(now - i * HOUR_MS).toISOString().slice(0, 13);
    signupTrendToday.push(byHour.get(hourKey) ?? 0);
  }

  // All-time: bucketed by calendar month, from the first-ever signup (or this
  // month, if there are no users yet) through the current month.
  const firstUser = await User.query()
    .select("createdAt")
    .orderBy("createdAt", "asc")
    .first();
  const allUsers = await User.query().select("createdAt");
  const byMonth = new Map<string, number>();
  for (const u of allUsers) {
    const monthKey = new Date(u.createdAt!).toISOString().slice(0, 7); // "YYYY-MM"
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + 1);
  }
  const signupTrendAllTime: number[] = [];
  const firstMonth = new Date(
    firstUser?.createdAt != null
      ? new Date(firstUser.createdAt).getTime()
      : now,
  );
  firstMonth.setUTCDate(1);
  const cursor = new Date(firstMonth);
  const nowMonth = new Date(now);
  while (
    cursor.getUTCFullYear() < nowMonth.getUTCFullYear() ||
    (cursor.getUTCFullYear() === nowMonth.getUTCFullYear() &&
      cursor.getUTCMonth() <= nowMonth.getUTCMonth())
  ) {
    const monthKey = cursor.toISOString().slice(0, 7);
    signupTrendAllTime.push(byMonth.get(monthKey) ?? 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Signup country: top ~8, everyone else folded into "other". Every
  // existing account has `signupCountry: null` today (the registration-path
  // write is a separate task), so this legitimately returns nothing but
  // "other" for now.
  const countryRows = (await knex(User.tableName)
    .select("signup_country")
    .whereNotNull("signup_country")
    .count({ count: "*" })
    .groupBy("signup_country")) as {
    signup_country: string;
    count: number | string;
  }[];
  const sortedCountries = countryRows
    .map((r) => ({ country: r.signup_country, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);
  const byCountry = sortedCountries.slice(0, 8);
  const otherCount = sortedCountries
    .slice(8)
    .reduce((sum, r) => sum + r.count, 0);
  if (otherCount > 0) {
    byCountry.push({ country: "other", count: otherCount });
  }

  // Signup language: same top-8-plus-other shape as signup country. Every
  // account registered before the `locale` column existed has `locale: null`
  // and is excluded, same as signup country.
  const localeRows = (await knex(User.tableName)
    .select("locale")
    .whereNotNull("locale")
    .count({ count: "*" })
    .groupBy("locale")) as { locale: string; count: number | string }[];
  const sortedLocales = localeRows
    .map((r) => ({ language: r.locale, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);
  const byLanguage = sortedLocales.slice(0, 8);
  const otherLocaleCount = sortedLocales
    .slice(8)
    .reduce((sum, r) => sum + r.count, 0);
  if (otherLocaleCount > 0) {
    byLanguage.push({ language: "other", count: otherLocaleCount });
  }

  // Sign-in method: linked OAuth providers, plus a computed password /
  // magic-link split for accounts with no linked provider at all.
  const providerRows = (await knex("user_external_id")
    .select("provider")
    .count({ count: "*" })
    .groupBy("provider")) as { provider: string; count: number | string }[];
  const noProvider = knex("user_external_id").select("user_id");
  const passwordOnly = (await knex(User.tableName)
    .whereNotNull("password_hash")
    .whereNotIn("id", noProvider)
    .count({ count: "*" })
    .first()) as { count: number | string } | undefined;
  const magicLinkOnly = (await knex(User.tableName)
    .whereNull("password_hash")
    .whereNotIn("id", knex("user_external_id").select("user_id"))
    .count({ count: "*" })
    .first()) as { count: number | string } | undefined;
  const bySignupMethod = [
    ...providerRows.map((r) => ({
      method: r.provider,
      count: Number(r.count),
    })),
    { method: "password", count: Number(passwordOnly?.count ?? 0) },
    { method: "magic-link", count: Number(magicLinkOnly?.count ?? 0) },
  ];

  // Kids vs. grown-ups: one row per Profile.kind.
  const kindRows = (await knex("profile")
    .select("kind")
    .count({ count: "*" })
    .groupBy("kind")) as { kind: string; count: number | string }[];
  const kidsVsGrownups = kindRows.map((r) => ({
    kind: r.kind,
    count: Number(r.count),
  }));

  // Avg. logins per active user per week — mirrors
  // PracticeSession.avgSessionsPerActiveUserPerWeek's exact aggregation
  // shape, against security_event instead.
  const sinceDays = 28;
  const sinceLogin = new Date(now - sinceDays * DAY_MS);
  const loginRow = (await knex("security_event")
    .where("type", "login")
    .where("created_at", ">=", sinceLogin)
    .count({ logins: "*" })
    .countDistinct({ activeUsers: "user_id" })
    .first()) as
    | { logins: number | string; activeUsers: number | string }
    | undefined;
  const logins = Number(loginRow?.logins ?? 0);
  const activeLoginUsers = Number(loginRow?.activeUsers ?? 0);
  const avgLoginsPerActiveUserPerWeek =
    logins === 0 || activeLoginUsers === 0
      ? 0
      : logins / (activeLoginUsers * (sinceDays / 7));

  const avgSessionsPerActiveUserPerWeek =
    await PracticeSession.avgSessionsPerActiveUserPerWeek();

  const automation = await computeAutomationStats(knex, since7);

  const topCountryRow = byCountry.find((r) => r.country !== "other");
  const topCountry = topCountryRow != null ? topCountryRow.country : null;

  const flagged = await SupportTicket.query()
    .where("status", "flagged")
    .orderBy("updatedAt", "desc");
  const urgent =
    flagged.length > 0
      ? {
          count: flagged.length,
          ticketId: flagged[0].id!,
          subject: flagged[0].subject!,
          ageHours: Math.max(
            0,
            Math.floor(
              (now - new Date(flagged[0].updatedAt!).getTime()) /
                (60 * 60 * 1000),
            ),
          ),
        }
      : null;

  const activeNotices = await Notice.activeNotices();
  const notices = activeNotices.map((n) => {
    const d = n.toDetails();
    return {
      id: d.id,
      message: d.message,
      kind: d.kind,
      dismissible: d.dismissible,
      createdAt: d.createdAt,
    };
  });

  return {
    accountsTotal,
    newLast7Days,
    avgLoginsPerActiveUserPerWeek,
    avgSessionsPerActiveUserPerWeek,
    signupTrend,
    signupTrendToday,
    signupTrendAllTime,
    byCountry,
    byLanguage,
    bySignupMethod,
    kidsVsGrownups,
    automation,
    topCountry,
    digestHour: digestHour(),
    urgent,
    notices,
    computedAt: new Date(now).toISOString(),
  };
}

/**
 * Tab's own performance, trailing 7 days — mockup step 08. Uses the audit
 * log as ground truth (agent-reply / agent-flag / agent-close-spam are
 * unambiguous, unlike inferring intent back out of a ticket's current
 * status) rather than re-deriving outcomes from ticket/message state.
 */
async function computeAutomationStats(
  knex: Knex,
  since: Date,
): Promise<DashboardData["automation"]> {
  const events = (await knex("staff_audit_event")
    .select("action", "detail", "created_at")
    .whereIn("action", ["agent-reply", "agent-flag", "agent-close-spam"])
    .where("created_at", ">=", since)) as {
    action: string;
    detail: string | null;
    created_at: string | Date;
  }[];

  const ticketIdOf = (detail: string | null): number | null => {
    const m = /^ticket (\d+)/.exec(detail ?? "");
    return m ? Number(m[1]) : null;
  };

  const replied = new Set<number>();
  const escalated = new Set<number>();
  for (const e of events) {
    const id = ticketIdOf(e.detail);
    if (id == null) {
      continue;
    }
    if (e.action === "agent-reply") {
      replied.add(id);
    } else {
      escalated.add(id);
    }
  }

  // A ticket Tab both replied to and later flagged (e.g. a second-reopen)
  // counts once, as escalated — the flag is the more recent, more decisive
  // outcome. Kept out of the auto-resolved bucket instead of double-counted.
  for (const id of escalated) {
    replied.delete(id);
  }

  let reopened = 0;
  if (replied.size > 0) {
    const repliedIds = [...replied];
    const messages = (await knex("support_message")
      .select("ticket_id", "sender", "created_at")
      .whereIn("ticket_id", repliedIds)
      .where("created_at", ">=", since)) as {
      ticket_id: number;
      sender: string;
      created_at: string | Date;
    }[];
    const lastAgentAt = new Map<number, number>();
    const themMessages = new Map<number, number[]>();
    for (const m of messages) {
      const t = new Date(m.created_at).getTime();
      if (m.sender === "agent") {
        lastAgentAt.set(
          m.ticket_id,
          Math.max(lastAgentAt.get(m.ticket_id) ?? 0, t),
        );
      } else if (m.sender === "them") {
        const arr = themMessages.get(m.ticket_id) ?? [];
        arr.push(t);
        themMessages.set(m.ticket_id, arr);
      }
    }
    for (const id of repliedIds) {
      const agentAt = lastAgentAt.get(id);
      const them = themMessages.get(id);
      if (agentAt != null && them != null && them.some((t) => t > agentAt)) {
        reopened++;
      }
    }
  }

  const total = replied.size + escalated.size;
  const pct = (n: number, of: number) => (of === 0 ? 0 : (n / of) * 100);
  return {
    autoResolved: replied.size,
    escalated: escalated.size,
    reopened,
    autoResolvedPct: pct(replied.size, total),
    escalatedPct: pct(escalated.size, total),
    reopenedPct: pct(reopened, replied.size),
  };
}

/**
 * "google"/"facebook"/etc for a linked OAuth account (the most recently used
 * provider, mirroring `User.toPublicUser`'s tie-break), else "password" or
 * "magic-link" depending on whether a password hash is set.
 */
export function deriveSignInMethod(user: User): string {
  const ids = user.externalIds ?? [];
  if (ids.length > 0) {
    const latest = ids.reduce((a, b) =>
      new Date(b.usedAt ?? b.createdAt!).getTime() >
      new Date(a.usedAt ?? a.createdAt!).getTime()
        ? b
        : a,
    );
    return latest.provider!;
  }
  return user.passwordHash != null ? "password" : "magic-link";
}

@injectable()
@controller()
export class Controller {
  constructor(
    @inject("canonicalUrl") readonly canonicalUrl: string,
    readonly mailer: Mailer,
  ) {}

  #link(path: string): string {
    return String(new URL(path, this.canonicalUrl));
  }

  // ── Public: submit + confirm + guest thread ──

  @http.POST("/_/support/tickets")
  async createTicket(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PCreateTicket, jsonOpts) input: TCreateTicket,
  ) {
    // On a household account with a kid profile, support is a grown-up's
    // section — see auth/parent-pin.ts for why this one is stricter than
    // the ordinary PIN gate. Checked before the rate limiter so a child
    // probing the form can't burn the household's hourly allowance.
    await requireParentPinForSupport(ctx, ctx.state.user);

    rateLimit(ctx, "support-ticket", 5, 60 * 60 * 1000);
    rateLimit(
      ctx,
      `support-ticket-email:${input.email.toLowerCase()}`,
      5,
      60 * 60 * 1000,
    );
    if (await SupportBlock.isBlocked(input.email)) {
      throw new HttpError(
        429,
        "This email address has been temporarily paused from opening new support requests, due to repeated off-topic submissions. Please try again later.",
      );
    }
    // Always, not adaptively — see the note on requireCaptcha. This is the
    // one door into QDesk that needs no account, and every ticket through
    // it costs a triage pass and, when automation is on, several model
    // calls. The other layers stay: they catch different things. Rate
    // limits bound volume per address and per email, the honeypot catches
    // naive form-fillers, SupportBlock catches repeat offenders, and
    // looksSuspicious still feeds the failure streak.
    await requireCaptcha(ctx, input.turnstileToken);

    if (input.website) {
      // Honeypot tripped. Same body shape as a real submission — the caller
      // (and whatever filled the hidden field) sees no difference.
      ctx.response.body = { ok: true };
      return;
    }

    const suspicious = looksSuspicious(input.message);
    if (suspicious) {
      recordFailure(ctx);
    }

    // Same sender, same words, within a day: fold it into the existing
    // ticket instead of opening a second one. A simple exact-text match is
    // enough here — no fuzzy matching needed for "I hit submit twice".
    const dupSince = new Date(Date.now() - DEDUP_WINDOW_MS);
    const dup = await SupportTicket.query()
      .where("email", input.email)
      .where("message", input.message)
      .whereNotIn("status", ["closed", "spam"])
      .where("createdAt", ">=", dupSince)
      .orderBy("createdAt", "desc")
      .first();

    if (dup != null) {
      const dupMessage = await SupportMessage.create({
        ticketId: dup.id!,
        sender: "them",
        body: input.message,
      });
      if (dup.confirmed) {
        forwardReplyToQdesk(dup.id!, input.message, dupMessage.id!);
      }
      const threadToken = await SupportTicket.reissueThreadToken(dup.id!);
      const holding = !dup.confirmed;
      if (holding) {
        const confirmToken = await SupportTicket.issueConfirmToken(dup.id!);
        this.#sendConfirmEmail(dup, confirmToken, threadToken);
      }
      ctx.response.body = { ok: true, threadToken, holding };
      ctx.response.headers.set("X-Ticket-Id", String(dup.id));
      return;
    }

    // Business enquiries and anything from a signed-in account are "never
    // queued" — only a signed-out "support" submission needs the
    // email-confirmation holding queue.
    const confirmed = ctx.state.user != null || input.kind === "business";
    const status: SupportTicketStatus = confirmed
      ? suspicious
        ? "flagged"
        : "open"
      : "holding";

    // Same header, same "captured once, never updated" rule as
    // User.signupCountry — see auth/controller.ts.
    const country = ctx.request.headers.get("cf-ipcountry");
    const { ticket, threadToken } = await SupportTicket.create({
      userId: ctx.state.user?.id ?? null,
      kind: input.kind,
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      status,
      confirmed,
      ip: clientIp(ctx),
      country: country != null && country !== "" ? country : null,
      // Stored with the submission, not merely forwarded from it: a ticket
      // in the holding queue forwards at CONFIRM time, from a request that
      // carries no browser and therefore no zone. What was true at
      // submission is the only copy there will ever be.
      timeZone: input.timeZone ?? null,
    });

    if (confirmed) {
      // The ticket's own `message` column stays the cheap preview line for
      // the queue; the thread's actual first message is this same text.
      const first = await SupportMessage.create({
        ticketId: ticket.id!,
        sender: "them",
        body: input.message,
      });
      forwardTicketToQdesk({
        id: ticket.id!,
        kind: input.kind,
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        userId: ctx.state.user?.id ?? null,
        messageId: first.id!,
        // Same two independent facts my-controller sends (see the note
        // there): country from the network edge, zone from the browser.
        // They were missing here, so every ticket filed through the
        // public form reached QDesk with no location and no local time —
        // which costs the crisis script its emergency number and the
        // assistant its sense of what time it is for the customer.
        country: ctx.request.headers.get("cf-ipcountry"),
        timeZone: input.timeZone ?? null,
      });
      // With the QDesk bridge on, QDesk's own agent owns automation —
      // running the local auto-reply too would give the customer two
      // bots answering the same message.
      if (input.kind === "support" && !qdeskConfigured()) {
        await this.#tryAutoReply(ticket.id!, input.message);
      }
    } else {
      const confirmToken = await SupportTicket.issueConfirmToken(ticket.id!);
      this.#sendConfirmEmail(ticket, confirmToken, threadToken);
    }

    if (input.kind === "business") {
      const inbox = Env.getString("SUPPORT_INBOX_EMAIL", "");
      if (inbox) {
        void (async () => {
          try {
            await this.mailer.sendMail(
              messageBusinessEnquiry({
                to: inbox,
                name: input.name,
                fromEmail: input.email,
                subject: input.subject,
                message: input.message,
                ticketLink: this.#link(`/desk/t/${ticket.id}`),
              }),
            );
          } catch {
            // A mail outage must never fail the submission — the ticket is
            // already saved and still reachable from the queue.
          }
        })();
      }
    }

    // Wrapped in a real JSON body rather than a bare 204 — the client's
    // support-ticket request expects an application/json response even on
    // success, and an empty 204 carries no Content-Type for it to match,
    // which turned every successful submission into a client-side error.
    ctx.response.body = { ok: true, threadToken, holding: !confirmed };
    ctx.response.headers.set("X-Ticket-Id", String(ticket.id));
  }

  /** Fire-and-forget: a mail outage must never fail the ticket submission. */
  #sendConfirmEmail(
    ticket: SupportTicket,
    confirmToken: string,
    threadToken: string,
  ): void {
    void (async () => {
      try {
        await this.mailer.sendMail(
          messageConfirmSupportTicket({
            to: ticket.email!,
            name: ticket.name!,
            confirmLink: this.#link(`/support/confirm/${confirmToken}`),
            threadLink: this.#link(`/support/t/${threadToken}`),
          }),
        );
      } catch {
        // Deliberately swallowed — see above.
      }
    })();
  }

  /**
   * Runs the keyword matcher and, if a confident-enough non-suggest-only
   * rule fires, sends its Answer as an `auto` message. Never closes the
   * ticket — a person still has to look at it, per the mock's "automation
   * answers first, never last" rule. Swallows its own errors: a matching
   * bug must never fail ticket creation or confirmation.
   */
  async #tryAutoReply(ticketId: number, message: string): Promise<void> {
    try {
      const rules = await AnswerRule.listAll();
      const matches = matchAnswers(
        message,
        rules.map((r) => ({
          id: r.id!,
          answerId: r.answerId!,
          keywords: r.keywords!,
          suggestOnly: Boolean(r.suggestOnly),
        })),
      );
      if (matches.length === 0) {
        return;
      }
      const top = matches[0];
      const rule = rules.find((r) => r.id === top.ruleId);
      if (rule == null || Boolean(rule.suggestOnly) || rule.answer == null) {
        return;
      }
      if (!rule.answer.published) {
        return;
      }
      const siteSettings = await StaffSettings.siteDefault();
      const threshold =
        (siteSettings.confidenceThreshold ??
          StaffSettings.defaultConfidenceThreshold) / 100;
      if (top.score < threshold) {
        return;
      }
      const body = `This looks like a question we've answered before: ${rule.answer.title}\n\n${rule.answer.body}`;
      await SupportMessage.create({
        ticketId,
        sender: "auto",
        body,
        emailed: false,
      });
      await AnswerRule.incrementFired(rule.id!);
      await Answer.incrementHit(rule.answerId!);
      await SupportTicket.attachAutoAnswer(ticketId, rule.answerId!, rule.id!);
    } catch {
      // Deliberately swallowed — see above.
    }
  }

  /**
   * Credits the Answer/AnswerRule that auto-replied to this ticket with a
   * "solved" the moment it closes — but only if the sender never had to
   * write again after the auto-reply (see `clearAutoAttribution`, called
   * from `replyToThread`). Clears the attribution afterwards so a
   * reopen-then-reclose can't double-count it.
   */
  async #creditAutoSolve(ticket: SupportTicket): Promise<void> {
    if (ticket.autoAnswerId == null || ticket.autoRuleId == null) {
      return;
    }
    await AnswerRule.incrementSolved(ticket.autoRuleId);
    await Answer.incrementSolved(ticket.autoAnswerId);
    await ticket.clearAutoAttribution();
  }

  @http.GET("/_/support/confirm/{token}")
  async confirmTicket(
    ctx: Context<RouterState & AuthState>,
    @pathParam("token", pToken) token: string,
  ) {
    const ticket = await SupportTicket.redeemConfirmToken(token);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    // The thread's first message only becomes visible once the ticket
    // leaves the holding queue — this is the first moment the sender (or
    // staff) can actually read it, and therefore also the first moment it
    // is real enough to forward to QDesk (an unconfirmed submission never
    // leaves this repo).
    const confirmedFirst = await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "them",
      body: ticket.message!,
    });
    forwardTicketToQdesk({
      id: ticket.id!,
      kind: (ticket.kind ?? "support") as "support" | "business",
      name: ticket.name!,
      email: ticket.email!,
      subject: ticket.subject!,
      message: ticket.message!,
      userId: ticket.userId ?? null,
      messageId: confirmedFirst.id!,
      // The same two facts the direct path sends — read back off the
      // ticket, because the confirm click arrives with neither. Without
      // these, every ticket that went through the holding queue (which is
      // every signed-out submission) reached the desk with no country and
      // no local time: no emergency number for the crisis script, no sense
      // of the customer's clock for the agent.
      country: ticket.country ?? null,
      timeZone: ticket.timeZone ?? null,
    });
    if (ticket.kind === "support" && !qdeskConfigured()) {
      await this.#tryAutoReply(ticket.id!, ticket.message!);
    }
    ctx.response.body = { ok: true };
  }

  /**
   * The help centre's articles. Public and unauthenticated by design —
   * this is published content, the same articles the assistant answers
   * from, and the point is that somebody can read them BEFORE opening a
   * ticket.
   */
  /**
   * Whether this account's support section is behind the grown-up PIN, and
   * whether this browser has already got past it.
   *
   * Asked on page load rather than inferred: `parentPinSet` is on the user
   * already, but whether the PIN has been *proved in this session* is
   * server state, and the page must not open before it knows. Cheap enough
   * to call every visit — one indexed count and a session read.
   */
  @http.GET("/_/support/gate")
  async supportGate(ctx: Context<RouterState & SessionState & AuthState>) {
    ctx.response.body = await supportGateStatus(ctx, ctx.state.user);
  }

  @http.GET("/_/support/help/articles")
  async helpArticles(ctx: Context<RouterState & AuthState>) {
    ctx.response.body = { articles: await fetchHelpArticles() };
  }

  @http.GET("/_/support/t/{token}")
  async getThread(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("token", pToken) token: string,
  ) {
    // A thread carries everything anyone has written into this ticket, so
    // it is gated like the rest of the section. Only for a signed-in
    // session, deliberately: the link is emailed, and a parent opening it
    // from their inbox on a device they are not signed in on must not be
    // asked for a PIN the page has no way to check.
    await requireParentPinForSupport(ctx, ctx.state.user);
    const ticket = await SupportTicket.findByThreadToken(token);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    if (!ticket.confirmed) {
      // Nothing about the ticket's content is revealed before confirmation
      // — the sender already knows what they wrote.
      ctx.response.body = { pending: true };
      return;
    }
    if (this.#threadExpired(ticket)) {
      ctx.response.status = 410;
      return;
    }
    const messages = (await SupportMessage.listForTicket(ticket.id!)).map((m) =>
      m.toDetails(),
    );
    // `reveal` stays false: the person already knows their own email, and
    // this keeps the response shape identical to every other ticket view.
    ctx.response.body = {
      ticket: ticket.toDetails({ reveal: false, messages }),
    };
  }

  #threadExpired(ticket: SupportTicket): boolean {
    return (
      ticket.closedAt != null &&
      Date.now() - new Date(ticket.closedAt).getTime() > threadLinkMs()
    );
  }

  @http.POST("/_/support/t/{token}/reply")
  async replyToThread(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("token", pToken) token: string,
    @body.json(PGuestMessage, jsonOpts) input: TGuestMessage,
  ) {
    // Same gate as reading the thread — writing into it is not a lesser act.
    await requireParentPinForSupport(ctx, ctx.state.user);
    const ticket = await SupportTicket.findByThreadToken(token);
    if (ticket == null || !ticket.confirmed) {
      ctx.response.status = 404;
      return;
    }
    if (this.#threadExpired(ticket)) {
      ctx.response.status = 410;
      return;
    }
    const guestReply = await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "them",
      body: input.message,
    });
    forwardReplyToQdesk(ticket.id!, input.message, guestReply.id!);
    // The sender writing again means the auto-reply (if any) didn't fully
    // solve it — credit the reopen to the article/rule that answered before
    // clearing the attribution, so a later close doesn't also credit a solve.
    if (ticket.autoAnswerId != null && ticket.autoRuleId != null) {
      await AnswerRule.incrementReopened(ticket.autoRuleId);
      await Answer.incrementReopened(ticket.autoAnswerId);
    }
    await ticket.clearAutoAttribution();
    // A reply from the person means staff needs to look again — "waiting on
    // them" (the chip's meaning from staff's point of view) no longer holds.
    // Only a reply after "closed" is a real reopen (a "waiting" ticket was
    // never resolved in the first place, so it doesn't count toward the
    // second-reopen-auto-flag threshold).
    let updated = ticket;
    if (ticket.status === "closed") {
      const siteSettings = await StaffSettings.siteDefault();
      updated = await ticket.reopen({
        autoFlag: Boolean(siteSettings.secondReopenAutoFlag),
      });
    } else if (ticket.status === "waiting") {
      updated = await ticket.setStatus("open");
    }
    const messages = (await SupportMessage.listForTicket(updated.id!)).map(
      (m) => m.toDetails(),
    );
    ctx.response.body = {
      ticket: updated.toDetails({ reveal: false, messages }),
    };
  }

  @http.POST("/_/support/t/{token}/resolve")
  async resolveThread(
    ctx: Context<RouterState & AuthState>,
    @pathParam("token", pToken) token: string,
  ) {
    const ticket = await SupportTicket.findByThreadToken(token);
    if (ticket == null || !ticket.confirmed) {
      ctx.response.status = 404;
      return;
    }
    if (this.#threadExpired(ticket)) {
      ctx.response.status = 410;
      return;
    }
    const closed = await ticket.setStatus("closed");
    await this.#creditAutoSolve(closed);
    await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "system",
      body: "Marked resolved by the sender.",
    });
    ctx.response.body = { ok: true };
  }

  // ── Public: answers library ──

  // ── Public: site-wide notices ──

  @http.GET("/_/support/notice")
  async getActiveNotices(
    ctx: Context<RouterState & AuthState>,
    @queryParam("audience", pAudience) audience: string | undefined,
  ) {
    const notices = await Notice.activeNotices(audience);
    // The desk's own notices, folded in. An incident posted where the
    // support team lives should reach the people it's about — the
    // site-wide banner and the support form both read this feed, so a
    // desk incident becomes "we know, no need to write in" everywhere at
    // once. Negative ids on purpose: the dismissal memory keys on id, a
    // desk notice must never collide with a local one, and this app's own
    // rows can never be negative. Cached and failure-tolerant inside the
    // fetcher — the desk being down never empties the local feed.
    // Every display travels: banners and windows for everyone, and the
    // poll and feedback cards (phase 3), which the client shows only to a
    // signed-in adult profile and this side accepts answers for only from
    // an account. Audience is applied the same way as for local rows.
    const deskNotices = (await fetchDeskNotices())
      .filter(
        (n) =>
          audience == null ||
          n.audience == null ||
          n.audience === "everyone" ||
          n.audience === audience,
      )
      .map((n) => ({
        id: -n.id,
        message: n.message,
        level: (n.kind === "feature" ? "info" : "warning") as
          | "info"
          | "warning",
        kind: n.kind,
        display: n.display,
        startsAt: null,
        endsAt: null,
        audience: n.audience ?? "everyone",
        dismissible: n.dismissible,
        options: n.options ?? null,
        showResults: n.showResults ?? true,
        askComment: n.askComment ?? true,
        createdAt: n.createdAt,
      }));
    ctx.response.body = {
      notices: [...notices.map((n) => n.toDetails()), ...deskNotices],
    };
    ctx.response.headers.set("Cache-Control", "public, max-age=30");
  }

  // ── Public, signed in: polls and feedback (control centre phase 3) ──

  /**
   * The account's own answer to a desk poll or feedback card, and the
   * running result when the card shows one. `id` is the desk's notice id
   * (positive; the feed negates it so the dismissal memory never collides).
   * Under `/_/support/my` so it reads the learner's own session, not the
   * desk's (see desk-session.ts).
   */
  @http.GET("/_/support/my/voice/{id}")
  async getLearnerResponse(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const user = ctx.state.requireUser();
    const notice = await fetchDeskNotice(id);
    const open =
      notice != null &&
      (notice.display === "poll" || notice.display === "feedback");
    const mine = await LearnerResponse.findFor(id, user.id!);
    ctx.response.body = {
      open,
      response: mine?.toDetails() ?? null,
      results:
        open && notice.showResults !== false
          ? await LearnerResponse.resultsFor(id)
          : null,
    };
    ctx.response.headers.set("Cache-Control", "private, no-store");
  }

  /**
   * One answer per account, changeable until the card closes. Votes are
   * per account, never per profile; the client never shows the card to a
   * kid profile, and this route only knows accounts, so there is no way
   * to count a child. A comment is personal data: the multiplayer
   * contact-detail detector runs on it and a comment that would take
   * someone off-platform is refused rather than stored (spec §8).
   */
  @http.PUT("/_/support/my/voice/{id}")
  async putLearnerResponse(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PLearnerResponse) input: TLearnerResponse,
  ) {
    const user = ctx.state.requireUser();
    rateLimit(ctx, "learner-response", 30, 60 * 60 * 1000);
    const notice = await fetchDeskNotice(id);
    if (
      notice == null ||
      (notice.display !== "poll" && notice.display !== "feedback")
    ) {
      throw new ApplicationError("This card has closed.");
    }
    let choice: number | null = null;
    let stars: number | null = null;
    let text: string | null = null;
    if (notice.display === "poll") {
      const options = notice.options ?? [];
      if (input.choice == null || input.choice >= options.length) {
        throw new ApplicationError("Pick one of the options.");
      }
      choice = input.choice;
    } else {
      if (input.stars == null) {
        throw new ApplicationError("Pick a star rating first.");
      }
      stars = input.stars;
      if (
        notice.askComment !== false &&
        input.text != null &&
        input.text !== ""
      ) {
        if (hasContactDetails(input.text)) {
          throw new ApplicationError(
            "Please leave contact details out of a comment. Staff read these, and your account already tells them who you are.",
          );
        }
        text = input.text;
      }
    }
    const saved = await LearnerResponse.upsert({
      noticeId: id,
      userId: user.id!,
      choice,
      stars,
      text,
    });
    ctx.response.body = {
      open: true,
      response: saved.toDetails(),
      results:
        notice.showResults !== false
          ? await LearnerResponse.resultsFor(id)
          : null,
    };
    ctx.response.headers.set("Cache-Control", "private, no-store");
  }

  // ── Staff: access status (unaudited — see doc comment) ──

  // ── Staff: ticket queue + threads ──

  /**
   * QDesk delivering a reply back to the customer through this repo's
   * own channels — the return leg of the forwarding bridge
   * (qdesk-forward.ts). QDesk is the system of record for the
   * conversation, but the mailer, the in-app notification badge, and the
   * guest thread view all live here, so an ops-side reply has to land
   * here to actually reach anyone. Ops-key gated, machine to machine —
   * the acting staff member's identity stays in QDesk's own audit log.
   */
  @http.POST("/_/internal/tickets/{id}/deliver-reply")
  async deliverOpsReply(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PDeliverReply, jsonOpts) input: TDeliverReply,
  ) {
    ctx.state.requireOpsApi();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    await SupportMessage.create({
      ticketId: id,
      sender: input.sender,
      body: input.body,
      emailed: ticket.userId == null,
      authorName: input.authorName ?? null,
      kind: input.kind ?? null,
      qdeskMessageId: input.qdeskMessageId ?? null,
    });
    // A crisis redirect is not a reply waiting on the customer — it goes
    // in front of a person, and "waiting on you" is the wrong thing to
    // tell somebody who has just been handed an emergency number.
    const status: SupportTicketStatus =
      input.kind === "crisis" ? "flagged" : input.close ? "closed" : "waiting";
    const updated = await ticket.setStatus(status);
    // A crisis reply is never announced.
    //
    // A notification is a banner, an unread badge, a line of preview text
    // on a lock screen — surfaces designed to be seen without the phone
    // being unlocked, which is precisely the wrong property when the
    // person may be reading with an aggressor beside them. The covert
    // script exists so the conversation looks unremarkable to anyone
    // glancing at it; a push saying "KeyLearn support replied" undoes
    // that from outside the app, where nothing we style can reach.
    //
    // They are already in the conversation — they wrote the message that
    // triggered this — so nothing is lost by staying quiet. A person has
    // been paged and is on the thread either way.
    if (input.kind !== "crisis") {
      void this.#notifyReply(
        ticket,
        input.body,
        input.authorName ?? null,
        input.sender === "agent",
      );
    }
    ctx.response.body = { ok: true, status: updated.status };
  }

  /**
   * A signed-in user already has an account to check, so a reply becomes a
   * small in-app badge instead of one more email — email is reserved for
   * a signed-out guest, whose thread link is their only way back into the
   * conversation at all. Best-effort either way: neither path may fail
   * the reply itself, which is already saved by the time this runs.
   */
  async #notifyReply(
    ticket: SupportTicket,
    body: string,
    /** Who the customer should see this reply from; null keeps the generic label. */
    authorName: string | null = null,
    /** Whether the assistant wrote it, so the bell can say so. */
    fromAssistant = false,
  ): Promise<void> {
    if (ticket.userId != null) {
      try {
        await Notification.create({
          userId: ticket.userId,
          kind: "ticket-reply",
          ticketId: ticket.id!,
          body,
          authorName,
          fromAssistant,
        });
      } catch {
        // Best-effort — see doc comment.
      }
      return;
    }
    try {
      // The token is minted before the send but the OLD one is revoked only
      // after it. Rotating first meant a failed send — an SMTP outage, a
      // provider rejecting this IP — destroyed the guest's only way back
      // into the conversation: the fresh link died in the catch below and
      // the link they already held had just been invalidated. Verified
      // live: the desk's reply landed, the mail failed, and the thread 404d
      // for its own customer. Send first; a link is only retired once its
      // replacement is actually on its way to them.
      const threadToken = SupportTicket.mintThreadToken();
      await this.mailer.sendMail(
        messageThreadReply({
          to: ticket.email!,
          subject: ticket.subject!,
          // Resolved here because an email has no renderer to do it
          // later: whatever is sent is what the recipient reads, forever.
          // UTC, because a guest has no account and therefore no zone we
          // could honour — and a time with a named zone is at least true
          // for everyone, which "10:39" is not.
          body: resolveDateMarks(body, { timeZone: "UTC" }),
          threadLink: this.#link(`/support/t/${threadToken}`),
          authorName,
        }),
      );
      await SupportTicket.adoptThreadToken(ticket.id!, threadToken);
    } catch {
      // Best-effort — see doc comment.
    }
  }

  // ── Staff: account lookup ──
  //
  // Structurally scoped: this query never selects, joins, or returns a
  // child profile's name/kind/avatar, any result/practice_session content
  // beyond a COUNT, or anything from ProfileData — the restriction is that
  // those columns are simply never reached, not filtered out afterwards.

  /**
   * What the account holder's own cancel page reads before showing anything
   * — read-only, so a mail client's link-prefetch can't itself cancel a
   * deletion the person never actually asked to stop.
   */
  @http.GET("/_/support/accounts/deletion/{token}")
  async getAccountDeletionByToken(
    ctx: Context<RouterState & AuthState>,
    @pathParam("token", pToken) token: string,
  ) {
    const request = await AccountDeletionRequest.findByCancelToken(token);
    if (request == null) {
      ctx.response.status = 404;
      return;
    }
    ctx.response.body = { deletionRequest: request.toDetails() };
  }

  /** The account holder's own cancel action — a deliberate POST, not the GET above. */
  @http.POST("/_/support/accounts/deletion/{token}/cancel")
  async cancelAccountDeletionByToken(
    ctx: Context<RouterState & AuthState>,
    @pathParam("token", pToken) token: string,
  ) {
    const request = await AccountDeletionRequest.findByCancelToken(token);
    if (request == null) {
      ctx.response.status = 404;
      return;
    }
    const cancelled = await request.cancel("self");
    void StaffAuditEvent.record({
      userId: null,
      action: "account-deletion-cancelled",
      detail: `account ${request.userId} — cancelled by account holder`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { deletionRequest: cancelled.toDetails() };
  }

  // ── Staff: dashboard ──

  // ── Staff: answers + rules CRUD ──

  // ── Staff: saved replies ──
  //
  // Shared canned-reply text, not a sensitive surface — unlike ticket
  // replies, notices and settings, changes here are not audited (matching
  // the /use endpoint's own reasoning below).

  // ── Staff + public: notices ──

  // ── Staff: settings ──

  // ── Staff: roster (read-only) ──

  // ── Staff: audit log ──
}
