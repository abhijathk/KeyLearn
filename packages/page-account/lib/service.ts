import {
  type AnyUser,
  downloadBlob,
  exportFilename,
  type NotificationDetails,
  type ProfileAvatar,
  type ProfileDetails,
  type SecurityEventDetails,
  type UserDetails,
} from "@keylearn/pages-shared";
import { expectType, request } from "@keylearn/request";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

export type Passkey = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
};

/** Which factors an account can confirm a deletion with. */
export type DeleteMethods = {
  readonly email: boolean;
  readonly password: boolean;
  readonly totp: boolean;
  readonly passkey: boolean;
};

/** Exactly one of these proves the account holder meant it. */
export type DeleteProof = {
  readonly code?: string;
  readonly totp?: string;
  readonly password?: string;
  readonly passkey?: unknown;
};

export type ProfileInput = {
  readonly kind: "adult" | "kid";
  readonly firstName: string;
  readonly lastName?: string;
  readonly birthYear?: number | null;
  readonly avatar?: ProfileAvatar | null;
  readonly prefs?: unknown;
  /** Lead with audio and offer braille entry for this learner. */
  readonly visionSupport?: boolean;
  readonly parentalConsent?: boolean;
};

export type PatchAccountRequest = {
  readonly anonymized?: boolean;
  readonly publicProfile?: boolean;
  readonly name?: string;
};

export type PatchAccountResponse = {
  readonly user: UserDetails;
  readonly publicUser: AnyUser;
};

