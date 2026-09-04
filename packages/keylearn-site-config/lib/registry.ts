import { DESCRIPTIONS, overrideDescription } from "./descriptions.ts";
import { type SettingDef } from "./types.ts";

/**
 * Every controllable thing in KeyLearn, one row each.
 *
 * Transcribed from `control-centre-registry.md` (2 September 2026), which is
 * the contract: the control centre renders from this list, the validator
 * enforces it, and the contract test in the server package checks each
 * row's default against the constant the code ships with.
 *
 * Defaults are written here as literals rather than imported, deliberately:
 * this package has no dependencies so that anything — a page package in the
 * browser, the database layer, the server — can import it without a cycle.
 * The guarantee the registry document asks for ("never retyped") is kept
 * by `registry-contract.test.ts` in the server package, which imports the
 * real constants and fails the moment one of them diverges from this file.
 *
 * Rows with `protection: "new"` describe a control that has no enforcement
 * in KeyLearn yet. They are listed so the page can show them, and a write
 * to one is refused until the enforcement lands.
 */

const PAGE_STATES = ["live", "404", "soon"] as const;

function page(
  name: string,
  label: string,
  enforcedAt: string,
  extra: Partial<SettingDef> = {},
): SettingDef {
  return {
    key: `pages.${name}.state`,
    section: "pages",
    label,
    type: "choice",
    default: "live",
    choices: PAGE_STATES,
    direction: "free",
    protection: "free",
    impact: "hides",
    warning:
      "Off refuses the URL at the router, not just the link. Data is hidden, never deleted; admins can still preview the page.",
    enforcedAt,
    ...extra,
  };
}

function info(
  key: string,
  section: SettingDef["section"],
  label: string,
  value: unknown,
  reason: string,
  extra: Partial<SettingDef> = {},
): SettingDef {
  return {
    key,
    section,
    label,
    type: "info",
    default: value,
    direction: "free",
    protection: "locked",
    reason,
    ...extra,
  };
}

