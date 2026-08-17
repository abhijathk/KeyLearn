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
import { Env, listStaffEmails } from "@keylearn/config";
import {
  AccountDeletionRequest,
  AgentStatus,
  Answer,
  AnswerRule,
  Credential,
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
import { type NoticeKind } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { z } from "zod";
import {
  messageAccountDeletionRequested,
  messageBusinessEnquiry,
  messageConfirmSupportTicket,
  messageThreadReply,
  messageUrgentFlag,
} from "../auth/email.ts";
import { clientIp, rateLimit } from "../auth/ratelimit.ts";
import { staffAccessStatus } from "../auth/staff-access.ts";
import {
  recordFailure,
  requireCaptchaIfSuspicious,
} from "../auth/turnstile.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import { Mailer } from "../mail/index.ts";
import { matchAnswers } from "./matching.ts";
import { digestHour } from "./sweep.ts";

const jsonOpts = { maxLength: 4096 };

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a closed thread's guest link keeps working. */
const THREAD_EXPIRY_MS = 90 * DAY_MS;
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
  message: z.string().trim().min(1).max(4000),
  turnstileToken: z.string().max(4096).optional(),
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

const TGuestMessage = z.object({
  message: z.string().trim().min(1).max(4000),
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
    ctx: Context<RouterState & AuthState>,
    @body.json(PCreateTicket, jsonOpts) input: TCreateTicket,
  ) {
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
    await requireCaptchaIfSuspicious(ctx, input.turnstileToken);

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
      await SupportMessage.create({
        ticketId: dup.id!,
        sender: "them",
        body: input.message,
      });
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
    });

    if (confirmed) {
      // The ticket's own `message` column stays the cheap preview line for
      // the queue; the thread's actual first message is this same text.
      await SupportMessage.create({
        ticketId: ticket.id!,
        sender: "them",
        body: input.message,
      });
      if (input.kind === "support") {
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
    // staff) can actually read it.
    await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "them",
      body: ticket.message!,
    });
    if (ticket.kind === "support") {
      await this.#tryAutoReply(ticket.id!, ticket.message!);
    }
    ctx.response.body = { ok: true };
  }

  @http.GET("/_/support/t/{token}")
  async getThread(
    ctx: Context<RouterState & AuthState>,
    @pathParam("token", pToken) token: string,
  ) {
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
      Date.now() - new Date(ticket.closedAt).getTime() > THREAD_EXPIRY_MS
    );
  }

  @http.POST("/_/support/t/{token}/reply")
  async replyToThread(
    ctx: Context<RouterState & AuthState>,
    @pathParam("token", pToken) token: string,
    @body.json(PGuestMessage, jsonOpts) input: TGuestMessage,
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
    await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "them",
      body: input.message,
    });
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

  @http.GET("/_/support/answers")
  async listPublicAnswers(ctx: Context<RouterState & AuthState>) {
    const answers = await Answer.listPublished();
    ctx.response.body = answers.map((a) => a.toDetails());
  }

  @http.POST("/_/support/answers/suggest")
  async suggestAnswers(
    ctx: Context<RouterState & AuthState>,
    @body.json(PSuggest, jsonOpts) input: TSuggest,
  ) {
    rateLimit(ctx, "answers-suggest", 30, 60_000);
    const rules = await AnswerRule.listAll();
    const matches = matchAnswers(
      input.text,
      rules.map((r) => ({
        id: r.id!,
        answerId: r.answerId!,
        keywords: r.keywords!,
        suggestOnly: Boolean(r.suggestOnly),
      })),
    )
      .map((m) => {
        const rule = rules.find((r) => r.id === m.ruleId);
        return rule?.answer != null && Boolean(rule.answer.published)
          ? { score: m.score, answer: rule.answer.toDetails() }
          : null;
      })
      .filter((m) => m != null)
      .slice(0, 3);
    ctx.response.body = { matches };
  }

  // ── Public: site-wide notices ──

  @http.GET("/_/support/notice")
  async getActiveNotices(
    ctx: Context<RouterState & AuthState>,
    @queryParam("audience", pAudience) audience: string | undefined,
  ) {
    const notices = await Notice.activeNotices(audience);
    ctx.response.body = { notices: notices.map((n) => n.toDetails()) };
    ctx.response.headers.set("Cache-Control", "public, max-age=30");
  }

  // ── Staff: access status (unaudited — see doc comment) ──

  /**
   * Read-only status the staff sign-in screen polls after every sign-in
   * attempt — data instead of a thrown error, so the screen can tell
   * "wrong account" apart from "right account, no second factor yet"
   * instead of showing one generic failure for both. Never throws and
   * never audits: {@link requireStaff} is still the real, audited gate on
   * every endpoint below.
   */
  @http.GET("/_/support/desk/access")
  async deskAccess(ctx: Context<RouterState & AuthState>) {
    ctx.response.body = await staffAccessStatus(ctx.state.user);
  }

  // ── Staff: ticket queue + threads ──

  @http.GET("/_/support/tickets")
  async listTickets(
    ctx: Context<RouterState & AuthState>,
    @queryParam("kind", pKind) kind: SupportTicketKind | undefined,
    @queryParam("status", pStatus) status: SupportTicketStatus | undefined,
    @queryParam("archived", pArchived) archived: boolean | undefined,
    @queryParam("q", pQuery) q: string | undefined,
  ) {
    await ctx.state.requireStaff();
    const tickets = await SupportTicket.listQueue({
      kind,
      status,
      archived,
      q,
    });
    ctx.response.body = tickets.map((t) => t.toDetails());
  }

  @http.GET("/_/support/tickets/{id}")
  async getTicket(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const messages = (await SupportMessage.listForTicket(id)).map((m) =>
      m.toDetails(),
    );
    ctx.response.body = ticket.toDetails({ reveal: false, messages });
  }

  /**
   * The one deliberate way to see a submitter's real address. Everything
   * else that returns a ticket masks it — this is a separate, audited
   * action rather than a side effect of opening a thread.
   */
  @http.POST("/_/support/tickets/{id}/reveal-email")
  async revealEmail(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "reveal-email",
      detail: `ticket ${id}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { email: ticket.email };
  }

  /**
   * Posts a real thread message from staff — replaces the old single-slot
   * reply. Emails the reply to the ticket's real address with a freshly
   * minted thread link (the original plaintext token was only ever handed
   * out once, at the ticket's creation).
   */
  @http.POST("/_/support/tickets/{id}/reply")
  async postReply(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PStaffMessage, jsonOpts) input: TStaffMessage,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    await SupportMessage.create({
      ticketId: id,
      sender: "us",
      body: input.body,
      staffUserId: staff.id,
      emailed: true,
    });
    // Staff replied — now waiting on the person to respond next.
    const status: SupportTicketStatus = input.close ? "closed" : "waiting";
    const updated = await ticket.setStatus(status);
    if (status === "closed") {
      await this.#creditAutoSolve(updated);
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "reply-ticket",
      detail: `ticket ${id} → ${status}`,
      ip: clientIp(ctx),
    });

    void this.#notifyReply(ticket, input.body);

    const messages = (await SupportMessage.listForTicket(id)).map((m) =>
      m.toDetails(),
    );
    ctx.response.body = updated.toDetails({ reveal: false, messages });
  }

  /**
   * A signed-in user already has an account to check, so a reply becomes a
   * small in-app badge instead of one more email — email is reserved for
   * a signed-out guest, whose thread link is their only way back into the
   * conversation at all. Best-effort either way: neither path may fail
   * the reply itself, which is already saved by the time this runs.
   */
  async #notifyReply(ticket: SupportTicket, body: string): Promise<void> {
    if (ticket.userId != null) {
      try {
        await Notification.create({
          userId: ticket.userId,
          kind: "ticket-reply",
          ticketId: ticket.id!,
          body,
        });
      } catch {
        // Best-effort — see doc comment.
      }
      return;
    }
    try {
      const threadToken = await SupportTicket.reissueThreadToken(ticket.id!);
      await this.mailer.sendMail(
        messageThreadReply({
          to: ticket.email!,
          subject: ticket.subject!,
          body,
          threadLink: this.#link(`/support/t/${threadToken}`),
        }),
      );
    } catch {
      // Best-effort — see doc comment.
    }
  }

  /**
   * @deprecated Superseded by {@link postReply}, kept for backward safety.
   * Writes through the ticket's old single staffReply/repliedBy slot — does
   * not post a SupportMessage or send mail.
   */
  @http.PUT("/_/support/tickets/{id}")
  async replyToTicketLegacy(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PReply, jsonOpts) input: TReply,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const updated = await ticket.reply({
      staffUserId: staff.id!,
      reply: input.reply,
      status: input.status,
    });
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "reply-ticket",
      detail: `ticket ${id} → ${input.status}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = updated.toDetails();
  }

  /** A status-only move — "waiting on them", "close", "spam" — no reply sent. */
  @http.PUT("/_/support/tickets/{id}/status")
  async setTicketStatus(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PStatus, jsonOpts) input: TStatus,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const updated = await ticket.setStatus(input.status);
    if (input.status === "closed") {
      await this.#creditAutoSolve(updated);
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "ticket-status",
      detail: `ticket ${id} → ${input.status}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = updated.toDetails();
  }

  /** Hides (or restores) a ticket from the default Inbox view — its status, and everything else, is untouched. */
  @http.PUT("/_/support/tickets/{id}/archive")
  async setTicketArchived(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PArchive, jsonOpts) input: TArchive,
  ) {
    const staff = await ctx.state.requireStaff();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const updated = await ticket.setArchived(input.archived);
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "ticket-archived",
      detail: `ticket ${id} → ${input.archived ? "archived" : "unarchived"}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = updated.toDetails();
  }

  // ── Automation agent (machine credential, not staff) ──
  //
  // Every route below is gated by `requireSupportAgent()`, not
  // `requireStaff()` — a completely separate credential (see
  // `auth/middleware.ts`), narrower in what it can reach: read the queue
  // and a thread, post a reply, record a tone read, and flag a ticket.
  // Nothing here can close a ticket, reveal a masked email, or touch
  // settings/notices — those routes simply aren't exposed to this key.

  /**
   * Open tickets needing a look — same shape as the staff queue, but
   * "support" kind only. Business enquiries (sales/partnership) stay
   * entirely human-handled, same as today — never exposed to the agent.
   */
  @http.GET("/_/support/agent/queue")
  async agentQueue(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireSupportAgent();
    const tickets = await SupportTicket.listQueue({
      status: "open",
      kind: "support",
    });
    ctx.response.body = tickets.map((t) => t.toDetails());
  }

  /** A ticket's full thread — same shape the staff view returns. */
  @http.GET("/_/support/agent/tickets/{id}")
  async agentGetTicket(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    ctx.state.requireSupportAgent();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const messages = (await SupportMessage.listForTicket(id)).map((m) =>
      m.toDetails(),
    );
    ctx.response.body = ticket.toDetails({ reveal: false, messages });
  }

  /**
   * Posts a `sender: "agent"` reply — moves the ticket to "waiting", same
   * as a staff reply, and never to "closed": closing stays a human (or the
   * sender's own {@link resolveThread}) decision, on purpose.
   */
  @http.POST("/_/support/agent/tickets/{id}/reply")
  async agentReply(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAgentMessage, jsonOpts) input: TAgentMessage,
  ) {
    ctx.state.requireSupportAgent();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    await SupportMessage.create({
      ticketId: id,
      sender: "agent",
      body: input.body,
      emailed: ticket.userId == null,
      answerIds: input.usedAnswerIds,
    });
    const updated = await ticket.setStatus("waiting");
    void StaffAuditEvent.record({
      userId: null,
      action: "agent-reply",
      detail: `ticket ${id}`,
      ip: clientIp(ctx),
    });
    void this.#notifyReply(ticket, input.body);
    const messages = (await SupportMessage.listForTicket(id)).map((m) =>
      m.toDetails(),
    );
    ctx.response.body = updated.toDetails({ reveal: false, messages });
  }

  /**
   * Records the agent's tone read. A `critical` read escalates on its own
   * — the one sentiment-driven trigger the mock's design agreed to — a
   * `frustrated` read is visibility-only and doesn't touch the queue.
   */
  @http.POST("/_/support/agent/tickets/{id}/sentiment")
  async agentSentiment(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAgentSentiment, jsonOpts) input: TAgentSentiment,
  ) {
    ctx.state.requireSupportAgent();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const updated = await ticket.setSentiment(input.sentiment);
    if (input.sentiment === "critical") {
      await updated.setStatus("flagged");
    }
    void StaffAuditEvent.record({
      userId: null,
      action: "agent-sentiment",
      detail: `ticket ${id} → ${input.sentiment}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = updated.toDetails();
  }

  /**
   * Escalates a ticket with a reason. `urgent` tickets fire an immediate
   * alert to every staff address instead of waiting for the next daily
   * digest — see the mockup's step 05 "fires now" list (security/
   * account-takeover, child-safety, privacy/deletion, legal/regulatory, a
   * real-looking vulnerability report, a second reopen).
   */
  @http.POST("/_/support/agent/tickets/{id}/flag")
  async agentFlag(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAgentFlag, jsonOpts) input: TAgentFlag,
  ) {
    ctx.state.requireSupportAgent();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    const updated = await ticket.setStatus("flagged");
    void StaffAuditEvent.record({
      userId: null,
      action: "agent-flag",
      detail: `ticket ${id} — ${input.reason}`,
      ip: clientIp(ctx),
    });
    if (input.urgent) {
      void this.#sendUrgentAlert({
        subject: `Urgent: ${updated.subject}`,
        reason: input.reason,
        detail: `Ticket #${id} from ${updated.name} — flagged by Tab, not waiting for the daily digest.`,
        deskLink: this.#link(`/desk/t/${id}`),
      });
    }
    ctx.response.body = updated.toDetails();
  }

  /**
   * Marks a ticket spam after Tab has already redirected the same thread
   * once for off-topic content — posts a final message, then moves the
   * ticket to "spam" instead of "waiting". Unlike "closed"/"waiting",
   * "spam" is not reopened by a further reply (see `replyToThread`), so a
   * spammer replying again does not resurrect the ticket into anyone's
   * queue. A second spam-closed ticket from the same email within
   * {@link SPAM_WINDOW_MS} earns that address a temporary cooldown on new
   * submissions ({@link SupportBlock}); a repeat after an earlier cooldown
   * escalates to a staff alert instead of re-blocking automatically —
   * Tab does not enforce a permanent ban unattended.
   */
  @http.POST("/_/support/agent/tickets/{id}/close-spam")
  async agentCloseSpam(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAgentMessage, jsonOpts) input: TAgentMessage,
  ) {
    ctx.state.requireSupportAgent();
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      ctx.response.status = 404;
      return;
    }
    await SupportMessage.create({
      ticketId: id,
      sender: "agent",
      body: input.body,
      emailed: ticket.userId == null,
    });
    const updated = await ticket.setStatus("spam");
    void StaffAuditEvent.record({
      userId: null,
      action: "agent-close-spam",
      detail: `ticket ${id}`,
      ip: clientIp(ctx),
    });
    void this.#notifyReply(ticket, input.body);

    const since = new Date(Date.now() - SPAM_WINDOW_MS);
    const recentSpamCount = await SupportTicket.query()
      .whereRaw("lower(email) = ?", [ticket.email!.toLowerCase()])
      .where("status", "spam")
      .where("updatedAt", ">=", since)
      .resultSize();

    if (recentSpamCount >= 2) {
      const existingBlock = await SupportBlock.currentFor(ticket.email!);
      if (existingBlock != null && (existingBlock.blockCount ?? 0) >= 1) {
        void this.#sendUrgentAlert({
          subject: `Repeated spam from ${ticket.email}`,
          reason:
            "Repeated off-topic/spam tickets after an earlier cooldown — needs a permanent-ban decision",
          detail: `Ticket #${id} from ${updated.name} — this address has already earned a cooldown ${existingBlock.blockCount} time(s) before. Tab will not re-block automatically; a human needs to decide on a permanent block.`,
          deskLink: this.#link(`/desk/t/${id}`),
        });
      } else {
        await SupportBlock.applyBlock(
          ticket.email!,
          SPAM_BLOCK_DURATION_MS,
          "Repeated off-topic/spam tickets",
        );
      }
    }

    ctx.response.body = updated.toDetails();
  }

  /**
   * The one place an urgent staff alert actually goes out — best-effort,
   * one email per `STAFF_EMAILS` address, never allowed to fail the
   * request that triggered it.
   */
  async #sendUrgentAlert({
    subject,
    reason,
    detail,
    deskLink,
  }: {
    readonly subject: string;
    readonly reason: string;
    readonly detail: string;
    readonly deskLink: string;
  }): Promise<void> {
    try {
      await Promise.all(
        listStaffEmails().map((to) =>
          this.mailer.sendMail(
            messageUrgentFlag({ to, subject, reason, detail, deskLink }),
          ),
        ),
      );
    } catch {
      // Best-effort — see doc comment.
    }
  }

  /**
   * Called the moment the triage flow first sees a quota/rate-limit
   * response from Groq — fires once, not once per failed ticket
   * ({@link AgentStatus.pause} no-ops if already paused), and reads the
   * same way the kill switch being off does: every ticket from here
   * routes straight to the human queue until {@link agentQuotaClear}.
   */
  @http.POST("/_/support/agent/quota-alert")
  async agentQuotaAlert(
    ctx: Context<RouterState & AuthState>,
    @body.json(PAgentQuota, jsonOpts) input: TAgentQuota,
  ) {
    ctx.state.requireSupportAgent();
    const wasAlreadyPaused = (await AgentStatus.current()).pausedSince != null;
    const status = await AgentStatus.pause(input.model);
    if (!wasAlreadyPaused) {
      void StaffAuditEvent.record({
        userId: null,
        action: "agent-quota-paused",
        detail: `model ${input.model}`,
        ip: clientIp(ctx),
      });
      void this.#sendUrgentAlert({
        subject: `Tab is paused — quota reached on ${input.model}`,
        reason: `${input.model} hit its request limit.`,
        detail:
          "Automation has stopped — every new ticket is routing directly to your inbox, untouched, exactly as if the kill switch were off. Resets automatically, or check Settings → Automation.",
        deskLink: this.#link("/desk/settings"),
      });
    }
    ctx.response.body = { pausedSince: status.pausedSince };
  }

  /** Called once the agent successfully processes a ticket again. */
  @http.POST("/_/support/agent/quota-clear")
  async agentQuotaClear(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireSupportAgent();
    await AgentStatus.clear();
    ctx.response.body = { ok: true };
  }

  /** The Settings page's paused-state banner (mockup step 11) and kill switch. */
  @http.GET("/_/support/desk/quota-status")
  async deskQuotaStatus(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const status = await AgentStatus.current();
    ctx.response.body = {
      pausedSince:
        status.pausedSince != null
          ? new Date(status.pausedSince).toISOString()
          : null,
      pausedModel: status.pausedModel,
      enabled: status.enabled ?? true,
    };
  }

  /**
   * The staff kill switch (mockup step 07) — independent of the quota
   * pause. Off routes every ticket straight to the human queue, same as a
   * quota pause, until switched back on.
   */
  @http.POST("/_/support/desk/automation-enabled")
  async deskSetAutomationEnabled(
    ctx: Context<RouterState & AuthState>,
    @body.json(PDeskAutomationEnabled, jsonOpts)
    input: TDeskAutomationEnabled,
  ) {
    const staff = await ctx.state.requireStaff();
    const status = await AgentStatus.setEnabled(input.enabled);
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "automation-toggled",
      detail: input.enabled ? "on" : "off",
      ip: clientIp(ctx),
    });
    ctx.response.body = { enabled: status.enabled ?? true };
  }

  /**
   * Read-only: whether the triage flow should even start this run. Checked
   * once at the top of every `triage.mjs` pass — same "routes to human,
   * nothing in flight is lost" behavior as a quota pause, just staff-driven
   * instead of Groq-driven.
   */
  @http.GET("/_/support/agent/status")
  async agentAutomationStatus(ctx: Context<RouterState & AuthState>) {
    ctx.state.requireSupportAgent();
    const status = await AgentStatus.current();
    ctx.response.body = {
      enabled: (status.enabled ?? true) && status.pausedSince == null,
    };
  }

  // ── Staff: account lookup ──
  //
  // Structurally scoped: this query never selects, joins, or returns a
  // child profile's name/kind/avatar, any result/practice_session content
  // beyond a COUNT, or anything from ProfileData — the restriction is that
  // those columns are simply never reached, not filtered out afterwards.

  @http.GET("/_/support/accounts")
  async lookupAccounts(
    ctx: Context<RouterState & AuthState>,
    @queryParam("query", pQuery) query: string | undefined,
  ) {
    const staff = await ctx.state.requireStaff();
    const term = query?.trim();
    // Empty query: the search screen's placeholder state shows the 10 most
    // recently registered accounts rather than a blank page — same query
    // shape, just no `where`, so it's still a real lookup for the audit log.
    const users = await (term
      ? User.query()
          .withGraphFetched("externalIds")
          .where((q) =>
            q
              .where("email", "like", `%${term}%`)
              .orWhere("name", "like", `%${term}%`),
          )
          .orderBy("createdAt", "desc")
          .limit(20)
      : User.query()
          .withGraphFetched("externalIds")
          .orderBy("createdAt", "desc")
          .limit(10));

    const results = await Promise.all(
      users.map(async (u) => {
        const profileCount = await Profile.query()
          .where("userId", u.id!)
          .resultSize();
        const lastLogin = await SecurityEvent.query()
          .where({ userId: u.id!, type: "login" })
          .orderBy("createdAt", "desc")
          .first();
        return {
          id: u.id!,
          name: u.name!,
          email: maskEmail(u.email!),
          emailVerified: Boolean(u.emailVerified),
          createdAt: new Date(u.createdAt!).toISOString(),
          signInMethod: deriveSignInMethod(u),
          profileCount,
          lastSeen:
            lastLogin?.createdAt != null
              ? new Date(lastLogin.createdAt).toISOString()
              : null,
        };
      }),
    );

    void StaffAuditEvent.record({
      userId: staff.id,
      action: "account-lookup",
      detail: term ? term.slice(0, 120) : "(recent, no query)",
      ip: clientIp(ctx),
    });
    ctx.response.body = results;
  }

  /** How many accounts exist, for the search screen's "N registered" stat. */
  @http.GET("/_/support/accounts/total")
  async getAccountsTotal(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    ctx.response.body = { total: await User.query().resultSize() };
  }

  /**
   * One account's facts — same scope as {@link lookupAccounts}, just for a
   * single id: never a profile's name/kind/avatar, never lesson or typing
   * content. The support-ticket list below is subject/status/date only, the
   * same shape the Inbox itself shows, not message bodies.
   */
  @http.GET("/_/support/accounts/{id}")
  async getAccount(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const staff = await ctx.state.requireStaff();
    const user = await User.query()
      .withGraphFetched("externalIds")
      .findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    const profileCount = await Profile.query().where("userId", id).resultSize();
    const lastLogin = await SecurityEvent.query()
      .where({ userId: id, type: "login" })
      .orderBy("createdAt", "desc")
      .first();
    const tickets = await SupportTicket.query()
      .where("userId", id)
      .orderBy("createdAt", "desc")
      .limit(10);
    const siteSettings = await StaffSettings.siteDefault();
    const showLocation = siteSettings.toDetails().showLastLoginLocation;
    const deletionRequest = await AccountDeletionRequest.findPendingForUser(id);

    void StaffAuditEvent.record({
      userId: staff.id,
      action: "account-viewed",
      detail: `account ${id}`,
      ip: clientIp(ctx),
    });

    ctx.response.body = {
      id: user.id!,
      name: user.name!,
      email: maskEmail(user.email!),
      emailVerified: Boolean(user.emailVerified),
      createdAt: new Date(user.createdAt!).toISOString(),
      signInMethod: deriveSignInMethod(user),
      signupCountry: user.signupCountry ?? null,
      locale: user.locale ?? null,
      profileCount,
      lastLogin:
        lastLogin == null
          ? null
          : {
              at: new Date(lastLogin.createdAt!).toISOString(),
              ip: showLocation ? (lastLogin.ip ?? null) : null,
              userAgent: showLocation ? (lastLogin.userAgent ?? null) : null,
            },
      tickets: tickets.map((t) => ({
        id: t.id!,
        subject: t.subject!,
        status: t.status!,
        createdAt: new Date(t.createdAt!).toISOString(),
      })),
      deletionRequest: deletionRequest?.toDetails() ?? null,
    };
  }

  /**
   * Starts the 48-hour cooling-off window and emails the account holder —
   * a reason is mandatory (staff accountability, same rule the reveal-email
   * endpoint already enforces when the setting is on) even though it isn't
   * repeated back to the customer verbatim; the email states plainly what's
   * happening and how to stop it.
   */
  @http.POST("/_/support/accounts/{id}/request-deletion")
  async requestAccountDeletion(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAccountRequestDeletion, jsonOpts)
    input: TAccountRequestDeletion,
  ) {
    const staff = await ctx.state.requireStaff();
    const user = await User.findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    if (user.email == null) {
      throw new ApplicationError(
        "This account has no email address to notify.",
      );
    }
    const existing = await AccountDeletionRequest.findPendingForUser(id);
    if (existing != null) {
      throw new ApplicationError(
        "A deletion is already scheduled for this account.",
      );
    }
    const { request, cancelToken } = await AccountDeletionRequest.request({
      userId: id,
      requestedByUserId: staff.id ?? null,
      reason: input.reason,
    });
    await this.mailer.sendMail(
      messageAccountDeletionRequested({
        email: user.email,
        when: new Date(request.executeAt!).toLocaleString(undefined, {
          dateStyle: "long",
          timeStyle: "short",
        }),
        cancelLink: this.#link(`/support/deletion-cancel/${cancelToken}`),
        contactLink: this.#link("/support"),
      }),
    );
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "account-deletion-requested",
      detail: `account ${id} — ${input.reason}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { deletionRequest: request.toDetails() };
  }

  /** Staff-side cancel — the account holder has their own token-based link, see {@link cancelAccountDeletionByToken}. */
  @http.POST("/_/support/accounts/{id}/cancel-deletion")
  async cancelAccountDeletion(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAccountRequestDeletion, jsonOpts)
    input: TAccountRequestDeletion,
  ) {
    const staff = await ctx.state.requireStaff();
    const pending = await AccountDeletionRequest.findPendingForUser(id);
    if (pending == null) {
      ctx.response.status = 404;
      return;
    }
    const cancelled = await pending.cancel("staff");
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "account-deletion-cancelled",
      detail: `account ${id} — ${input.reason}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { deletionRequest: cancelled.toDetails() };
  }

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

  /** The one deliberate, audited way to see a registered account's real address. */
  @http.POST("/_/support/accounts/{id}/reveal-email")
  async revealAccountEmail(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAccountReveal, jsonOpts) input: TAccountReveal,
  ) {
    const staff = await ctx.state.requireStaff();
    const user = await User.findById(id);
    if (user == null) {
      ctx.response.status = 404;
      return;
    }
    const siteSettings = await StaffSettings.siteDefault();
    const reason = input.reason?.trim();
    if (siteSettings.toDetails().requireRevealReason && !reason) {
      throw new ApplicationError(
        "A reason is required to reveal this address.",
      );
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "account-email-revealed",
      detail: reason ? `account ${id} — ${reason}` : `account ${id}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { email: user.email };
  }

  // ── Staff: dashboard ──

  @http.GET("/_/support/desk/dashboard")
  async getDashboardStats(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    ctx.response.body = await getDashboard();
  }

  // ── Staff: answers + rules CRUD ──

  @http.GET("/_/support/desk/answers")
  async listAllAnswers(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const answers = await Answer.query().orderBy("createdAt", "desc");
    ctx.response.body = answers.map((a) => a.toDetails());
  }

  @http.POST("/_/support/desk/answers")
  async createAnswer(
    ctx: Context<RouterState & AuthState>,
    @body.json(PAnswerCreate, jsonOpts) input: TAnswerCreate,
  ) {
    const staff = await ctx.state.requireStaff();
    const answer = await Answer.create({
      title: input.title,
      body: input.body,
      published: input.published,
      createdBy: staff.id,
    });
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "answer-changed",
      detail: `created "${input.title.slice(0, 100)}"`,
      ip: clientIp(ctx),
    });
    ctx.response.body = answer.toDetails();
  }

  @http.PUT("/_/support/desk/answers/{id}")
  async updateAnswer(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PAnswerUpdate, jsonOpts) input: TAnswerUpdate,
  ) {
    const staff = await ctx.state.requireStaff();
    const answer = await Answer.update(id, input);
    if (answer == null) {
      ctx.response.status = 404;
      return;
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "answer-changed",
      detail: `updated answer ${id}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = answer.toDetails();
  }

  @http.GET("/_/support/desk/rules")
  async listRules(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const rules = await AnswerRule.listAll();
    ctx.response.body = rules.map((r) => r.toDetails());
  }

  @http.POST("/_/support/desk/rules")
  async createRule(
    ctx: Context<RouterState & AuthState>,
    @body.json(PRuleCreate, jsonOpts) input: TRuleCreate,
  ) {
    const staff = await ctx.state.requireStaff();
    const created = await AnswerRule.create({
      answerId: input.answerId,
      keywords: input.keywords,
      suggestOnly: input.suggestOnly,
    });
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "rule-changed",
      detail: `created rule for answer ${input.answerId}`,
      ip: clientIp(ctx),
    });
    const withAnswer = await AnswerRule.query()
      .withGraphFetched("answer")
      .findById(created.id!);
    ctx.response.body = (withAnswer ?? created).toDetails();
  }

  @http.PUT("/_/support/desk/rules/{id}")
  async updateRule(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PRuleUpdate, jsonOpts) input: TRuleUpdate,
  ) {
    const staff = await ctx.state.requireStaff();
    const updated = await AnswerRule.update(id, input);
    if (updated == null) {
      ctx.response.status = 404;
      return;
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "rule-changed",
      detail: `updated rule ${id}`,
      ip: clientIp(ctx),
    });
    const withAnswer = await AnswerRule.query()
      .withGraphFetched("answer")
      .findById(id);
    ctx.response.body = (withAnswer ?? updated).toDetails();
  }

  // ── Staff: saved replies ──
  //
  // Shared canned-reply text, not a sensitive surface — unlike ticket
  // replies, notices and settings, changes here are not audited (matching
  // the /use endpoint's own reasoning below).

  @http.GET("/_/support/desk/saved-replies")
  async listSavedReplies(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const replies = await SavedReply.listAll();
    ctx.response.body = replies.map((r) => r.toDetails());
  }

  @http.POST("/_/support/desk/saved-replies")
  async createSavedReply(
    ctx: Context<RouterState & AuthState>,
    @body.json(PSavedReplyCreate, jsonOpts) input: TSavedReplyCreate,
  ) {
    const staff = await ctx.state.requireStaff();
    const reply = await SavedReply.create({
      title: input.title,
      body: input.body,
      createdBy: staff.id,
    });
    ctx.response.body = reply.toDetails();
  }

  @http.PUT("/_/support/desk/saved-replies/{id}")
  async updateSavedReply(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PSavedReplyUpdate, jsonOpts) input: TSavedReplyUpdate,
  ) {
    await ctx.state.requireStaff();
    const reply = await SavedReply.update(id, input);
    if (reply == null) {
      ctx.response.status = 404;
      return;
    }
    ctx.response.body = reply.toDetails();
  }

  /** Called when staff actually inserts a saved reply into an outgoing message. */
  @http.POST("/_/support/desk/saved-replies/{id}/use")
  async useSavedReply(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    await ctx.state.requireStaff();
    await SavedReply.incrementUsed(id);
    ctx.response.status = 204;
  }

  // ── Staff + public: notices ──

  @http.GET("/_/support/desk/notices")
  async listAllNotices(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const notices = await Notice.query().orderBy("createdAt", "desc");
    ctx.response.body = notices.map((n) => n.toDetails());
  }

  @http.POST("/_/support/notices")
  async createNotice(
    ctx: Context<RouterState & AuthState>,
    @body.json(PNoticeCreate, jsonOpts) input: TNoticeCreate,
  ) {
    const staff = await ctx.state.requireStaff();
    const notice = await Notice.create({
      message: input.message,
      level: input.level,
      kind: input.kind as NoticeKind | undefined,
      display: input.display,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      audience: input.audience,
      dismissible: input.dismissible,
      createdBy: staff.id!,
    });
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "notice-published",
      detail: input.message.slice(0, 120),
      ip: clientIp(ctx),
    });
    ctx.response.body = notice.toDetails();
  }

  @http.PUT("/_/support/notices/{id}")
  async updateNotice(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @body.json(PNoticeUpdate, jsonOpts) input: TNoticeUpdate,
  ) {
    const staff = await ctx.state.requireStaff();
    const { active, ...fields } = input;

    if (active != null) {
      await Notice.setActive(id, active);
      if (!active) {
        void StaffAuditEvent.record({
          userId: staff.id,
          action: "notice-retracted",
          detail: `notice ${id}`,
          ip: clientIp(ctx),
        });
      }
    }

    const hasFieldPatch = Object.values(fields).some((v) => v !== undefined);
    let notice: Notice | null;
    if (hasFieldPatch) {
      notice = await Notice.update(id, fields);
      if (notice != null) {
        void StaffAuditEvent.record({
          userId: staff.id,
          action: "notice-updated",
          detail: `notice ${id}`,
          ip: clientIp(ctx),
        });
      }
    } else {
      notice = (await Notice.query().findById(id)) ?? null;
    }

    if (notice == null) {
      ctx.response.status = 404;
      return;
    }
    ctx.response.body = notice.toDetails();
  }

  /** Permanently removes a notice — distinct from retracting it (PUT .../active), which keeps the row. */
  @http.DELETE("/_/support/notices/{id}")
  async deleteNotice(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const staff = await ctx.state.requireStaff();
    const deleted = await Notice.delete(id);
    if (!deleted) {
      ctx.response.status = 404;
      return;
    }
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "notice-deleted",
      detail: `notice ${id}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = { ok: true };
  }

  // ── Staff: settings ──

  @http.GET("/_/support/desk/settings")
  async getSettings(ctx: Context<RouterState & AuthState>) {
    const staff = await ctx.state.requireStaff();
    const settings = await StaffSettings.getForUser(staff.id!);
    ctx.response.body = settings.toDetails();
  }

  @http.PUT("/_/support/desk/settings")
  async updateSettings(
    ctx: Context<RouterState & AuthState>,
    @body.json(PSettings, jsonOpts) input: TSettings,
  ) {
    const staff = await ctx.state.requireStaff();
    const settings = await StaffSettings.upsert(staff.id!, input);
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "settings-changed",
      detail: null,
      ip: clientIp(ctx),
    });
    ctx.response.body = settings.toDetails();
  }

  // ── Staff: roster (read-only) ──

  /**
   * Who's allowlisted and what proves their identity — not editable here,
   * see `deskSettings.notHere.staff`. An address with no account yet still
   * appears, since it lists who's *allowed*, not just who's signed in.
   */
  @http.GET("/_/support/desk/staff")
  async listStaffRoster(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const roster = await Promise.all(
      listStaffEmails().map(async (email) => {
        const user = await User.findByEmail(email);
        if (user == null) {
          return {
            email,
            name: null,
            hasPasskey: false,
            hasAuthenticator: false,
            lastSignedInAt: null,
          };
        }
        const [credentials, lastLogin] = await Promise.all([
          Credential.listForUser(user.id!),
          SecurityEvent.lastOfType(user.id!, "login"),
        ]);
        return {
          email,
          name: user.name ?? null,
          hasPasskey: credentials.length > 0,
          hasAuthenticator: Boolean(user.totpEnabled),
          lastSignedInAt:
            lastLogin != null
              ? new Date(lastLogin.createdAt!).toISOString()
              : null,
        };
      }),
    );
    ctx.response.body = roster;
  }

  // ── Staff: audit log ──

  /** Read-only. Nothing on the desk edits or deletes a row here. */
  @http.GET("/_/support/audit")
  async listAudit(ctx: Context<RouterState & AuthState>) {
    await ctx.state.requireStaff();
    const events = await StaffAuditEvent.listRecent(100);
    const userIds = [
      ...new Set(events.map((e) => e.userId).filter((id) => id != null)),
    ] as number[];
    const users = await User.loadAll(userIds);
    ctx.response.body = events.map((e) =>
      e.toDetails(
        e.userId != null ? (users.get(e.userId)?.name ?? null) : null,
      ),
    );
  }
}
