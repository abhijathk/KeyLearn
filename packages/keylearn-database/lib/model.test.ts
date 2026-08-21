import { createHash } from "node:crypto";
import { test } from "node:test";
import { PublicId } from "@keylearn/publicid";
import { ValidationError } from "objection";
import {
  deepEqual,
  doesNotThrow,
  equal,
  isNotNull,
  isNull,
  like,
  throws,
} from "rich-assert";
import { User, UserExternalId, UserLoginRequest } from "./model.ts";
import { useDatabase } from "./testing.ts";
import { Random } from "./util.ts";

useDatabase();

const now = new Date("2001-02-03T04:05:06Z");

// Login/reset tokens are persisted as a hash, never in the clear.
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

// `User.ensure` returns a tagged outcome. The tests below exercise the
// straightforward success path; this unwraps it and fails loudly otherwise, so
// a test can never silently start asserting against the wrong branch.
async function ensureOk(ro: Parameters<typeof User.ensure>[0]) {
  const result = await User.ensure(ro);
  if (result.kind !== "ok") {
    throw new Error(`Expected an "ok" sign-in, got "${result.kind}"`);
  }
  return result.user;
}

test("validate models", (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  throws(() => {
    User.fromJson({});
  }, ValidationError);

  throws(() => {
    User.fromJson({
      name: null,
      email: null,
    });
  }, ValidationError);

  throws(() => {
    User.fromJson({
      name: "",
      email: "",
    });
  }, ValidationError);

  doesNotThrow(() => {
    User.fromJson({
      name: "name",
      email: "email",
    });
  });

  throws(() => {
    UserExternalId.fromJson({});
  }, ValidationError);

  throws(() => {
    UserExternalId.fromJson({
      provider: null,
      externalId: null,
    });
  }, ValidationError);

  throws(() => {
    UserExternalId.fromJson({
      provider: "",
      externalId: "",
    });
  }, ValidationError);

  doesNotThrow(() => {
    UserExternalId.fromJson({
      provider: "provider",
      externalId: "externalId",
    });
  });

  doesNotThrow(() => {
    UserExternalId.fromJson({
      provider: "provider",
      externalId: "externalId",
      name: null,
      url: null,
      imageUrl: null,
    });
  });

  doesNotThrow(() => {
    UserExternalId.fromJson({
      provider: "provider",
      externalId: "externalId",
      name: "name",
      url: "url",
      imageUrl: "imageUrl",
    });
  });
});

test("automatically populate createdAt", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await User.query().insertGraph({
    email: "user0@keylearn.org",
    name: "user0",
    externalIds: [
      {
        provider: "provider0",
        externalId: "externalId0",
        name: "externalName0",
        url: "url0",
        imageUrl: "imageUrl0",
      },
    ],
  });

  deepEqual(user.createdAt, now);
  deepEqual(user.externalIds![0].createdAt, now);
});

test("generate unique user name", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  await User.query().insertGraph({
    email: `test@keylearn.org`,
    name: `test`,
    createdAt: now,
  });
  for (let i = 1; i <= 9; i++) {
    await User.query().insertGraph({
      email: `test${i}@keylearn.org`,
      name: `test${i}`,
      createdAt: now,
    });
  }
  await User.query().insertGraph({
    email: `example@keylearn.org`,
    name: `example`,
    createdAt: now,
  });

  equal(await User.findUniqueName(null, "x".repeat(100)), "x".repeat(32));
  equal(
    await User.findUniqueName(null, "x".repeat(100) + "@keylearn.org"),
    "x".repeat(32),
  );
  equal(await User.findUniqueName(null, "unique"), "unique");
  equal(await User.findUniqueName(null, "unique@keylearn.org"), "unique");
  equal(await User.findUniqueName(null, "test"), "test10");
  equal(await User.findUniqueName(null, "test@keylearn.org"), "test10");
  equal(await User.findUniqueName("test@keylearn.org", "test"), "test");
  equal(
    await User.findUniqueName("test@keylearn.org", "test@keylearn.org"),
    "test",
  );
  equal(await User.findUniqueName(null, "test10"), "test10");
  equal(await User.findUniqueName(null, "test10@keylearn.org"), "test10");
  equal(await User.findUniqueName("test@keylearn.org", "example"), "example1");
  equal(
    await User.findUniqueName("test@keylearn.org", "example@keylearn.org"),
    "example1",
  );
});

