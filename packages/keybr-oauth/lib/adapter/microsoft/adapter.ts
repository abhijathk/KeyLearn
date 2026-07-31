import { AbstractAdapter } from "../../adapter.ts";
import { type ResourceOwner } from "../../resource-owner.ts";
import { type ClientConfig } from "../../types.ts";
import { type MicrosoftProfileResponse } from "./types.ts";

// Which Microsoft authority to sign users in against:
//   "common"    — personal accounts AND any work/school tenant (the default);
//   "consumers" — personal Microsoft accounts only;
//   <tenant id> — one named organisation only.
//
// "common" is the right reach for a household + schools audience, but it means
// any Entra tenant on the internet can present an arbitrary `mail` address.
// That is safe here only because such an address can never claim an existing
// account (see `emailVerified` below); operators who want Microsoft addresses
// treated as authoritative should pin this to their own tenant.
const authority = process.env.AUTH_MICROSOFT_TENANT || "common";
const authorizationUri = `https://login.microsoftonline.com/${authority}/oauth2/v2.0/authorize`;
const tokenUri = `https://login.microsoftonline.com/${authority}/oauth2/v2.0/token`;
const profileUri = "https://graph.microsoft.com/v1.0/me";

export class MicrosoftAdapter extends AbstractAdapter {
  constructor(config: ClientConfig) {
    super(config, { authorizationUri, tokenUri, profileUri });
  }

  protected parseProfileResponse(
    response: MicrosoftProfileResponse,
  ): ResourceOwner<MicrosoftProfileResponse> {
    const { id, mail, userPrincipalName, displayName } = response;
    return {
      raw: response,
      provider: "microsoft",
      id: id,
      // Prefer the real mailbox address; fall back to the UPN (which is the
      // email for personal accounts and most work/school accounts).
      email: mail || userPrincipalName || null,
      // Microsoft Graph exposes NO email-verification signal, and against the
      // "common" authority any tenant can set a user's `mail` to an address it
      // does not own — the nOAuth takeover. So this is always `null`: the
      // address is usable for display and for creating a brand-new (unverified)
      // account, but never for claiming one that already exists.
      //
      // Deployments that need Microsoft sign-in to be self-verifying should pin
      // AUTH_MICROSOFT_TENANT to their own tenant id, where directory addresses
      // are administratively controlled.
      emailVerified: null,
      name: displayName || null,
      url: null,
      imageUrl: null,
    };
  }
}
