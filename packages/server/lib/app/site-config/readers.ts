import { type CertificateCriteria } from "@keylearn/certificate";
import { allLocales } from "@keylearn/intl";
import { Language } from "@keylearn/keyboard";
import { type PageInfo, Pages, type ProfileCaps } from "@keylearn/pages-shared";
import {
  REGISTRY,
  siteChoice,
  siteNumber,
  siteSetting,
  siteSwitch,
} from "@keylearn/site-config";

/**
 * The typed readers the rest of the server uses for the phase 1 keys.
 *
 * Each is a one-liner over the registry store, kept here so the contract
 * test can grep one place per key and so a caller never spells a key
 * string by hand. Every read is synchronous and live: the per-worker cache
 * behind `siteChoice` and friends is what a control-centre change lands in.
 */

export type PageState = "live" | "404" | "soon";

/** Registry page names, and the page each one gates. */
export const PAGE_KEYS = {
  practice: "pages.practice.state",
  kids: "pages.kids.state",
  braille: "pages.braille.state",
  typingTest: "pages.typingTest.state",
  multiplayer: "pages.multiplayer.state",
  texts: "pages.texts.state",
  highScores: "pages.highScores.state",
  support: "pages.support.state",
  helpCentre: "pages.helpCentre.state",
  forSchools: "pages.forSchools.state",
  verify: "pages.verify.state",
  publicProfiles: "pages.publicProfiles.state",
  layouts: "pages.layouts.state",
  guide: "pages.guide.state",
  about: "pages.about.state",
} as const;

export type PageName = keyof typeof PAGE_KEYS;

export function pageState(name: PageName): PageState {
  return siteChoice(PAGE_KEYS[name]) as PageState;
}

/** Every page state at once, for the page data the client renders from. */
export function pageStates(): Record<PageName, PageState> {
  const out = {} as Record<PageName, PageState>;
  for (const name of Object.keys(PAGE_KEYS) as PageName[]) {
    out[name] = pageState(name);
  }
  return out;
}

/**
 * The registry page name a rendered page is gated by, or null for a page
 * that has no switch (account, legal, sign-in, help…). The public profile
 * shares `Pages.profile` with the owner's own progress page, so the
 * controller names it explicitly rather than through this map.
 */
export function pageNameOf(page: PageInfo): PageName | null {
  switch (page.path) {
    case Pages.practice.path:
      return "practice";
    case Pages.kids.path:
      return "kids";
    case Pages.braille.path:
      return "braille";
    case Pages.typingTest.path:
      return "typingTest";
    case Pages.multiplayer.path:
      return "multiplayer";
    case Pages.texts.path:
      return "texts";
    case Pages.highScores.path:
      return "highScores";
    case Pages.support.path:
      return "support";
    case Pages.helpCentre.path:
      return "helpCentre";
    case Pages.forSchools.path:
      return "forSchools";
    case Pages.verify.path:
      return "verify";
    case Pages.layouts.path:
      return "layouts";
    case Pages.guide.path:
      return "guide";
    case Pages.about.path:
      return "about";
    default:
      return null;
  }
}

/** The site locales switched on. "all" in the registry means every one. */
export function siteLocalesAllowed(): readonly string[] {
  const value = siteSetting("languages.site");
  return Array.isArray(value) ? (value as string[]) : allLocales;
}

export function siteLocaleAllowed(locale: string): boolean {
  return siteLocalesAllowed().includes(locale);
}

/** The typing languages switched on, as language ids. */
export function typingLanguagesAllowed(): readonly string[] {
  const value = siteSetting("languages.typing");
  return Array.isArray(value)
    ? (value as string[])
    : Language.ALL.map((language) => language.id);
}

export type RegistrationMode = "open" | "invite" | "closed";

export function registrationMode(): RegistrationMode {
  return siteChoice("registration.mode") as RegistrationMode;
}

