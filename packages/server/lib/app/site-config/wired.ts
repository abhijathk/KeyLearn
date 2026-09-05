/**
 * The registry keys that KeyLearn's code actually reads from the site
 * configuration today.
 *
 * The registry lists every controllable thing so the page can show it; this
 * list says which of them are connected. A write to a key that is not here
 * is refused with the reason "not connected yet", because the page must
 * never display a value it is not applying (spec §2, principle 3). Each
 * phase that wires a reader adds its key here, and the contract test in
 * `registry-contract.test.ts` checks that every key on this list is read
 * somewhere outside this directory, so the list cannot claim more than the
 * code does.
 *
 * Phase 0 wires four, as the proof of the whole path from a PUT to an
 * effect: two are env-protected numbers read by a sweep and a page guard,
 * one is a choice with an env parser of its own, and together they exercise
 * default → stored → env precedence end to end.
 */
export const WIRED_KEYS: ReadonlySet<string> = new Set([
  // Phase 0.
  "retention.staffAuditDays",
  "leaderboard.minAccounts",
  "leaderboard.minRanked",
  "pages.multiplayer.state",
  // Phase 1.3 — page states, gated in page/controller.tsx (server) and
  // App.tsx / NavMenu.tsx (client) through PageData.pages.
  "pages.practice.state",
  "pages.kids.state",
  "pages.braille.state",
  "pages.typingTest.state",
  "pages.texts.state",
  "pages.highScores.state",
  "pages.support.state",
  "pages.helpCentre.state",
  "pages.forSchools.state",
  "pages.verify.state",
  "pages.publicProfiles.state",
  // Phase 3 follow-up (3 Sep 2026): the drawer's own links.
  "pages.layouts.state",
  "pages.guide.state",
  "pages.about.state",
  // Phase 1.4 — auth/registration.ts.
  "registration.mode",
  "registration.inviteCodes",
  // Phase 1.5 — maintenance.ts middleware and site-config/sweep.ts.
  "maintenance.enabled",
  "maintenance.message",
  "maintenance.revertAfter",
  // Phase 1.7 — highscores/readiness.ts and site-config/sweep.ts.
  "leaderboard.override.until",
  // Phase 1.8 — page/intl.ts, the sitemap, and the client lists via PageData.
  "languages.site",
  "languages.typing",
  // Phase 1.9 — internal/controller.ts account detail.
  "privacy.showLastLoginLocation",
  // Phase 2.1 — auth/controller.ts, auth/parent-pin.ts, support/controller.ts,
  // support/sweep.ts and the database's security-event.ts.
  "profiles.placesFree",
  "profiles.placesPremium",
  "accounts.minAge",
  "security.minPasswordLength",
  "security.parentPinWindowMin",
  "security.loginAttemptsPerMin",
  "retention.threadLinkDays",
  "retention.holdingQueueDays",
  "retention.securityEventDays",
  // Phase 2.2 — certificate/controller.ts, speech/controller.ts,
  // org/controller.ts, and the client through PageData.learnerDefaults.
  // Phase 3 follow-up: the adaptive helpers, gated site-wide.
  "practice.smartPractice",
  "practice.defaultLessonType",
  "practice.defaultTargetSpeedCpm",
  "practice.defaultDailyGoalMin",
  "kids.paceFloorByBand",
  "kids.paceCeilByBand",
  "kids.certificates",
  "braille.serverSpeech",
  "braille.defaultGoalMin",
  "typingTest.defaultDurationS",
  "typingTest.defaultSource",
  "certificates.issue",
  "certificates.namedAdults",
  "certificates.publicVerify",
  "certificates.adultTyping.wpm",
  "certificates.adultTyping.accuracy",
  "certificates.adultBraille.wpm",
  "certificates.adultBraille.accuracy",
  "certificates.practiceMargin.typing",
  "certificates.practiceMargin.braille",
  "certificates.retention.adult",
  "certificates.retention.kid",
  "certificates.sittingsCounted",
  "certificates.attemptsPerDay",
  "schools.acceptInvites",
  "schools.newOrganisations",
  "premium.sell",
  "a11y.defaultMotion",
  "a11y.defaultContrast",
  // Phase 2.3 — the sweeps and the notifier.
  "ops.qdeskRetryAfterMin",
  "ops.qdeskGiveUpHours",
  "ops.reminderAfterDays",
  "ops.digestHour",
  "ops.idleCloseDays",
  "ops.closeConfirmDays",
  "ops.deletionSweepMin",
  "ops.snapshotMin",
  "ops.staffRefreshS",
  "email.practiceReminders",
  "email.productNews",
  "email.staffDigest",
  // Phase 3.4 — learner overrides, applied by the client through
  // PageData.learnerOverrides (Settings.setForced in keylearn-settings).
  // Only the choices: a numeric learner default has no `.override` row at all
  // (see `mayBeForced` in the registry), because the site sets where a learner
  // starts and never where they are held.
  "practice.defaultLessonType.override",
  "typingTest.defaultSource.override",
  "a11y.defaultMotion.override",
  "a11y.defaultContrast.override",
  // Phase 4 — the sponsor slot, read by app/ads/readers.ts through the
  // feed, the eligibility check and the bar's own rotation.
  "ads.enabled",
  "ads.dwellSeconds",
  "ads.maxRotation",
  "ads.showToGuests",
]);

export function isWired(key: string): boolean {
  return WIRED_KEYS.has(key);
}