test("create user from resource owner with null values", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: null,
        url: null,
        imageUrl: null,
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "example1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: null,
          url: null,
          imageUrl: null,
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test("create user from resource owner with non-null values", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: "name1",
        url: "url1",
        imageUrl: "imageUrl1",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test("create user from resource owner with invalid values", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: null,
        url: "x".repeat(1000),
        imageUrl: "x".repeat(1000),
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "example1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: null,
          url: null,
          imageUrl: null,
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test("update user from resource owner with null values", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  await User.query().insertGraph({
    email: email,
    name: "name1",
    createdAt: now,
  });

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: null,
        url: null,
        imageUrl: null,
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: null,
          url: null,
          imageUrl: null,
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test("update user from resource owner with non-null values", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  await User.query().insertGraph({
    email: email,
    name: "name1",
    createdAt: now,
  });

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: "name1",
        url: "url1",
        imageUrl: "imageUrl1",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: "name1!",
        url: "url1!",
        imageUrl: "imageUrl1!",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1!",
          url: "url1!",
          imageUrl: "imageUrl1!",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test("update user from resource owner with invalid values", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  await User.query().insertGraph({
    email: email,
    name: "name1",
    createdAt: now,
  });

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: "name1",
        url: "url1",
        imageUrl: "imageUrl1",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: "name1!",
        url: "x".repeat(1000),
        imageUrl: "x".repeat(1000),
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1!",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test("merge multiple resource owners", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: email,
        emailVerified: true,
        name: "name1",
        url: "url1",
        imageUrl: "imageUrl1",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider2",
        id: "id2",
        email: email,
        emailVerified: true,
        name: "name2",
        url: "url2",
        imageUrl: "imageUrl2",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: email,
      // Linking a second provider does not rename the account — the handle set
      // when it was created stands, and each provider's own display name lives
      // on its externalIds row.
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
        {
          id: 5,
          userId: 4,
          createdAt: now,
          provider: "provider2",
          externalId: "id2",
          name: "name2",
          url: "url2",
          imageUrl: "imageUrl2",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test.skip("handle email change", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: "example1@keylearn.org",
        emailVerified: true,
        name: "name1",
        url: "url1",
        imageUrl: "imageUrl1",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: "example1@keylearn.org",
      name: "name1",
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider1",
        id: "id1",
        email: "changed@keylearn.org",
        emailVerified: true,
        name: "name1",
        url: "url1",
        imageUrl: "imageUrl1",
      })
    ).toJSON(),
    {
      id: 4,
      createdAt: now,
      email: "changed@keylearn.org",
      name: "name1",
      externalIds: [
        {
          id: 4,
          userId: 4,
          createdAt: now,
          provider: "provider1",
          externalId: "id1",
          name: "name1",
          url: "url1",
          imageUrl: "imageUrl1",
          usedAt: now,
        },
      ],
      order: null,
    } as unknown,
  );
});

test("generates unique name for resource owner", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  await User.query().insertGraph({
    email: "example1@keylearn.org",
    name: "name",
    createdAt: now,
  });

  deepEqual(
    (
      await ensureOk({
        raw: {},
        provider: "provider2",
        id: "id2",
        email: "example2@keylearn.org",
        emailVerified: true,
        name: "name",
        url: null,
        imageUrl: null,
      })
    ).toJSON(),
    {
      id: 5,
      createdAt: now,
      email: "example2@keylearn.org",
      name: "name1",
      anonymized: 0,
      publicProfile: 0,
      emailVerified: 1,
      passwordHash: null,
      dateOfBirth: null,
      sessionEpoch: 0,
      totpSecret: null,
      totpEnabled: 0,
      recoveryCodes: null,
      parentPinHash: null,
      staff: 0,
      remindedAt: null,
      externalIds: [
        {
          id: 4,
          userId: 5,
          createdAt: now,
          provider: "provider2",
          externalId: "id2",
          name: "name",
          url: null,
          imageUrl: null,
          usedAt: now,
        },
      ],
      order: null,
      // order: null,
    } as unknown,
  );
});

test("prefers the most recently used linked provider for name and avatar", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const email = "example1@keylearn.org";

  // First sign-in: provider1 links and, being the only identity, is also the
  // most recently used one.
  const afterFirst = await ensureOk({
    raw: {},
    provider: "provider1",
    id: "id1",
    email,
    emailVerified: true,
    name: "name1",
    url: "url1",
    imageUrl: "imageUrl1",
  });
  like(User.toPublicUser(afterFirst, ""), {
    name: "name1",
    imageUrl: "imageUrl1",
  });

  // A second provider links later. Before this fix, toPublicUser() always
  // took whichever identity happened to be first in the array — provider1
  // forever — regardless of which one was actually just used to sign in.
  ctx.mock.timers.tick(1000);
  const afterSecond = await ensureOk({
    raw: {},
    provider: "provider2",
    id: "id2",
    email,
    emailVerified: true,
    name: "name2",
    url: "url2",
    imageUrl: "imageUrl2",
  });
  like(User.toPublicUser(afterSecond, ""), {
    name: "name2",
    imageUrl: "imageUrl2",
  });

  // Signing in with provider1 again refreshes its usedAt, so it becomes the
  // most recent once more — even though it was linked first.
  ctx.mock.timers.tick(1000);
  const afterThird = await ensureOk({
    raw: {},
    provider: "provider1",
    id: "id1",
    email,
    emailVerified: true,
    name: "name1",
    url: "url1",
    imageUrl: "imageUrl1",
  });
  like(User.toPublicUser(afterThird, ""), {
    name: "name1",
    imageUrl: "imageUrl1",
  });
});

