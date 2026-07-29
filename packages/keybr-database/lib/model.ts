import { createHash, randomInt } from "node:crypto";
import { type ResourceOwner } from "@keybr/oauth";
import {
  type AnonymousUser,
  type AnyUser,
  type NamedUser,
  type OrderDetails,
  type ProfileAvatar,
  type ProfileDetails,
  type ProfileKind,
  type UserDetails,
  type UserExternalIdDetails,
} from "@keybr/pages-shared";
import { PublicId } from "@keybr/publicid";
import { type Knex } from "knex";
import { type JSONSchema, Model, type Pojo, snakeCaseMappers } from "objection";
import { anonymousName } from "./name.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { Random } from "./util.ts";

/** Thrown when a registration email is already in use. */
export class UserExistsError extends Error {
  constructor() {
    super("A user with this email address already exists");
    this.name = "UserExistsError";
  }
}

export function TimestampMixin(superClass: typeof Model): typeof Model {
  return class extends superClass implements Model {
    createdAt?: Date;

    override $beforeInsert(): void {
      if (this.createdAt == null) {
        this.createdAt = new Date();
      }
    }
  };
}

export class User extends TimestampMixin(Model) {
  static override readonly tableName = "user";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["email", "name"],
    properties: {
      id: { type: "integer" },
      email: { type: "string", minLength: 1, maxLength: 64 },
      name: { type: "string", minLength: 1, maxLength: 32 },
      // The account owner's date of birth (ISO "YYYY-MM-DD"), used for the
      // age gate at sign-up. Null for accounts created before it was asked
      // (e.g. OAuth sign-ups).
      dateOfBirth: { type: ["string", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { email, name } = User.jsonSchema.properties;
    table.increments("id").primary();
    table.string("email", email.maxLength).notNullable();
    table.string("name", name.maxLength).notNullable();
    table.boolean("anonymized").notNullable().defaultTo(false);
    // Null for OAuth / magic-link accounts; set only for email+password.
    table.string("password_hash", 128).nullable();
    table.date("date_of_birth").nullable();
    // Whether the account's email address has been proven. True for OAuth and
    // magic-link sign-ups (email is inherently verified); email+password
    // sign-ups start false and flip once the emailed code is entered.
    table.boolean("email_verified").notNullable().defaultTo(false);
    // Bumped to invalidate all existing sessions ("sign out everywhere").
    table.integer("session_epoch").notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["email"]);
    table.unique(["name"]);
  }

  readonly id?: number;
  email?: string;
  name?: string;
  anonymized?: number;
  passwordHash?: string | null;
  dateOfBirth?: string | null;
  emailVerified?: number | boolean;
  sessionEpoch?: number;
  createdAt?: Date;
  externalIds?: UserExternalId[];
  order?: Order;

  static async loadProfileOwner(publicId: PublicId): Promise<NamedUser | null> {
    if (publicId.example) {
      return publicId.toUser();
    }
    const user = await User.findById(publicId.id);
    if (user != null) {
      return User.toPublicUser(user, 0);
    }
    return null;
  }

  static async findById(id: number): Promise<User | null> {
    return (
      (await User.query() //
        .withGraphFetched("externalIds")
        .withGraphFetched("order")
        .findOne({ id })) ?? null
    );
  }

  static async findByEmail(email: string): Promise<User | null> {
    return (
      (await User.query() //
        .withGraphFetched("externalIds")
        .withGraphFetched("order")
        .findOne({ email })) ?? null
    );
  }

  static async loadAll(id: number[]): Promise<Map<number, User>> {
    return new Map<number, User>(
      (
        await User.query() //
          .withGraphFetched("externalIds")
          .withGraphFetched("order")
          .findByIds(id)
      ).map((user) => [user.id!, user]),
    );
  }

  static async login(email: string): Promise<User> {
    let user = await User.findByEmail(email);
    if (user == null) {
      const name = await User.findUniqueName(email, email);
      // Reaching this path means the visitor proved control of the address
      // (a magic-login link), so the email counts as verified.
      user = await User.query()
        .withGraphFetched("externalIds")
        .withGraphFetched("order")
        .insertAndFetch({ email, name, emailVerified: true });
    }
    return user;
  }

  // Creates a brand-new email+password account. Throws if the email is
  // already taken (whatever the sign-in method).
  static async registerWithPassword(
    email: string,
    password: string,
    hint: string,
    dateOfBirth: string | null = null,
  ): Promise<User> {
    const existing = await User.findByEmail(email);
    if (existing != null) {
      throw new UserExistsError();
    }
    const name = await User.findUniqueName(email, hint || email);
    const passwordHash = await hashPassword(password);
    return await User.query()
      .withGraphFetched("externalIds")
      .withGraphFetched("order")
      .insertAndFetch({ email, name, passwordHash, dateOfBirth });
  }

  // Verifies an email+password pair. Returns null on any mismatch — the
  // caller must not reveal which half was wrong.
  static async loginWithPassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await User.findByEmail(email);
    if (user == null) {
      // Compare against a dummy hash anyway to keep the timing uniform.
      await verifyPassword(password, null);
      return null;
    }
    if (await verifyPassword(password, user.passwordHash)) {
      return user;
    }
    return null;
  }

