import { AbstractAdapter } from "../../adapter.ts";
import { type ResourceOwner } from "../../resource-owner.ts";
import { type ClientConfig } from "../../types.ts";
import { type MicrosoftProfileResponse } from "./types.ts";

// "common" accepts BOTH personal Microsoft accounts (outlook/hotmail/live) and
// work or school accounts (Microsoft 365 / Entra ID) — the right choice for a
// household + schools audience. Use "consumers" for personal-only, or a
// specific tenant id to restrict to one organisation. The Azure app
// registration's "supported account types" must match this.
const authorizationUri =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const tokenUri =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
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
      name: displayName || null,
      url: null,
      imageUrl: null,
    };
  }
}
