import { type LocaleId } from "@keybr/intl";

export type PageData = {
  /**
   * Whether the leaderboard is worth showing yet. False until the community is
   * large enough for a ranking to be meaningful — the navigation link is hidden
   * until then, so nobody is sent to an empty or misleading board.
   */
  readonly leaderboard?: boolean;
  /**
   * Base URL.
   */
  readonly base: string;
  /**
   * Active locale identifier.
   */
  readonly locale: LocaleId;
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
  | { readonly type: "photo"; readonly dataUrl: string };

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
  readonly createdAt: Date;
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
  /** Whether a grown-up PIN guards profile management. */
  readonly parentPinSet: boolean;
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
};

export type AnyUser = AnonymousUser | NamedUser;
