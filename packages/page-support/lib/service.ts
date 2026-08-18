import {
  type AccountDeletionRequestDetails,
  type AnswerDetails,
  type AnswerRuleDetails,
  DESK_SESSION_HEADER,
  type NoticeDetails,
  type NoticeDisplay,
  type NoticeKind,
  type SavedReplyDetails,
  type StaffAuditEventDetails,
  type StaffRosterEntry,
  type StaffSettingsDetails,
  type SupportTicketDetails,
} from "@keylearn/pages-shared";
import { expectType, request } from "@keylearn/request";
import { startAuthentication } from "@simplewebauthn/browser";

export type TicketKind = "support" | "business";
export type TicketStatus =
  | "open"
  | "flagged"
  | "waiting"
  | "closed"
  | "spam"
  | "holding";

export type DeskAccessReason = "signed-out" | "not-staff" | "needs-2fa";
export type DeskAccessStatus =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: DeskAccessReason };

export type PasswordLoginResult =
  | { readonly ok: true }
  | { readonly twoFactor: true }
  | { readonly verify: true; readonly email: string };

export type CreateTicketInput = {
  readonly kind: TicketKind;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly turnstileToken?: string;
  /** Honeypot field — always left blank by a real visitor. */
  readonly website?: string;
};

/** One day's aggregation bucket, e.g. `byCountry`/`byLanguage`. */
export type CountedBucket = { readonly name: string; readonly count: number };

/** `GET /_/support/desk/dashboard`'s shape — see the server's `DashboardData`. */
export type DashboardStats = {
  readonly accountsTotal: number;
  readonly newLast7Days: number;
  readonly avgLoginsPerActiveUserPerWeek: number;
  readonly avgSessionsPerActiveUserPerWeek: number;
  readonly signupTrend: readonly number[];
  readonly signupTrendToday: readonly number[];
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
  readonly automation: {
    readonly autoResolved: number;
    readonly escalated: number;
    readonly reopened: number;
    readonly autoResolvedPct: number;
    readonly escalatedPct: number;
    readonly reopenedPct: number;
  };
  readonly topCountry: string | null;
  readonly digestHour: number;
  readonly urgent: {
    readonly count: number;
    readonly ticketId: number;
    readonly subject: string;
    readonly ageHours: number;
  } | null;
  readonly notices: readonly {
    readonly id: number;
    readonly message: string;
    readonly kind: NoticeKind;
    readonly dismissible: boolean;
    readonly createdAt: string;
  }[];
  readonly computedAt: string;
};

/**
 * A registered account's basic details, deliberately scoped: never a child
 * profile's name/avatar/activity, never typing or practice data — see the
 * controller's `lookupAccounts`, which never selects those columns at all.
 */
export type AccountLookupResult = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly createdAt: string;
  readonly signInMethod: string;
  readonly profileCount: number;
  readonly lastSeen: string | null;
};

/** One account's full facts, opened from a search result — same scope as {@link AccountLookupResult}. */
export type AccountDetails = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly createdAt: string;
  readonly signInMethod: string;
  readonly signupCountry: string | null;
  readonly locale: string | null;
  readonly profileCount: number;
  readonly lastLogin: {
    readonly at: string;
    readonly ip: string | null;
    readonly userAgent: string | null;
  } | null;
  readonly tickets: readonly {
    readonly id: number;
    readonly subject: string;
    readonly status: TicketStatus;
    readonly createdAt: string;
  }[];
  readonly deletionRequest: AccountDeletionRequestDetails | null;
};

export type CreateNoticeInput = {
  readonly message: string;
  readonly kind?: NoticeKind;
  readonly display?: NoticeDisplay;
  readonly startsAt?: string | null;
  readonly endsAt?: string | null;
  readonly audience?: string;
  readonly dismissible?: boolean;
};

export type UpdateNoticeInput = {
  readonly message?: string;
  readonly kind?: NoticeKind;
  readonly display?: NoticeDisplay;
  readonly startsAt?: string | null;
  readonly endsAt?: string | null;
  readonly audience?: string;
  readonly dismissible?: boolean;
  readonly active?: boolean;
};

/** One published article from the desk's knowledge base. */
export type HelpArticle = {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly updatedAt: string;
};

/** What the customer's own thread view gets back — the ticket plus its messages. */
export type ThreadView = SupportTicketDetails;

export namespace SupportService {
  /**
   * The customer's own conversation, addressed by the unguessable token
   * from their email rather than a session — a signed-out guest has no
   * other way back in.
   */
  /** The published help articles. Public — no session needed. */
  export async function listHelpArticles(): Promise<readonly HelpArticle[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/help/articles")
      .send();
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as {
      readonly articles?: readonly HelpArticle[];
    };
    return body.articles ?? [];
  }

