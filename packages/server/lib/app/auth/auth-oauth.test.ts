import { test } from "node:test";
import { Application } from "@fastr/core";
import { type Binder, inject, type Module, provides } from "@fastr/invert";
import { User, type UserExternalId } from "@keylearn/database";
import {
  AbstractAdapter,
  AccessToken,
  type ClientConfig,
  type ResourceOwner,
  type TokenResponse,
} from "@keylearn/oauth";
import { equal, isNotNull, isNull, match } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { AdapterFactory } from "./module.ts";

const context = new TestContext();

const kTokenResponse = Symbol();
const kResourceOwner = Symbol();

test.beforeEach(async () => {
  class FakeAuthModule implements Module {
    configure(binder: Binder) {}

    @provides({ id: AdapterFactory, name: "fake", singleton: true })
    fake(@inject("canonicalUrl") canonicalUrl: string): AdapterFactory {
      return new (class Fake extends AdapterFactory {
        makeAdapter(redirectUri: string): AbstractAdapter {
          return new FakeAdapter({
            clientId: "clientId",
            clientSecret: "clientSecret",
            scope: "scope",
            redirectUri: String(new URL(redirectUri, canonicalUrl)),
          });
        }
      })();
    }
  }

  class FakeAdapter extends AbstractAdapter {
    constructor(clientConfig: ClientConfig) {
      super(clientConfig, {
        authorizationUri: "https://localhost/authorizationUri",
        tokenUri: "https://localhost/tokenUri",
        profileUri: "https://localhost/profileUri",
      });
    }

    override async getAccessToken(): Promise<AccessToken> {
      return new AccessToken({ ...context.get(kTokenResponse) });
    }

    override async getProfile(): Promise<ResourceOwner> {
      return { ...context.get(kResourceOwner) };
    }

    protected override parseProfileResponse(): ResourceOwner {
      throw new Error("Unreachable");
    }
  }

  context.load(new FakeAuthModule());
  context.bind(kTokenResponse).toValue({
    token_type: "Bearer",
    access_token: "xyz",
    expires_in: 3600,
  } satisfies TokenResponse);
  context.bind(kResourceOwner).toValue({
    raw: {},
    provider: "fake",
    id: "123",
    email: "fake@keylearn.org",
    emailVerified: true,
    name: "fake",
    url: "url",
    imageUrl: "imageUrl",
  } satisfies ResourceOwner);
});

test("handle unknown provider", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  const params = new URLSearchParams([
    ["code", "code"],
    ["state", "state"],
  ]);

  // Act, Assert.

  equal(
    (
      await request //
        .GET("/auth/oauth-init/wtf")
        .send()
    ).status,
    404,
  );
  equal(
    (
      await request //
        .GET("/auth/oauth-callback/wtf?" + params)
        .send()
    ).status,
    404,
  );
});

test("redirect to provider", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // Act.

  const response = await request //
    .GET("/auth/oauth-init/fake")
    .send();

  // Assert.

  equal(response.status, 302);

  const url = new URL(response.headers.get("Location")!);

  match(url.searchParams.get("client_id")!, /\S+/);
  match(url.searchParams.get("scope")!, /\S+/);
  match(url.searchParams.get("state")!, /\S+/);
  equal(url.searchParams.get("response_type")!, "code");
  equal(
    url.searchParams.get("redirect_uri")!,
    "https://www.keylearn.org/auth/oauth-callback/fake",
  );
});

test("validate state", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  const params = new URLSearchParams([
    ["code", "xyz"],
    ["state", "invalid"],
  ]);

  // Act. Step 1: redirect from keylearn to provider.

  {
    const response = await request //
      .GET("/auth/oauth-init/fake")
      .send();
    equal(response.status, 302);
  }

  // Assert.

  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());

  // Act. Step 2: redirect from provider to keylearn.

  {
    const response = await request //
      .GET("/auth/oauth-callback/fake?" + params)
      .send();
    equal(response.status, 400);
  }

  // Assert.

  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());
});

test("reject a callback for a flow that was never started", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // No `/auth/oauth-init` first, so there is no state in the session, and no
  // `state` parameter on the callback either. Both read back as null, and
  // `state === authState` was therefore satisfied by null === null: anybody
  // could redeem an authorization code obtained for their own provider account
  // inside somebody else's browser and leave that browser signed in as them.

  // Act.

  const response = await request
    .GET("/auth/oauth-callback/fake?" + new URLSearchParams([["code", "xyz"]]))
    .send();

  // Assert.

  equal(response.status, 400);
  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());
});