const BASE_REGISTRY: readonly SettingDef[] = [
  // ── Site & access ──────────────────────────────────────────────────────

  page("practice", "Practice page", "page/controller.tsx GET / + App.tsx"),
  page("kids", "Kids world page", "/kids route + PracticeSurfaceGuard", {
    warning:
      "Kid profiles disappear from their families' screens while the page is off; none are deleted.",
  }),
  page("braille", "Braille page", "/braille route", {
    warning:
      "Vision-support learners are routed only here. Off leaves them with nowhere to practise.",
  }),
  page("typingTest", "Typing test", "/typing-test"),
  {
    // Shipped OFF: the reader's own default has been `false` since phase
    // 0.1, so the registry says the same rather than the "live" the pages
    // table lists — the opening state must be the live state.
    ...page("multiplayer", "Multiplayer page", "/multiplayer + /_/game/*"),
    default: "404",
    protection: { env: "MULTIPLAYER_ENABLED" },
    envParse: (raw) => {
      switch (raw) {
        case "true":
          return "live";
        case "false":
          return "404";
        default:
          throw new TypeError(`Invalid boolean value '${raw}'`);
      }
    },
    warning:
      "Live practice is unfinished. Off means gone: the page, its locale twins, the sitemap entry and every game endpoint answer 404.",
  },
  page("texts", "Practice library", "/texts"),
  page("highScores", "High scores", "/high-scores", {
    warning: "The population rule still applies while the page is live.",
  }),
  page("support", "Support page", "/support"),
  page("helpCentre", "Help centre", "/support/help"),
  page("forSchools", "For schools page", "/for-schools"),
  page("verify", "Certificate check", "/verify, /verify/:number"),
  page("publicProfiles", "Public profiles", "/profile/:userId"),
  // The drawer's own links. These are pages a visitor reaches from the menu
  // rather than the main nav, and they were missing a switch entirely until
  // 3 Sep 2026 — an admin could not take the layouts reference or the guide
  // down without a deploy.
  page("layouts", "Keyboard layouts", "/layouts"),
  page("guide", "User guide", "/guide"),
  page("about", "About page", "/about"),
  info(
    "pages.account",
    "pages",
    "Part of an account: /account, /profiles, /profile, /org, /join/:token",
    "always on",
    "Core to owning an account. Switching these off would lock a household out of its own data.",
    { enforcedAt: "page/controller.tsx (no gate by design)" },
  ),
  info(
    "pages.legal",
    "pages",
    "Always on: privacy policy, terms, accessibility statement, sign-in, forgot and reset password, the deletion-cancel and guest-thread links, and the data export",
    "always on",
    "Legal and rights. A privacy policy nobody can reach is not a privacy policy, and the sign-in page is the admin's own way back in.",
    { enforcedAt: "page/controller.tsx (no gate by design)" },
  ),
  info(
    "pages.adminPreview",
    "pages",
    "Admin preview of a page that is off",
    true,
    "Admins always bypass a non-live state so a page can be checked before it goes live.",
    { enforcedAt: "router" },
  ),

  {
    key: "languages.site",
    section: "languages",
    label: "Site languages",
    type: "set",
    default: "all",
    choicesRef: "siteLocales",
    immovable: ["en"],
    direction: "free",
    protection: "free",
    impact: "hides",
    warning:
      "An unticked language falls back to English for those visitors; nothing is deleted.",
    enforcedAt: "keylearn-intl locale negotiation",
  },
  {
    key: "languages.typing",
    section: "languages",
    label: "Typing languages",
    type: "set",
    default: "all",
    choicesRef: "typingLanguages",
    immovable: ["en"],
    direction: "free",
    protection: "free",
    impact: "hides",
    warning:
      "An unticked language is hidden from new choices; existing practice keeps its data.",
    enforcedAt: "keyboard settings language list",
  },

  {
    key: "registration.mode",
    section: "registration",
    label: "Registration",
    type: "choice",
    default: "open",
    choices: ["open", "invite", "closed"],
    direction: "free",
    protection: "free",
    impact: "refuses",
    warning: "Existing users always sign in. Invite only adds a code field.",
    enforcedAt: "auth/registration.ts (register, magic link, OAuth)",
  },
  {
    key: "registration.inviteCodes",
    section: "registration",
    label: "Invite codes",
    type: "textList",
    default: [],
    maxLength: 64,
    direction: "free",
    protection: "free",
    enforcedAt: "auth/registration.ts (register, magic link, OAuth)",
  },
  // Sign-in, as the spec's Registration & sign-in table asks for it. Every
  // row here is read-only: which providers exist is decided by whether
  // their credentials are configured, and the built-in methods are the
  // floor nobody may remove (spec §2, principle 2: never build a way to
  // lock yourself out). Shown rather than hidden, because "is Microsoft
  // sign-in live?" is a question an admin has to be able to answer without
  // reading a deployment file.
  {
    key: "signin.google",
    section: "registration",
    label: "Sign in with Google",
    type: "info",
    default: false,
    direction: "free",
    protection: { env: "AUTH_GOOGLE_CLIENT_ID" },
    envParse: (raw) => raw.trim() !== "",
    reason:
      "A sign-in button is shown only when its credentials are configured, so nobody is offered one that would fail on click.",
    enforcedAt: "page/controller.tsx oauthProviders",
  },
  {
    key: "signin.microsoft",
    section: "registration",
    label: "Sign in with Microsoft",
    type: "info",
    default: false,
    direction: "free",
    protection: { env: "AUTH_MICROSOFT_CLIENT_ID" },
    envParse: (raw) => raw.trim() !== "",
    reason:
      "A sign-in button is shown only when its credentials are configured, so nobody is offered one that would fail on click.",
    enforcedAt: "page/controller.tsx oauthProviders",
  },
  {
    key: "signin.facebook",
    section: "registration",
    label: "Sign in with Facebook",
    type: "info",
    default: false,
    direction: "free",
    protection: { env: "AUTH_FACEBOOK_CLIENT_ID" },
    envParse: (raw) => raw.trim() !== "",
    reason:
      "A sign-in button is shown only when its credentials are configured, so nobody is offered one that would fail on click.",
    enforcedAt: "page/controller.tsx oauthProviders",
  },
  // Two rows rather than one, as the mock has them: a sign-in link is the
  // floor every account stands on, and a passkey is something a learner
  // chooses to add on top. They are locked for different reasons and it is
  // worth an admin being able to see which is which.
  {
    key: "signin.emailAndPassword",
    section: "registration",
    label: "Email sign-in links and passwords",
    type: "info",
    default: true,
    direction: "free",
    protection: "locked",
    reason:
      "The way in that every account has. It has no off position: switching it off would lock every account out, this one included.",
    enforcedAt: "auth/controller.ts sign-in routes, auth/email.ts magic links",
  },
  {
    key: "signin.passkeys",
    section: "registration",
    label: "Passkeys and authenticator apps",
    type: "info",
    default: true,
    direction: "free",
    protection: "locked",
    reason:
      "Core: staff sign-in depends on one of the two being set up, so this cannot be taken away.",
    enforcedAt: "auth/controller.ts passkey routes, auth/totp-crypto.ts",
  },
  {
    key: "maintenance.enabled",
    section: "maintenance",
    label: "Maintenance mode",
    type: "switch",
    default: false,
    direction: "free",
    protection: "free",
    impact: "refuses",
    warning:
      "Website only: the API and the desk bridge keep running and admins stay signed in.",
    enforcedAt: "maintenance.ts middleware",
  },
  {
    key: "maintenance.message",
    section: "maintenance",
    label: "Maintenance message",
    type: "text",
    default:
      "KeyLearn is having a short rest for maintenance. Your progress is safe; please try again in a little while.",
    maxLength: 280,
    direction: "free",
    protection: "free",
    enforcedAt: "maintenance.ts middleware",
  },
  {
    key: "maintenance.revertAfter",
    section: "maintenance",
    label: "Maintenance auto-revert",
    type: "choice",
    default: "1h",
    choices: ["never", "1h", "4h", "tomorrow06"],
    direction: "free",
    protection: "free",
    enforcedAt: "site-config/sweep.ts",
  },

  {
    key: "leaderboard.minAccounts",
    section: "leaderboard",
    label: "Leaderboard: activated accounts needed",
    type: "number",
    default: 500,
    bounds: { min: 50, max: 5000, step: 50, unit: "accounts" },
    direction: "free",
    protection: { env: "LEADERBOARD_MIN_ACCOUNTS" },
    impact: "tunes",
    warning: "The population rule is tuned, never removed.",
    enforcedAt: "highscores/readiness.ts minAccounts()",
  },
  {
    key: "leaderboard.minRanked",
    section: "leaderboard",
    label: "Leaderboard: ranked learners needed",
    type: "number",
    default: 50,
    bounds: { min: 5, max: 1000, unit: "learners" },
    direction: "free",
    protection: { env: "LEADERBOARD_MIN_RANKED" },
    impact: "tunes",
    enforcedAt: "highscores/readiness.ts minRanked()",
  },
  {
    key: "leaderboard.override.until",
    section: "leaderboard",
    label: "Leaderboard override until",
    type: "datetime",
    default: null,
    direction: "free",
    protection: "free",
    impact: "tunes",
    warning:
      "Shows the board regardless of population until the moment passes; expires by itself.",
    enforcedAt: "highscores/readiness.ts leaderboardReady()",
  },

  // ── Limits & safety ────────────────────────────────────────────────────

  {
    key: "profiles.placesFree",
    section: "profiles",
    label: "Profiles per free account",
    type: "number",
    default: 4,
    bounds: { min: 1, max: 10, unit: "profiles" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    warning:
      "Lowering the cap affects new accounts only; nobody loses a profile.",
    enforcedAt: "keylearn-pages-shared/lib/profilecaps.ts PLACES_FREE",
  },
  {
    key: "profiles.placesPremium",
    section: "profiles",
    label: "Profiles per premium account",
    type: "number",
    default: 8,
    bounds: { min: 4, max: 20, unit: "profiles" },
    // Raise-only for existing buyers: a paid promise is never reduced.
    direction: "raise-only",
    protection: "free",
    impact: "tunes",
    warning: "A paid promise is never reduced retroactively.",
    enforcedAt: "keylearn-pages-shared/lib/profilecaps.ts PLACES_PREMIUM",
  },
  info(
    "profiles.placesBraille",
    "profiles",
    "Braille places",
    4,
    "Four braille places on every plan, by design.",
    { enforcedAt: "keylearn-pages-shared/lib/profilecaps.ts" },
  ),
  {
    key: "accounts.minAge",
    section: "accounts",
    label: "Minimum age",
    type: "number",
    default: 13,
    bounds: { min: 13, max: 18, unit: "years" },
    direction: "raise-only",
    protection: "free",
    impact: "refuses",
    warning: "COPPA and GDPR-K floor. Can go up, never below 13.",
    enforcedAt: "auth/controller.ts MIN_AGE + page-account DobEntry.tsx",
  },
  {
    key: "privacy.showLastLoginLocation",
    section: "privacy",
    label: "Show last sign-in location to the owner",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    enforcedAt: "staff_settings.show_last_login_location → site_config",
  },
  {
    key: "security.minPasswordLength",
    section: "security",
    label: "Minimum password length",
    type: "number",
    default: 8,
    bounds: { min: 8, max: 64, unit: "characters" },
    direction: "raise-only",
    protection: "free",
    impact: "refuses",
    warning: "Applies to new passwords; nobody is signed out.",
    enforcedAt: "auth/controller.ts MIN_PASSWORD + password.ts",
  },
  {
    key: "security.parentPinWindowMin",
    section: "security",
    label: "Parent PIN window",
    type: "number",
    default: 15,
    choices: [5, 10, 15],
    bounds: { min: 5, max: 15, unit: "minutes" },
    direction: "tighten-only",
    protection: "free",
    impact: "tunes",
    enforcedAt: "auth/parent-pin.ts PARENT_PIN_TTL_MS",
  },
  {
    key: "security.loginAttemptsPerMin",
    section: "security",
    label: "Sign-in attempts per minute",
    type: "number",
    default: 20,
    bounds: { min: 5, max: 20, unit: "attempts" },
    direction: "tighten-only",
    protection: "free",
    impact: "tunes",
    enforcedAt: "auth/controller.ts rateLimit(login)",
  },
  info(
    "security.sessionLifetime",
    "security",
    "Session lifetime",
    "14 days",
    "Set by COOKIE_MAX_AGE; the server refuses to boot in production if weakened.",
    { protection: { env: "COOKIE_MAX_AGE" }, enforcedAt: "session.ts" },
  ),
  info(
    "security.headers",
    "security",
    "Security headers, CSRF, cookie flags",
    "on",
    "Never switchable: the server refuses to boot in production if weakened.",
    { enforcedAt: "headers.ts, csrf.ts, config-check.ts" },
  ),
  info(
    "security.passcodeLockout",
    "security",
    "Desk passcode lockout",
    "5 failures, then 15 / 30 / 60 min",
    "Protects the admin's own door.",
    { enforcedAt: "desk-unlock.ts" },
  ),
  info(
    "security.signIn",
    "security",
    "Email links and passwords; passkeys and authenticator apps",
    "always on",
    "The fallback every account has. Removing a sign-in method would lock people out of their own data, and staff sign-in depends on the second factor.",
    { enforcedAt: "auth/controller.ts, auth/passkeys.ts, totp.ts" },
  ),
  info(
    "security.secrets",
    "security",
    "Password hashing and the service secrets",
    "scrypt; env only",
    "ADMIN_EMAILS, the ops API key, the certificate signing secret and the authenticator encryption key live in the environment and are readable from no screen, this one included. Changing the hash would invalidate every stored password.",
    { enforcedAt: "auth/password.ts, config-check.ts" },
  ),
  info(
    "security.totp",
    "security",
    "Authenticator codes",
    "6 digits, 30 s",
    "Standard TOTP; changing it would break every enrolled authenticator.",
    { enforcedAt: "totp.ts" },
  ),
  info(
    "integrity.maxSpeedCpm",
    "integrity",
    "Anti-cheat: maximum plausible speed",
    1500,
    "Fails badly in both directions; not a tuning knob.",
    { enforcedAt: "sync/plausible.ts MAX_SPEED_CPM" },
  ),
  info(
    "integrity.minMsPerKey",
    "integrity",
    "Anti-cheat: minimum time per key",
    20,
    "Fails badly in both directions; not a tuning knob.",
    { enforcedAt: "sync/plausible.ts MIN_MS_PER_KEY" },
  ),
  info(
    "kids.parentalConsent",
    "kids",
    "Parental consent before any kid profile",
    "always required",
    "A child's profile cannot exist without a grown-up saying so. There is no switch for this anywhere.",
    { enforcedAt: "auth/controller.ts profile creation" },
  ),
  info(
    "kids.routeGuards",
    "kids",
    "A kid profile never reaches adult drills, Account or Profiles",
    "always on",
    "Route guards, not a link that is merely hidden. Child safety.",
    { enforcedAt: "App.tsx KidAccountGuard, PracticeSurfaceGuard" },
  ),
  info(
    "kids.noAds",
    "kids",
    "No advertising to children",
    "never",
    "Fails closed: there is no code path that could show a child an advertisement, and none may be added behind a switch.",
    { enforcedAt: "no ad surface exists" },
  ),
  info(
    "kids.parentPin",
    "kids",
    "The grown-up PIN stays required once a household has had a child",
    "always on",
    "Removing it would open a child's account section to the child. The window can be tightened, never removed.",
    { enforcedAt: "auth/parent-pin.ts" },
  ),
  info(
    "certificates.childNeverNamed",
    "certificates",
    "A child is never named on the public certificate check",
    "always on",
    "The public check shows a child's first name to nobody. Named certificates are an adult-only switch.",
    { enforcedAt: "certificate/controller.ts verify" },
  ),
  info(
    "moderation.ladder",
    "moderation",
    "Chat moderation ladder and contact-detail block",
    "warn / 5 min / 24 h / 7 d",
    "Child safety.",
    { enforcedAt: "keylearn-moderation strikes.ts, contact.ts" },
  ),
  {
    key: "retention.threadLinkDays",
    section: "retention",
    label: "Support thread links expire after",
    type: "number",
    default: 90,
    choices: [30, 90, 365],
    bounds: { min: 30, max: 365, unit: "days" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    warning: "A policy change: say so in the privacy policy if it moves.",
    enforcedAt: "support/controller.ts THREAD_EXPIRY_MS",
  },
  {
    key: "retention.holdingQueueDays",
    section: "retention",
    label: "Unconfirmed tickets dropped after",
    type: "number",
    default: 7,
    choices: [3, 7, 14],
    bounds: { min: 3, max: 14, unit: "days" },
    direction: "free",
    protection: { env: "HOLDING_QUEUE_DAYS" },
    impact: "tunes",
    enforcedAt: "support/sweep.ts holdingDays()",
  },
  {
    key: "retention.securityEventDays",
    section: "retention",
    label: "Sign-in history shown to the owner",
    type: "number",
    default: 30,
    choices: [7, 14, 30],
    bounds: { min: 7, max: 30, unit: "days" },
    direction: "tighten-only",
    protection: "free",
    impact: "tunes",
    warning: "Lengthening is refused.",
    enforcedAt: "security-event.ts retentionMs",
  },
  info(
    "retention.deletionCoolingOffHours",
    "retention",
    "Account deletion cooling-off",
    48,
    "Legal.",
    { enforcedAt: "account-deletion-request.ts" },
  ),
  {
    key: "retention.staffAuditDays",
    section: "retention",
    label: "Staff audit log retention",
    type: "number",
    // 0 = forever, which is the shipped value.
    default: 0,
    choices: [0, 730, 365],
    bounds: { min: 0, max: 730, unit: "days" },
    direction: "free",
    protection: { env: "STAFF_AUDIT_RETENTION_DAYS" },
    impact: "tunes",
    warning:
      "Rows past the window are dropped by a daily sweep and cannot be recovered.",
    enforcedAt: "support/sweep.ts StaffAuditSweep",
  },

  // ── Features ───────────────────────────────────────────────────────────

  {
    key: "practice.defaultLessonType",
    section: "practice",
    label: "Default lesson type",
    type: "choice",
    default: "guided",
    choices: ["guided", "wordlist", "books", "code"],
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-lesson/lib/settings.ts lessonProps.type",
  },
  {
    key: "practice.defaultTargetSpeedCpm",
    section: "practice",
    label: "Default target speed",
    type: "number",
    default: 175,
    bounds: { min: 75, max: 750, step: 5, unit: "cpm" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-lesson/lib/settings.ts lessonProps.targetSpeed",
  },
  {
    key: "practice.defaultDailyGoalMin",
    section: "practice",
    label: "Default daily goal",
    type: "number",
    default: 30,
    bounds: { min: 0, max: 120, unit: "minutes" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-lesson/lib/settings.ts lessonProps.dailyGoal",
  },
  // `practice.library` and `schools.pageAndEnquiry` from the document are
  // aliases of `pages.texts.state` and `pages.forSchools.state`: one truth
  // per page, so they are not separate keys here.
  {
    key: "practice.smartPractice",
    section: "practice",
    label: "Smart practice",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-lesson/lib/settings.ts lesson.guided.*",
  },
  // The registry document listed one unlock speed per band (75 · 100 · 125
  // · 175). The code has moved on: the target follows the child between a
  // floor and a ceiling per band (page-kids/lib/age.ts), so the registry
  // carries both, read from that file by the contract test.
  {
    key: "kids.paceFloorByBand",
    section: "kids",
    label: "Kids: unlock target floor by age band",
    type: "numberList",
    default: [25, 40, 75, 100],
    length: 4,
    bounds: { min: 10, max: 400, unit: "cpm" },
    nonDecreasing: true,
    direction: "free",
    protection: "free",
    impact: "tunes",
    warning:
      "The floor sits at the bottom of each band's normal range on purpose; children stalled when it was higher.",
    enforcedAt: "page-kids/lib/age.ts paceFloor",
  },
  {
    key: "kids.paceCeilByBand",
    section: "kids",
    label: "Kids: unlock target ceiling by age band",
    type: "numberList",
    default: [60, 90, 140, 190],
    length: 4,
    bounds: { min: 10, max: 400, unit: "cpm" },
    nonDecreasing: true,
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "page-kids/lib/age.ts paceCeil",
  },
  {
    key: "kids.certificates",
    section: "kids",
    label: "Kids test and certificates",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    enforcedAt: "certificate/controller.ts audience kid",
  },
  {
    key: "braille.serverSpeech",
    section: "braille",
    label: "Braille: server speech",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    warning:
      "Off makes /_/speech.wav answer 404; the browser voice still works.",
    enforcedAt: "speech/controller.ts",
  },
  {
    key: "braille.defaultGoalMin",
    section: "braille",
    label: "Braille: default daily goal",
    type: "number",
    default: 15,
    choices: [0, 10, 15, 20, 30],
    bounds: { min: 0, max: 30, unit: "minutes" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "page-braille/lib/prefs.ts goalMinutes",
  },
  {
    key: "typingTest.defaultDurationS",
    section: "typingTest",
    label: "Typing test: default duration",
    type: "number",
    default: 15,
    choices: [15, 30, 60, 120],
    bounds: { min: 15, max: 120, unit: "seconds" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "page-typing-test/lib/settings.ts duration",
  },
  {
    key: "typingTest.defaultSource",
    section: "typingTest",
    label: "Typing test: default text",
    type: "choice",
    default: "commonWords",
    choices: ["commonWords", "pseudoWords", "book"],
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "page-typing-test/lib/settings.ts source",
  },
  {
    key: "certificates.issue",
    section: "certificates",
    label: "Issue certificates",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "refuses",
    enforcedAt: "certificate/controller.ts sitting + issue routes",
  },
  {
    key: "certificates.namedAdults",
    section: "certificates",
    label: "Named certificates for adults",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    enforcedAt: "certificate/controller.ts named",
  },
  {
    key: "certificates.publicVerify",
    section: "certificates",
    label: "Public certificate check",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    enforcedAt: "/verify + /_/certificate/verify",
  },
  {
    key: "certificates.adultTyping.wpm",
    section: "certificates",
    label: "Adult typing pass mark: speed",
    type: "number",
    default: 35,
    bounds: { min: 20, max: 80, unit: "wpm" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    warning:
      "Versioned: changes affect new sittings only; issued certificates keep their criteria.",
    enforcedAt: "keylearn-certificate/lib/criteria.ts ADULT_TYPING.speed",
  },
  {
    key: "certificates.adultTyping.accuracy",
    section: "certificates",
    label: "Adult typing pass mark: accuracy",
    type: "number",
    default: 0.95,
    bounds: { min: 0.8, max: 1, step: 0.01 },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-certificate/lib/criteria.ts ADULT_TYPING.accuracy",
  },
  {
    key: "certificates.adultBraille.wpm",
    section: "certificates",
    label: "Adult braille pass mark: speed",
    type: "number",
    default: 50,
    bounds: { min: 20, max: 100, unit: "wpm" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-certificate/lib/criteria.ts ADULT_BRAILLE.speed",
  },
  {
    key: "certificates.adultBraille.accuracy",
    section: "certificates",
    label: "Adult braille pass mark: accuracy",
    type: "number",
    default: 0.95,
    bounds: { min: 0.8, max: 1, step: 0.01 },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-certificate/lib/criteria.ts ADULT_BRAILLE.accuracy",
  },
  {
    key: "certificates.practiceMargin.typing",
    section: "certificates",
    label: "Practice margin: typing",
    type: "number",
    default: 3,
    bounds: { min: 0, max: 10, unit: "wpm" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-certificate/lib/criteria.ts PRACTICE_MARGIN.typing",
  },
  {
    key: "certificates.practiceMargin.braille",
    section: "certificates",
    label: "Practice margin: braille",
    type: "number",
    default: 5,
    bounds: { min: 0, max: 15, unit: "wpm" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-certificate/lib/criteria.ts PRACTICE_MARGIN.braille",
  },
  {
    key: "certificates.retention.adult",
    section: "certificates",
    label: "Retention required: adults",
    type: "number",
    default: 0.85,
    bounds: { min: 0.5, max: 1, step: 0.01 },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-certificate/lib/criteria.ts RETENTION.adult",
  },
  {
    key: "certificates.retention.kid",
    section: "certificates",
    label: "Retention required: children",
    type: "number",
    default: 0.8,
    bounds: { min: 0.5, max: 1, step: 0.01 },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-certificate/lib/criteria.ts RETENTION.kid",
  },
  {
    key: "certificates.sittingsCounted",
    section: "certificates",
    label: "Sittings counted",
    type: "number",
    default: 3,
    bounds: { min: 1, max: 5, unit: "sittings" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-assessment assessment.ts MIN_SITTINGS",
  },
  {
    key: "certificates.attemptsPerDay",
    section: "certificates",
    label: "Attempts per day",
    type: "number",
    // 0 = unlimited, the shipped value.
    default: 0,
    choices: [0, 3, 5, 10],
    bounds: { min: 0, max: 10, unit: "attempts" },
    direction: "free",
    protection: "free",
    impact: "refuses",
    enforcedAt: "certificate/controller.ts sitting route",
  },
  // Two table-shaped rows. Each needs a validator of its own (per-band
  // non-decreasing marks; a plan of sittings per audience) that lands with
  // the Certificates section in phase 2.2, so until then they are shown and
  // a write is refused, rather than accepted and silently not applied.
  {
    key: "certificates.bands",
    section: "certificates",
    label: "Children's pass marks by age band",
    type: "info",
    default: "shipped bands",
    direction: "free",
    protection: "new",
    enforcedAt: "keylearn-certificate/lib/criteria.ts BANDS, NEUTRAL",
  },
  {
    key: "certificates.plan",
    section: "certificates",
    label: "Sitting plan",
    type: "info",
    default: "3 × 60 s adult, 1 × 30 / 45 s child",
    direction: "free",
    protection: "new",
    enforcedAt: "keylearn-assessment assessment.ts planFor",
  },
  info(
    "certificates.criteriaVersion",
    "certificates",
    "Criteria version",
    "monotonic",
    "Issued certificates keep the criteria they were issued under.",
    { enforcedAt: "certificate + certificate_sitting criteria_version" },
  ),
  info(
    "multiplayer.limits",
    "multiplayer",
    "Multiplayer limits (room size / max players / per address)",
    "10 · 500 · 8",
    "Set by MULTIPLAYER_* in the environment.",
    {
      protection: { env: "MULTIPLAYER_*" },
      enforcedAt: "keylearn-multiplayer-server",
    },
  ),
  {
    key: "schools.acceptInvites",
    section: "schools",
    label: "Accept organisation invites",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "refuses",
    enforcedAt: "org/controller.ts accept",
  },
  {
    key: "schools.newOrganisations",
    section: "schools",
    label: "New organisations",
    type: "choice",
    default: "open",
    choices: ["open", "closed"],
    direction: "free",
    protection: "free",
    impact: "refuses",
    warning:
      "Decided 2 Sep 2026: organisations stay automatic; an approval flow is deferred until abuse appears.",
    enforcedAt: "org/controller.ts POST /_/org",
  },
  {
    key: "premium.sell",
    section: "premium",
    label: "Sell premium",
    type: "switch",
    default: false,
    direction: "free",
    protection: "free",
    impact: "hides",
    warning: "Refuses to turn on until the Paddle keys are set.",
    enforcedAt: "account window upgrade + /_/checkout",
  },
  // The sponsor slot (control centre phase 4). One paid line above the
  // header on adult pages, sold by the week. The campaigns themselves are
  // rows in `ad_campaign`, not registry keys; what lives here is the site
  // policy around them, so an admin can stop every campaign at once
  // without opening any of them.
  {
    key: "ads.enabled",
    section: "ads",
    label: "Show sponsored line",
    type: "switch",
    default: false,
    direction: "free",
    protection: "free",
    impact: "hides",
    warning:
      "Turning this off stops every campaign immediately, including ones already paid for. Time lost is credited back automatically.",
    enforcedAt: "app/ads/eligibility.ts adsAllowed",
  },
  {
    key: "ads.dwellSeconds",
    section: "ads",
    label: "Seconds per screen",
    type: "number",
    default: 8,
    bounds: { min: 4, max: 30, unit: "seconds" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    warning:
      "Below about six seconds a reader cannot finish the line before it moves.",
    enforcedAt: "app/ads/readers.ts adDwellSeconds",
  },
  {
    key: "ads.maxRotation",
    section: "ads",
    label: "Most campaigns in rotation",
    type: "number",
    default: 4,
    bounds: { min: 1, max: 8, unit: "campaigns" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "app/ads/readers.ts adMaxRotation",
  },
  {
    key: "ads.showToGuests",
    section: "ads",
    label: "Show to signed-out visitors",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    enforcedAt: "app/ads/eligibility.ts adsAllowed",
  },
  {
    key: "ads.neverForChildren",
    section: "ads",
    label: "Never shown to children",
    type: "info",
    default: true,
    direction: "free",
    protection: "locked",
    reason:
      "A child profile, the kids world and every school account never see a paid line. This is not a setting because it has no off position.",
    enforcedAt: "app/ads/eligibility.ts adsAllowed",
  },
  {
    key: "ads.neverDuringLesson",
    section: "ads",
    label: "Hidden while typing",
    type: "info",
    default: true,
    direction: "free",
    protection: "locked",
    reason:
      "The line is removed the moment a lesson starts and returns when it ends, so nothing moves beside the text being typed.",
    enforcedAt: "pages-browser/lib/Template.tsx AdSlot",
  },
  {
    key: "a11y.defaultMotion",
    section: "a11y",
    label: "Default motion",
    type: "choice",
    default: "system",
    choices: ["system", "reduce"],
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-pages-shared/lib/a11y-storage.ts",
  },
  {
    key: "a11y.defaultContrast",
    section: "a11y",
    label: "Default contrast",
    type: "choice",
    default: "default",
    choices: ["default", "clearer", "strongest"],
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "keylearn-pages-shared/lib/accent-storage.ts",
  },
  info(
    "a11y.features",
    "a11y",
    "Accessibility features",
    "on",
    "Defaults may change; options may never be removed.",
    { enforcedAt: "PreferencesPane.tsx, /braille, captions, speech" },
  ),

  // ── Operations ─────────────────────────────────────────────────────────

  {
    key: "ops.qdeskRetryAfterMin",
    section: "ops",
    label: "Retry a failed desk hand-off after",
    type: "number",
    default: 5,
    bounds: { min: 1, max: 60, unit: "minutes" },
    direction: "free",
    protection: { env: "QDESK_RETRY_AFTER_MINUTES" },
    impact: "tunes",
    enforcedAt: "support/qdesk-retry.ts",
  },
  {
    key: "ops.qdeskGiveUpHours",
    section: "ops",
    label: "Give up a desk hand-off after",
    type: "number",
    default: 48,
    bounds: { min: 1, max: 168, unit: "hours" },
    direction: "free",
    protection: { env: "QDESK_RETRY_GIVE_UP_HOURS" },
    impact: "tunes",
    enforcedAt: "support/qdesk-retry.ts",
  },
  {
    key: "ops.reminderAfterDays",
    section: "ops",
    label: "Practice reminder after",
    type: "number",
    default: 3,
    bounds: { min: 1, max: 30, unit: "days" },
    direction: "free",
    protection: { env: "REMINDER_AFTER_DAYS" },
    impact: "tunes",
    enforcedAt: "mail/sweep.ts",
  },
  {
    key: "ops.digestHour",
    section: "ops",
    label: "Daily digest hour",
    type: "number",
    default: 8,
    bounds: { min: 0, max: 23, unit: "hour" },
    direction: "free",
    protection: { env: "DIGEST_HOUR" },
    impact: "tunes",
    enforcedAt: "support/sweep.ts digestHour()",
  },
  {
    key: "ops.idleCloseDays",
    section: "ops",
    label: "Close idle tickets after",
    type: "number",
    default: 0,
    choices: [0, 3, 7, 14],
    bounds: { min: 0, max: 14, unit: "days" },
    direction: "free",
    protection: "free",
    impact: "tunes",
    enforcedAt: "StaffSettings.siteDefault().autoCloseIdleDays → site_config",
  },
  {
    key: "ops.deletionSweepMin",
    section: "ops",
    label: "Account deletion sweep every",
    type: "number",
    default: 60,
    bounds: { min: 15, max: 240, unit: "minutes" },
    direction: "free",
    protection: { env: "ACCOUNT_DELETION_SWEEP_MINUTES" },
    impact: "tunes",
    enforcedAt: "support/sweep.ts",
  },
  {
    key: "ops.snapshotMin",
    section: "ops",
    label: "Data snapshot every",
    type: "number",
    default: 15,
    bounds: { min: 5, max: 120, unit: "minutes" },
    direction: "free",
    protection: { env: "DATA_SNAPSHOT_MINUTES" },
    impact: "tunes",
    enforcedAt: "sync/snapshot.ts",
  },
  {
    key: "ops.staffRefreshS",
    section: "ops",
    label: "Staff roster refresh every",
    type: "number",
    default: 60,
    bounds: { min: 15, max: 300, unit: "seconds" },
    direction: "free",
    protection: { env: "STAFF_REFRESH_SECONDS" },
    impact: "tunes",
    enforcedAt: "auth/staff-cache.ts",
  },
  {
    key: "email.practiceReminders",
    section: "email",
    label: "Email: practice reminders",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    warning: "A site-wide gate ahead of each learner's own preference.",
    enforcedAt: "mail/sweep.ts",
  },
  {
    key: "email.productNews",
    section: "email",
    label: "Email: product news",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    enforcedAt: "mail/notify.ts productNews",
  },
  {
    key: "email.staffDigest",
    section: "email",
    label: "Email: staff digest",
    type: "switch",
    default: true,
    direction: "free",
    protection: "free",
    impact: "hides",
    enforcedAt: "support/sweep.ts DigestSweep",
  },
  info(
    "email.securityAlerts",
    "email",
    "Email: security alerts",
    "always",
    "They exist to reach someone who did not do the thing being reported.",
    { enforcedAt: "mail/notify.ts securityAlert" },
  ),
  info(
    "admin.notifyOnChange",
    "admin",
    "Email other admins on every change",
    "always",
    "Decided 2 Sep 2026: every change emails the other admins with who, what, from, to and a revert link.",
    { enforcedAt: "site-config service → ADMIN_EMAILS minus the actor" },
  ),
];

/**
 * How a learner default may be applied (phase 3.4): the learner starts with
 * it and may change it (`default`), the site value replaces the learner's
 * own choice (`forced`), or it is forced and the control is removed from
 * their settings too (`hidden`).
 */
export const LEARNER_OVERRIDE_MODES = ["default", "forced", "hidden"] as const;
export type LearnerOverrideMode = (typeof LEARNER_OVERRIDE_MODES)[number];

/** The learner defaults a learner can change for themselves, and so can be overridden. */
const LEARNER_OVERRIDABLE: readonly string[] = [
  "practice.defaultLessonType",
  "practice.defaultTargetSpeedCpm",
  "practice.defaultDailyGoalMin",
  "typingTest.defaultDurationS",
  "typingTest.defaultSource",
  "braille.defaultGoalMin",
  "a11y.defaultMotion",
  "a11y.defaultContrast",
];

function learnerOverride(base: SettingDef): SettingDef {
  return {
    key: `${base.key}.override`,
    section: base.section,
    label: `${base.label}: learner override`,
    type: "choice",
    default: "default",
    choices: LEARNER_OVERRIDE_MODES,
    direction: "free",
    protection: "free",
    impact: "tunes",
    warning:
      "Forced applies the site value to every learner and ignores their own choice. Hidden also removes the control from their settings.",
    enforcedAt:
      "keylearn-settings Settings.setForced() via PageData.learnerOverrides",
    overrideOf: base.key,
  };
}

/**
 * Whether the site may take this default away from the learner entirely.
 *
 * It may not, if the default is a number (owner, 4 Sep 2026): "control centre
 * cannot dictate the practice settings numbers — the user can set how they
 * want to practise." The numbers ARE the practice — the speed a letter has to
 * reach before the next unlocks, how long a session runs, how many minutes a
 * day. Pinning one does not tune somebody's practice, it decides whether they
 * can progress at all, and the learner sitting at the keyboard is the only one
 * who knows what they can currently type.
 *
 * The site still sets every one of them, as the value a new learner starts
 * from. That is what a default is, and it is the whole of what the control
 * centre gets here.
 *
 * A rule rather than a shorter list, so a numeric default added next year is
 * covered on the day it is added. The choices that remain overridable are
 * policy rather than pace: which lesson type the site runs, where its typing
 * test draws text from, and the two accessibility defaults.
 */
function mayBeForced(def: SettingDef): boolean {
  return def.type !== "number";
}

export const REGISTRY: readonly SettingDef[] = [
  ...BASE_REGISTRY,
  ...BASE_REGISTRY.filter(
    (def) => LEARNER_OVERRIDABLE.includes(def.key) && mayBeForced(def),
  ).map(learnerOverride),
  // Every row carries its one-line description, attached here rather than
  // written beside each row: a hundred sentences read together stay
  // consistent in a way a hundred scattered ones do not. The contract test
  // refuses a row with no description, so a new one cannot ship without.
].map((def) => ({
  ...def,
  description:
    def.description ??
    (def.overrideOf != null
      ? overrideDescription(
          BASE_REGISTRY.find((base) => base.key === def.overrideOf)?.label ??
            def.label,
        )
      : DESCRIPTIONS[def.key]),
}));

/** The override rows, in registry order. */
export const LEARNER_OVERRIDE_KEYS: readonly string[] = REGISTRY.filter(
  (def) => def.overrideOf != null,
).map((def) => def.key);

const BY_KEY: ReadonlyMap<string, SettingDef> = new Map(
  REGISTRY.map((def) => [def.key, def]),
);

/** The definition for a key, or null for a key that is not in the registry. */
export function settingDef(key: string): SettingDef | null {
  return BY_KEY.get(key) ?? null;
}

/** Every key, in registry order. */
export function settingKeys(): readonly string[] {
  return REGISTRY.map((def) => def.key);
}

/** Whether a row is a read-only reference row rather than a control. */
export function isInfoRow(def: SettingDef): boolean {
  return def.type === "info";
}