export function inviteCodes(): readonly string[] {
  const value = siteSetting("registration.inviteCodes");
  return Array.isArray(value) ? (value as string[]) : [];
}

export function maintenanceEnabled(): boolean {
  return siteSwitch("maintenance.enabled");
}

export function maintenanceMessage(): string {
  return String(siteSetting("maintenance.message"));
}

export type MaintenanceRevert = "never" | "1h" | "4h" | "tomorrow06";

export function maintenanceRevertAfter(): MaintenanceRevert {
  return siteChoice("maintenance.revertAfter") as MaintenanceRevert;
}

/** The moment the leaderboard override ends, or null when there is none. */
export function leaderboardOverrideUntil(): Date | null {
  const value = siteSetting("leaderboard.override.until");
  if (typeof value !== "string") {
    return null;
  }
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function showLastLoginLocation(): boolean {
  return siteSwitch("privacy.showLastLoginLocation");
}

// ── phase 2: limits, features, operations ────────────────────────────────

export function profileCaps(): ProfileCaps {
  return {
    free: siteNumber("profiles.placesFree"),
    premium: siteNumber("profiles.placesPremium"),
  };
}

export function minAge(): number {
  return siteNumber("accounts.minAge");
}

export function minPasswordLength(): number {
  return siteNumber("security.minPasswordLength");
}

export function parentPinWindowMs(): number {
  return siteNumber("security.parentPinWindowMin") * 60 * 1000;
}

export function loginAttemptsPerMin(): number {
  return siteNumber("security.loginAttemptsPerMin");
}

export function threadLinkMs(): number {
  return siteNumber("retention.threadLinkDays") * 24 * 60 * 60 * 1000;
}

export function kidsCertificates(): boolean {
  return siteSwitch("kids.certificates");
}

export function brailleServerSpeech(): boolean {
  return siteSwitch("braille.serverSpeech");
}

/** The certificate criteria in force, in the shape the certificate package judges with. */
/**
 * Whether KeyLearn's adaptive helpers run at all. Off takes the four
 * `lesson.guided.*` layers away from every learner and removes their
 * controls: a learner cannot switch on an engine the site has turned off.
 */
export function smartPractice(): boolean {
  return siteSwitch("practice.smartPractice");
}

/** The four settings props smart practice governs. */
export const SMART_PRACTICE_PROPS: readonly string[] = [
  "lesson.guided.smartConfidence",
  "lesson.guided.skillDecay",
  "lesson.guided.spacedRepetition",
  "lesson.guided.bottleneckDrill",
];

export function certificateCriteria(): CertificateCriteria {
  return {
    adultTyping: {
      speed: siteNumber("certificates.adultTyping.wpm"),
      accuracy: siteNumber("certificates.adultTyping.accuracy"),
    },
    adultBraille: {
      speed: siteNumber("certificates.adultBraille.wpm"),
      accuracy: siteNumber("certificates.adultBraille.accuracy"),
    },
    practiceMargin: {
      typing: siteNumber("certificates.practiceMargin.typing"),
      braille: siteNumber("certificates.practiceMargin.braille"),
    },
    retention: {
      adult: siteNumber("certificates.retention.adult"),
      kid: siteNumber("certificates.retention.kid"),
    },
    sittingsCounted: siteNumber("certificates.sittingsCounted"),
  };
}

export function certificatesIssue(): boolean {
  return siteSwitch("certificates.issue");
}

export function certificatesNamedAdults(): boolean {
  return siteSwitch("certificates.namedAdults");
}

export function certificatesPublicVerify(): boolean {
  return siteSwitch("certificates.publicVerify");
}

/** 0 means unlimited. */
export function certificateAttemptsPerDay(): number {
  return siteNumber("certificates.attemptsPerDay");
}

export function schoolsAcceptInvites(): boolean {
  return siteSwitch("schools.acceptInvites");
}

export function schoolsNewOrganisations(): "open" | "closed" {
  return siteChoice("schools.newOrganisations") as "open" | "closed";
}

export function premiumSell(): boolean {
  return siteSwitch("premium.sell");
}

export function emailPracticeReminders(): boolean {
  return siteSwitch("email.practiceReminders");
}

export function emailProductNews(): boolean {
  return siteSwitch("email.productNews");
}

export function emailStaffDigest(): boolean {
  return siteSwitch("email.staffDigest");
}

/**
 * The site-wide learner defaults the client applies under every learner's
 * own settings (spec §6.3 Learner defaults): the registry rows for the
 * Features tab, keyed by the settings prop they feed.
 */
export function learnerDefaults(): Record<string, unknown> {
  return {
    "lesson.type": siteChoice("practice.defaultLessonType"),
    "lesson.targetSpeed": siteNumber("practice.defaultTargetSpeedCpm"),
    "lesson.dailyGoal": siteNumber("practice.defaultDailyGoalMin"),
    "typingTest.duration.value":
      siteNumber("typingTest.defaultDurationS") * 1000,
    "typingTest.textSource.type": siteChoice("typingTest.defaultSource"),
    "braille.goalMinutes": siteNumber("braille.defaultGoalMin"),
    "a11y.motion": siteChoice("a11y.defaultMotion"),
    "a11y.contrast": siteChoice("a11y.defaultContrast"),
    "kids.paceFloor": siteSetting("kids.paceFloorByBand"),
    "kids.paceCeil": siteSetting("kids.paceCeilByBand"),
    // Smart practice off means every adaptive layer is off for everyone.
    ...(smartPractice()
      ? {}
      : Object.fromEntries(SMART_PRACTICE_PROPS.map((prop) => [prop, false]))),
  };
}

/** The Features rows shown read-only as "Learner defaults", generated from the registry. */
export function learnerDefaultRows(): readonly {
  key: string;
  label: string;
  value: unknown;
  /** The override row governing this default, when it has one (phase 3.4). */
  overrideKey: string | null;
  override: string | null;
}[] {
  return REGISTRY.filter(
    (def) =>
      ["practice", "typingTest", "braille", "kids", "a11y"].includes(
        def.section,
      ) &&
      def.type !== "info" &&
      def.overrideOf == null,
  ).map((def) => {
    const override = REGISTRY.find((o) => o.overrideOf === def.key) ?? null;
    return {
      key: def.key,
      label: def.label,
      value: siteSetting(def.key),
      overrideKey: override?.key ?? null,
      override: override == null ? null : siteChoice(override.key),
    };
  });
}

// ── phase 3.4: learner overrides ─────────────────────────────────────────

/**
 * Which settings prop each override row governs. Spelled out as literals
 * so the contract test can see every wired key read here.
 */
const LEARNER_OVERRIDE_PROPS: readonly {
  readonly key: string;
  readonly prop: string;
}[] = [
  { key: "practice.defaultLessonType.override", prop: "lesson.type" },
  {
    key: "typingTest.defaultSource.override",
    prop: "typingTest.textSource.type",
  },
  { key: "a11y.defaultMotion.override", prop: "a11y.motion" },
  { key: "a11y.defaultContrast.override", prop: "a11y.contrast" },
];

/**
 * The learner defaults the site forces or hides, keyed by the settings prop
 * they govern. A prop at "default" is absent, so an empty object means the
 * learner decides everything, which is what a fresh install means.
 */
export function learnerOverrides(): Record<string, "forced" | "hidden"> {
  const out: Record<string, "forced" | "hidden"> = {};
  if (!smartPractice()) {
    // Forced off and hidden: the control would promise something the site
    // is not doing.
    for (const prop of SMART_PRACTICE_PROPS) {
      out[prop] = "hidden";
    }
  }
  for (const { key, prop } of LEARNER_OVERRIDE_PROPS) {
    const mode = siteChoice(key);
    if (mode === "forced" || mode === "hidden") {
      out[prop] = mode;
    }
  }
  return out;
}
