export type MicrosoftProfileResponse = {
  readonly id: string;
  readonly displayName?: string;
  readonly surname?: string;
  readonly givenName?: string;
  readonly userPrincipalName?: string;
  // The account's real email. Present for most work/school accounts; may be
  // absent, in which case we fall back to the userPrincipalName.
  readonly mail?: string;
};
