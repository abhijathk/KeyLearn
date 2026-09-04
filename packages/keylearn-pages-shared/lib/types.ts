import { type LocaleId } from "@keylearn/intl";

export type PageData = {
  /**
   * Whether the leaderboard is worth showing yet. False until the community is
   * large enough for a ranking to be meaningful — the navigation link is hidden
   * until then, so nobody is sent to an empty or misleading board.
   */
  readonly leaderboard?: boolean;
  /**
   * Whether live practice is offered yet.
   *
   * The page works, but the room it opens onto is half a feature: there is no
   * join dialog, so nobody can choose a name before walking in, and no way to
   * land in the same room as someone you know. A link to that is a promise the
   * product cannot keep, so it stays off until the rest is built. The route is
   * still reachable by URL for anyone testing it.
   */
  readonly multiplayer?: boolean;
  /**
   * The control centre's page states, by registry page key ("kids",
   * "braille", …): "live", "404" or "soon". A page that is not live is
   * refused by the server for everyone but an admin, and the client hides
   * its route and link the same way. Absent means everything is live.
   */
  readonly pages?: Readonly<Record<string, "live" | "404" | "soon">>;
  /** Whether the signed-in account is an admin (ADMIN_EMAILS). */
  readonly admin?: boolean;
  /** Site locales the control centre has switched on; absent means all. */
  readonly siteLocales?: readonly string[];
  /** Typing languages switched on; absent means all. */
  readonly typingLanguages?: readonly string[];
  /** Who may create an account: "open", "invite" or "closed". */
  readonly registration?: "open" | "invite" | "closed";
  /** Control-centre limits the client mirrors: minimum age, password length, profile caps. */
  readonly minAge?: number;
  readonly minPasswordLength?: number;
  readonly profileCaps?: { readonly free: number; readonly premium: number };
  /**
   * Site-wide learner defaults (control centre, Features): applied as the
   * defaults layer under every learner's own settings. Keys are the
   * settings props' own keys plus a few page-level ones.
   */
  /**
   * Whether this visitor must sign in to change the keyboard's finish.
   *
   * Decided on the server so the policy lives in one place: it is the site's
   * switch AND whether anybody is signed in, and a client recomputing that
   * from two fields is a client that can get it wrong on one screen only.
   * The board's finish is all it covers — layout, geometry, language and
   * zones are never gated, or a visitor on a non-Latin keyboard would find
   * the app broken rather than locked.
   */
  readonly boardChoiceLocked?: boolean;
  readonly learnerDefaults?: Readonly<Record<string, unknown>>;
  /**
   * Learner defaults the site forces on every learner ("forced") or forces
   * and removes from their settings ("hidden"), keyed like
   * `learnerDefaults`. Absent or empty means the learner decides.
   */
  readonly learnerOverrides?: Readonly<Record<string, "forced" | "hidden">>;
  /** The certificate criteria in force and their version, for the assessment UI. */
  readonly certificates?: {
    readonly version: number;
    readonly criteria: unknown;
    readonly issue: boolean;
    readonly namedAdults: boolean;
    readonly kids: boolean;
  };
  /** Whether premium is on sale (premium.sell). */
  readonly premiumSell?: boolean;
  /**
   * Whether KeyLearn's adaptive helpers run at all. False takes the four
   * guided layers away from every learner and removes their controls.
   */
  readonly smartPractice?: boolean;
  /**
   * Base URL.
   */
  readonly base: string;
  /**
   * Where the game server can be reached, when it is not this origin.
   *
   * In production nginx forwards `/_/game/` to the game worker, so the page
   * talks to its own origin and this is empty. In development there is no
   * proxy and the game worker listens on its own port, so the socket has to be
   * told where to go — otherwise it dials the HTTP worker, which has no game
   * routes, and every connection dies with a 1006 before it opens.
   */
  readonly gameUrl?: string;
  /**
   * Active locale identifier.
   */
  readonly locale: LocaleId;
  /**
   * ISO 3166-1 alpha-2 from the network edge (Cloudflare's `cf-ipcountry`),
   * or null where there is no edge in front — development, or any host
   * without it. Network truth rather than a preference: the browser cannot
   * know this, which is exactly why it is sent down.
   */
  readonly networkCountry?: string | null;
  /**
   * The full details about the currently authenticated user, which include
   * private information such as email, or null if the anonymous is anonymous.
   *
   * This is only visible to the authenticated user.
   */
  readonly user: UserDetails | null;
  /**
   * The current user as is visible to the public.
   *
   * This value does not include any user private information.
   *
   * If the current user is authenticated, then this value is derived from the
   * available user details, or can be anonymized on demand of the user.
   *
   * If the current user is anonymous, then this value is automatically
   * generated.
   */
  readonly publicUser: AnyUser;
  /**
   * Serialized user settings.
   */
  readonly settings: unknown | null;
  /**
   * The signed-in account's household profiles (learners), stored server-side.
   * Empty when signed out.
   */
  readonly profiles: readonly ProfileDetails[];
  /**
   * OAuth sign-in providers that are configured on this deployment (have
   * client credentials set), in preferred display order — e.g. ["google",
   * "microsoft"]. The sign-in UI only shows buttons for these.
   */
  readonly oauthProviders?: readonly string[];
  /**
   * Public Cloudflare Turnstile site key, present only when the adaptive CAPTCHA
   * is configured on this deployment. The browser uses it to render a challenge
   * when the server responds that one is required (HTTP 428).
   */
  readonly turnstileSiteKey?: string;
};