test("make premium user", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await User.query().insertGraph({
    email: "user0@keylearn.org",
    name: "user0",
    externalIds: [],
  });

  like(User.toPublicUser(await User.findById(user.id!), ""), {
    premium: false,
  });

  await user.$relatedQuery("order").insert({
    provider: "paddle",
    id: "order id",
    createdAt: now,
    name: null,
    email: null,
  });

  like(User.toPublicUser(await User.findById(user.id!), ""), {
    premium: true,
  });
});

test("create access token", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  // Should create a new access token. Only its SHA-256 hash is persisted, so a
  // database read never yields a usable login/reset link.
  Random.string = () => "token1";
  equal(await UserLoginRequest.init("example1@keylearn.org"), "token1");
  isNull(await User.findByEmail("example1@keylearn.org"));
  deepEqual(
    (await UserLoginRequest.findByEmail("example1@keylearn.org"))!.toJSON(),
    {
      id: 1,
      email: "example1@keylearn.org",
      purpose: "login",
      accessToken: sha256("token1"),
      createdAt: now,
    },
  );

  // Should REPLACE, not reuse, the previous token: re-issuing rotates it so an
  // older emailed link stops working.
  Random.string = () => "tokenX";
  equal(await UserLoginRequest.init("example1@keylearn.org"), "tokenX");
  equal(await User.findByEmail("example1@keylearn.org"), null);
  deepEqual(
    (await UserLoginRequest.findByEmail("example1@keylearn.org"))!.toJSON(),
    {
      id: 2,
      email: "example1@keylearn.org",
      purpose: "login",
      accessToken: sha256("tokenX"),
      createdAt: now,
    },
  );
});