export namespace AccountService {
  export async function registerEmail(
    email: string,
    turnstileToken?: string,
  ): Promise<unknown> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/auth/login/register-email")
      .send({ email, turnstileToken });
    return await response.json();
  }

  // On success these return { ok: true }; on failure the request middleware
  // already throws an ApplicationError carrying the server's message (the
  // error handler negotiates JSON for our Accept header), so we just await.
  async function postAuth(path: string, data: object): Promise<void> {
    await request.use(expectType("application/json")).POST(path).send(data);
  }

  /** As postAuth, but hands back the parsed response body. */
  async function postAuthJson<T>(path: string, data: object): Promise<T> {
    const response = await request
      .use(expectType("application/json"))
      .POST(path)
      .send(data);
    return (await response.json()) as T;
  }

  /**
   * The account is ready ({ ok: true }); the email still needs verifying
   * ({ verify: true, email }); or the password was right but the account
   * has two-step verification on, so the session is only pending until a
   * current code is supplied ({ twoFactor: true }) — in every one of these
   * cases except the first, the caller must show a further step rather
   * than treat the call as a finished sign-in.
   */
  export type AuthResult =
    | { readonly ok: true }
    | { readonly verify: true; readonly email: string }
    | { readonly twoFactor: true };

  async function postAuthResult(
    path: string,
    data: object,
  ): Promise<AuthResult> {
    const response = await request
      .use(expectType("application/json"))
      .POST(path)
      .send(data);
    return (await response.json()) as AuthResult;
  }

  export async function registerPassword(data: {
    readonly email: string;
    readonly password: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly dateOfBirth: string;
    readonly turnstileToken?: string;
    readonly inviteCode?: string;
  }): Promise<AuthResult> {
    return await postAuthResult("/auth/register-password", data);
  }

  export type Lookup =
    | { readonly exists: false }
    | {
        readonly exists: true;
        readonly hasPassword: boolean;
        readonly twoFactor: boolean;
        readonly providers: readonly string[];
      };

  /** Asks what this address needs next, before showing a password field. */
  export async function lookup(data: {
    readonly email: string;
    readonly turnstileToken?: string;
  }): Promise<Lookup> {
    return await postAuthJson<Lookup>("/auth/lookup", data);
  }

  export async function loginPassword(data: {
    readonly email: string;
    readonly password: string;
    readonly turnstileToken?: string;
    readonly remember?: boolean;
  }): Promise<AuthResult> {
    return await postAuthResult("/auth/login-password", data);
  }

  /** Confirm the emailed 6-digit code; signs the account in on success. */
  export async function verifyEmail(data: {
    readonly email: string;
    readonly code: string;
  }): Promise<void> {
    await postAuth("/auth/verify-email", data);
  }

  /** Ask for a fresh verification code (always resolves — never reveals whether the email exists). */
  export async function resendCode(
    email: string,
    turnstileToken?: string,
  ): Promise<void> {
    await postAuth("/auth/resend-code", { email, turnstileToken });
  }

  export async function completeProfile(dateOfBirth: string): Promise<void> {
    await postAuth("/auth/complete-profile", { dateOfBirth });
  }

  export async function signOutEverywhere(): Promise<void> {
    const response = await request
      .POST("/_/account/sign-out-everywhere")
      .send();
    await response.blob(); // Ignore.
  }

  export async function changePassword(data: {
    readonly currentPassword?: string;
    readonly newPassword: string;
  }): Promise<void> {
    await postAuth("/auth/change-password", data);
  }

  /**
   * Send an identity code to the account's CURRENT email — the verification
   * step for password-less (SSO) accounts before changing their email.
   */
  export async function sendChangeEmailIdentityCode(): Promise<void> {
    await postAuth("/auth/change-email/identity-code", {});
  }

  /** Start an email change: sends a 6-digit code to the new address. */
  export async function changeEmail(
    email: string,
    opts: { password?: string; identityCode?: string } = {},
  ): Promise<void> {
    await postAuth("/auth/change-email", { email, ...opts });
  }

  /** Confirm the code sent to the new address; switches the account email. */
  export async function verifyEmailChange(code: string): Promise<void> {
    await postAuth("/auth/verify-email-change", { code });
  }

  // ---- Passkeys (WebAuthn) ----

  export function passkeysSupported(): boolean {
    try {
      return browserSupportsWebAuthn();
    } catch {
      return false;
    }
  }

  async function postJson(path: string, data?: object): Promise<any> {
    const response = await request
      .use(expectType("application/json"))
      .POST(path)
      .send(data ?? {});
    return await response.json();
  }

  /** Create a passkey for the signed-in account (a browser prompt appears). */
  export async function registerPasskey(name?: string): Promise<void> {
    const optionsJSON = await postJson("/auth/passkey/register-options");
    const response = await startRegistration({ optionsJSON });
    await postJson("/auth/passkey/register-verify", { response, name });
  }

  /** Sign in with a passkey (usernameless). Reload on success. */
  export async function loginPasskey(): Promise<void> {
    const optionsJSON = await postJson("/auth/passkey/login-options");
    const response = await startAuthentication({ optionsJSON });
    await postJson("/auth/passkey/login-verify", response);
  }

  // ---- Two-step verification ----

  /** Mint a secret and get the otpauth URI to show as a QR code. */
  export async function twoFactorBegin(): Promise<{
    secret: string;
    uri: string;
  }> {
    return await postAuthJson<{ secret: string; uri: string }>(
      "/_/account/2fa/begin",
      {},
    );
  }

  /** Confirm the app is set up, switching it on. Returns the recovery codes. */
  export async function twoFactorEnable(code: string): Promise<string[]> {
    const body = await postAuthJson<{ recoveryCodes: string[] }>(
      "/_/account/2fa/enable",
      { code },
    );
    return body.recoveryCodes;
  }

  export async function twoFactorDisable(data: {
    readonly password?: string;
    readonly code?: string;
  }): Promise<void> {
    await postAuth("/_/account/2fa/disable", data);
  }

  /** Second step of signing in. */
  export async function twoFactorVerify(code: string): Promise<void> {
    await postAuth("/auth/2fa/verify", { code });
  }

  // ---- Grown-up PIN ----

  export async function setParentPin(data: {
    readonly pin: string | null;
    readonly currentPin?: string;
    readonly password?: string;
  }): Promise<void> {
    await postAuth("/_/account/parent-pin", data);
  }

  export async function verifyParentPin(pin: string): Promise<void> {
    await postAuth("/_/account/parent-pin/verify", { pin });
  }

  /** Downloads everything the account holds, as a JSON file. */
  export async function exportData(
    who: string | null | undefined,
    stamp: string,
  ): Promise<void> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/account/export")
      .send();
    const blob = new Blob([JSON.stringify(await response.json(), null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, exportFilename("account", who, "json", stamp));
  }

  export async function listSecurityEvents(): Promise<SecurityEventDetails[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/account/security-events")
      .send();
    return ((await response.json()) as { events: SecurityEventDetails[] })
      .events;
  }

  export async function listPasskeys(): Promise<Passkey[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/passkeys")
      .send();
    return ((await response.json()) as { passkeys: Passkey[] }).passkeys;
  }

  export async function deletePasskey(id: string): Promise<Passkey[]> {
    const response = await request
      .use(expectType("application/json"))
      .DELETE(`/_/passkeys/${id}`)
      .send();
    return ((await response.json()) as { passkeys: Passkey[] }).passkeys;
  }

  export async function listNotifications(): Promise<{
    readonly notifications: readonly NotificationDetails[];
    readonly unread: number;
  }> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/account/notifications")
      .send();
    return (await response.json()) as {
      notifications: readonly NotificationDetails[];
      unread: number;
    };
  }

  /** Removed from the list — the ticket it points at is untouched. */
  export async function dismissNotification(id: number): Promise<void> {
    await request
      .use(expectType("application/json"))
      .DELETE(`/_/account/notifications/${id}`)
      .send();
  }

  export async function dismissAllNotifications(): Promise<void> {
    await request
      .use(expectType("application/json"))
      .DELETE("/_/account/notifications")
      .send();
  }

  export async function markNotificationRead(id: number): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST(`/_/account/notifications/${id}/read`)
      .send({});
  }

  export async function forgotPassword(
    email: string,
    turnstileToken?: string,
  ): Promise<void> {
    await postAuth("/auth/forgot-password", { email, turnstileToken });
  }

  export async function resetPassword(data: {
    readonly token: string;
    readonly password: string;
    readonly turnstileToken?: string;
  }): Promise<void> {
    await postAuth("/auth/reset-password", data);
  }

  export async function patchAccount(
    data: PatchAccountRequest,
  ): Promise<PatchAccountResponse> {
    const response = await request
      .use(expectType("application/json"))
      .PATCH("/_/account")
      .send(data);
    return await response.json();
  }

  /** Send a 6-digit confirmation code to the registered email. */
  export async function sendDeleteAccountCode(): Promise<void> {
    const response = await request.POST("/_/account/delete-code").send();
    await response.blob(); // Ignore.
  }

  /** Which factors this account can confirm a deletion with. */
  export async function deleteAccountMethods(): Promise<DeleteMethods> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/account/delete-methods")
      .send();
    return (await response.json()) as DeleteMethods;
  }

  /**
   * Confirm deletion with exactly one factor. The caller supplies whichever
   * the account holder chose; the server accepts any the account actually has.
   */
  export async function deleteAccount(
    proof: DeleteProof,
    keepStats: boolean,
  ): Promise<void> {
    const response = await request
      .POST("/_/account/delete")
      .send({ ...proof, keepStats });
    await response.blob(); // Ignore.
  }

  /** Prompt for one of this account's passkeys and return the assertion. */
  export async function deleteAccountPasskeyProof(): Promise<DeleteProof> {
    const optionsJSON = await postJson("/_/account/delete-passkey-options");
    return { passkey: await startAuthentication({ optionsJSON }) };
  }

  // ---- Household profiles (server-side). All return the full updated list. ----

  async function profilesOf(response: {
    json: () => Promise<{ profiles: ProfileDetails[] }>;
  }): Promise<ProfileDetails[]> {
    return (await response.json()).profiles;
  }

  export async function listProfiles(): Promise<ProfileDetails[]> {
    return await profilesOf(
      await request
        .use(expectType("application/json"))
        .GET("/_/profiles")
        .send(),
    );
  }

  export async function createProfile(
    data: ProfileInput,
  ): Promise<ProfileDetails[]> {
    return await profilesOf(
      await request
        .use(expectType("application/json"))
        .POST("/_/profiles")
        .send(data),
    );
  }

  export async function updateProfile(
    id: string,
    patch: Partial<ProfileInput>,
  ): Promise<ProfileDetails[]> {
    return await profilesOf(
      await request
        .use(expectType("application/json"))
        .PATCH(`/_/profiles/${id}`)
        .send(patch),
    );
  }

  export async function deleteProfile(id: string): Promise<ProfileDetails[]> {
    return await profilesOf(
      await request
        .use(expectType("application/json"))
        .DELETE(`/_/profiles/${id}`)
        .send(),
    );
  }

  /** Whether the account window itself is behind the grown-up PIN. */
  export type AccountGate = {
    readonly required: boolean;
    readonly proved: boolean;
    /** One box per digit; null until the length has been recorded. */
    readonly length: number | null;
  };

  export async function getAccountGate(): Promise<AccountGate> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/account/pin-gate")
      .send();
    return (await response.json()) as AccountGate;
  }

  // ---- The way back in when a factor is lost ----

  /** What this account can reset, and the state of each. */
  export type SecurityResetOptions = {
    /** Masked — enough to recognise, not enough to hand out. */
    readonly email: string | null;
    readonly password: {
      readonly available: boolean;
      readonly hasPassword: boolean;
    };
    readonly twoFactor: {
      readonly available: boolean;
      readonly enabled: boolean;
    };
    readonly recoveryCodes: {
      readonly available: boolean;
      readonly left: number;
    };
    readonly parentPin: { readonly available: boolean; readonly set: boolean };
  };

  export type SecurityResetScope = {
    readonly password: boolean;
    readonly twoFactor: boolean;
    readonly recoveryCodes: boolean;
    readonly parentPin: boolean;
  };

  export async function getSecurityResetOptions(): Promise<SecurityResetOptions> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/account/security-reset/options")
      .send();
    return (await response.json()) as SecurityResetOptions;
  }

  /**
   * Asks for a code for exactly this selection. The server records the
   * choice, so the code that comes back cannot be spent on anything else.
   */
  export async function sendSecurityResetCode(
    scope: SecurityResetScope,
  ): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST("/_/account/security-reset/code")
      .send(scope);
  }

  export async function confirmSecurityReset(code: string): Promise<{
    readonly done: readonly string[];
    readonly passwordLinkSent: boolean;
  }> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/account/security-reset")
      .send({ code });
    return (await response.json()) as {
      done: readonly string[];
      passwordLinkSent: boolean;
    };
  }
}