  async setPassword(password: string): Promise<void> {
    await this.$query().patch({ passwordHash: await hashPassword(password) });
  }

  static async findUniqueName(
    email: string | null,
    hint: string,
  ): Promise<string> {
    for (const candidate of candidates(hint)) {
      if (!(await User.nameExists(email, candidate))) {
        return candidate;
      }
    }
    throw new Error(); // Unreachable.

    function* candidates(hint: string, length: number = 32): Iterable<string> {
      let name = hint;
      const pos = hint.indexOf("@");
      if (pos !== -1) {
        name = hint.substring(0, pos);
      }
      name = name.substring(0, length);
      // Try original name.
      yield name;
      // Try name with numeric suffix.
      for (let index = 0; index < 10; index++) {
        const suffix = String(index + 1);
        yield name.substring(0, length - suffix.length) + suffix;
      }
      // Try name with random suffix.
      for (let index = 0; index < 10; index++) {
        const suffix = Random.string(10);
        yield name.substring(0, length - suffix.length) + suffix;
      }
    }
  }

  static async nameExists(
    email: string | null,
    name: string,
  ): Promise<boolean> {
    if (email != null) {
      return (await User.query().whereNot({ email }).findOne({ name })) != null;
    } else {
      return (await User.query().findOne({ name })) != null;
    }
  }

  static async ensure(ro: ResourceOwner): Promise<User> {
    ro = User.parseResourceOwner(ro);
    const { email } = ro;
    if (email == null) {
      throw new Error("No email address");
    }
    const user = await User.findByEmail(email);
    const model = await User.merge(user, ro, email);
    return await User.query().upsertGraphAndFetch(model);
  }

  static parseResourceOwner(ro: ResourceOwner): ResourceOwner {
    const emailType = User.jsonSchema.properties.email;
    const nameType = User.jsonSchema.properties.name;
    const urlType = UserExternalId.jsonSchema.properties.url;
    const imageUrlType = UserExternalId.jsonSchema.properties.imageUrl;
    let { raw, provider, id, email, name, url, imageUrl } = ro;
    if (email != null && email.length > emailType.maxLength) {
      email = null;
    }
    if (name != null && name.length > nameType.maxLength) {
      name = name.substring(0, nameType.maxLength);
    }
    if (url != null && url.length > urlType.maxLength) {
      url = null;
    }
    if (imageUrl != null && imageUrl.length > imageUrlType.maxLength) {
      imageUrl = null;
    }
    return { raw, provider, id, email, name, url, imageUrl };
  }