test("delete expired access token", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  Random.string = () => "token1";
  equal(await UserLoginRequest.init("example1@keylearn.org"), "token1");

  isNotNull(await UserLoginRequest.findByEmail("example1@keylearn.org"));
  // The finder takes the stored value, which is the hash — the plaintext token
  // exists only in the emailed link.
  isNotNull(await UserLoginRequest.findByAccessToken(sha256("token1")));
  isNull(await UserLoginRequest.findByAccessToken("token1"));

  await UserLoginRequest.deleteExpired(
    now.getTime() + UserLoginRequest.expireTime + 1000,
  );

  isNull(await UserLoginRequest.findByEmail("example1@keylearn.org"));
  isNull(await UserLoginRequest.findByAccessToken(sha256("token1")));
});

test("login with a valid access token", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  Random.string = () => "token1";

  // Should create a new access token.

  equal(await UserLoginRequest.init("example1@keylearn.org"), "token1");

  // Before the first login.

  isNull(await User.findByEmail("example1@keylearn.org"));
  isNotNull(await UserLoginRequest.findByEmail("example1@keylearn.org"));

  // First login.

  deepEqual((await UserLoginRequest.login("token1"))!.toJSON(), {
    id: 4,
    createdAt: now,
    email: "example1@keylearn.org",
    name: "example1",
    anonymized: 0,
    publicProfile: 0,
    emailVerified: 1,
    passwordHash: null,
    dateOfBirth: null,
    sessionEpoch: 0,
    totpSecret: null,
    totpEnabled: 0,
    recoveryCodes: null,
    parentPinHash: null,
    staff: 0,
    remindedAt: null,
    externalIds: [],
    order: null,
  } as unknown);

  // Should create a new user after login, and CONSUME the token: a magic-login
  // link is single-use, so a leaked or forwarded link cannot be replayed.

  isNotNull(await User.findByEmail("example1@keylearn.org"));
  isNull(await UserLoginRequest.findByEmail("example1@keylearn.org"));

  // Second attempt with the same token is refused.

  isNull(await UserLoginRequest.login("token1"));

  // The account itself is of course still there.

  isNotNull(await User.findByEmail("example1@keylearn.org"));
});

test("ignore invalid access token", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  Random.string = () => "token1";

  isNull(await UserLoginRequest.login("token1"));
  isNull(await UserLoginRequest.login("abc"));
  isNull(await UserLoginRequest.login("xyz"));
});

test("access token should be case-sensitive", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  await UserLoginRequest.query().insertGraph({
    email: "test@keylearn.org",
    accessToken: "token",
    createdAt: now,
  });

  isNotNull(await UserLoginRequest.findByAccessToken("token"));
  isNull(await UserLoginRequest.findByAccessToken("TOKEN"));
});

test("load profile owner", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  isNull(await User.loadProfileOwner(new PublicId(999)));
  deepEqual(await User.loadProfileOwner(PublicId.of("example1")), {
    id: "example1",
    name: "Example User 1",
    imageUrl: null,
    premium: false,
  });
  deepEqual(await User.loadProfileOwner(new PublicId(1)), {
    id: "55vdtk1",
    name: "externalName1",
    imageUrl: "imageUrl1",
    premium: false,
    staff: false,
  });
});

test("convert to user details", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  deepEqual((await User.findByEmail("user1@keylearn.org"))?.toDetails(), {
    id: "55vdtk1",
    email: "user1@keylearn.org",
    name: "user1",
    anonymized: false,
    publicProfile: false,
    externalId: [
      {
        provider: "provider1",
        id: "externalId1",
        name: "externalName1",
        url: "url1",
        imageUrl: "imageUrl1",
        usedAt: new Date("2001-02-03T04:05:06Z"),
        createdAt: new Date("2001-02-03T04:05:06Z"),
      },
    ],
    order: null,
    dateOfBirth: null,
    hasPassword: false,
    twoFactorEnabled: false,
    parentPinSet: false,
    parentPinLength: null,
    emailVerified: false,
    createdAt: now,
  });
});

test("make public user for anonymous", (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  deepEqual(User.toPublicUser(null, "hint1"), {
    id: null,
    name: "Gold Sparrowhawk",
    imageUrl: null,
    staff: false,
  });
  deepEqual(User.toPublicUser(null, "hint4"), {
    id: null,
    name: "Gold Skink",
    imageUrl: null,
    staff: false,
  });
});

