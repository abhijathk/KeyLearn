import { createHash } from "node:crypto";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";
import { Random } from "./util.ts";

/**
 * The organisation tier — docs/organisations.md, revision 2.
 *
 * A second way to own (mode A) or see (mode B) learners, beside the
 * household model, for coaching centres and weekend schools. Everything
 * here is additive; no household query changes meaning (P1), and the
 * access question is answered in ONE place — the server's resolver —
 * never by these models individually (P2).
 */

// ------------------------------------------------------------------ roles

/**
 * Kept as an open string in the schema (spec §7's seam: a new role is one
 * string and one line, no enum migration). The type narrows what the app
 * itself hands out today.
 */
export type OrgRole = "owner" | "admin" | "teacher";

export type OrgAction =
  | "org.manage" // rename, delete, transfer ownership
  | "org.billing" // seats, plan
  | "members.admins" // appoint and remove admins
  | "members.teachers" // appoint and remove teachers
  | "batches.manage" // create and edit batches
  | "learners.create" // mode-A profile creation
  | "learners.pins" // set, reset and unlock learner PINs
  | "learners.unenrol" // end a mode-B grant
  | "learners.read" // see learners' progress (teacher: own batch)
  | "invites.guardians" // invite guardians into a batch (teacher: own batch)
  | "session.run"; // run a projection session for a batch

/**
 * Roles are strict supersets — owner ⊇ admin ⊇ teacher (spec §3). One
 * rank per role, one minimum per action, and no permission can ever
 * exist that a teacher has and an admin does not. Batch scoping for
 * teachers is the RESOLVER's job, not this function's: `can` answers
 * "may this role do this at all"; where it may do it is membership data.
 */
const RANK: Record<string, number> = { owner: 3, admin: 2, teacher: 1 };

const MIN_RANK: Record<OrgAction, number> = {
  "org.manage": 3,
  "org.billing": 3,
  "members.admins": 3,
  "members.teachers": 2,
  "batches.manage": 2,
  "learners.create": 2,
  "learners.pins": 2,
  "learners.unenrol": 2,
  "learners.read": 1,
  "invites.guardians": 1,
  "session.run": 1,
};

export function can(role: string, action: OrgAction): boolean {
  return (RANK[role] ?? 0) >= MIN_RANK[action];
}

// ----------------------------------------------------------- organization