  static async merge(
    user: User | null,
    ro: ResourceOwner,
    email: string,
  ): Promise<Partial<User>> {
    let name: string;
    if (user != null && ro.name == null) {
      name = user.name!;
    } else {
      name = await User.findUniqueName(email, ro.name ?? email);
    }

    const externalIds = new Map(
      (user?.externalIds ?? []).map((id) => [id.provider!, id]),
    );

    externalIds.set(ro.provider, {
      ...externalIds.get(ro.provider),
      provider: ro.provider,
      externalId: ro.id,
      name: ro.name ?? undefined,
      url: ro.url ?? undefined,
      imageUrl: ro.imageUrl ?? undefined,
    } as UserExternalId);

    return {
      ...user,
      email: ro.email,
      name,
      // The OAuth provider has already verified the address on its side.
      emailVerified: true,
      externalIds: [...externalIds.values()],
    } as User;
  }

  toDetails(): UserDetails {
    return {
      id: String(new PublicId(this.id!)),
      email: this.email!,
      name: this.name!,
      anonymized: Boolean(this.anonymized!),
      externalId: this.externalIds!.map((id) => id.toDetails()),
      order: this.order?.toDetails() ?? null,
      dateOfBirth: this.dateOfBirth ?? null,
      hasPassword: this.passwordHash != null,
      emailVerified: Boolean(this.emailVerified),
      createdAt: this.createdAt!,
    };
  }

  static toPublicUser(user: null, hint: number | string): AnonymousUser;
  static toPublicUser(user: User, hint: number | string): NamedUser;
  static toPublicUser(user: User | null, hint: number | string): AnyUser;
  static toPublicUser(user: User | null, hint: number | string): AnyUser {
    if (user != null) {
      // Handle authenticated user.
      const details = user.toDetails();
      const premium = details.order != null;
      if (user.anonymized) {
        return Object.freeze<NamedUser>({
          id: details.id,
          name: anonymousName(details.email),
          imageUrl: null,
          premium,
        });
      }
      const [externalId = null] = details.externalId;
      if (externalId != null) {
        // Try to take username from an external id, if exists.
        return Object.freeze<NamedUser>({
          id: details.id,
          name: externalId.name ?? details.name,
          imageUrl: externalId.imageUrl,
          premium,
        });
      } else {
        // Otherwise use auto-generated username.
        return Object.freeze<NamedUser>({
          id: details.id,
          name: details.name,
          imageUrl: null,
          premium,
        });
      }
    } else {
      // Handle anonymous user.
      return Object.freeze<AnonymousUser>({
        id: null,
        name: anonymousName(hint),
        imageUrl: null,
      });
    }
  }
}

export class UserExternalId extends TimestampMixin(Model) {
  static override readonly tableName = "user_external_id";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["provider", "externalId"],
    properties: {
      id: { type: "integer" },
      provider: { type: "string", minLength: 1, maxLength: 16 },
      externalId: { type: "string", minLength: 1, maxLength: 32 },
      name: { type: ["null", "string"], minLength: 1, maxLength: 64 },
      url: { type: ["null", "string"], minLength: 1, maxLength: 256 },
      imageUrl: { type: ["null", "string"], minLength: 1, maxLength: 256 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { provider, externalId, name, url, imageUrl } =
      UserExternalId.jsonSchema.properties;
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.string("provider", provider.maxLength).notNullable();
    table.string("external_id", externalId.maxLength).notNullable();
    table.string("name", name.maxLength).nullable();
    table.string("url", url.maxLength).nullable();
    table.string("image_url", imageUrl.maxLength).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["user_id", "provider"]);
    table.unique(["provider", "external_id"]);
  }

  readonly id?: number;
  provider?: string;
  externalId?: string;
  name?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  createdAt?: Date;
  user?: User;

  toDetails(): UserExternalIdDetails {
    return {
      provider: this.provider!,
      id: this.externalId!,
      name: this.name ?? null,
      url: this.url ?? null,
      imageUrl: this.imageUrl ?? null,
      createdAt: this.createdAt!,
    };
  }
}

