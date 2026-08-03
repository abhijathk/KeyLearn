export type ResourceOwner<TRaw = unknown> = {
  readonly raw: TRaw;
  readonly provider: string;
  /**
   * The provider's stable, immutable identifier for this account (OIDC `sub`).
   * This — never the email address — is the account's identity: an email can be
   * asserted by any provider, so keying on it lets one provider impersonate a
   * user of another.
   */
  readonly id: string;
  readonly email: string | null;
  /**
   * Whether the provider asserts that it has verified this email belongs to
   * this subject.
   *
   * `null` means the provider gives us no such signal, and MUST be treated
   * exactly as `false` by anything making a trust decision — never as "probably
   * fine". Only a `true` here may be used to link this identity to a
   * pre-existing account.
   */
  readonly emailVerified: boolean | null;
  readonly name: string | null;
  readonly url: string | null;
  readonly imageUrl: string | null;
};