test("reject a callback that carries a state but no session", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  // The other half of the same hole: a state on the query string can never be
  // right when the session holds none, however it was guessed.

  // Act.

  const response = await request
    .GET(
      "/auth/oauth-callback/fake?" +
        new URLSearchParams([
          ["code", "xyz"],
          ["state", ""],
        ]),
    )
    .send();

  // Assert.

  equal(response.status, 400);
  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());
});

test("require email", async () => {
  // Arrange.

  context.bind(kResourceOwner).toValue({
    raw: {},
    provider: "fake",
    id: "123",
    email: null,
    name: "name",
    url: "url",
    imageUrl: "imageUrl",
  } as ResourceOwner);

  const request = startApp(context.get(Application, kMain));

  const params = new URLSearchParams([
    ["code", "xyz"],
    ["extra", "unknown"],
  ]);

  // Act. Step 1: redirect from keylearn to provider.

  {
    const response = await request //
      .GET("/auth/oauth-init/fake")
      .send();
    equal(response.status, 302);
    const url = new URL(response.headers.get("Location")!);
    params.set("state", url.searchParams.get("state")!);
  }

  // Assert.

  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());

  // Act. Step 2: redirect from provider to keylearn.

  {
    const response = await request //
      .GET("/auth/oauth-callback/fake?" + params)
      .send();
    equal(response.status, 302);
    equal(response.headers.get("Location"), "/");
  }

  // Assert.

  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());
});

test("register a new user", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  const params = new URLSearchParams([
    ["code", "xyz"],
    ["extra", "unknown"],
  ]);

  // Act. Step 1: redirect from keylearn to provider. Signing UP, which is the only
  // intent that provisions an account the visitor does not already have.

  {
    const response = await request //
      .GET("/auth/oauth-init/fake?intent=register")
      .send();
    equal(response.status, 302);
    const url = new URL(response.headers.get("Location")!);
    params.set("state", url.searchParams.get("state")!);
  }

  // Assert.

  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());

  // Act. Step 2: redirect from provider to keylearn.

  {
    const response = await request //
      .GET("/auth/oauth-callback/fake?" + params)
      .send();
    equal(response.status, 302);
    equal(response.headers.get("Location"), "/");
  }

  // Assert.

  isNotNull(await User.findByEmail("fake@keylearn.org"));
  equal(await request.who(), "fake@keylearn.org");
});

test("do not create an account from a login that matches none", async () => {
  // Arrange.

  const request = startApp(context.get(Application, kMain));

  const params = new URLSearchParams([
    ["code", "xyz"],
    ["extra", "unknown"],
  ]);

  // Act. Step 1: "Sign in with …", not "Sign up with …". Anything other than an
  // explicit register intent is a login, and a login must not quietly mint an
  // account for whatever address a provider hands back.

  {
    const response = await request //
      .GET("/auth/oauth-init/fake")
      .send();
    equal(response.status, 302);
    const url = new URL(response.headers.get("Location")!);
    params.set("state", url.searchParams.get("state")!);
  }

  // Act. Step 2: redirect from provider to keylearn.

  {
    const response = await request //
      .GET("/auth/oauth-callback/fake?" + params)
      .send();
    equal(response.status, 302);
    equal(response.headers.get("Location"), "/register?sso=noaccount");
  }

  // Assert.

  isNull(await User.findByEmail("fake@keylearn.org"));
  isNull(await request.who());
});

test("login an existing user", async () => {
  // Arrange.

  await User.query().insertGraph({
    email: "fake@keylearn.org",
    emailVerified: true,
    name: "fake name",
    externalIds: [
      {
        provider: "fake",
        externalId: "fake id",
        name: "fake name",
        url: "fake url",
        imageUrl: "fake image url",
      } as UserExternalId,
    ],
  } as User);

  const request = startApp(context.get(Application, kMain));

  const params = new URLSearchParams([
    ["code", "xyz"],
    ["extra", "unknown"],
  ]);

  // Act. Step 1: redirect from keylearn to provider.

  {
    const response = await request //
      .GET("/auth/oauth-init/fake")
      .send();
    equal(response.status, 302);
    const url = new URL(response.headers.get("Location")!);
    params.set("state", url.searchParams.get("state")!);
  }

  // Assert.

  isNull(await request.who());

  // Act. Step 2: redirect from provider to keylearn.

  {
    const response = await request //
      .GET("/auth/oauth-callback/fake?" + params)
      .send();
    equal(response.status, 302);
    equal(response.headers.get("Location"), "/");
  }

  // Assert.

  equal(await request.who(), "fake@keylearn.org");
});