  export async function getThread(
    token: string,
  ): Promise<{ readonly ticket?: ThreadView; readonly pending?: boolean }> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/t/${encodeURIComponent(token)}`)
      .send();
    if (!response.ok) {
      throw new Error(`thread ${response.status}`);
    }
    return (await response.json()) as {
      readonly ticket?: ThreadView;
      readonly pending?: boolean;
    };
  }

  export async function replyToThread(
    token: string,
    message: string,
  ): Promise<{ readonly ticket?: ThreadView }> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/t/${encodeURIComponent(token)}/reply`)
      .send({ message });
    if (!response.ok) {
      throw new Error(`reply ${response.status}`);
    }
    return (await response.json()) as { readonly ticket?: ThreadView };
  }

  export async function createTicket(input: CreateTicketInput): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST("/_/support/tickets")
      .send(input);
  }

  export async function listTickets({
    kind,
    status,
    archived,
    q,
  }: {
    readonly kind?: TicketKind;
    readonly status?: TicketStatus;
    /** Omitted or false: the default Inbox view, archived tickets hidden. True: only archived tickets. */
    readonly archived?: boolean;
    readonly q?: string;
  } = {}): Promise<SupportTicketDetails[]> {
    const query = new URLSearchParams();
    if (kind != null) {
      query.set("kind", kind);
    }
    if (status != null) {
      query.set("status", status);
    }
    if (archived != null) {
      query.set("archived", String(archived));
    }
    if (q != null && q.trim() !== "") {
      query.set("q", q.trim());
    }
    const qs = query.toString();
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/tickets${qs ? `?${qs}` : ""}`)
      .send();
    return (await response.json()) as SupportTicketDetails[];
  }

  /** Hides (or restores) a ticket from the default Inbox view — its status is untouched. */
  export async function setTicketArchived(
    id: number,
    archived: boolean,
  ): Promise<SupportTicketDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/tickets/${id}/archive`)
      .send({ archived });
    return (await response.json()) as SupportTicketDetails;
  }

  export async function getTicket(id: number): Promise<SupportTicketDetails> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/tickets/${id}`)
      .send();
    return (await response.json()) as SupportTicketDetails;
  }

  /**
   * Posts a real thread message from staff — replaces the ticket's old
   * single-slot reply. `close: true` closes the ticket in the same move
   * ("Reply and close"); otherwise it moves to "waiting" (on them, next).
   */
  export async function postReply(
    id: number,
    input: { readonly body: string; readonly close?: boolean },
  ): Promise<SupportTicketDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/tickets/${id}/reply`)
      .send(input);
    return (await response.json()) as SupportTicketDetails;
  }

  /** A status-only move — "waiting on them", "close", "spam" — no reply sent. */
  export async function setTicketStatus(
    id: number,
    status: TicketStatus,
  ): Promise<SupportTicketDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/tickets/${id}/status`)
      .send({ status });
    return (await response.json()) as SupportTicketDetails;
  }

  /** The one deliberate, audited way to see a submitter's real address. */
  export async function revealEmail(id: number): Promise<string> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/tickets/${id}/reveal-email`)
      .send({});
    return ((await response.json()) as { email: string }).email;
  }

  /**
   * Basic account lookup, scoped per the mock's "reads messages, not
   * users" rule — never a child profile's name, avatar or activity, never
   * typing/practice data. Every call is written to the audit log
   * server-side.
   */
  /** Empty `query`: the 10 most recently registered accounts, not nothing. */
  export async function lookupAccounts(
    query: string,
  ): Promise<AccountLookupResult[]> {
    const term = query.trim();
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/accounts?query=${encodeURIComponent(term)}`)
      .send();
    return (await response.json()) as AccountLookupResult[];
  }

  /** How many accounts exist, for the search screen's "N registered" stat. */
  export async function getAccountsTotal(): Promise<number> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/accounts/total")
      .send();
    return ((await response.json()) as { total: number }).total;
  }

  export async function getAccount(id: number): Promise<AccountDetails> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/accounts/${id}`)
      .send();
    return (await response.json()) as AccountDetails;
  }

  /** The one deliberate, audited way to see a registered account's real address. */
  export async function revealAccountEmail(
    id: number,
    reason?: string,
  ): Promise<string> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/accounts/${id}/reveal-email`)
      .send({ reason });
    return ((await response.json()) as { email: string }).email;
  }

  /** Starts the 48-hour cooling-off window and emails the account holder. */
  export async function requestAccountDeletion(
    id: number,
    reason: string,
  ): Promise<AccountDeletionRequestDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/accounts/${id}/request-deletion`)
      .send({ reason });
    return (
      (await response.json()) as {
        deletionRequest: AccountDeletionRequestDetails;
      }
    ).deletionRequest;
  }

  export async function cancelAccountDeletion(
    id: number,
    reason: string,
  ): Promise<AccountDeletionRequestDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/accounts/${id}/cancel-deletion`)
      .send({ reason });
    return (
      (await response.json()) as {
        deletionRequest: AccountDeletionRequestDetails;
      }
    ).deletionRequest;
  }

  /** The account holder's own view of a deletion, reached via the emailed cancel link — no staff auth. */
  export async function getAccountDeletionByToken(
    token: string,
  ): Promise<AccountDeletionRequestDetails> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/accounts/deletion/${token}`)
      .send();
    return (
      (await response.json()) as {
        deletionRequest: AccountDeletionRequestDetails;
      }
    ).deletionRequest;
  }

  export async function cancelAccountDeletionByToken(
    token: string,
  ): Promise<AccountDeletionRequestDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/accounts/deletion/${token}/cancel`)
      .send();
    return (
      (await response.json()) as {
        deletionRequest: AccountDeletionRequestDetails;
      }
    ).deletionRequest;
  }

  export async function getDashboard(): Promise<DashboardStats> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/dashboard")
      .send();
    return (await response.json()) as DashboardStats;
  }

  // ── Answers + rules ──

  export async function listAllAnswers(): Promise<AnswerDetails[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/answers")
      .send();
    return (await response.json()) as AnswerDetails[];
  }

  export async function createAnswer(input: {
    readonly title: string;
    readonly body: string;
    readonly published?: boolean;
  }): Promise<AnswerDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/support/desk/answers")
      .send(input);
    return (await response.json()) as AnswerDetails;
  }

  export async function updateAnswer(
    id: number,
    input: {
      readonly title?: string;
      readonly body?: string;
      readonly published?: boolean;
    },
  ): Promise<AnswerDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/desk/answers/${id}`)
      .send(input);
    return (await response.json()) as AnswerDetails;
  }

  export async function listRules(): Promise<AnswerRuleDetails[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/rules")
      .send();
    return (await response.json()) as AnswerRuleDetails[];
  }

  export async function createRule(input: {
    readonly answerId: number;
    readonly keywords: string;
    readonly suggestOnly?: boolean;
  }): Promise<AnswerRuleDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/support/desk/rules")
      .send(input);
    return (await response.json()) as AnswerRuleDetails;
  }

  export async function updateRule(
    id: number,
    input: {
      readonly keywords?: string;
      readonly suggestOnly?: boolean;
    },
  ): Promise<AnswerRuleDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/desk/rules/${id}`)
      .send(input);
    return (await response.json()) as AnswerRuleDetails;
  }

  // ── Saved replies ──

  export async function listSavedReplies(): Promise<SavedReplyDetails[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/saved-replies")
      .send();
    return (await response.json()) as SavedReplyDetails[];
  }

  export async function createSavedReply(input: {
    readonly title: string;
    readonly body: string;
  }): Promise<SavedReplyDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/support/desk/saved-replies")
      .send(input);
    return (await response.json()) as SavedReplyDetails;
  }

  export async function updateSavedReply(
    id: number,
    input: { readonly title?: string; readonly body?: string },
  ): Promise<SavedReplyDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/desk/saved-replies/${id}`)
      .send(input);
    return (await response.json()) as SavedReplyDetails;
  }

  /** Called when staff actually inserts a saved reply into an outgoing message. */
  export async function markSavedReplyUsed(id: number): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST(`/_/support/desk/saved-replies/${id}/use`)
      .send({});
  }

  // ── Notices ──

  /**
   * The one live notice most callers care about — Template.tsx's site-wide
   * banner slot only ever shows one at a time, so this keeps that contract
   * even though the endpoint itself now returns every notice live for the
   * given audience (the desk's own preview and list views call
   * {@link listAllNotices} instead, to see all of them).
   */
  export async function getActiveNotice(): Promise<NoticeDetails | null> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/notice")
      .send();
    const { notices } = (await response.json()) as {
      notices: NoticeDetails[];
    };
    return notices[0] ?? null;
  }

  /** Every notice, live or not — the desk's own management list. */
  export async function listAllNotices(): Promise<NoticeDetails[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/notices")
      .send();
    return (await response.json()) as NoticeDetails[];
  }

  export async function createNotice(
    input: CreateNoticeInput,
  ): Promise<NoticeDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/support/notices")
      .send(input);
    return (await response.json()) as NoticeDetails;
  }

  export async function updateNotice(
    id: number,
    input: UpdateNoticeInput,
  ): Promise<NoticeDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/notices/${id}`)
      .send(input);
    return (await response.json()) as NoticeDetails;
  }

  export async function setNoticeActive(
    id: number,
    active: boolean,
  ): Promise<void> {
    await request
      .use(expectType("application/json"))
      .PUT(`/_/support/notices/${id}`)
      .send({ active });
  }

  /** Permanently removes a notice — distinct from retracting it, which keeps the row. */
  export async function deleteNotice(id: number): Promise<void> {
    await request.DELETE(`/_/support/notices/${id}`).send();
  }

  // ── Staff settings ──

  export async function getSettings(): Promise<StaffSettingsDetails> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/settings")
      .send();
    return (await response.json()) as StaffSettingsDetails;
  }

  /**
   * Whether Tab is currently paused on a model-quota failure (mockup step
   * 11) and whether the staff kill switch (mockup step 07) is on.
   */
  export async function getQuotaStatus(): Promise<{
    readonly pausedSince: string | null;
    readonly pausedModel: string | null;
    readonly enabled: boolean;
  }> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/quota-status")
      .send();
    return (await response.json()) as {
      pausedSince: string | null;
      pausedModel: string | null;
      enabled: boolean;
    };
  }

  export async function setAutomationEnabled(
    enabled: boolean,
  ): Promise<{ readonly enabled: boolean }> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/support/desk/automation-enabled")
      .send({ enabled });
    return (await response.json()) as { enabled: boolean };
  }

  export async function updateSettings(
    input: Partial<StaffSettingsDetails>,
  ): Promise<StaffSettingsDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT("/_/support/desk/settings")
      .send(input);
    return (await response.json()) as StaffSettingsDetails;
  }

  /** Who's allowlisted and what proves their identity — not editable. */
  export async function getStaffRoster(): Promise<StaffRosterEntry[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/staff")
      .send();
    return (await response.json()) as StaffRosterEntry[];
  }

  /** Read-only — who did what, when. */
  export async function listAudit(): Promise<StaffAuditEventDetails[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/audit")
      .send();
    return (await response.json()) as StaffAuditEventDetails[];
  }

  /**
   * Whether the signed-in visitor (if any) can reach the desk right now,
   * and if not, which of the three reasons applies. Never throws — the
   * sign-in screen renders a different message per reason.
   */
  export async function deskAccess(): Promise<DeskAccessStatus> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/access")
      .send();
    return (await response.json()) as DeskAccessStatus;
  }

  // Only ever called against the `/auth/*` routes the app's own /login page
  // shares with the desk's sign-in screen — the header marks the request as
  // the desk's own, so it lands in the desk's session, not the learner's.
  async function postJson(path: string, data?: object): Promise<any> {
    const response = await request
      .use(expectType("application/json"))
      .POST(path)
      .header(DESK_SESSION_HEADER, "1")
      .send(data ?? {});
    return await response.json();
  }

  /**
   * Sign in with a passkey (usernameless). Duplicated from
   * `@keylearn/page-account`'s identical helper rather than imported —
   * `page-account` embeds this package's `SupportPage` for its own Support
   * pane, so the reverse import would be circular.
   */
  export async function loginPasskey(): Promise<void> {
    const optionsJSON = await postJson("/auth/passkey/login-options");
    const response = await startAuthentication({ optionsJSON });
    await postJson("/auth/passkey/login-verify", response);
  }

  /**
   * The desk's own password step — deliberately not `@keylearn/page-account`'s
   * `AccountService.loginPassword` (that would be circular; see
   * {@link loginPasskey}), and deliberately not a link out to the general
   * `/login` window either: a staff account needs a second factor, and the
   * mock is explicit that this screen shows only what staff signing in need
   * — no OAuth buttons, no registration, no magic link.
   */
  export async function loginPassword(input: {
    readonly email: string;
    readonly password: string;
    readonly turnstileToken?: string;
  }): Promise<PasswordLoginResult> {
    return (await postJson(
      "/auth/login-password",
      input,
    )) as PasswordLoginResult;
  }

  /** The authenticator-code step after {@link loginPassword} returns `twoFactor: true`. */
  export async function verifyTwoFactor(code: string): Promise<void> {
    await postJson("/auth/2fa/verify", { code });
  }
}
