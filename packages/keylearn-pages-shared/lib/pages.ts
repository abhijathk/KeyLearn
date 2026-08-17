import { defaultLocale } from "@keylearn/intl";
import {
  mdiAccountGroupOutline,
  mdiBookOpenPageVariantOutline,
  mdiChartAreaspline,
  mdiDotsGrid,
  mdiHelpCircleOutline,
  mdiKeyboard,
  mdiKeyboardOutline,
  mdiLifebuoy,
  mdiSpeedometer,
  mdiTeddyBear,
  mdiTrophyOutline,
} from "@mdi/js";
import { defineMessage, type MessageDescriptor } from "react-intl";
import { type AnonymousUser, type AnyUser, type NamedUser } from "./types.ts";

export type Meta = {
  readonly name?: string;
  readonly property?: string;
  readonly content: string | MessageDescriptor;
};

export type PageInfo = {
  readonly path: string;
  readonly title: MessageDescriptor;
  readonly link: {
    readonly label: MessageDescriptor;
    readonly title?: MessageDescriptor;
    readonly icon?: string;
  };
  readonly meta: Meta[];
};

export namespace Pages {
  const meta: Meta[] = [
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "KeyLearn - Typing lessons" },
    { property: "og:title", content: "KeyLearn - Typing lessons" },
    {
      property: "og:description",
      content:
        "Teaching the world to type at the speed of thought! Typing lessons that work.",
    },
    { name: "twitter:card", content: "summary" },
  ];

  export const account = {
    path: "/account",
    title: defineMessage({
      id: "t_Account",
      defaultMessage: "Account",
    }),
    link: {
      label: defineMessage({
        id: "t_Account",
        defaultMessage: "Account",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  // The theme designer: a colour of your own, when none of the shipped ones
  // is the one you want. Reached from the Custom chip in Account → Appearance.
  export const design = {
    path: "/design",
    title: defineMessage({
      id: "t_ThemeDesigner",
      defaultMessage: "Theme designer",
    }),
    link: {
      label: defineMessage({
        id: "t_ThemeDesigner",
        defaultMessage: "Theme designer",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * Checking a certificate number.
   *
   * Public and unauthenticated on purpose — the person who needs to check one
   * is usually not the person who holds it, and often has no account at all.
   */
  export const verify = {
    path: "/verify",
    title: defineMessage({
      id: "t_VerifyCertificate",
      defaultMessage: "Check a certificate",
    }),
    link: {
      label: defineMessage({
        id: "t_VerifyCertificate",
        defaultMessage: "Check a certificate",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * Sitting the assessment.
   *
   * No nav link: this is reached from the account page, and only once the
   * practice has proved everything it can. A menu entry would offer it to
   * every learner every day, which is exactly the thing the eligibility rules
   * exist to prevent.
   */
  export const assessment = {
    path: "/assessment",
    title: defineMessage({
      id: "t_Assessment",
      defaultMessage: "Assessment",
    }),
    // Every page carries a label; nothing renders this one, because the
    // assessment is deliberately absent from the menu.
    link: {
      label: defineMessage({
        id: "t_Assessment",
        defaultMessage: "Assessment",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const practice = {
    path: "/",
    title: defineMessage({
      id: "t_Practice",
      defaultMessage: "Practice",
    }),
    link: {
      label: defineMessage({
        id: "t_Practice",
        defaultMessage: "Practice",
      }),
      title: defineMessage({
        id: "page.practice.description",
        defaultMessage:
          "Guided typing lessons that build your speed and accuracy.",
      }),
      icon: mdiKeyboard,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.practice.description",
          defaultMessage:
            "Guided typing lessons that build your speed and accuracy.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const profiles = {
    path: "/profiles",
    title: defineMessage({ id: "t_Profiles", defaultMessage: "Profiles" }),
    link: {
      label: defineMessage({ id: "t_Profiles", defaultMessage: "Profiles" }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const login = {
    path: "/login",
    title: defineMessage({ id: "t_Log_In", defaultMessage: "Log In" }),
    link: {
      label: defineMessage({ id: "t_Log_In", defaultMessage: "Log In" }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const register = {
    path: "/register",
    title: defineMessage({ id: "t_Register", defaultMessage: "Register" }),
    link: {
      label: defineMessage({ id: "t_Register", defaultMessage: "Register" }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const forgotPassword = {
    path: "/forgot-password",
    title: defineMessage({
      id: "t_Forgot_Password",
      defaultMessage: "Forgot Password",
    }),
    link: {
      label: defineMessage({
        id: "t_Forgot_Password",
        defaultMessage: "Forgot Password",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const resetPassword = {
    path: "/reset-password",
    title: defineMessage({
      id: "t_Reset_Password",
      defaultMessage: "Reset Password",
    }),
    link: {
      label: defineMessage({
        id: "t_Reset_Password",
        defaultMessage: "Reset Password",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const kids = {
    path: "/kids",
    title: defineMessage({
      id: "t_Kids",
      defaultMessage: "Kids",
    }),
    link: {
      label: defineMessage({
        id: "t_Kids",
        defaultMessage: "Kids",
      }),
      title: defineMessage({
        id: "page.kids.description",
        defaultMessage:
          "A dino typing adventure for kids — same smart lessons, playful world.",
      }),
      icon: mdiTeddyBear,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.kids.description",
          defaultMessage:
            "A dino typing adventure for kids — same smart lessons, playful world.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const profile = {
    path: "/profile",
    title: defineMessage({
      id: "t_Profile",
      defaultMessage: "Profile",
    }),
    link: {
      label: defineMessage({
        id: "t_Profile",
        defaultMessage: "Profile",
      }),
      title: defineMessage({
        id: "page.profile.description",
        defaultMessage: "A detailed look at your typing progress over time.",
      }),
      icon: mdiChartAreaspline,
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const help = {
    path: "/help",
    title: defineMessage({
      id: "t_Help",
      defaultMessage: "Help",
    }),
    link: {
      label: defineMessage({
        id: "t_Help",
        defaultMessage: "Help",
      }),
      title: defineMessage({
        id: "page.help.description",
        defaultMessage: "How to get the most out of KeyLearn.",
      }),
      icon: mdiHelpCircleOutline,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.help.description",
          defaultMessage: "How to get the most out of KeyLearn.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const highScores = {
    path: "/high-scores",
    title: defineMessage({
      id: "t_High_Scores",
      defaultMessage: "Leaderboard",
    }),
    link: {
      label: defineMessage({
        id: "t_High_Scores",
        defaultMessage: "Leaderboard",
      }),
      title: defineMessage({
        id: "page.highScores.description",
        defaultMessage: "See how the fastest typists rank.",
      }),
      icon: mdiTrophyOutline,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.highScores.description",
          defaultMessage: "See how the fastest typists rank.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const braille = {
    path: "/braille",
    title: defineMessage({
      id: "t_Braille",
      defaultMessage: "Braille typing",
    }),
    link: {
      label: defineMessage({
        id: "t_Braille",
        defaultMessage: "Braille typing",
      }),
      title: defineMessage({
        id: "page.braille.description",
        defaultMessage:
          "Practise six-key braille entry on an ordinary keyboard.",
      }),
      icon: mdiDotsGrid,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.braille.description",
          defaultMessage:
            "Practise six-key braille entry on an ordinary keyboard.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const multiplayer = {
    path: "/multiplayer",
    title: defineMessage({
      id: "t_Multiplayer",
      defaultMessage: "Multiplayer",
    }),
    link: {
      label: defineMessage({
        id: "t_Multiplayer",
        defaultMessage: "Multiplayer",
      }),
      title: defineMessage({
        id: "page.multiplayer.description",
        defaultMessage:
          "Practise alongside other people, all typing the same passage at once.",
      }),
      icon: mdiAccountGroupOutline,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.multiplayer.description",
          defaultMessage:
            "Practise alongside other people, all typing the same passage at once.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const typingTest = {
    path: "/typing-test",
    title: defineMessage({
      id: "t_Typing_Test",
      defaultMessage: "Speed Test",
    }),
    link: {
      label: defineMessage({
        id: "t_Typing_Test",
        defaultMessage: "Speed Test",
      }),
      title: defineMessage({
        id: "page.typingTest.description",
        defaultMessage: "Test your typing speed and accuracy.",
      }),
      icon: mdiSpeedometer,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.typingTest.description",
          defaultMessage: "Test your typing speed and accuracy.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const layouts = {
    path: "/layouts",
    title: defineMessage({
      id: "t_Layouts",
      defaultMessage: "Layouts",
    }),
    link: {
      label: defineMessage({
        id: "t_Layouts",
        defaultMessage: "Layouts",
      }),
      title: defineMessage({
        id: "page.layouts.description",
        defaultMessage: "Compare keyboard layouts side by side.",
      }),
      icon: mdiKeyboardOutline,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.layouts.description",
          defaultMessage: "Compare keyboard layouts side by side.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const texts = {
    path: "/texts",
    title: defineMessage({
      id: "t_Texts",
      defaultMessage: "Texts",
    }),
    link: {
      label: defineMessage({
        id: "t_Texts",
        defaultMessage: "Texts",
      }),
      title: defineMessage({
        id: "page.texts.description",
        defaultMessage:
          "Browse the practice library — books, your own text, words, code and numbers.",
      }),
      icon: mdiBookOpenPageVariantOutline,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.texts.description",
          defaultMessage:
            "Browse the practice library — books, your own text, words, code and numbers.",
        }),
      },
    ],
  } satisfies PageInfo;

  export const termsOfService = {
    path: "/terms-of-service",
    title: defineMessage({
      id: "t_Terms_of_Service",
      defaultMessage: "Terms of Service",
    }),
    link: {
      label: defineMessage({
        id: "t_Terms_of_Service",
        defaultMessage: "Terms of Service",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const privacyPolicy = {
    path: "/privacy-policy",
    title: defineMessage({
      id: "t_Privacy_Policy",
      defaultMessage: "Privacy Policy",
    }),
    link: {
      label: defineMessage({
        id: "t_Privacy_Policy",
        defaultMessage: "Privacy Policy",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export const accessibility = {
    path: "/accessibility",
    title: defineMessage({
      id: "t_Accessibility",
      defaultMessage: "Accessibility",
    }),
    link: {
      label: defineMessage({
        id: "t_Accessibility",
        defaultMessage: "Accessibility",
      }),
    },
    // Indexable, unlike the policy pages: a school looking for this before
    // they buy should be able to find it, and so should a search for the
    // statement a public body is obliged to check for.
    meta,
  } satisfies PageInfo;

  export const about = {
    path: "/about",
    title: defineMessage({
      id: "t_About",
      defaultMessage: "About",
    }),
    link: {
      label: defineMessage({
        id: "t_About",
        defaultMessage: "About",
      }),
    },
    meta,
  } satisfies PageInfo;

  export const guide = {
    path: "/guide",
    title: defineMessage({
      id: "guide.title",
      defaultMessage: "User Guide",
    }),
    link: {
      label: defineMessage({
        id: "guide.title",
        defaultMessage: "User Guide",
      }),
      title: defineMessage({
        id: "guide.dateline",
        defaultMessage: "How KeyLearn works, start to finish",
      }),
      icon: mdiHelpCircleOutline,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "guide.dateline",
          defaultMessage: "How KeyLearn works, start to finish",
        }),
      },
    ],
  } satisfies PageInfo;

  export const support = {
    path: "/support",
    title: defineMessage({
      id: "support.headline",
      defaultMessage: "Support",
    }),
    link: {
      label: defineMessage({
        id: "support.headline",
        defaultMessage: "Support",
      }),
      title: defineMessage({
        id: "page.support.description",
        defaultMessage: "Answers to common questions, and a way to reach us.",
      }),
      icon: mdiLifebuoy,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.support.description",
          defaultMessage: "Answers to common questions, and a way to reach us.",
        }),
      },
    ],
  } satisfies PageInfo;

  /**
   * The account holder's own view of a staff-requested deletion, reached
   * only via the emailed cancel link — no nav link, no staff auth. The base
   * path only — the token is appended separately, same convention
   * {@link deskThread} uses for its own id-suffixed variant.
   */
  export const deletionCancel = {
    path: "/support/deletion-cancel",
    title: defineMessage({
      id: "deletionCancel.headline",
      defaultMessage: "Account deletion",
    }),
    link: {
      label: defineMessage({
        id: "deletionCancel.headline",
        defaultMessage: "Account deletion",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * The staff console's landing page — today's numbers first, per the
   * mock's own "opens on the dashboard, not the inbox" rule. No nav link —
   * reached only from a staff-gated link elsewhere, the same "absent from
   * the menu" pattern {@link assessment} uses for a page nobody should be
   * routinely offered.
   */
  export const desk = {
    path: "/desk",
    title: defineMessage({
      id: "staffDesk.headline",
      defaultMessage: "Support desk",
    }),
    link: {
      label: defineMessage({
        id: "staffDesk.headline",
        defaultMessage: "Support desk",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /** Every ticket, newest first — the desk's second screen. */
  export const deskInbox = {
    path: "/desk/inbox",
    title: defineMessage({
      id: "deskNav.inbox",
      defaultMessage: "Inbox",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.inbox",
        defaultMessage: "Inbox",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * One ticket's thread, with everything known about the sender beside it.
   * The base path only — the `:id`/`{id}` param is appended by the client
   * route and the server's SSR handler separately, the same convention
   * {@link profile} uses for its own id-suffixed variant.
   */
  export const deskThread = {
    path: "/desk/t",
    title: defineMessage({
      id: "deskNav.inbox",
      defaultMessage: "Inbox",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.inbox",
        defaultMessage: "Inbox",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /** Search and open any registered account — facts only, never a profile. */
  export const deskAccounts = {
    path: "/desk/accounts",
    title: defineMessage({
      id: "deskNav.accounts",
      defaultMessage: "Accounts",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.accounts",
        defaultMessage: "Accounts",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * One account's facts, opened from a search result. The base path only —
   * the `:id`/`{id}` param is appended separately, same convention as
   * {@link deskThread}.
   */
  export const deskAccountDetail = {
    path: "/desk/accounts/a",
    title: defineMessage({
      id: "deskNav.accounts",
      defaultMessage: "Accounts",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.accounts",
        defaultMessage: "Accounts",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /** The how-to library, and the keyword rules that decide when it answers. */
  export const deskAnswers = {
    path: "/desk/answers",
    title: defineMessage({
      id: "deskNav.answers",
      defaultMessage: "Answers",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.answers",
        defaultMessage: "Answers",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /** What appears at the top of the app, and when. */
  export const deskNotices = {
    path: "/desk/notices",
    title: defineMessage({
      id: "deskNav.notices",
      defaultMessage: "Notices",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.notices",
        defaultMessage: "Notices",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * How the desk behaves for the app currently selected — confidence
   * threshold, automation, saved replies, the signed-in staff member's own
   * preferences. Preferences and content only — cannot grant access, move
   * mail, or weaken sign-in. Staff access itself, and (eventually) which
   * app is selected, live in {@link deskPlatformSettings} instead.
   */
  export const deskSettings = {
    path: "/desk/settings",
    title: defineMessage({
      id: "deskNav.settings",
      defaultMessage: "Settings",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.settings",
        defaultMessage: "Settings",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /** Read-only staff action log. Reached from a link on the desk itself. */
  export const deskAudit = {
    path: "/desk/audit",
    title: defineMessage({
      id: "staffDesk.auditLink",
      defaultMessage: "Audit log",
    }),
    link: {
      label: defineMessage({
        id: "staffDesk.auditLink",
        defaultMessage: "Audit log",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /** Version, release notes, and what this app is versus KeyLearn itself. */
  export const deskAbout = {
    path: "/desk/about",
    title: defineMessage({
      id: "deskNav.about",
      defaultMessage: "About",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.about",
        defaultMessage: "About",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * The desk platform itself, not any one app it manages: who has staff
   * access, and (once more than one app is assigned to the same staff
   * email) which app is currently selected. {@link deskSettings} holds
   * everything about how the desk behaves for the selected app instead —
   * this page is deliberately the smaller of the two.
   */
  export const deskPlatformSettings = {
    path: "/desk/platform-settings",
    title: defineMessage({
      id: "deskNav.platformSettings",
      defaultMessage: "QDesk settings",
    }),
    link: {
      label: defineMessage({
        id: "deskNav.platformSettings",
        defaultMessage: "QDesk settings",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  /**
   * Passkey-first sign-in for the desk, separate from the general
   * `/login` window. Reached only when a staff visitor isn't already
   * signed in as an eligible account — {@link DeskShell} (every screen
   * under `/desk`) redirects here with a `returnTo` back to itself instead
   * of bouncing to `/practice`.
   */
  export const deskSignin = {
    path: "/desk/signin",
    title: defineMessage({
      id: "staffDesk.signin.headline",
      defaultMessage: "Staff sign-in",
    }),
    link: {
      label: defineMessage({
        id: "staffDesk.signin.headline",
        defaultMessage: "Staff sign-in",
      }),
    },
    meta: [{ name: "robots", content: "noindex" }],
  } satisfies PageInfo;

  export function profileOf(arg: string): string;
  export function profileOf(arg: NamedUser): string;
  export function profileOf(arg: AnonymousUser): null;
  export function profileOf(arg: AnyUser): string | null;
  export function profileOf(arg: null): null;
  export function profileOf(arg: any): string | null {
    if (arg == null) {
      return null;
    }
    if (typeof arg === "string") {
      return `${Pages.profile.path}/${arg}`;
    }
    if (typeof arg === "object" && typeof arg.id === "string") {
      return `${Pages.profile.path}/${arg.id}`;
    }
    return null;
  }

  export function intlBase(locale: string): string {
    return locale === defaultLocale ? "" : `/${locale}`;
  }

  export function intlPath(path: string, locale: string): string {
    return locale === defaultLocale
      ? path
      : path === "/"
        ? `/${locale}`
        : `/${locale}${path}`;
  }
}