export class Order extends TimestampMixin(Model) {
  static override readonly tableName = "order";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["id", "provider"],
    properties: {
      id: { type: "string", minLength: 1, maxLength: 100 },
      provider: { type: "string", minLength: 1, maxLength: 30 },
      name: { type: ["null", "string"], minLength: 1, maxLength: 100 },
      email: { type: ["null", "string"], minLength: 1, maxLength: 100 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { id, provider, name, email } = Order.jsonSchema.properties;
    table.string("id", id.maxLength).primary();
    table.string("provider", provider.maxLength).notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.string("name", name.maxLength).nullable();
    table.string("email", email.maxLength).nullable();
    table.unique(["user_id"]);
  }

  readonly id?: string;
  provider?: string;
  name?: string | null;
  email?: string | null;
  createdAt?: Date;
  user?: User;

  toDetails(): OrderDetails {
    return {
      id: this.id!,
      provider: this.provider!,
      name: this.name ?? null,
      email: this.email ?? null,
      createdAt: this.createdAt!,
    };
  }
}

// A household learner profile (grown-up or kid). Stored server-side and owned
// by a User account, so profiles — and everything on them — follow the user
// across devices. Kid profiles carry the parental consent captured at creation.
export class Profile extends TimestampMixin(Model) {
  static override readonly tableName = "profile";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["userId", "kind", "firstName"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      kind: { type: "string", enum: ["adult", "kid"] },
      firstName: { type: "string", minLength: 1, maxLength: 32 },
      lastName: { type: ["null", "string"], maxLength: 32 },
      birthYear: { type: ["null", "integer"] },
      // JSON blobs (avatar, and per-profile client prefs such as the kids
      // toy-box settings that used to live in localStorage).
      avatar: { type: ["null", "string"] },
      prefs: { type: ["null", "string"] },
      parentalConsent: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.string("kind", 8).notNullable();
    table.string("first_name", 32).notNullable();
    table.string("last_name", 32).nullable();
    table.integer("birth_year").nullable();
    table.text("avatar").nullable();
    table.text("prefs").nullable();
    table.boolean("parental_consent").notNullable().defaultTo(false);
    table.timestamp("consent_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table
      .foreign("user_id")
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
  }

  readonly id?: number;
  userId?: number;
  kind?: string;
  firstName?: string;
  lastName?: string | null;
  birthYear?: number | null;
  avatar?: string | null;
  prefs?: string | null;
  parentalConsent?: number | boolean;
  consentAt?: Date | string | null;
  createdAt?: Date;

  static async listForUser(userId: number): Promise<Profile[]> {
    return await Profile.query().where("userId", userId).orderBy("id");
  }

  static async findOwned(userId: number, id: number): Promise<Profile | null> {
    return (await Profile.query().findOne({ id, userId })) ?? null;
  }

  // All learning lives under a profile, never the bare account. So every
  // signed-in account gets a default grown-up profile the first time it has
  // none — created lazily here, so it covers every sign-in path (password,
  // OAuth, magic-link) and backfills existing accounts. The learner can rename
  // it or add more; deleting the last one just re-creates it on next load.
  static async ensureDefault(user: User): Promise<void> {
    const count = await Profile.query()
      .where("userId", user.id!)
      .resultSize();
    if (count === 0) {
      const seed = (user.email ?? "").split("@")[0].trim();
      const firstName = (seed || "Me").slice(0, 32);
      await Profile.query().insert({
        userId: user.id!,
        kind: "adult",
        firstName,
        parentalConsent: false,
        consentAt: null,
      });
    }
  }

  toDetails(): ProfileDetails {
    let avatar: ProfileAvatar | null = null;
    if (this.avatar) {
      try {
        avatar = JSON.parse(this.avatar) as ProfileAvatar;
      } catch {
        avatar = null;
      }
    }
    return {
      id: String(this.id!),
      kind: (this.kind === "kid" ? "kid" : "adult") as ProfileKind,
      firstName: this.firstName!,
      lastName: this.lastName ?? "",
      birthYear: this.birthYear ?? null,
      avatar,
      parentalConsent: Boolean(this.parentalConsent),
      consentAt:
        this.consentAt != null ? new Date(this.consentAt).toISOString() : null,
    };
  }
}

// A registered WebAuthn passkey (public-key credential) for an account.
export class Credential extends TimestampMixin(Model) {
  static override readonly tableName = "credential";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["userId", "credentialId", "publicKey"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      credentialId: { type: "string", minLength: 1, maxLength: 512 },
      publicKey: { type: "string" },
      counter: { type: "integer" },
      transports: { type: ["null", "string"] },
      name: { type: ["null", "string"], maxLength: 64 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.string("credential_id", 512).notNullable(); // base64url
    table.text("public_key").notNullable(); // base64
    table.integer("counter").notNullable().defaultTo(0);
    table.text("transports").nullable(); // JSON array
    table.string("name", 64).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["credential_id"]);
    table
      .foreign("user_id")
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
  }