export class Organization extends TimestampMixin(Model) {
  static override readonly tableName = "organization";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["name", "type"],
    properties: {
      id: { type: "integer" },
      parentId: { type: ["integer", "null"] },
      name: { type: "string", minLength: 1, maxLength: 128 },
      // "school" labels batches "class" in the UI; the schema keeps one word.
      type: { type: "string", minLength: 1, maxLength: 24 },
      staffEmailDomains: { type: ["string", "null"], maxLength: 255 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    // school → campus, an association running schools in three countries,
    // without restructuring scoped queries (spec §7). Self-referencing and
    // unused until somebody needs it.
    table.integer("parent_id").unsigned().nullable();
    table.string("name", 128).notNullable();
    table.string("type", 24).notNullable();
    // Which email domains this organisation's STAFF accounts use, comma
    // separated — "balakairali.org.au" or "example.org,example.org.au".
    // Null means no restriction, which is the twelve-parents-in-a-hall
    // school that has only personal addresses; nothing changes for them.
    table.string("staff_email_domains", 255).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  parentId?: number | null;
  name?: string;
  type?: string;
  staffEmailDomains?: string | null;
  createdAt?: Date;

  /** The allowlist as domains, lowercased; empty when unrestricted. */
  domains(): string[] {
    return (this.staffEmailDomains ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter((d) => d !== "");
  }

  /**
   * May an account with this address hold this staff role here?
   *
   * Owner and admin are the people who can see every learner in the
   * school and appoint others, so they must be AT the school — option A,
   * the owner's decision. A teacher sees one batch and appoints nobody,
   * so an org address is recommended and not required: at a community
   * school the volunteer teachers are the parents, and forcing a second
   * address on them would split one person across two accounts.
   *
   * Returns "ok", "recommended" (allowed, worth a nudge), or "wrong".
   */
  staffAddressVerdict(
    email: string | null | undefined,
    role: string,
  ): "ok" | "recommended" | "wrong" {
    const allowed = this.domains();
    if (allowed.length === 0 || role === "guardian") {
      return "ok";
    }
    const at = (email ?? "").lastIndexOf("@");
    const domain =
      at < 0
        ? ""
        : email!
            .slice(at + 1)
            .trim()
            .toLowerCase();
    if (allowed.includes(domain)) {
      return "ok";
    }
    return role === "teacher" ? "recommended" : "wrong";
  }

  static async findById(id: number): Promise<Organization | null> {
    return (await Organization.query().findById(id)) ?? null;
  }

  /**
   * Seat accounting, spec §9.4 (resolved): a seat is a learner place —
   * mode-A profiles plus live mode-B grants. A missing plan means the
   * organisation is being set up before billing exists (M4), which must
   * not stop a school mid-onboarding: unlimited seats, not lapsed.
   * A lapsed plan degrades staff surfaces to read-only and NEVER refuses
   * a learner mid-lesson (A14) — enforcement lives in the controller.
   */
  async seatStatus(): Promise<{
    seats: number | null;
    used: number;
    lapsed: boolean;
  }> {
    const plan = await OrganizationPlan.query().findOne({
      organizationId: this.id!,
    });
    // Lowercase single-word aliases on purpose: makeKnex installs
    // snake-case identifier wrapping, so a camelCase alias comes back
    // renamed ("modeA" → "mode_a") and a naive read produces NaN.
    const [a] = (await Organization.knex()("profile")
      .where("organization_id", this.id!)
      .count("id as n")) as unknown as [{ n: number | string }];
    const [b] = (await Organization.knex()("profile_access")
      .where("organization_id", this.id!)
      .whereNull("revoked_at")
      .count("id as n")) as unknown as [{ n: number | string }];
    const used = Number(a.n) + Number(b.n);
    if (plan == null) {
      return { seats: null, used, lapsed: false };
    }
    const lapsed =
      plan.validUntil != null &&
      new Date(plan.validUntil).getTime() < Date.now();
    return { seats: plan.seats ?? null, used, lapsed };
  }

  toDetails() {
    return {
      id: this.id!,
      name: this.name!,
      type: this.type!,
      parentId: this.parentId ?? null,
      staffEmailDomains: this.domains(),
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

// ------------------------------------------------------------- membership

export class OrgMember extends TimestampMixin(Model) {
  static override readonly tableName = "org_member";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["organizationId", "userId", "role"],
    properties: {
      id: { type: "integer" },
      organizationId: { type: "integer" },
      userId: { type: "integer" },
      role: { type: "string", minLength: 1, maxLength: 16 },
      batchId: { type: ["integer", "null"] },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("organization_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
    table.string("role", 16).notNullable();
    // A teacher's whole world (spec rev 2): sight and action end at this
    // batch. Null for owners and admins, whose scope is the organisation.
    table.integer("batch_id").unsigned().nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["organization_id", "user_id"]);
  }

  readonly id?: number;
  organizationId?: number;
  userId?: number;
  role?: string;
  batchId?: number | null;
  createdAt?: Date;

  static async membershipsFor(userId: number): Promise<OrgMember[]> {
    return await OrgMember.query().where("userId", userId);
  }

  static async find(
    organizationId: number,
    userId: number,
  ): Promise<OrgMember | null> {
    return (
      (await OrgMember.query().findOne({ organizationId, userId })) ?? null
    );
  }

  static async listFor(organizationId: number): Promise<OrgMember[]> {
    return await OrgMember.query()
      .where("organizationId", organizationId)
      .orderBy("id");
  }

  /**
   * A10: an organisation always has exactly one owner-or-more; removing
   * the last one is refused. Ownership moves by adding the next owner
   * first (transfer), never by leaving a headless organisation behind.
   */
  static async remove(organizationId: number, userId: number): Promise<void> {
    await OrgMember.transaction(async (trx) => {
      const member = await OrgMember.query(trx).findOne({
        organizationId,
        userId,
      });
      if (member == null) {
        return;
      }
      if (member.role === "owner") {
        const owners = await OrgMember.query(trx)
          .where({ organizationId, role: "owner" })
          .resultSize();
        if (owners <= 1) {
          throw new Error(
            "An organisation always has an owner — appoint the next owner before removing this one.",
          );
        }
      }
      await member.$query(trx).delete();
    });
  }
}

// ------------------------------------------------------------------ batch

export class Batch extends TimestampMixin(Model) {
  static override readonly tableName = "batch";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["organizationId", "name"],
    properties: {
      id: { type: "integer" },
      organizationId: { type: "integer" },
      name: { type: "string", minLength: 1, maxLength: 64 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("organization_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.string("name", 64).notNullable();
    // A cohort has a season; a curriculum does not live here (P6) — any
    // module's own fields (current unit, meeting time, content pin) go in
    // module-owned tables keyed by batch_id.
    table.date("starts_on").nullable();
    table.date("ends_on").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  organizationId?: number;
  name?: string;
  startsOn?: Date | string | null;
  endsOn?: Date | string | null;
  createdAt?: Date;

  static async listFor(organizationId: number): Promise<Batch[]> {
    return await Batch.query()
      .where("organizationId", organizationId)
      .orderBy("id");
  }
}

// ------------------------------------------------------------------- plan

/**
 * A record, never flags on the organisation row, and never the
 * household's `user.order` (spec §4.3) — different payers, different
 * units, different shapes to come.
 */
export class OrganizationPlan extends Model {
  static override readonly tableName = "organization_plan";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["organizationId", "seats"],
    properties: {
      organizationId: { type: "integer" },
      seats: { type: "integer", minimum: 1 },
      provider: { type: ["string", "null"], maxLength: 32 },
      providerRef: { type: ["string", "null"], maxLength: 128 },
    },
  } satisfies JSONSchema;
  static override idColumn = "organizationId";

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table
      .integer("organization_id")
      .unsigned()
      .primary()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.integer("seats").unsigned().notNullable();
    table.timestamp("valid_until").nullable();
    table.string("provider", 32).nullable();
    table.string("provider_ref", 128).nullable();
  }

  organizationId?: number;
  seats?: number;
  validUntil?: Date | string | null;
  provider?: string | null;
  providerRef?: string | null;
}

// ----------------------------------------------------- the enrolment grant

/**
 * Mode B (spec §4.4): a family-owned learner made visible to an
 * organisation by the guardian accepting an invite. The grant grants
 * VISIBILITY, never ownership — `profile.user_id` stays set, the §4.1
 * CHECK is untouched, and revoking removes the organisation's access and
 * nothing else. The row itself is the consent artifact: who consented,
 * and when.
 */
export class ProfileAccess extends Model {
  static override readonly tableName = "profile_access";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["profileId", "organizationId", "grantedByUserId", "scope"],
    properties: {
      id: { type: "integer" },
      profileId: { type: "integer" },
      organizationId: { type: "integer" },
      batchId: { type: ["integer", "null"] },
      grantedByUserId: { type: "integer" },
      // One value today; a narrower grant later is a value, not a table.
      scope: { type: "string", minLength: 1, maxLength: 24 },
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
      .onDelete("CASCADE");
    table
      .integer("organization_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.integer("batch_id").unsigned().nullable();
    // Not a foreign key: a guardian leaving the platform must not erase
    // the record of who consented (same reasoning as staff_user_id on
    // support messages).
    table.integer("granted_by_user_id").unsigned().notNullable();
    table.string("scope", 24).notNullable();
    table.timestamp("granted_at").notNullable().defaultTo(knex.fn.now());
    // Unenrolment is a timestamp, not a DELETE — aggregate term reports
    // must keep resolving after a student changes school (§9.3).
    table.timestamp("revoked_at").nullable();
    table.index(["organization_id", "revoked_at"]);
    table.index(["profile_id", "revoked_at"]);
  }

  readonly id?: number;
  profileId?: number;
  organizationId?: number;
  batchId?: number | null;
  grantedByUserId?: number;
  scope?: string;
  grantedAt?: Date;
  revokedAt?: Date | null;

  static async liveFor(profileId: number): Promise<ProfileAccess[]> {
    return await ProfileAccess.query()
      .where("profileId", profileId)
      .whereNull("revokedAt");
  }

  static async liveForOrg(organizationId: number): Promise<ProfileAccess[]> {
    return await ProfileAccess.query()
      .where("organizationId", organizationId)
      .whereNull("revokedAt");
  }

  static async grant({
    profileId,
    organizationId,
    batchId = null,
    grantedByUserId,
  }: {
    readonly profileId: number;
    readonly organizationId: number;
    readonly batchId?: number | null;
    readonly grantedByUserId: number;
  }): Promise<ProfileAccess> {
    // One live grant per (profile, organisation): re-enrolling a child a
    // second time refreshes the batch rather than stacking rows.
    const existing = await ProfileAccess.query().findOne({
      profileId,
      organizationId,
      revokedAt: null,
    });
    if (existing != null) {
      return await existing.$query().patchAndFetch({ batchId });
    }
    return await ProfileAccess.query().insertAndFetch({
      profileId,
      organizationId,
      batchId,
      grantedByUserId,
      scope: "progress",
      grantedAt: new Date(),
    });
  }

  /** A12: access ends within one request; the guardian's own is untouched. */
  static async revoke(
    profileId: number,
    organizationId: number,
  ): Promise<boolean> {
    const n = await ProfileAccess.query()
      .where({ profileId, organizationId })
      .whereNull("revokedAt")
      .patch({ revokedAt: new Date() });
    return n > 0;
  }
}

// ----------------------------------------------------------------- invite

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The tier's ONE membership mechanism (spec §5.3): single-use, scoped to
 * one organisation, one role, one batch where relevant; expiring;
 * revocable before acceptance. The token is stored hashed — the clear
 * value exists only in the response that created it and on the paper it
 * was printed to.
 */
export class OrgInvite extends TimestampMixin(Model) {
  static override readonly tableName = "org_invite";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["organizationId", "role", "tokenHash", "issuedByUserId"],
    properties: {
      id: { type: "integer" },
      organizationId: { type: "integer" },
      batchId: { type: ["integer", "null"] },
      // "guardian" is an invite role, not a membership role: accepting one
      // writes grants, never an org_member row.
      role: { type: "string", minLength: 1, maxLength: 16 },
      tokenHash: { type: "string", minLength: 64, maxLength: 64 },
      issuedByUserId: { type: "integer" },
      acceptedByUserId: { type: ["integer", "null"] },
      email: { type: ["string", "null"], maxLength: 128 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("organization_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.integer("batch_id").unsigned().nullable();
    table.string("role", 16).notNullable();
    table.string("token_hash", 64).notNullable().unique();
    // Who this was WRITTEN TO, when it was emailed rather than printed.
    // Deliberately not who may redeem it: parents hold the school's
    // address at work and their account at home, and a couple share one
    // between them. Locking the token to the mailbox turns all of that
    // into support tickets. Null on an anonymous printed slip.
    table.string("email", 128).nullable();
    table.integer("issued_by_user_id").unsigned().notNullable();
    table.timestamp("expires_at").notNullable();
    table.integer("accepted_by_user_id").unsigned().nullable();
    table.timestamp("accepted_at").nullable();
    table.timestamp("revoked_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  }

  readonly id?: number;
  organizationId?: number;
  batchId?: number | null;
  role?: string;
  tokenHash?: string;
  email?: string | null;
  reference?: string | null;
  issuedByUserId?: number;
  expiresAt?: Date | string;
  acceptedByUserId?: number | null;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt?: Date;

  /** Two Saturdays to act — the weekend-school cadence. */
  static readonly DEFAULT_EXPIRY_DAYS = 14;

  static async issue({
    organizationId,
    batchId = null,
    role,
    issuedByUserId,
    email = null,
    reference = null,
    expiresInDays = OrgInvite.DEFAULT_EXPIRY_DAYS,
  }: {
    readonly organizationId: number;
    readonly batchId?: number | null;
    readonly role: "owner" | "admin" | "teacher" | "guardian";
    readonly issuedByUserId: number;
    /** Set when emailed to a named address; null for a printed slip. */
    readonly email?: string | null;
    /**
     * The coordinator's note about who this is for — the child's name,
     * usually. Never shown to the recipient and dropped from view once
     * they accept; it exists to chase the ones who have not.
     */
    readonly reference?: string | null;
    readonly expiresInDays?: number;
  }): Promise<{ invite: OrgInvite; token: string }> {
    const token = Random.string(40);
    const invite = await OrgInvite.query().insertAndFetch({
      organizationId,
      batchId,
      role,
      tokenHash: hashToken(token),
      email: email == null ? null : email.trim().toLowerCase(),
      reference:
        reference == null || reference.trim() === "" ? null : reference.trim(),
      issuedByUserId,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 3600 * 1000),
    });
    return { invite, token };
  }

  /**
   * A sheet of them at once. A class of forty is forty invites and
   * nobody is pressing a button forty times — the addressed form comes
   * from a CSV of the class list, the anonymous form from a count and
   * gets printed as tear-off slips for the hall.
   */
  static async issueMany({
    organizationId,
    batchId = null,
    role,
    issuedByUserId,
    emails = null,
    count = 0,
  }: {
    readonly organizationId: number;
    readonly batchId?: number | null;
    readonly role: "owner" | "admin" | "teacher" | "guardian";
    readonly issuedByUserId: number;
    /** Addresses, each optionally carrying the coordinator's reference. */
    readonly emails?:
      | readonly (
          | string
          | {
              readonly email: string;
              readonly reference?: string | null;
            }
        )[]
      | null;
    readonly count?: number;
  }): Promise<{ invite: OrgInvite; token: string }[]> {
    const made: { invite: OrgInvite; token: string }[] = [];
    const targets: { email: string | null; reference: string | null }[] =
      emails != null
        ? emails.map((e) =>
            typeof e === "string"
              ? { email: e, reference: null }
              : { email: e.email, reference: e.reference ?? null },
          )
        : new Array(count).fill(null).map(() => ({
            email: null,
            reference: null,
          }));
    for (const target of targets) {
      made.push(
        await OrgInvite.issue({
          organizationId,
          batchId,
          role,
          issuedByUserId,
          email: target.email,
          reference: target.reference,
        }),
      );
    }
    return made;
  }

  /** Whether this address already holds a live invite here — CSV dedupe. */
  static async pendingEmails(organizationId: number): Promise<Set<string>> {
    const rows = await OrgInvite.query()
      .where("organizationId", organizationId)
      .whereNull("acceptedAt")
      .whereNull("revokedAt")
      .whereNotNull("email")
      .select("email");
    return new Set(rows.map((r) => (r.email ?? "").toLowerCase()));
  }

  toDetails() {
    return {
      id: this.id!,
      role: this.role!,
      batchId: this.batchId ?? null,
      email: this.email ?? null,
      // Only while it is still waiting. Once the parent is in, the
      // school knows who they are from the enrolment itself, so the
      // coordinator's crib note has done its job and stops being shown.
      reference: this.acceptedAt != null ? null : (this.reference ?? null),
      expiresAt: new Date(this.expiresAt!).toISOString(),
      acceptedAt:
        this.acceptedAt != null
          ? new Date(this.acceptedAt).toISOString()
          : null,
      acceptedByUserId: this.acceptedByUserId ?? null,
      revokedAt:
        this.revokedAt != null ? new Date(this.revokedAt).toISOString() : null,
      status:
        this.acceptedAt != null
          ? ("joined" as const)
          : this.revokedAt != null
            ? ("revoked" as const)
            : new Date(this.expiresAt!).getTime() < Date.now()
              ? ("expired" as const)
              : ("waiting" as const),
    };
  }

  /** A13: expired, revoked or used fails closed — one answer for all three, so a probe learns nothing. */
  static async findLive(token: string): Promise<OrgInvite | null> {
    const invite = await OrgInvite.query().findOne({
      tokenHash: hashToken(token),
    });
    if (
      invite == null ||
      invite.acceptedAt != null ||
      invite.revokedAt != null ||
      new Date(invite.expiresAt!).getTime() < Date.now()
    ) {
      return null;
    }
    return invite;
  }

  static async listFor(organizationId: number): Promise<OrgInvite[]> {
    return await OrgInvite.query()
      .where("organizationId", organizationId)
      .orderBy("id", "desc")
      .limit(50);
  }
}

// ---------------------------------------------------------- access audit

/**
 * A15: every staff view of an individual learner's progress is a row —
 * who, whose, when. Cheap now, painful to retrofit, and the first
 * question a school's data-protection officer asks. Written by the
 * resolver on the org and grant branches; the household branch never
 * writes here (a parent looking at their own child is not surveillance).
 */
export class OrgAccessEvent extends TimestampMixin(Model) {
  static override readonly tableName = "org_access_event";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["organizationId", "actorUserId", "profileId", "action"],
    properties: {
      id: { type: "integer" },
      organizationId: { type: "integer" },
      actorUserId: { type: "integer" },
      profileId: { type: "integer" },
      action: { type: "string", minLength: 1, maxLength: 32 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    table.increments("id").primary();
    table
      .integer("organization_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.integer("actor_user_id").unsigned().notNullable();
    // Not a foreign key — the log must keep resolving after the profile
    // is deleted; it is the record that access HAPPENED.
    table.integer("profile_id").unsigned().notNullable();
    table.string("action", 32).notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["organization_id", "created_at"]);
  }

  readonly id?: number;
  organizationId?: number;
  actorUserId?: number;
  profileId?: number;
  action?: string;
  createdAt?: Date;

  /** Best-effort: an audit failure must never fail the read it describes. */
  static record(row: {
    readonly organizationId: number;
    readonly actorUserId: number;
    readonly profileId: number;
    readonly action: string;
  }): void {
    void OrgAccessEvent.query()
      .insert(row)
      .catch((err) => {
        console.error("org-access-event: could not record", err);
      });
  }

  static async listFor(
    organizationId: number,
    limit = 200,
  ): Promise<OrgAccessEvent[]> {
    return await OrgAccessEvent.query()
      .where("organizationId", organizationId)
      .orderBy("id", "desc")
      .limit(limit);
  }
}

Organization.relationMappings = {};
OrgMember.relationMappings = {};
Batch.relationMappings = {};
OrganizationPlan.relationMappings = {};
ProfileAccess.relationMappings = {};
OrgInvite.relationMappings = {};
OrgAccessEvent.relationMappings = {};