export type ProfileKind = "adult" | "kid";

export type ProfileAvatar =
  | { readonly type: "icon"; readonly id: string }
  | { readonly type: "photo"; readonly dataUrl: string }
  /**
   * A generated abstract painting: a family and one integer, from which the
   * palette and every coordinate are derived. Two small values instead of an
   * image, so it renders identically everywhere and costs nothing to store.
   */
  | {
      readonly type: "art";
      readonly family: string;
      readonly seed: number;
      /** Ink the learner's initial over the top. Off unless asked for. */
      readonly letter?: boolean;
    };

export type ProfileDetails = {
  readonly id: string;
  readonly kind: ProfileKind;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthYear: number | null;
  readonly avatar: ProfileAvatar | null;
  /** Hide this learner's name on leaderboards and in multiplayer. */
  readonly anonymized: boolean;
  /**
   * This learner uses the app without relying on sight, or with difficulty
   * seeing it.
   *
   * Recorded as a need rather than a diagnosis, deliberately: what the app has
   * to know is what to do — announce things, lead with audio, offer braille
   * entry — and a label would not tell it that. It also keeps this out of the
   * special-category health data that a disability status would be.
   */
  readonly visionSupport: boolean;
  /** Parental consent captured when a kid profile was created. */
  readonly parentalConsent: boolean;
  /** ISO timestamp the consent was recorded, or null. */
  readonly consentAt: string | null;
};

/** One entry in an account's security activity log. */
export type SecurityEventDetails = {
  readonly id: number;
  readonly type: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly detail: string | null;
  /**
   * When it happened, as an ISO timestamp.
   *
   * A string, not a Date. This type describes what arrives over the wire, and
   * JSON has no date — so declaring it a Date made every consumer believe it
   * had one, and handing that string to `Intl.DateTimeFormat.format` throws
   * "Invalid time value" and takes the whole activity log down with it.
   */
  readonly createdAt: string;
};

/**
 * One message in a support ticket's conversation thread.
 *
 * Replaces the ticket's old single staffReply/repliedAt slot — "them" is the
 * original submitter (or a later guest reply from their thread link), "us"
 * is staff, "auto" is a matched Answer sent without a human, and "system" is
 * a note like "marked resolved" that belongs in the timeline but was said by
 * nobody.
 */
export type SupportMessageDetails = {
  readonly id: number;
  readonly sender: "them" | "us" | "auto" | "agent" | "system";
  readonly body: string;
  readonly emailed: boolean;
  /** The name shown above this reply — the sender's chosen desk name or the assistant's, never an account name. Null on the customer's own messages. */
  readonly authorName: string | null;
  /** Which Answer(s) an agent reply was drafted from — null for every other sender. */
  readonly answerIds: readonly number[] | null;
  /**
   * When the desk acknowledged it, or null if it is stored here and not
   * handed over yet. Drawn as the second tick on your own messages.
   */
  readonly deliveredAt: string | null;
  /**
   * The desk's own id for a reply it delivered here — present only on
   * desk replies, and the handle the per-reply thumbs post back with.
   */
  readonly qdeskMessageId: number | null;
  /** The customer's thumbs on this reply, if they gave one. */
  readonly feedback: "good" | "bad" | null;
  readonly createdAt: string;
};