test("make public user from user name", (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  deepEqual(
    User.toPublicUser(
      User.fromJson({
        id: 1,
        email: "email",
        name: "somebody",
        anonymized: 0,
        publicProfile: 0,
        emailVerified: 1,
        passwordHash: null,
        dateOfBirth: null,
        sessionEpoch: 0,
        totpSecret: null,
        totpEnabled: 0,
        recoveryCodes: null,
        parentPinHash: null,
        staff: 0,
        remindedAt: null,
        externalIds: [],
        createdAt: new Date(0),
      }),
      0,
    ),
    {
      id: "55vdtk1",
      name: "somebody",
      imageUrl: null,
      premium: false,
      staff: false,
    },
  );
});

test("make public user from external user id", (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  deepEqual(
    User.toPublicUser(
      User.fromJson({
        id: 1,
        email: "email",
        name: "somebody",
        anonymized: 0,
        publicProfile: 0,
        emailVerified: 1,
        passwordHash: null,
        dateOfBirth: null,
        sessionEpoch: 0,
        totpSecret: null,
        totpEnabled: 0,
        recoveryCodes: null,
        parentPinHash: null,
        staff: 0,
        remindedAt: null,
        externalIds: [
          {
            id: 1,
            provider: "provider",
            externalId: "externalId",
            name: null,
            url: null,
            imageUrl: null,
            createdAt: new Date(0),
          },
        ],
        order: null,
        createdAt: new Date(0),
      }),
      0,
    ),
    {
      id: "55vdtk1",
      name: "somebody",
      imageUrl: null,
      premium: false,
      staff: false,
    },
  );
  deepEqual(
    User.toPublicUser(
      User.fromJson({
        id: 1,
        email: "email",
        name: "somebody",
        anonymized: 0,
        publicProfile: 0,
        emailVerified: 1,
        passwordHash: null,
        dateOfBirth: null,
        sessionEpoch: 0,
        totpSecret: null,
        totpEnabled: 0,
        recoveryCodes: null,
        parentPinHash: null,
        staff: 0,
        remindedAt: null,
        externalIds: [
          {
            id: 1,
            provider: "provider",
            externalId: "externalId",
            name: "xyz",
            url: "url",
            imageUrl: "imageUrl",
            createdAt: new Date(0),
          },
        ],
        order: null,
        createdAt: new Date(0),
      }),
      0,
    ),
    {
      id: "55vdtk1",
      name: "xyz",
      imageUrl: "imageUrl",
      premium: false,
      staff: false,
    },
  );
});

test("make public user with anonymous name", (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  deepEqual(
    User.toPublicUser(
      User.fromJson({
        id: 1,
        email: "email1",
        name: "somebody",
        anonymized: 1,
        externalIds: [],
        createdAt: new Date(0),
      }),
      0,
    ),
    {
      id: "55vdtk1",
      name: "Gleaming Wolf",
      imageUrl: null,
      premium: false,
      staff: false,
    },
  );
  deepEqual(
    User.toPublicUser(
      User.fromJson({
        id: 1,
        email: "email3",
        name: "somebody",
        anonymized: 1,
        externalIds: [],
        createdAt: new Date(0),
      }),
      0,
    ),
    {
      id: "55vdtk1",
      name: "Gleaming Wombat",
      imageUrl: null,
      premium: false,
      staff: false,
    },
  );
});

// ---- Federated identity must not be claimable by email address ----

test("refuses to claim an existing account with an unverified email", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  // A victim who registered with a password.
  const victim = await User.query().insertGraph({
    email: "victim@keylearn.org",
    name: "victim",
    createdAt: now,
  });

  // An attacker signing in through a provider that will happily assert any
  // address it likes (Microsoft's "common" authority, Facebook, ...).
  const result = await User.ensure({
    raw: {},
    provider: "provider1",
    id: "attacker-subject",
    email: "victim@keylearn.org",
    emailVerified: null,
    name: "attacker",
    url: null,
    imageUrl: null,
  });

  equal(result.kind, "link-required");
  // The account was neither handed over nor linked to the attacker's subject.
  isNull(await UserExternalId.findBySubject("provider1", "attacker-subject"));
  const after = await User.findById(victim.id!);
  deepEqual(after!.externalIds, []);
});