  readonly id?: number;
  userId?: number;
  credentialId?: string;
  publicKey?: string;
  counter?: number;
  transports?: string | null;
  name?: string | null;
  createdAt?: Date;

  static async listForUser(userId: number): Promise<Credential[]> {
    return await Credential.query().where("userId", userId).orderBy("id");
  }

  static async findByCredentialId(
    credentialId: string,
  ): Promise<Credential | null> {
    return (await Credential.query().findOne({ credentialId })) ?? null;
  }

  toDetails(): { id: string; name: string; createdAt: string } {
    return {
      id: String(this.id!),
      name: this.name ?? "Passkey",
      createdAt: (this.createdAt ?? new Date()).toISOString?.() ?? "",
    };
  }
}

export class UserLoginRequest extends TimestampMixin(Model) {
  static override readonly tableName = "user_login_request";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["email", "accessToken"],
    properties: {
      id: { type: "integer" },
      email: { type: "string", minLength: 1, maxLength: 64 },
      accessToken: { type: "string", minLength: 1, maxLength: 64 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { email, accessToken } = UserLoginRequest.jsonSchema.properties;
    table.increments("id").primary();
    table.string("email", email.maxLength).notNullable();
    table.binary("access_token", accessToken.maxLength).notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["email"]);
    table.unique(["access_token"]);
  }

  static readonly expireTime = 24 * 3600 * 1000;

  readonly id?: number;
  email?: string;
  accessToken?: string;
  createdAt?: Date;

  override $formatDatabaseJson(json: Pojo): Pojo {
    json = super.$formatDatabaseJson(json);
    if (json.accessToken != null) {
      json.accessToken = Buffer.from(json.accessToken);
    }
    return json;
  }

  override $parseDatabaseJson(json: Pojo): Pojo {
    json = super.$parseDatabaseJson(json);
    if (json.accessToken != null) {
      json.accessToken = String(json.accessToken);
    }
    return json;
  }

  static async findById(id: number): Promise<UserLoginRequest | null> {
    return (await UserLoginRequest.query().findOne({ id })) ?? null;
  }

  static async findByEmail(email: string): Promise<UserLoginRequest | null> {
    return (await UserLoginRequest.query().findOne({ email })) ?? null;
  }

  static async findByAccessToken(
    accessToken: string,
  ): Promise<UserLoginRequest | null> {
    return (await UserLoginRequest.query().findOne({ accessToken })) ?? null;
  }

  static #hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  // Issues a fresh single-use token for an email. Only the SHA-256 *hash* is
  // persisted, so a database leak never exposes a usable reset/login link; the
  // plaintext token is returned once, to be emailed. Any prior token for the
  // address is replaced.
  static async init(email: string): Promise<string> {
    await this.deleteExpired();
    await UserLoginRequest.query().where({ email }).delete();
    const token = Random.string(20);
    await UserLoginRequest.query().insert({
      email,
      accessToken: UserLoginRequest.#hash(token),
    });
    return token;
  }

  static async login(accessToken: string): Promise<User | null> {
    await this.deleteExpired();
    const request = await UserLoginRequest.findByAccessToken(
      UserLoginRequest.#hash(accessToken),
    );
    if (request != null) {
      const user = await User.login(request.email!);
      // One-shot: consume the token so the magic-login link can't be replayed.
      await UserLoginRequest.query().deleteById(request.id!);
      return user;
    }
    return null;
  }

