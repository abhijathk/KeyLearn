import { createHash, randomInt } from "node:crypto";
import { isStaffEmail } from "@keylearn/config";
import { type ResourceOwner } from "@keylearn/oauth";
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
} from "@keylearn/pages-shared";
import { PublicId } from "@keylearn/publicid";
import { type Knex } from "knex";
import { type JSONSchema, Model, type Pojo, snakeCaseMappers } from "objection";
import { anonymousName } from "./name.ts";
import { hashPassword, needsRehash, verifyPassword } from "./password.ts";
import { Random } from "./util.ts";

/**
 * The outcome of resolving an OAuth sign-in to an account.
 *
 * - `ok` — signed in; start a session.
 * - `verify` — a new account was created from an address the provider did not
 *   vouch for; it must pass the emailed code before it can be used.
 * - `link-required` — an account already holds this address, but the provider
 *   did not verify it, so the identity cannot be attached automatically. The
 *   owner must sign in another way and link it deliberately.
 */
export type SsoResult =
  | { readonly kind: "ok"; readonly user: User }
  | { readonly kind: "verify"; readonly user: User; readonly email: string }
  | { readonly kind: "link-required"; readonly email: string };

/** Thrown when a registration email is already in use. */
export class UserExistsError extends Error {
  constructor() {
    super("A user with this email address already exists");
    this.name = "UserExistsError";
  }
}

/**
 * The provider's display fields, for writing onto a {@link UserExternalId}.
 *
 * A field the provider did not supply this time — absent, or dropped by
 * {@link User.parseResourceOwner} for being over-long — is omitted rather than
 * set to null, so one malformed profile response cannot wipe a good avatar or
 * profile link that a previous sign-in recorded.
 */
