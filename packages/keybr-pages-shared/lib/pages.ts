import { defaultLocale } from "@keybr/intl";
import {
  mdiCarSide,
  mdiChartAreaspline,
  mdiHelpCircleOutline,
  mdiKeyboard,
  mdiKeyboardOutline,
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
        defaultMessage: "Race other typists online in real time.",
      }),
      icon: mdiCarSide,
    },
    meta: [
      ...meta,
      {
        name: "description",
        content: defineMessage({
          id: "page.multiplayer.description",
          defaultMessage: "Race other typists online in real time.",
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
