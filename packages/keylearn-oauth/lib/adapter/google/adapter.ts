import { AbstractAdapter } from "../../adapter.ts";
import { type ResourceOwner } from "../../resource-owner.ts";
import { type ClientConfig } from "../../types.ts";
import { type GoogleProfileResponse } from "./types.ts";

const authorizationUri = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenUri = "https://oauth2.googleapis.com/token";
const profileUri = "https://openidconnect.googleapis.com/v1/userinfo";

export class GoogleAdapter extends AbstractAdapter {
  constructor(config: ClientConfig) {
    super(config, { authorizationUri, tokenUri, profileUri });
  }

  protected override parseProfileResponse(
    response: GoogleProfileResponse,
  ): ResourceOwner<GoogleProfileResponse> {
    const { sub, name, picture, email, email_verified } = response;
    return {
      raw: response,
      provider: "google",
      id: sub,
      email: email || null,
      // Google returns this on the OIDC userinfo endpoint. It is false for,
      // among others, Workspace aliases the domain never confirmed, so it must
      // be checked rather than assumed.
      emailVerified: email_verified === true,
      name: name || null,
      url: null,
      imageUrl: picture || null,
    };
  }
}