/** A submission to the support desk — a general question or a business enquiry. */
export type SupportTicketDetails = {
  readonly id: number;
  readonly kind: "support" | "business";
  readonly name: string;
  /** Masked (e.g. "r****@gmail.com") unless fetched via the reveal endpoint. */
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly status:
    | "open"
    | "flagged"
    | "waiting"
    | "closed"
    | "spam"
    | "holding";
  /**
   * The automation agent's tone read — set only via its own sentiment
   * endpoint, null until it's looked. `"critical"` is the one value that
   * escalates a ticket on its own; `"frustrated"` is visibility-only.
   */
  readonly sentiment: "neutral" | "frustrated" | "critical" | null;
  /**
   * False only while a signed-out "support" submission sits in the
   * email-confirmation holding queue. Every other submission starts (and
   * stays) confirmed.
   */
  readonly confirmed: boolean;
  /** @deprecated Superseded by {@link SupportTicketDetails.messages}; kept for old rows. */
  readonly staffReply: string | null;
  /** @deprecated Superseded by {@link SupportTicketDetails.messages}; kept for old rows. */
  readonly repliedAt: string | null;
  readonly closedAt: string | null;
  /** Hidden from the default Inbox view — orthogonal to `status`, which keeps whatever resolution it had. */
  readonly archived: boolean;
  readonly messages: readonly SupportMessageDetails[];
  readonly createdAt: string;
  /** From the sender's CF-IPCountry header at submission, or null off-Cloudflare. */
  readonly country: string | null;
};

/** What kind of announcement a {@link NoticeDetails} is — drives its icon/tone. */
export type NoticeKind = "incident" | "maintenance" | "feature";

/**
 * How a {@link NoticeDetails} shows: the thin top-of-page strip (almost
 * always right — it doesn't block anything) or a floating, centered window
 * (the rare, deliberate exception for a message someone actually needs to
 * stop and read).
 */
/** The two learner-voice cards (spec §8) sit in a corner and always have an exit button. */
export type NoticeDisplay = "banner" | "window" | "poll" | "feedback";

/** A short site-wide announcement staff can post and later retract. */
export type NoticeDetails = {
  readonly id: number;
  readonly message: string;
  /** @deprecated Superseded by {@link NoticeDetails.kind}; kept for old rows. */
  readonly level: "info" | "warning";
  readonly kind: NoticeKind;
  readonly display: NoticeDisplay;
  /** Null means "live now". */
  readonly startsAt: string | null;
  /** Null means "no scheduled end". */
  readonly endsAt: string | null;
  /** `"everyone"`, `"signed-in"`, `"kids"`, or a locale code. */
  readonly audience: string;
  readonly dismissible: boolean;
  /** A poll's two to four options. */
  readonly options?: readonly string[] | null;
  /** Whether learners see the running result after they answer. */
  readonly showResults?: boolean;
  /** Whether a feedback card asks for an optional comment. */
  readonly askComment?: boolean;
  readonly createdAt: string;
};

/** The live tally behind a poll or feedback card. Never any comment text. */
export type LearnerResults = {
  readonly count: number;
  readonly choices: readonly number[];
  readonly stars: readonly number[];
  readonly average: number | null;
  readonly comments: number;
};