test("links an existing account only when the provider verified the email", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const user = await User.query().insertGraph({
    email: "owner@keylearn.org",
    name: "owner",
    createdAt: now,
  });

  const result = await User.ensure({
    raw: {},
    provider: "provider1",
    id: "subject1",
    email: "owner@keylearn.org",
    emailVerified: true,
    name: "owner",
    url: null,
    imageUrl: null,
  });

  equal(result.kind, "ok");
  equal(result.kind === "ok" ? result.user.id : null, user.id);
  isNotNull(await UserExternalId.findBySubject("provider1", "subject1"));
});

test("resolves a known subject even when the provider changes the email", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const first = await User.ensure({
    raw: {},
    provider: "provider1",
    id: "subject1",
    email: "original@keylearn.org",
    emailVerified: true,
    name: "person",
    url: null,
    imageUrl: null,
  });
  const userId = first.kind === "ok" ? first.user.id : null;
  isNotNull(userId);

  // A separate account the attacker would like to reach.
  await User.query().insertGraph({
    email: "target@keylearn.org",
    name: "target",
    createdAt: now,
  });

  // The same subject now reports a different address. The subject wins, and the
  // account's own email is left untouched — following the rename would move the
  // account onto an address the provider does not own.
  const second = await User.ensure({
    raw: {},
    provider: "provider1",
    id: "subject1",
    email: "target@keylearn.org",
    emailVerified: true,
    name: "person",
    url: null,
    imageUrl: null,
  });

  equal(second.kind, "ok");
  equal(second.kind === "ok" ? second.user.id : null, userId);
  equal(
    second.kind === "ok" ? second.user.email : null,
    "original@keylearn.org",
  );
});

test("a brand-new account from an unverified email must verify first", async (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  const result = await User.ensure({
    raw: {},
    provider: "provider1",
    id: "subject1",
    email: "fresh@keylearn.org",
    emailVerified: null,
    name: "fresh",
    url: null,
    imageUrl: null,
  });

  equal(result.kind, "verify");
  // Created, but not usable until the emailed code is entered — otherwise a
  // provider could pre-register an address its real owner has not reached yet.
  const user = await User.findByEmail("fresh@keylearn.org");
  isNotNull(user);
  equal(Boolean(user!.emailVerified), false);
});

test("parse resource owner", (ctx) => {
  ctx.mock.timers.enable({ apis: ["Date"], now });

  deepEqual(
    User.parseResourceOwner({
      raw: { x: 1 },
      provider: "provider1",
      id: "id1",
      email: "email1",
      emailVerified: null,
      name: "name1",
      url: "url1",
      imageUrl: "imageUrl",
    }),
    {
      raw: { x: 1 },
      provider: "provider1",
      id: "id1",
      email: "email1",
      emailVerified: null,
      name: "name1",
      url: "url1",
      imageUrl: "imageUrl",
    },
  );
  deepEqual(
    User.parseResourceOwner({
      raw: { x: 1 },
      provider: "provider1",
      id: "id1",
      email: null,
      emailVerified: null,
      name: null,
      url: null,
      imageUrl: null,
    }),
    {
      raw: { x: 1 },
      provider: "provider1",
      id: "id1",
      email: null,
      emailVerified: null,
      name: null,
      url: null,
      imageUrl: null,
    },
  );
  deepEqual(
    User.parseResourceOwner({
      raw: { x: 1 },
      provider: "provider1",
      id: "id1",
      email: "x".repeat(67),
      emailVerified: null,
      name: "x".repeat(33),
      url: "x".repeat(257),
      imageUrl: "x".repeat(257),
    }),
    {
      raw: { x: 1 },
      provider: "provider1",
      id: "id1",
      email: null,
      emailVerified: null,
      name: "x".repeat(32),
      url: null,
      imageUrl: null,
    },
  );
});
