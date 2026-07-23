import { type AnyUser, type UserDetails } from "@keybr/pages-shared";
import { expectType, request } from "@keybr/request";

export type PatchAccountRequest = {
  readonly anonymized: boolean;
};

export type PatchAccountResponse = {
  readonly user: UserDetails;
  readonly publicUser: AnyUser;
};

export namespace AccountService {
  export async function registerEmail(email: string): Promise<unknown> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/auth/login/register-email")
      .send({ email });
    return await response.json();
  }

  // On success these return { ok: true }; on failure the request middleware
  // already throws an ApplicationError carrying the server's message (the
  // error handler negotiates JSON for our Accept header), so we just await.
  async function postAuth(path: string, data: object): Promise<void> {
    await request.use(expectType("application/json")).POST(path).send(data);
  }

  export async function registerPassword(data: {
    readonly email: string;
    readonly password: string;
    readonly name?: string;
  }): Promise<void> {
    await postAuth("/auth/register-password", data);
  }

  export async function loginPassword(data: {
    readonly email: string;
    readonly password: string;
  }): Promise<void> {
    await postAuth("/auth/login-password", data);
  }

  export async function forgotPassword(email: string): Promise<void> {
    await postAuth("/auth/forgot-password", { email });
  }

  export async function resetPassword(data: {
    readonly token: string;
    readonly password: string;
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

  export async function deleteAccount(): Promise<void> {
    const response = await request.DELETE("/_/account").send();
    await response.blob(); // Ignore.
  }
}