/** The signed-in account's own answer to a card. */
export type LearnerResponseDetails = {
  readonly id: number;
  readonly noticeId: number;
  readonly choice: number | null;
  readonly stars: number | null;
  readonly text: string | null;
  readonly textDropped: boolean;
  readonly flagged: boolean;
  readonly hidden: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** What `/_/support/notice/{id}/response` answers with. */
export type LearnerResponseState = {
  /** Whether the card is still live on the desk. */
  readonly open: boolean;
  readonly response: LearnerResponseDetails | null;
  /** Null when the card does not show its running result. */
  readonly results: LearnerResults | null;
};

/** A short published article the support desk can hand back automatically. */
export type AnswerDetails = {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly published: boolean;
  readonly hitCount: number;
  readonly solvedCount: number;
  /** Times the sender wrote back after this article's auto-reply — it didn't hold. */
  readonly reopenedCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** A keyword/phrase rule that points at an {@link AnswerDetails}. */
export type AnswerRuleDetails = {
  readonly id: number;
  readonly answerId: number;
  /** Comma-or-newline-delimited keywords/phrases. */
  readonly keywords: string;
  readonly suggestOnly: boolean;
  readonly firedCount: number;
  readonly solvedCount: number;
  readonly reopenedCount: number;
  /** The parent article, when eagerly loaded alongside the rule. */
  readonly answer: AnswerDetails | null;
};

/** A pending (or resolved) staff-initiated account deletion — the 48-hour cooling-off window and its outcome. */
export type AccountDeletionRequestDetails = {
  readonly id: number;
  readonly reason: string;
  readonly requestedAt: string;
  readonly executeAt: string;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
};

/** A canned reply starting point staff can drop into a thread and edit. */
export type SavedReplyDetails = {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly usedCount: number;
  readonly updatedAt: string;
};

/** One staff member's own desk preferences. */
export type StaffSettingsDetails = {
  readonly signature: string | null;
  readonly notifyNew: boolean;
  /** "HH:MM", 24-hour, or null for "no quiet hours set". */
  readonly quietFrom: string | null;
  readonly quietTo: string | null;
  /** ISO date ("YYYY-MM-DD"), or null. */
  readonly awayUntil: string | null;
  readonly confidenceThreshold: number;
  readonly overdueHours: number;
  /** Whether revealing an account's email requires typing a short reason first. */
  readonly requireRevealReason: boolean;
  /** Whether an account's last-login city/IP is shown at all, site-wide. */
  readonly showLastLoginLocation: boolean;
  /** Tighter row spacing in the Inbox and other ticket lists. */
  readonly compactDensity: boolean;
  /** "2h ago" instead of an absolute date/time, wherever the desk shows one. */
  readonly relativeTimestamps: boolean;
  /** A small flag next to each ticket, from the sender's CF-IPCountry at submission. */
  readonly showCountryFlag: boolean;
  /** Browser notification on a new ticket, separate from the email toggle. */
  readonly desktopPush: boolean;
  /** A short chime on a new ticket while the desk tab is open and focused. */
  readonly soundAlert: boolean;
  /** Desktop push/sound fire only for flagged tickets, not every new one. */
  readonly escalationOnly: boolean;
  /** Which screen opens first when signing in. */
  readonly defaultLandingPage: "dashboard" | "inbox";
  /** Force a ticket to "flagged" the second time a guest reopens it. */
  readonly secondReopenAutoFlag: boolean;
  /** Auto-close an idle open/waiting ticket after this many days. 0 = off. */
  readonly autoCloseIdleDays: number;
  /**
   * How easily a frustrated tone escalates a ticket. Only meaningful once
   * the sentiment-reading agent from the pending automation plan is wired
   * up to read it — stored now so the setting's shape exists ahead of that.
   */
  readonly sentimentSensitivity: "mild" | "moderate" | "strict";
};

/**
 * A signed-in account's in-app "you have an update" indicator — currently
 * only fired when a support ticket gets a reply while signed in, in place
 * of an email (see `page-support`'s email-vs-notification split).
 */
export type NotificationDetails = {
  readonly id: number;
  readonly kind: "ticket-reply";
  readonly ticketId: number | null;
  /** A short snapshot of the reply. Clicking opens the conversation. */
  readonly body: string | null;
  /** Who it is from — the assistant's name, or a staffer's desk name. */
  readonly authorName: string | null;
  /** Whether that author was the assistant, so it is never passed off. */
  readonly fromAssistant: boolean;
  /** The conversation it belongs to, read off the ticket at list time. */
  readonly reference: string | null;
  readonly subject: string | null;
  readonly status: string | null;
  readonly read: boolean;
  readonly createdAt: string;
};

/**
 * One row of the support desk's read-only staff roster — who's allowlisted
 * and what proves their identity, not editable from here (see
 * `STAFF_EMAILS`). An allowlisted address with no account yet still
 * appears, with both factors false and no last sign-in.
 */
export type StaffRosterEntry = {
  readonly email: string;
  readonly name: string | null;
  readonly hasPasskey: boolean;
  readonly hasAuthenticator: boolean;
  readonly lastSignedInAt: string | null;
};

/** One entry in the support desk's read-only staff action log. */
export type StaffAuditEventDetails = {
  readonly id: number;
  readonly staffName: string | null;
  readonly action: string;
  readonly detail: string | null;
  readonly ip: string | null;
  readonly createdAt: string;
};

export type UserDetails = {
  /**
   * Unique id.
   */
  readonly id: string;
  /**
   * Unique e-mail.
   */
  readonly email: string;
  /**
   * User name.
   */
  readonly name: string;
  /**
   * Whether the user name is anonymized.
   */
  readonly anonymized: boolean;
  /** Whether this account's typing history is publicly viewable. */
  readonly publicProfile: boolean;
  /**
   * Profiles from social networks.
   */
  readonly externalId: readonly UserExternalIdDetails[];
  /**
   * Premium account order.
   */
  readonly order: OrderDetails | null;
  /**
   * The account owner's date of birth ("YYYY-MM-DD"), or null if never
   * collected (e.g. an OAuth sign-up that hasn't completed the age gate yet).
   */
  readonly dateOfBirth: string | null;
  /** Whether the account has a password set (vs. OAuth/passkey-only). */
  readonly hasPassword: boolean;
  /** Whether two-step verification is switched on. */
  readonly twoFactorEnabled: boolean;
  /**
   * ISO 3166-1 alpha-2 the network reported at registration, or null when
   * it was not available (off-Cloudflare, or an account older than the
   * column). A starting guess for the time-zone country, never a setting.
   */
  readonly signupCountry: string | null;
  /** Whether a grown-up PIN guards profile management. */
  readonly parentPinSet: boolean;
  /** How many digits it has; null when unset, or set before we recorded it. */
  readonly parentPinLength: number | null;
  /** Whether the account's email address has been verified. */
  readonly emailVerified: boolean;
  /**
   * Timestamp.
   */
  readonly createdAt: string | Date;
};

export type UserExternalIdDetails = {
  /**
   * Social network name.
   */
  readonly provider: string;
  /**
   * User id in the social network.
   */
  readonly id: string;
  /**
   * User name in the social network.
   */
  readonly name: string | null;
  /**
   * Profile url.
   */
  readonly url: string | null;
  /**
   * Avatar image url.
   */
  readonly imageUrl: string | null;
  /**
   * When this provider was last signed in with — used to prefer the most
   * recently used linked provider's name/avatar over an older one.
   */
  readonly usedAt: string | Date;
  /**
   * Timestamp.
   */
  readonly createdAt: string | Date;
};

export type OrderDetails = {
  /**
   * Order unique id.
   */
  readonly id: string;
  /**
   * Order provider.
   */
  readonly provider: string;
  /**
   * Customer email.
   */
  readonly email: string | null;
  /**
   * Customer name.
   */
  readonly name: string | null;
  /**
   * Timestamp.
   */
  readonly createdAt: string | Date;
};

export type AnonymousUser = {
  /**
   * Anonymous user id.
   */
  readonly id: null;
  /**
   * Anonymous user name.
   */
  readonly name: string;
  /**
   * Image url for avatar.
   */
  readonly imageUrl: null;
  /**
   * An anonymous visitor is never staff. Optional (rather than a required
   * `false`) so the many existing call sites across the monorepo that build
   * an {@link AnyUser} don't all need updating — absent reads the same as
   * false wherever this is checked.
   */
  readonly staff?: boolean;
};

export type NamedUser = {
  /**
   * Unique user id.
   */
  readonly id: string;
  /**
   * Non-unique user name.
   */
  readonly name: string;
  /**
   * Image url for avatar.
   */
  readonly imageUrl: string | null;
  /**
   * Whether this is a premium user;
   */
  readonly premium: boolean;
  /**
   * Whether this account can reach the support desk's staff-only views.
   * Optional for the same reason as {@link AnonymousUser.staff} — absent
   * reads as not-staff.
   */
  readonly staff?: boolean;
};

export type AnyUser = AnonymousUser | NamedUser;

/**
 * The longest a learner's first or last name may be.
 *
 * Thirty-two is what the database column holds, so this is the number the
 * server would reject at anyway — stating it here lets the input stop at the
 * limit instead of letting somebody type past it and find out on save.
 *
 * It is also comfortably longer than real names need: the longest given names
 * in common use run to about fifteen characters, and the postal and payment
 * standards that will eventually carry a printed name cap their own name lines
 * between twenty-six and thirty-five. A certificate's name box holds about
 * thirty-five at the grown-up sheet's type size, and `fitName` shortens
 * anything longer rather than overflowing it.
 */
export const PROFILE_NAME_MAX = 32;
