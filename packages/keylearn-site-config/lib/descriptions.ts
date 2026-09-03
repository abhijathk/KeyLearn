/**
 * One line under every row, saying what it does.
 *
 * Three different sentences used to compete for the same space, and two of
 * them are not descriptions at all: `warning` is what to think about before
 * changing something, and `reason` is why a locked row is locked. Rows with
 * neither showed nothing under their label, which left an admin to guess
 * from the label alone — and the labels are short on purpose.
 *
 * So every row has a description here, and only a description. It answers
 * "what does this do?" in one sentence, in the present tense, without
 * repeating the label and without the word "setting". The warning and the
 * reason keep their own jobs and their own places on the page.
 *
 * They live in this file rather than beside each row because prose is
 * reviewed as prose: a hundred sentences read together are kept consistent
 * in a way a hundred sentences scattered through a data file never are.
 * The contract test fails if a registry row has no entry here, so a new
 * row cannot ship without one.
 */
export const DESCRIPTIONS: Readonly<Record<string, string>> = {
  // ── Pages ──
  "pages.practice.state":
    "The main practice page at the site root, where the guided course runs.",
  "pages.kids.state":
    "The children's world: the map, the islands and the whole kid experience.",
  "pages.braille.state":
    "The braille practice page, and the only route vision-support learners have.",
  "pages.typingTest.state":
    "The timed test that produces a speed and accuracy score.",
  "pages.multiplayer.state":
    "Live races against other people, and the game endpoints behind them.",
  "pages.texts.state":
    "The library of books, quotes and word lists a learner can practise from.",
  "pages.highScores.state":
    "The public leaderboard of the fastest ranked learners.",
  "pages.support.state":
    "The contact form a learner or a visitor writes to the support desk with.",
  "pages.helpCentre.state":
    "The self-service answers a learner reads before writing in.",
  "pages.forSchools.state":
    "The page schools land on, and the enquiry form on it.",
  "pages.verify.state":
    "Where anybody can check that a certificate number is genuine.",
  "pages.publicProfiles.state":
    "A learner's own progress page as other people see it.",
  "pages.layouts.state":
    "The reference of every keyboard layout KeyLearn can teach.",
  "pages.guide.state": "The written guide to using KeyLearn.",
  "pages.about.state": "The page explaining what KeyLearn is and who makes it.",
  "pages.account":
    "The pages a household owns: its account, its profiles, its organisation and its invitations.",
  "pages.legal":
    "The pages a person has a right to reach whatever else is switched off.",
  "pages.adminPreview":
    "Lets an admin open a page that is off, so it can be checked before it goes live.",

  // ── Languages ──
  "languages.site":
    "Which languages the site itself is offered in, from the menu to the emails.",
  "languages.typing":
    "Which languages a learner can choose to practise typing in.",

  // ── Registration and sign-in ──
  "registration.mode":
    "Whether anybody can create an account, only people with a code can, or nobody can.",
  "registration.inviteCodes":
    "The codes that open registration while it is invite only. A code is removed once it is used.",
  "signin.google": "Whether Google appears as a way to sign in.",
  "signin.microsoft": "Whether Microsoft appears as a way to sign in.",
  "signin.facebook": "Whether Facebook appears as a way to sign in.",
  "signin.builtIn":
    "The ways in that KeyLearn provides itself, without any outside provider.",

  // ── Maintenance ──
  "maintenance.enabled":
    "Closes the website behind a holding page while work is going on.",
  "maintenance.message": "What the holding page says while the site is closed.",
  "maintenance.revertAfter":
    "How long maintenance mode runs before it lifts itself, so the site cannot be left closed by accident.",

  // ── Leaderboard ──
  "leaderboard.minAccounts":
    "How many activated accounts the site needs before the leaderboard is shown at all.",
  "leaderboard.minRanked":
    "How many learners need a ranked result before the leaderboard is shown.",
  "leaderboard.override.until":
    "Shows the leaderboard regardless of those two numbers until this moment passes.",

  // ── Accounts and profiles ──
  "profiles.placesFree":
    "How many learner profiles a household gets without paying.",
  "profiles.placesPremium":
    "How many learner profiles a paying household gets.",
  "profiles.placesBraille":
    "How many braille places every household gets, paid or not.",
  "accounts.minAge": "The youngest age that may hold an account of their own.",
  "privacy.showLastLoginLocation":
    "Whether an account holder is shown the town and country of their own recent sign-ins.",

  // ── Security ──
  "security.minPasswordLength": "The shortest password a new one may be.",
  "security.parentPinWindowMin":
    "How long a grown-up's PIN stays proved before the household is asked for it again.",
  "security.loginAttemptsPerMin":
    "How many sign-in attempts one address may make in a minute before it is slowed down.",
  "security.sessionLifetime":
    "How long a signed-in session lasts before the person signs in again.",
  "security.headers":
    "The browser-level protections every response carries: the content policy, the cross-site guard and the cookie flags.",
  "security.passcodeLockout":
    "How many failed passcode tries lock the control centre, and for how long each time.",
  "security.signIn":
    "The ways into an account that KeyLearn provides itself, and that staff sign-in depends on.",
  "security.secrets":
    "How passwords are hashed, and where the service's own secrets are kept.",
  "security.totp":
    "The shape of the codes an authenticator app produces for two-step sign-in.",

  // ── Integrity ──
  "integrity.maxSpeedCpm":
    "The speed above which a submitted result is treated as impossible rather than impressive.",
  "integrity.minMsPerKey":
    "The gap below which two keystrokes are treated as a machine rather than a person.",

  // ── Kids ──
  "kids.parentalConsent":
    "A grown-up has to agree before a child profile can exist at all.",
  "kids.routeGuards":
    "What a child profile is refused: adult drills, the account pages and the profile manager.",
  "kids.noAds": "Children are never shown a paid line, anywhere, ever.",
  "kids.parentPin":
    "Once a household has had a child profile, the grown-up PIN stays required.",
  "kids.paceFloorByBand":
    "The slowest target a child of each age band is asked to reach before a key unlocks.",
  "kids.paceCeilByBand":
    "The fastest target a child of each age band is pushed towards before a key unlocks.",
  "kids.certificates":
    "Whether children can sit the test and be awarded a certificate.",

  // ── Moderation ──
  "moderation.ladder":
    "What happens to somebody who misbehaves in chat, step by step, and what is blocked outright.",

  // ── Retention ──
  "retention.threadLinkDays":
    "How long the link to a support conversation keeps working before it expires.",
  "retention.holdingQueueDays":
    "How long an unconfirmed ticket waits for its email to be verified before it is dropped.",
  "retention.securityEventDays":
    "How far back the sign-in history shown to an account holder goes.",
  "retention.deletionCoolingOffHours":
    "How long a requested account deletion waits, so it can still be called off.",
  "retention.staffAuditDays":
    "How long staff audit rows are kept. Zero keeps them for good.",

  // ── Practice and lessons ──
  "practice.defaultLessonType":
    "Which course a learner starts on before they choose for themselves.",
  "practice.defaultTargetSpeedCpm":
    "The speed a learner is aiming at before they change it.",
  "practice.defaultDailyGoalMin":
    "How many minutes a day a learner is aiming for before they change it.",
  "practice.smartPractice":
    "The adaptive layers that decide which keys to drill next from how a learner is actually doing.",

  // ── Braille ──
  "braille.serverSpeech":
    "Whether spoken prompts are generated on the server for learners whose device cannot.",
  "braille.defaultGoalMin":
    "How many minutes a day a braille learner is aiming for before they change it.",

  // ── Typing test ──
  "typingTest.defaultDurationS":
    "How long a test runs before a learner picks a different length.",
  "typingTest.defaultSource":
    "Where the test's words come from before a learner picks something else.",

  // ── Certificates ──
  "certificates.issue":
    "Whether a passed sitting produces a certificate at all.",
  "certificates.namedAdults":
    "Whether an adult's certificate carries their name.",
  "certificates.publicVerify":
    "Whether anybody can check a certificate number without an account.",
  "certificates.adultTyping.wpm":
    "The speed an adult has to reach to pass the typing certificate.",
  "certificates.adultTyping.accuracy":
    "The accuracy an adult has to reach to pass the typing certificate.",
  "certificates.adultBraille.wpm":
    "The speed an adult has to reach to pass the braille certificate.",
  "certificates.adultBraille.accuracy":
    "The accuracy an adult has to reach to pass the braille certificate.",
  "certificates.practiceMargin.typing":
    "How far above the pass mark a learner must be practising before they are offered the typing test.",
  "certificates.practiceMargin.braille":
    "How far above the pass mark a learner must be practising before they are offered the braille test.",
  "certificates.retention.adult":
    "How much of their practice speed an adult has to hold in the test itself.",
  "certificates.retention.kid":
    "How much of their practice speed a child has to hold in the test itself.",
  "certificates.sittingsCounted":
    "How many sittings are looked at together when deciding a pass.",
  "certificates.attemptsPerDay":
    "How many times a learner may sit the test in one day. Zero means no limit.",
  "certificates.bands":
    "The pass marks children are judged against, one set per age band.",
  "certificates.plan":
    "How a sitting is structured: how many runs, and how long each one lasts.",
  "certificates.criteriaVersion":
    "Every certificate records the rules it was judged under, and the public check shows them.",
  "certificates.childNeverNamed":
    "A child's certificate is verifiable by number, but the check never shows their name.",

  // ── Multiplayer ──
  "multiplayer.limits":
    "How large a race can be, how many can play at once, and how many one address may bring.",

  // ── Schools ──
  "schools.acceptInvites":
    "Whether a teacher's invitation can be accepted and turned into a place.",
  "schools.newOrganisations":
    "Whether a school can create an organisation on its own, or has to be let in.",

  // ── Premium ──
  "premium.sell": "Whether subscriptions are on sale at all.",

  // ── Sponsored ──
  "ads.enabled": "Whether the paid line above the header runs at all.",
  "ads.dwellSeconds":
    "How long one advertiser's line holds before the bar moves to the next.",
  "ads.maxRotation":
    "How many campaigns may share the bar before the rest wait for another day.",
  "ads.showToGuests":
    "Whether somebody reading without an account sees the paid line.",
  "ads.neverForChildren":
    "A child profile, the kids world and every school account never see a paid line.",
  "ads.neverDuringLesson":
    "The line is removed the moment a lesson starts and returns when it ends.",

  // ── Accessibility ──
  "a11y.defaultMotion":
    "Whether animation follows the device's own setting, or is reduced for everyone by default.",
  "a11y.defaultContrast":
    "How much contrast the interface starts with before a learner adjusts it.",
  "a11y.features":
    "The accessibility controls a learner has: motion, contrast, text size and the screen-reader paths.",

  // ── Sweeps and limits ──
  "ops.qdeskRetryAfterMin":
    "How long a failed hand-off to the support desk waits before it is tried again.",
  "ops.qdeskGiveUpHours":
    "How long hand-offs keep being retried before the attempt is abandoned.",
  "ops.reminderAfterDays":
    "How long a learner is left alone before a practice reminder is offered.",
  "ops.digestHour": "What time of day the staff digest email is sent.",
  "ops.idleCloseDays":
    "How long a ticket sits untouched before it closes itself. Zero leaves them open.",
  "ops.deletionSweepMin":
    "How often requested account deletions past their cooling-off are carried out.",
  "ops.snapshotMin":
    "How often learner data on disk is copied into the database that gets backed up.",
  "ops.staffRefreshS":
    "How often each server process re-reads who is on the staff roster.",

  // ── Email to learners ──
  "email.practiceReminders":
    "Whether the nudge to come back and practise is sent at all.",
  "email.productNews": "Whether announcements about KeyLearn are sent at all.",
  "email.staffDigest": "Whether the daily summary is sent to staff.",
  "email.securityAlerts":
    "Mail about a sign-in, a password change or a deletion request always sends.",
  "admin.notifyOnChange":
    "Every other admin is emailed whenever anything on this page changes.",
};

/**
 * The description for a learner-override row, built from the row it governs.
 *
 * Written once rather than eight times: every override row does the same
 * job for a different default, so eight near-identical sentences would have
 * been eight chances to let one drift.
 */
export function overrideDescription(baseLabel: string): string {
  // Deliberately does not spell out what "hidden" adds: the section's own
  // note above the list already does, and repeating it on eight rows would
  // push every one of them onto three lines.
  return `Whether the learner decides ${lowerFirst(baseLabel)}, or the site value is forced over their own choice.`;
}

function lowerFirst(text: string): string {
  // "Braille: default daily goal" reads as "braille: default daily goal" in
  // the middle of a sentence; an acronym or a proper noun would not.
  return /^[A-Z][a-z]/.test(text)
    ? text[0]!.toLowerCase() + text.slice(1)
    : text;
}