  // One-shot: validates a token, deletes it so it can't be reused, and
  // returns the email it was issued for. For the password-reset flow.
  static async consume(accessToken: string): Promise<string | null> {
    await this.deleteExpired();
    const request = await UserLoginRequest.findByAccessToken(
      UserLoginRequest.#hash(accessToken),
    );
    if (request == null) {
      return null;
    }
    await UserLoginRequest.query().deleteById(request.id!);
    return request.email!;
  }

  static async deleteExpired(now: number = Date.now()): Promise<void> {
    await UserLoginRequest.query()
      .where("createdAt", "<", new Date(now - UserLoginRequest.expireTime))
      .delete();
  }
}

User.relationMappings = {
  externalIds: {
    relation: Model.HasManyRelation,
    modelClass: UserExternalId,
    join: {
      from: "user.id",
      to: "user_external_id.user_id",
    },
  },
  order: {
    relation: Model.HasOneRelation,
    modelClass: Order,
    join: {
      from: "user.id",
      to: "order.user_id",
    },
  },
};

UserExternalId.relationMappings = {
  user: {
    relation: Model.BelongsToOneRelation,
    modelClass: User,
    join: {
      from: "user_external_id.user_id",
      to: "user.id",
    },
  },
};

Order.relationMappings = {
  user: {
    relation: Model.BelongsToOneRelation,
    modelClass: User,
    join: {
      from: "order.user_id",
      to: "user.id",
    },
  },
};

UserLoginRequest.relationMappings = {};

// A short-lived email-verification code issued during email+password sign-up.
// The 6-digit code is emailed to the address and stored only as a hash, so a
// database read never reveals a live code. One row per email (the newest code
// replaces any previous one); codes expire and lock out after a few tries.
export class EmailVerification extends TimestampMixin(Model) {
  static override readonly tableName = "email_verification";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["email", "codeHash"],
    properties: {
      id: { type: "integer" },
      email: { type: "string", minLength: 1, maxLength: 64 },
      codeHash: { type: "string", minLength: 1, maxLength: 64 },
      attempts: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { email, codeHash } = EmailVerification.jsonSchema.properties;
    table.increments("id").primary();
    table.string("email", email.maxLength).notNullable();
    table.string("code_hash", codeHash.maxLength).notNullable();
    table.integer("attempts").notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["email"]);
  }

  static readonly expireTime = 15 * 60 * 1000;
  static readonly maxAttempts = 5;
  static readonly codeLength = 6;

  readonly id?: number;
  email?: string;
  codeHash?: string;
  attempts?: number;
  createdAt?: Date;

  static #hash(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  // Issue a fresh code for an email, replacing any prior one. Returns the
  // plaintext code (to be emailed) — it is never persisted in the clear.
  static async issue(email: string): Promise<string> {
    await this.deleteExpired();
    const code = String(randomInt(0, 1_000_000)).padStart(
      EmailVerification.codeLength,
      "0",
    );
    const codeHash = EmailVerification.#hash(code);
    const existing = await EmailVerification.query().findOne({ email });
    if (existing != null) {
      await existing
        .$query()
        .patch({ codeHash, attempts: 0, createdAt: new Date() });
    } else {
      await EmailVerification.query().insert({ email, codeHash, attempts: 0 });
    }
    return code;
  }

  // Check a submitted code. Consumes (deletes) the record on success. Counts
  // failed tries and gives up after maxAttempts so a code can't be brute-forced.
  static async verify(email: string, code: string): Promise<boolean> {
    await this.deleteExpired();
    const rec = await EmailVerification.query().findOne({ email });
    if (rec == null) {
      return false;
    }
    if ((rec.attempts ?? 0) >= EmailVerification.maxAttempts) {
      await rec.$query().delete();
      return false;
    }
    if (EmailVerification.#hash(code) === rec.codeHash) {
      await rec.$query().delete();
      return true;
    }
    await rec.$query().patch({ attempts: (rec.attempts ?? 0) + 1 });
    return false;
  }

  static async deleteExpired(now: number = Date.now()): Promise<void> {
    await EmailVerification.query()
      .where("createdAt", "<", new Date(now - EmailVerification.expireTime))
      .delete();
  }
}

EmailVerification.relationMappings = {};