function profileFields({
  name,
  url,
  imageUrl,
}: ResourceOwner): Partial<UserExternalId> {
  return {
    ...(name != null && { name }),
    ...(url != null && { url }),
    ...(imageUrl != null && { imageUrl }),
    // Stamped on every sign-in (not just the first), so toPublicUser() can
    // tell which linked provider was used most recently.
    usedAt: new Date(),
  };
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
    // Whether this account's typing history is served to anyone who knows (or
    // guesses) its public id. Off by default: the public id is a reversible
    // encoding of the row id, so "public" here means enumerable by everyone.
    table.boolean("public_profile").notNullable().defaultTo(false);
    // Null for OAuth / magic-link accounts; set only for email+password.
    table.string("password_hash", 128).nullable();
    table.date("date_of_birth").nullable();
    // Whether the account's email address has been proven. True for OAuth and
    // magic-link sign-ups (email is inherently verified); email+password
    // sign-ups start false and flip once the emailed code is entered.
    table.boolean("email_verified").notNullable().defaultTo(false);
    // Bumped to invalidate all existing sessions ("sign out everywhere").
    table.integer("session_epoch").notNullable().defaultTo(0);
    // Two-step verification. The secret is only meaningful once `totp_enabled`
    // is set — it is written first, then confirmed, so a half-finished setup
    // can never lock anyone out.
    table.string("totp_secret", 64).nullable();
    table.boolean("totp_enabled").notNullable().defaultTo(false);
    // Hashed one-time recovery codes, JSON array. Hashed because they are
    // password-equivalent: each one alone completes a sign-in.
    table.text("recovery_codes").nullable();
    // A grown-up PIN gating profile management on a shared family device. The
    // client-side arithmetic gate is a speed bump a child can walk around with
    // devtools; this is checked by the server.
    table.string("parent_pin_hash", 160).nullable();
    table.integer("parent_pin_length").unsigned().nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["email"]);
    table.unique(["name"]);
  }

  readonly id?: number;
  email?: string;
  name?: string;
  anonymized?: number;
  publicProfile?: number | boolean;
  passwordHash?: string | null;
  dateOfBirth?: string | null;
  emailVerified?: number | boolean;
  sessionEpoch?: number;
  totpSecret?: string | null;
  totpEnabled?: number | boolean;
  recoveryCodes?: string | null;
  parentPinHash?: string | null;
  parentPinLength?: number | null;
  /**
   * This household has had a learner profile at some point, so the support
   * section stays behind the grown-up PIN even if that profile is later
   * removed. Set on creation, never cleared — see schema.ts.
   */
  supportPinRequired?: number | boolean;
  staff?: number | boolean;
  remindedAt?: Date | null;
  /**
   * The 2-character ISO country code Cloudflare reported (`CF-IPCountry`) at
   * the moment this account registered. Captured once, at sign-up, and never
   * updated again — this is a signup-attribution field for the support
   * dashboard's language/geography breakdown, not an ongoing location trail.
   * Bolt-on, like `staff`: added purely via an `addColumn` migration, not in
   * `jsonSchema`/`createTable`.
   */
  signupCountry?: string | null;
  /**
   * The locale negotiated from `Accept-Language` at the moment this account
   * registered. Captured once, at sign-up, and never updated again — same
   * signup-attribution rule as `signupCountry`, feeding the support
   * dashboard's language breakdown. Bolt-on, same reasoning as
   * `signupCountry`: `addColumn` migration only, not in `jsonSchema`.
   */
  locale?: string | null;
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
    firstName: string,
    lastName: string,
    dateOfBirth: string | null = null,
  ): Promise<User> {
    const existing = await User.findByEmail(email);
    if (existing != null) {
      throw new UserExistsError();
    }
    // `name` is the account's unique handle, seeded from the real first name;
    // the full name lives on the learner profile created alongside it.
    const name = await User.findUniqueName(email, firstName || email);
    const passwordHash = await hashPassword(password);
    return await User.query()
      .withGraphFetched("externalIds")
      .withGraphFetched("order")
      .insertAndFetch({ email, name, passwordHash, dateOfBirth })
      .then(async (user) => {
        // Give the account its own learner profile straight away, named
        // properly — otherwise ensureDefault later invents one from the email.
        await Profile.query().insert({
          userId: user.id!,
          kind: "adult",
          firstName,
          lastName,
          parentalConsent: false,
          consentAt: null,
        });
        return user;
      });
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
      // A successful login is the only moment the plaintext is available, so it
      // is the only chance to upgrade a hash made with weaker work factors.
      if (needsRehash(user.passwordHash)) {
        await user.setPassword(password);
      }
      return user;
    }
    return null;
  }

  /**
   * Replaces the account's recovery codes, storing only hashes. They are
   * password-equivalent — each one alone completes a sign-in — so a database
   * read must not yield usable ones. Returns the plaintext set, shown once.
   */
  async setRecoveryCodes(codes: readonly string[]): Promise<void> {
    const hashes = codes.map((code) => User.hashRecoveryCode(code));
    await this.$query().patch({ recoveryCodes: JSON.stringify(hashes) });
  }

  static hashRecoveryCode(code: string): string {
    // Normalised so formatting differences (case, spaces, the dash) do not
    // decide whether a correctly-transcribed code is accepted.
    const normal = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
    return createHash("sha256").update(normal).digest("hex");
  }

  /**
   * Consumes a recovery code if it matches an unused one. Single use: a code
   * that has been spent is removed, so a written-down list cannot be replayed.
   */
  async useRecoveryCode(code: string): Promise<boolean> {
    let hashes: string[];
    try {
      hashes = JSON.parse(this.recoveryCodes ?? "[]") as string[];
    } catch {
      return false;
    }
    const target = User.hashRecoveryCode(code);
    const index = hashes.indexOf(target);
    if (index === -1) {
      return false;
    }
    hashes.splice(index, 1);
    await this.$query().patch({ recoveryCodes: JSON.stringify(hashes) });
    return true;
  }

  /** How many unused recovery codes remain. */
  countRecoveryCodes(): number {
    try {
      return (JSON.parse(this.recoveryCodes ?? "[]") as string[]).length;
    } catch {
      return 0;
    }
  }

  /**
   * Sets (or clears) the grown-up PIN. Hashed with the same scrypt parameters as
   * a password: a 4-6 digit PIN has a tiny keyspace, so a fast hash would make a
   * leaked database trivially reversible.
   *
   * The length is kept alongside the hash, because a hash cannot be asked
   * how long its input was and the entry screen draws one box per digit.
   * It is a real disclosure — knowing a PIN is four digits narrows the
   * search from about 111 million to 10,000 — but an attacker would try
   * four first regardless, and what actually makes a PIN of any length
   * safe here is the ten-attempts-per-five-minutes limiter on the verify
   * route, not the secrecy of its length.
   */
  async setParentPin(pin: string | null): Promise<void> {
    await this.$query().patch({
      parentPinHash: pin == null ? null : await hashPassword(pin),
      parentPinLength: pin == null ? null : pin.length,
    });
  }

  async verifyParentPin(pin: string): Promise<boolean> {
    const ok = await verifyPassword(pin, this.parentPinHash);
    // A PIN set before the length was recorded has no length, and the
    // entry screen cannot draw the right number of boxes for it. A
    // correct PIN is the one moment we know how long it is, so it is
    // written down then — once — and every prompt afterwards is exact.
    if (ok && this.parentPinLength == null) {
      this.parentPinLength = pin.length;
      await this.$query().patch({ parentPinLength: pin.length });
    }
    return ok;
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

  /**
   * Resolves a completed OAuth sign-in to an account.
   *
   * Identity is the provider's subject (`provider` + `id`), never the email
   * address: any identity provider can assert any address, so resolving by
   * email lets a sign-in through one provider land on an account belonging to
   * someone else (the nOAuth takeover). An email may only be used to *reach* an
   * existing account when the provider states it verified it.
   */
  static async ensure(ro: ResourceOwner): Promise<SsoResult> {
    ro = User.parseResourceOwner(ro);
    const { provider, id: externalId, email } = ro;
    if (email == null) {
      throw new Error("No email address");
    }

    // A subject we've seen before: this IS the account, whatever address the
    // provider is reporting today.
    const link = await UserExternalId.findBySubject(provider, externalId);
    if (link != null) {
      const user = await User.findById(link.userId!);
      if (user != null) {
        // Refresh the provider's display fields only. The account's own email is
        // deliberately left alone — following a renamed directory attribute
        // would let a tenant move an account onto an address it doesn't own.
        await link.$query().patch(profileFields(ro));
        return { kind: "ok", user: (await User.findById(user.id!))! };
      }
      // The link outlived its account; drop it and continue as a fresh sign-in.
      await link.$query().delete();
    }

    // First time this subject has signed in here.
    const verified = ro.emailVerified === true;
    const existing = await User.findByEmail(email);

    if (existing != null) {
      if (!verified) {
        // Attaching a new provider to someone's account on the strength of an
        // unverified address is exactly the takeover. Make them prove the
        // account instead.
        return { kind: "link-required", email };
      }
      const fields = { externalId, ...profileFields(ro) };
      // The schema allows one identity per (account, provider), so re-linking
      // the same provider under a new subject replaces the old row rather than
      // colliding with it.
      const prior = await UserExternalId.query().findOne({
        userId: existing.id!,
        provider,
      });
      if (prior != null) {
        await prior.$query().patch(fields);
      } else {
        await existing
          .$relatedQuery<UserExternalId>("externalIds")
          .insert({ provider, ...fields } as UserExternalId);
      }
      if (!existing.emailVerified) {
        await existing.$query().patch({ emailVerified: true });
      }
      return { kind: "ok", user: (await User.findById(existing.id!))! };
    }

    // Brand-new account. An unverified address may not belong to whoever is
    // signing in, so the account starts unverified and has to pass the emailed
    // code before it can be used — otherwise a provider could pre-register an
    // address its real owner has not reached yet.
    // First name only, like the email sign-up path beside it. A provider
    // hands over a full name ("Abhijath Kottikkal") and this handle is what
    // the app shows on leaderboards, on a public profile and beside the
    // wordmark — none of which should carry somebody's surname. The full name
    // stays on the learner profile, which is where the certificate reads it.
    const name = await User.findUniqueName(
      email,
      givenNameOf(ro.name) ?? email,
    );
    const created = await User.query().insertGraphAndFetch({
      email,
      name,
      emailVerified: verified,
      externalIds: [
        {
          provider,
          externalId,
          name: ro.name ?? null,
          url: ro.url ?? null,
          imageUrl: ro.imageUrl ?? null,
          usedAt: new Date(),
        } as UserExternalId,
      ],
    } as User);
    const user = (await User.findById(created.id!))!;
    return verified ? { kind: "ok", user } : { kind: "verify", user, email };
  }

  /**
   * The first word of a provider's display name.
   *
   * Providers give "First Last", occasionally with a middle name. Splitting on
   * whitespace is crude but it is the only thing available — there is no
   * separate given-name field in the profile every provider returns — and the
   * cost of getting it wrong is a handle that is shorter than expected rather
   * than one that leaks a surname.
   */
  static parseResourceOwner(ro: ResourceOwner): ResourceOwner {
    const emailType = User.jsonSchema.properties.email;
    const nameType = User.jsonSchema.properties.name;
    const urlType = UserExternalId.jsonSchema.properties.url;
    const imageUrlType = UserExternalId.jsonSchema.properties.imageUrl;
    let { raw, provider, id, email, emailVerified, name, url, imageUrl } = ro;
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
    return { raw, provider, id, email, emailVerified, name, url, imageUrl };
  }

  toDetails(): UserDetails {
    return {
      id: String(new PublicId(this.id!)),
      email: this.email!,
      name: this.name!,
      anonymized: Boolean(this.anonymized!),
      publicProfile: Boolean(this.publicProfile),
      externalId: this.externalIds!.map((id) => id.toDetails()),
      order: this.order?.toDetails() ?? null,
      dateOfBirth: this.dateOfBirth ?? null,
      hasPassword: this.passwordHash != null,
      twoFactorEnabled: Boolean(this.totpEnabled),
      parentPinSet: this.parentPinHash != null,
      /**
       * How many boxes the entry screen draws.
       *
       * Null both when no PIN is set and when one was set before this
       * column existed — the screen then falls back to a single free-length
       * field. Guessing four there would lock out anyone whose PIN is
       * longer, which is the one outcome a PIN screen must never produce.
       */
      parentPinLength:
        this.parentPinHash == null ? null : (this.parentPinLength ?? null),
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
      const staff = isStaffEmail(user.email);
      if (user.anonymized) {
        return Object.freeze<NamedUser>({
          id: details.id,
          name: anonymousName(details.email),
          imageUrl: null,
          premium,
          staff,
        });
      }
      // When more than one provider is linked, the most recently *used* one
      // wins — not whichever happened to be linked first. Otherwise an old
      // Google link's name/avatar would silently outlive a newer Facebook
      // sign-in with no way to tell the two apart.
      const externalId =
        details.externalId.length === 0
          ? null
          : details.externalId.reduce((latest, current) =>
              new Date(current.usedAt).getTime() >
              new Date(latest.usedAt).getTime()
                ? current
                : latest,
            );
      if (externalId != null) {
        // Try to take username from an external id, if exists.
        return Object.freeze<NamedUser>({
          id: details.id,
          name: externalId.name ?? details.name,
          imageUrl: externalId.imageUrl,
          premium,
          staff,
        });
      } else {
        // Otherwise use auto-generated username.
        return Object.freeze<NamedUser>({
          id: details.id,
          name: details.name,
          imageUrl: null,
          premium,
          staff,
        });
      }
    } else {
      // Handle anonymous user.
      return Object.freeze<AnonymousUser>({
        id: null,
        name: anonymousName(hint),
        imageUrl: null,
        staff: false,
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
    table.timestamp("used_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["user_id", "provider"]);
    table.unique(["provider", "external_id"]);
  }

  readonly id?: number;
  userId?: number;
  provider?: string;
  externalId?: string;
  name?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  usedAt?: Date | null;
  createdAt?: Date;
  user?: User;

  /**
   * Finds the account link for a provider's subject. This pair — not the email
   * address — is the identity of a federated account.
   */
  static async findBySubject(
    provider: string,
    externalId: string,
  ): Promise<UserExternalId | null> {
    return (
      (await UserExternalId.query().findOne({ provider, externalId })) ?? null
    );
  }

  toDetails(): UserExternalIdDetails {
    return {
      provider: this.provider!,
      id: this.externalId!,
      name: this.name ?? null,
      url: this.url ?? null,
      imageUrl: this.imageUrl ?? null,
      // Falls back to createdAt for a row linked before this column existed,
      // so it still sorts rather than always losing to a fresher one.
      usedAt: this.usedAt ?? this.createdAt!,
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
      visionSupport: { type: "boolean" },
      parentalConsent: { type: "boolean" },
      anonymized: { type: "boolean" },
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
    // Per-learner "hide my identity". Each grown-up in a household decides for
    // themselves whether their own name shows on leaderboards and in
    // multiplayer — it is their result, not the account holder's.
    table.boolean("anonymized").notNullable().defaultTo(false);
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
  visionSupport?: number | boolean;
  parentalConsent?: number | boolean;
  anonymized?: number | boolean;
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
    const count = await Profile.query().where("userId", user.id!).resultSize();
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

  /**
   * How this learner appears to other people.
   *
   * Practice belongs to a profile, not to the account, so a household of two
   * grown-ups shows two distinct people rather than one shared account name.
   * `id` stays the ACCOUNT's public id — the public profile page is an
   * account-level thing the owner opts into — while the name and picture come
   * from the learner.
   */
  toPublicUser(account: User): NamedUser {
    const premium = account.order != null;
    const publicId = String(new PublicId(account.id!));
    if (this.anonymized) {
      // Deterministic per profile, so the same learner keeps the same alias
      // across sessions instead of becoming a new stranger each time.
      return Object.freeze<NamedUser>({
        id: publicId,
        name: anonymousName(`profile:${this.id}`),
        imageUrl: null,
        premium,
        // A public profile card is never a staff-permission surface — always
        // false here regardless of the account's real flag.
        staff: false,
      });
    }
    let imageUrl: string | null = null;
    const avatar = this.parseAvatar();
    // Only an inline image is usable as a picture here; a preset icon has no
    // URL, so those fall through to the name-based identicon.
    if (avatar?.type === "photo") {
      imageUrl = avatar.dataUrl;
    }
    return Object.freeze<NamedUser>({
      id: publicId,
      name: this.firstName!,
      imageUrl,
      premium,
      staff: false,
    });
  }

  parseAvatar(): ProfileAvatar | null {
    if (!this.avatar) {
      return null;
    }
    try {
      return JSON.parse(this.avatar) as ProfileAvatar;
    } catch {
      return null;
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
      visionSupport: Boolean(this.visionSupport),
      parentalConsent: Boolean(this.parentalConsent),
      anonymized: Boolean(this.anonymized),
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
      purpose: { type: "string", minLength: 1, maxLength: 16 },
      accessToken: { type: "string", minLength: 1, maxLength: 64 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { email, purpose, accessToken } =
      UserLoginRequest.jsonSchema.properties;
    table.increments("id").primary();
    table.string("email", email.maxLength).notNullable();
    table.string("purpose", purpose.maxLength).notNullable().defaultTo("login");
    table.binary("access_token", accessToken.maxLength).notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["email", "purpose"]);
    table.unique(["access_token"]);
  }

  /**
   * A magic-login link is good for a day; a password reset is a far more
   * sensitive capability and should not sit in an inbox that long.
   */
  static expireTimeFor(purpose: TokenPurpose): number {
    return purpose === "reset" ? 60 * 60 * 1000 : 24 * 3600 * 1000;
  }

  /** Kept for the sweep of legacy rows; prefer {@link expireTimeFor}. */
  static readonly expireTime = 24 * 3600 * 1000;

  readonly id?: number;
  email?: string;
  purpose?: string;
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

  // Issues a fresh single-use token for an email and purpose. Only the SHA-256
  // *hash* is persisted, so a database leak never exposes a usable reset/login
  // link; the plaintext token is returned once, to be emailed. Any prior token
  // for the same address and purpose is replaced.
  static async init(
    email: string,
    purpose: TokenPurpose = "login",
  ): Promise<string> {
    await this.deleteExpired();
    await UserLoginRequest.query().where({ email, purpose }).delete();
    const token = Random.string(20);
    await UserLoginRequest.query().insert({
      email,
      purpose,
      accessToken: UserLoginRequest.#hash(token),
    });
    return token;
  }

  /**
   * Redeems a token issued for a specific purpose, one shot.
   *
   * The purpose has to match. Otherwise the two flows share one token pool, and
   * a "here is your sign-in link" email — which a user may reasonably forward or
   * paste somewhere — doubles as authorisation to set a new password.
   */
  static async #take(
    accessToken: string,
    purpose: TokenPurpose,
  ): Promise<UserLoginRequest | null> {
    await this.deleteExpired();
    const request = await UserLoginRequest.findByAccessToken(
      UserLoginRequest.#hash(accessToken),
    );
    if (request == null || (request.purpose ?? "login") !== purpose) {
      return null;
    }
    const age = Date.now() - (request.createdAt?.getTime() ?? 0);
    if (age > UserLoginRequest.expireTimeFor(purpose)) {
      await UserLoginRequest.query().deleteById(request.id!);
      return null;
    }
    await UserLoginRequest.query().deleteById(request.id!);
    return request;
  }

  static async login(accessToken: string): Promise<User | null> {
    const request = await UserLoginRequest.#take(accessToken, "login");
    if (request == null) {
      return null;
    }
    return await User.login(request.email!);
  }

  // One-shot: validates a reset token, deletes it so it can't be reused, and
  // returns the email it was issued for.
  static async consume(accessToken: string): Promise<string | null> {
    const request = await UserLoginRequest.#take(accessToken, "reset");
    return request?.email ?? null;
  }

  static async deleteExpired(now: number = Date.now()): Promise<void> {
    // Sweeps at the longest lifetime; #take enforces the shorter per-purpose
    // limit precisely.
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

/**
 * What an emailed code authorises.
 *
 * A code is bound to exactly one of these. Without that binding there is a
 * single code namespace per address, so a code the user was asked to request for
 * one reason ("confirm your email") also satisfies an unrelated and destructive
 * one ("delete my account"). It also keeps two concurrent flows from
 * overwriting each other's code, since rows are keyed per purpose.
 */
/**
 * What an emailed *link* authorises. Kept separate from the code purposes: a
 * sign-in link and a password-reset link are very different capabilities, and
 * sharing one token pool lets either be redeemed for the other.
 */
export type TokenPurpose = "login" | "reset";

export type VerificationPurpose =
  /** Prove a new sign-up's address. */
  | "verify-email"
  /** Prove control of an address the account is moving TO. */
  | "change-email"
  /** Prove the requester still reads the account's CURRENT address. */
  | "identity"
  /** Confirm permanent deletion of the account. */
  | "delete-account"
  /**
   * Confirm a security reset. Bound to a recorded selection rather than
   * standing on its own — see SecurityReset for why a code that only
   * authorises its purpose is not enough here.
   */
  | "security-reset";

// A short-lived email-verification code. The 6-digit code is emailed and stored
// only as a hash, so a database read never reveals a live code. One row per
// (email, purpose); the newest code for a purpose replaces the previous one.
export class EmailVerification extends TimestampMixin(Model) {
  static override readonly tableName = "email_verification";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["email", "codeHash"],
    properties: {
      id: { type: "integer" },
      email: { type: "string", minLength: 1, maxLength: 64 },
      purpose: { type: "string", minLength: 1, maxLength: 24 },
      codeHash: { type: "string", minLength: 1, maxLength: 64 },
      attempts: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { email, purpose, codeHash } =
      EmailVerification.jsonSchema.properties;
    table.increments("id").primary();
    table.string("email", email.maxLength).notNullable();
    table
      .string("purpose", purpose.maxLength)
      .notNullable()
      .defaultTo("verify-email");
    table.string("code_hash", codeHash.maxLength).notNullable();
    // Cumulative failed guesses in the current window — deliberately NOT reset
    // by issuing a new code (see `issue`).
    table.integer("attempts").notNullable().defaultTo(0);
    table.timestamp("attempts_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["email", "purpose"]);
  }

  /** How long a single code stays usable. */
  static readonly expireTime = 15 * 60 * 1000;
  /** Failed guesses allowed per address+purpose within {@link attemptWindow}. */
  static readonly maxAttempts = 10;
  /** The rolling window over which failures accumulate. */
  static readonly attemptWindow = 60 * 60 * 1000;
  static readonly codeLength = 6;

  readonly id?: number;
  email?: string;
  purpose?: string;
  codeHash?: string;
  attempts?: number;
  attemptsAt?: Date | null;
  createdAt?: Date;

  // SQLite hands timestamps back as numbers rather than Dates, so normalise
  // here instead of type-testing at every read.
  override $parseDatabaseJson(json: Pojo): Pojo {
    json = super.$parseDatabaseJson(json);
    for (const key of ["attemptsAt", "createdAt"]) {
      const value = json[key];
      if (value != null && !(value instanceof Date)) {
        json[key] = new Date(value as string | number);
      }
    }
    return json;
  }

  static #hash(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  /**
   * Issue a fresh code for an address and purpose, replacing any prior one.
   * Returns the plaintext code (to be emailed) — never persisted in the clear.
   *
   * The failure counter survives reissue. Resetting it here would make the code
   * brute-forceable: an attacker who can trigger a resend would earn a fresh
   * budget of guesses each time, and a 6-digit code does not survive that.
   */
  static async issue(
    email: string,
    purpose: VerificationPurpose = "verify-email",
  ): Promise<string> {
    await this.deleteExpired();
    const code = String(randomInt(0, 1_000_000)).padStart(
      EmailVerification.codeLength,
      "0",
    );
    const codeHash = EmailVerification.#hash(code);
    const existing = await EmailVerification.query().findOne({
      email,
      purpose,
    });
    if (existing != null) {
      await existing.$query().patch({ codeHash, createdAt: new Date() });
    } else {
      await EmailVerification.query().insert({
        email,
        purpose,
        codeHash,
        attempts: 0,
      });
    }
    return code;
  }

  /**
   * Check a submitted code against an address AND the purpose it was issued for.
   * Consumes the record on success.
   *
   * A code only ever authorises its own purpose, and failures accumulate across
   * reissues within {@link attemptWindow}, so the 10^6 code space cannot be
   * ground down by alternating resend-and-guess.
   */
  static async verify(
    email: string,
    purpose: VerificationPurpose,
    code: string,
  ): Promise<boolean> {
    await this.deleteExpired();
    const rec = await EmailVerification.query().findOne({ email, purpose });
    if (rec == null) {
      return false;
    }
    const now = Date.now();
    // The code itself is short-lived, independently of the failure window that
    // keeps the row alive.
    if (
      rec.createdAt != null &&
      now - rec.createdAt.getTime() > EmailVerification.expireTime
    ) {
      return false;
    }
    // Roll the failure window over if it has elapsed.
    let attempts = rec.attempts ?? 0;
    const at = rec.attemptsAt?.getTime() ?? 0;
    if (at > 0 && now - at > EmailVerification.attemptWindow) {
      attempts = 0;
    }
    if (attempts >= EmailVerification.maxAttempts) {
      return false;
    }
    if (EmailVerification.#hash(code) === rec.codeHash) {
      await rec.$query().delete();
      return true;
    }
    await rec.$query().patch({
      attempts: attempts + 1,
      // Start the window on the first failure of a new window.
      attemptsAt:
        attempts === 0 ? new Date(now) : (rec.attemptsAt ?? new Date(now)),
    });
    return false;
  }

  /**
   * Drops rows whose code has expired AND whose failure window has elapsed.
   * The row has to outlive the code, or deleting it would discard the failure
   * count and hand out a fresh budget of guesses.
   */
  static async deleteExpired(now: number = Date.now()): Promise<void> {
    await EmailVerification.query()
      .where("createdAt", "<", new Date(now - EmailVerification.expireTime))
      .where((q) => {
        q.whereNull("attemptsAt").orWhere(
          "attemptsAt",
          "<",
          new Date(now - EmailVerification.attemptWindow),
        );
      })
      .delete();
  }
}

EmailVerification.relationMappings = {};

/**
 * A sitting of the certificate assessment.
 *
 * Held server-side rather than on the device because the standard is three
 * consistent sittings, and a household that switches devices must not have to
 * start that count again. It also means the server can judge the sittings it
 * was actually told about, rather than being handed a verdict by the client.
 *
 * These never touch the practice statistics. If a poor sitting dragged down
 * the medians that decide eligibility, failing once would lock a learner out
 * by their own failure — which is the opposite of what an assessment is for.
 */
export class CertificateSitting extends Model {
  static override readonly tableName = "certificate_sitting";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["profileId", "kind", "language", "speed", "accuracy"],
    properties: {
      id: { type: "integer" },
      profileId: { type: "integer" },
      kind: { type: "string", enum: ["typing", "braille"] },
      // The alphabet this was sat in. Finishing English says nothing about
      // Russian, so a sitting belongs to one language and only counts there.
      language: { type: "string", minLength: 1, maxLength: 32 },
      /** Words per minute for typing, cells per minute for braille. */
      speed: { type: "number" },
      accuracy: { type: "number" },
      runs: { type: "integer" },
      seconds: { type: "integer" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("profile_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("profile")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.string("kind", 8).notNullable();
    table.string("language", 32).notNullable();
    table.float("speed").notNullable();
    table.float("accuracy").notNullable();
    table.integer("runs").notNullable().defaultTo(1);
    table.integer("seconds").notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    // The verdict reads the most recent sittings for one learner in one
    // language, which is exactly this index.
    table.index(["profile_id", "language", "created_at"]);
  }

  readonly id?: number;
  profileId?: number;
  kind?: string;
  language?: string;
  speed?: number;
  accuracy?: number;
  runs?: number;
  seconds?: number;
  createdAt?: Date;
}

/**
 * An issued certificate.
 *
 * The number is derived from `sequence`, which is this row's own identity —
 * that is what makes duplicates impossible rather than merely unlikely. The
 * figures are copied in rather than referenced: a certificate states what was
 * true on the day it was issued, and later practice must not silently rewrite
 * a document somebody has already printed.
 */
export class Certificate extends Model {
  static override readonly tableName = "certificate";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["profileId", "kind", "language", "level", "speed", "accuracy"],
    properties: {
      id: { type: "integer" },
      sequence: { type: "integer" },
      profileId: { type: "integer" },
      userId: { type: "integer" },
      kind: { type: "string", enum: ["typing", "braille"] },
      audience: { type: "string", enum: ["adult", "kid"] },
      language: { type: "string", minLength: 1, maxLength: 32 },
      level: {
        type: "string",
        enum: ["completion", "bronze", "silver", "gold"],
      },
      // Which of the three papers was printed. Stored rather than worked out
      // from the age at print time: a birthday must not silently restyle a
      // document that has already been issued and possibly hung on a wall.
      sheet: { type: "string", enum: ["adult", "young", "child"] },
      speed: { type: "number" },
      accuracy: { type: "number" },
      /** The holder's name, as printed. Never shown by verification for a kid. */
      name: { type: "string", minLength: 1, maxLength: 80 },
      /** Whether verification may name the holder. Off unless asked for. */
      nameVisible: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    // Distinct from the primary key so the numbering space cannot be disturbed
    // by anything that renumbers rows.
    table.bigInteger("sequence").notNullable().unique();
    table
      .integer("profile_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("profile")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.integer("user_id").unsigned().notNullable().index();
    table.string("kind", 8).notNullable();
    table.string("audience", 8).notNullable();
    table.string("language", 32).notNullable();
    table.string("level", 12).notNullable();
    table.string("sheet", 8).notNullable().defaultTo("adult");
    table.float("speed").notNullable();
    table.float("accuracy").notNullable();
    table.string("name", 80).notNullable();
    table.boolean("name_visible").notNullable().defaultTo(false);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    // One certificate per learner per language per level: sitting again at the
    // same level reissues nothing, but reaching a higher one does.
    table.unique(["profile_id", "language", "level"]);
  }

  readonly id?: number;
  sequence?: number;
  profileId?: number;
  userId?: number;
  kind?: string;
  audience?: string;
  language?: string;
  level?: string;
  sheet?: string;
  speed?: number;
  accuracy?: number;
  name?: string;
  nameVisible?: boolean;
  createdAt?: Date;
}

/**
 * The first word of a display name, or null when there is nothing usable.
 *
 * Used when an identity provider hands over a full name and the app needs the
 * handle it shows publicly — leaderboards, a public profile, the wordmark. A
 * surname belongs on the learner profile and the certificate, not there.
 */
function givenNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first === "" ? null : first;
}
