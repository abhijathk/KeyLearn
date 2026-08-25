import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { ApplicationError, ForbiddenError } from "@fastr/errors";
import { inject, injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { type SessionState } from "@fastr/middleware-session";
import {
  Batch,
  can,
  OrgAccessEvent,
  type OrgAction,
  Organization,
  OrganizationPlan,
  OrgInvite,
  OrgMember,
  Profile,
  ProfileAccess,
  SecurityEvent,
  StaffAuditEvent,
  User,
} from "@keylearn/database";
import { z } from "zod";
import { endProfileSession, startProfileSession } from "../access/actor.ts";
import { reachProfile } from "../access/resolver.ts";
import { clientIp, rateLimit } from "../auth/ratelimit.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";

/**
 * The organisation tier's API — docs/organisations.md revision 2.
 *
 * Every access decision here is a MEMBERSHIP question (may this account
 * act on this organisation), answered by `#member` + `can()`. Learner
 * access is never decided here — that belongs to the resolver, which is
 * the one place that question is allowed to be answered (P2/A3).
 *
 * There is no public org sign-up anywhere: organisations are created by
 * platform staff, and every membership traces to an accepted invite row
 * (A13). The invite link is the tier's entire entry point — the login
 * page needs nothing.
 */

const pId = z.coerce.number().int().positive();

const TCreateOrg = z.object({
  name: z.string().trim().min(1).max(128),
  type: z.enum(["school", "centre", "other"]),
  /** The account that will own it — invited, not attached (A13). */
  ownerEmail: z.string().trim().min(3).max(128).email(),
  seats: z.number().int().min(1).max(100000).nullable().optional(),
  /**
   * Comma-separated domains this organisation's staff sign in with —
   * "balakairali.org.au". Null leaves staff unrestricted, which is the
   * school whose committee has only personal addresses.
   */
  staffEmailDomains: z.string().trim().max(255).nullable().optional(),
});
const PCreateOrg = zod(TCreateOrg);
type TCreateOrg = z.infer<typeof TCreateOrg>;

const TBatch = z.object({
  name: z.string().trim().min(1).max(64),
});
const PBatch = zod(TBatch);
type TBatch = z.infer<typeof TBatch>;

const TInvite = z.object({
  role: z.enum(["owner", "admin", "teacher", "guardian"]),
  batchId: z.number().int().positive().nullable().optional(),
  /**
   * The class list, from a pasted block or an uploaded CSV's `email`
   * column. Each address gets its own invite and its own email. Absent
   * means anonymous slips instead — see `count`.
   */
  emails: z.array(z.string().trim().min(3).max(128)).max(500).optional(),
  /** How many anonymous slips to mint for printing. */
  count: z.number().int().min(1).max(500).optional(),
});
const PInvite = zod(TInvite);
type TInvite = z.infer<typeof TInvite>;

const TScreen = z.object({
  emails: z.array(z.string().trim().min(1).max(128)).max(500),
});
const PScreen = zod(TScreen);
type TScreen = z.infer<typeof TScreen>;

const TAccept = z.object({
  token: z.string().trim().min(20).max(80),
  /**
   * Guardian invites only: which of MY children to enrol. Each id is
   * verified against the accepting account before a grant is written —
   * a guardian can consent for their own children and nobody else's.
   */
  profileIds: z.array(z.number().int().positive()).max(8).optional(),
});
const PAccept = zod(TAccept);
type TAccept = z.infer<typeof TAccept>;

const TLearner = z.object({
  firstName: z.string().trim().min(1).max(32),
  lastName: z.string().trim().max(32).nullable().optional(),
  birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
  batchId: z.number().int().positive(),
  /** Mode A requires a PIN from birth — there is no account behind the learner. */
  pin: z.string().regex(/^\d{4,6}$/),
});
const PLearner = zod(TLearner);
type TLearner = z.infer<typeof TLearner>;

const TPin = z.object({
  /** Set/reset when present; a bare `unlock` clears the lockout only. */
  pin: z
    .string()
    .regex(/^\d{4,6}$/)
    .nullable()
    .optional(),
  unlock: z.boolean().optional(),
});
const PPin = zod(TPin);
type TPin = z.infer<typeof TPin>;

const TEnter = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});
const PEnter = zod(TEnter);
type TEnter = z.infer<typeof TEnter>;

@injectable()
@controller()
export class OrgController {
  constructor(@inject("canonicalUrl") readonly canonicalUrl: string) {}

  // ---- membership plumbing --------------------------------------------

  /** The caller's membership, or 403 — same answer for "no such org". */
  async #member(
    ctx: Context<RouterState & SessionState & AuthState>,
    organizationId: number,
    action?: OrgAction,
  ): Promise<{ user: User; member: OrgMember; org: Organization }> {
    const user = ctx.state.requireUser();
    const org = await Organization.findById(organizationId);
    const member =
      org == null ? null : await OrgMember.find(organizationId, user.id!);
    if (org == null || member == null) {
      throw new ForbiddenError();
    }
    if (action != null && !can(member.role!, action)) {
      throw new ForbiddenError();
    }
    return { user, member, org };
  }

  /**
   * A14: a lapsed plan degrades staff surfaces to read-only — it never
   * refuses a learner mid-lesson (learner paths run through the resolver
   * and the profile session, not through here).
   */
  async #writable(org: Organization): Promise<void> {
    const seats = await org.seatStatus();
    if (seats.lapsed) {
      throw new ApplicationError(
        "This organisation's plan has lapsed — everything is readable, nothing is changeable, and no learner is affected. Renew to continue.",
      );
    }
  }

  #inviteUrl(token: string): string {
    return new URL(`/join/${token}`, this.canonicalUrl).toString();
  }

  // ---- creation (platform staff) --------------------------------------

  /**
   * Spec §2: the platform issues the licence and the first invite. The
   * owner is INVITED, never attached — so even the first membership
   * traces to an accepted invite row (A13), and the response carries the
   * link to hand over.
   */
  @http.POST("/_/org")
  async createOrg(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PCreateOrg) data: TCreateOrg,
  ) {
    const staff = await ctx.state.requireStaff();
    const org = await Organization.query().insertAndFetch({
      name: data.name,
      type: data.type,
      staffEmailDomains: data.staffEmailDomains || null,
    });
    if (data.seats != null) {
      await OrganizationPlan.query().insert({
        organizationId: org.id!,
        seats: data.seats,
      });
    }
    const { token } = await OrgInvite.issue({
      organizationId: org.id!,
      role: "owner",
      issuedByUserId: staff.id!,
    });
    void StaffAuditEvent.record({
      userId: staff.id,
      action: "org-created",
      detail: `${data.type} "${data.name}" (#${org.id}) — owner invite for ${data.ownerEmail}`,
      ip: clientIp(ctx),
    });
    ctx.response.body = {
      organization: org.toDetails(),
      ownerInviteUrl: this.#inviteUrl(token),
    };
  }

  // ---- my organisations -----------------------------------------------

  @http.GET("/_/org/mine")
  async myOrgs(ctx: Context<RouterState & SessionState & AuthState>) {
    const user = ctx.state.requireUser();
    const memberships = await OrgMember.membershipsFor(user.id!);
    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await Organization.findById(m.organizationId!);
        return org == null
          ? null
          : { ...org.toDetails(), role: m.role!, batchId: m.batchId ?? null };
      }),
    );
    ctx.response.body = { organizations: orgs.filter((o) => o != null) };
  }

  @http.GET("/_/org/{id:[0-9]+}")
  async orgOverview(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
  ) {
    const { member, org } = await this.#member(ctx, id);
    const batches = await Batch.listFor(id);
    const seats = await org.seatStatus();
    // The member list is staff-shaped information; a teacher sees the
    // batches (they need names for their own) but not the roster of
    // accounts.
    const members = can(member.role!, "members.teachers")
      ? await Promise.all(
          (await OrgMember.listFor(id)).map(async (m) => {
            const account = await User.query().findById(m.userId!);
            return {
              userId: m.userId!,
              name: account?.name ?? null,
              role: m.role!,
              batchId: m.batchId ?? null,
            };
          }),
        )
      : null;
    ctx.response.body = {
      organization: org.toDetails(),
      myRole: member.role!,
      myBatchId: member.batchId ?? null,
      batches: batches.map((b) => ({
        id: b.id!,
        name: b.name!,
      })),
      seats,
      members,
    };
  }

  // ---- batches ---------------------------------------------------------

  @http.POST("/_/org/{id:[0-9]+}/batches")
  async createBatch(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @body.json(PBatch) data: TBatch,
  ) {
    const { org } = await this.#member(ctx, id, "batches.manage");
    await this.#writable(org);
    const batch = await Batch.query().insertAndFetch({
      organizationId: id,
      name: data.name,
    });
    ctx.response.body = { id: batch.id!, name: batch.name! };
  }

  // ---- invites ---------------------------------------------------------

  @http.POST("/_/org/{id:[0-9]+}/invites")
  async createInvite(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @body.json(PInvite) data: TInvite,
  ) {
    const { user, member, org } = await this.#member(ctx, id);
    await this.#writable(org);
    // Who may invite whom: owners appoint owners and admins; admins
    // appoint teachers; teachers hand out guardian invites for their own
    // batch — the Saturday-morning path.
    const needed: OrgAction =
      data.role === "owner" || data.role === "admin"
        ? "members.admins"
        : data.role === "teacher"
          ? "members.teachers"
          : "invites.guardians";
    if (!can(member.role!, needed)) {
      throw new ForbiddenError();
    }
    let batchId = data.batchId ?? null;
    if (member.role === "teacher") {
      // A teacher's world ends at their batch — invites included.
      batchId = member.batchId ?? null;
      if (batchId == null) {
        throw new ForbiddenError();
      }
    }
    if (data.role === "guardian" && batchId == null) {
      throw new ApplicationError(
        "A guardian invite needs the class it enrols into.",
      );
    }
    // A class of forty is forty invites. Three shapes, one endpoint: a
    // list of addresses (emailed), a count (anonymous slips to print),
    // or neither (a single link to hand over).
    if (data.emails != null && data.emails.length > 0) {
      const checked = await this.#screenEmails(id, data.emails);
      const seats = await org.seatStatus();
      if (
        seats.seats != null &&
        seats.used + checked.invite.length > seats.seats
      ) {
        throw new ApplicationError(
          `That would need ${checked.invite.length} seats and ${Math.max(0, seats.seats - seats.used)} are free.`,
        );
      }
      const made = await OrgInvite.issueMany({
        organizationId: id,
        batchId,
        role: data.role,
        issuedByUserId: user.id!,
        emails: checked.invite,
      });
      // Sending is best-effort per address: one dead mailbox must not
      // lose the other thirty-nine invites, which already exist.
      for (const { invite, token } of made) {
        void this.#sendInvite(org, invite, token).catch((err) => {
          console.error("org-invite: could not send", err);
        });
      }
      ctx.response.body = {
        sent: made.length,
        skipped: checked.skipped,
        invites: made.map(({ invite }) => invite.toDetails()),
      };
      return;
    }

    if (data.count != null && data.count > 1) {
      const made = await OrgInvite.issueMany({
        organizationId: id,
        batchId,
        role: data.role,
        issuedByUserId: user.id!,
        count: data.count,
      });
      ctx.response.body = {
        // Printed once, here, and never readable again — the sheet IS
        // the only copy, which is why it comes back whole.
        slips: made.map(({ invite, token }) => ({
          id: invite.id!,
          url: this.#inviteUrl(token),
          expiresAt: new Date(invite.expiresAt!).toISOString(),
        })),
      };
      return;
    }

    const { invite, token } = await OrgInvite.issue({
      organizationId: id,
      batchId,
      role: data.role,
      issuedByUserId: user.id!,
    });
    ctx.response.body = {
      id: invite.id!,
      role: invite.role!,
      batchId: invite.batchId ?? null,
      expiresAt: new Date(invite.expiresAt!).toISOString(),
      // The clear token exists here and on the paper it gets printed to —
      // it is never readable again.
      url: this.#inviteUrl(token),
    };
  }

  /**
   * Read the list back before anyone is emailed. A merge that quietly
   * invites the same parent twice is how a coordinator stops trusting
   * the tool, so repeats, addresses already in the school and typos are
   * all reported rather than silently dropped.
   */
  /**
   * Reads a pasted list or a CSV's email column and says, for each entry
   * IN THE ORDER GIVEN, what would happen to it.
   *
   * Order is the whole point: the coordinator is looking at row 6 of a
   * spreadsheet they still have open, and "row 6 is not an address" is
   * fixable where "one of these forty is not an address" is not.
   */
  async #screenEmails(
    organizationId: number,
    raw: readonly string[],
  ): Promise<{
    invite: string[];
    verdicts: {
      email: string;
      verdict:
        | "invite"
        | "repeated"
        | "already-invited"
        | "already-here"
        | "not-an-address";
    }[];
    skipped: {
      email: string;
      reason:
        | "repeated"
        | "already-invited"
        | "already-here"
        | "not-an-address";
    }[];
  }> {
    const pending = await OrgInvite.pendingEmails(organizationId);
    const members = new Set(
      (
        await Promise.all(
          (await OrgMember.listFor(organizationId)).map(
            async (m) => await User.query().findById(m.userId!),
          ),
        )
      )
        .filter((u) => u != null)
        .map((u) => (u!.email ?? "").toLowerCase()),
    );
    const seen = new Set<string>();
    const invite: string[] = [];
    const verdicts: {
      email: string;
      verdict:
        | "invite"
        | "repeated"
        | "already-invited"
        | "already-here"
        | "not-an-address";
    }[] = [];
    for (const entry of raw) {
      const email = entry.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        // The raw entry, not the lowercased one — they have to find this
        // string in their spreadsheet.
        verdicts.push({ email: entry, verdict: "not-an-address" });
      } else if (seen.has(email)) {
        verdicts.push({ email, verdict: "repeated" });
      } else if (members.has(email)) {
        verdicts.push({ email, verdict: "already-here" });
      } else if (pending.has(email)) {
        verdicts.push({ email, verdict: "already-invited" });
      } else {
        seen.add(email);
        invite.push(email);
        verdicts.push({ email, verdict: "invite" });
      }
    }
    return {
      invite,
      verdicts,
      skipped: verdicts
        .filter((v) => v.verdict !== "invite")
        .map(({ email, verdict }) => ({
          email,
          reason: verdict as Exclude<typeof verdict, "invite">,
        })),
    };
  }

  /** Placeholder for the mail send — wired to the app mailer next. */
  async #sendInvite(
    _org: Organization,
    _invite: OrgInvite,
    _token: string,
  ): Promise<void> {
    // The mailer lands here; the invite already exists either way, so a
    // failure to send is a reason to resend, never a reason to lose it.
  }

  /** The roster: who was invited, who joined, who is still waiting. */
  /**
   * The read-back. Same screening as the send, no side effects at all —
   * not an invite row, not an email, not a consumed seat.
   *
   * A mail-merge that quietly invites the same parent twice is how a
   * coordinator stops trusting the tool on day one, so the list is shown
   * before anybody is written to, never after.
   */
  @http.POST("/_/org/{id:[0-9]+}/invites/screen")
  async screenInvites(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @body.json(PScreen) data: TScreen,
  ) {
    // Reading a list is the same privilege as sending to it.
    await this.#member(ctx, id, "invites.guardians");
    const org = await Organization.findById(id);
    if (org == null) {
      throw new ForbiddenError();
    }
    const checked = await this.#screenEmails(id, data.emails);
    const seats = await org.seatStatus();
    ctx.response.body = {
      verdicts: checked.verdicts,
      willInvite: checked.invite.length,
      // Said here rather than at send time, so "forty parents, four
      // seats" is discovered while the spreadsheet is still open.
      seatsLeft:
        seats.seats == null ? null : Math.max(0, seats.seats - seats.used),
    };
  }

  @http.GET("/_/org/{id:[0-9]+}/invites")
  async listInvites(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
  ) {
    const { member } = await this.#member(ctx, id, "invites.guardians");
    const all = await OrgInvite.listFor(id);
    // A teacher sees the invites for their own class and no others —
    // the same boundary their learner list has.
    const mine =
      member.role === "teacher"
        ? all.filter((i) => (i.batchId ?? null) === (member.batchId ?? null))
        : all;
    const names = new Map<number, string | null>();
    for (const i of mine) {
      if (i.acceptedByUserId != null && !names.has(i.acceptedByUserId)) {
        const u = await User.query().findById(i.acceptedByUserId);
        names.set(i.acceptedByUserId, u?.name ?? null);
      }
    }
    ctx.response.body = {
      invites: mine.map((i) => ({
        ...i.toDetails(),
        acceptedByName:
          i.acceptedByUserId == null
            ? null
            : (names.get(i.acceptedByUserId) ?? null),
      })),
    };
  }

  @http.POST("/_/org/{id:[0-9]+}/invites/{inviteId:[0-9]+}/revoke")
  async revokeInvite(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @pathParam("inviteId", zod(pId)) inviteId: number,
  ) {
    await this.#member(ctx, id, "members.teachers");
    const n = await OrgInvite.query()
      .where({ id: inviteId, organizationId: id })
      .whereNull("acceptedAt")
      .whereNull("revokedAt")
      .patch({ revokedAt: new Date() });
    if (n === 0) {
      throw new ApplicationError(
        "That invite is already accepted, revoked or unknown.",
      );
    }
    ctx.response.body = { ok: true };
  }

  /**
   * What an invite link is offering, before anybody signs in.
   *
   * Deliberately unauthenticated: the band on the join page has to name
   * the organisation and the role while the visitor is still signed out,
   * and they are holding the token already — it was handed to them. It
   * answers with the same "not valid" for expired, used, revoked and
   * never-existed, so a guessed token learns nothing from being close,
   * and it is rate limited so the space cannot be swept.
   *
   * The token travels in the path because it is already in the path of
   * the page the visitor clicked; putting it in a body would hide it
   * from nothing.
   */
  @http.GET("/_/org/invites/{token}/preview")
  async previewInvite(
    ctx: Context<RouterState & SessionState & AuthState>,
    // Deliberately permissive: a truncated or mistyped link is just
    // another token that does not exist, and it should get the same
    // answer — not a raw 400 that tells the visitor they broke it.
    @pathParam("token", zod(z.string().trim().min(1).max(120)))
    token: string,
  ) {
    rateLimit(ctx, "org-invite-preview", 60, 300_000);
    if (token.length < 20) {
      ctx.response.body = { valid: false };
      return;
    }
    const invite = await OrgInvite.findLive(token);
    if (invite == null) {
      ctx.response.body = { valid: false };
      return;
    }
    const org = await Organization.findById(invite.organizationId!);
    if (org == null) {
      ctx.response.body = { valid: false };
      return;
    }
    const batch =
      invite.batchId == null
        ? null
        : await Batch.query().findById(invite.batchId);
    ctx.response.body = {
      valid: true,
      organization: { id: org.id!, name: org.name!, type: org.type! },
      role: invite.role!,
      batchName: batch?.name ?? null,
      expiresAt: new Date(invite.expiresAt!).toISOString(),
      // So the form can say "your school address" before it is attempted,
      // rather than refusing after the fact.
      staffEmailDomains:
        invite.role === "owner" || invite.role === "admin" ? org.domains() : [],
    };
  }

  /**
   * The one door in (A13). A role invite attaches the accepting account
   * as a member; a guardian invite writes enrolment grants for the
   * children the guardian names — their own children, verified — and the
   * grant rows are the consent record (§4.4).
   */
  @http.POST("/_/org/invites/accept")
  async acceptInvite(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PAccept) data: TAccept,
  ) {
    // A13 also wants probes to learn nothing: same budget shape as other
    // token endpoints.
    rateLimit(ctx, "org-invite", 20, 300_000);
    const user = ctx.state.requireUser();
    const invite = await OrgInvite.findLive(data.token);
    if (invite == null) {
      throw new ApplicationError(
        "That invite link isn't valid any more — ask for a fresh one.",
      );
    }
    const org = await Organization.findById(invite.organizationId!);
    if (org == null) {
      throw new ApplicationError("That organisation no longer exists.");
    }

    if (invite.role !== "guardian") {
      const existing = await OrgMember.find(invite.organizationId!, user.id!);
      if (existing != null) {
        throw new ApplicationError(
          `You're already ${existing.role} at ${org.name}.`,
        );
      }
      // Option A (owner's decision): the people who can see every learner
      // and appoint others must be AT the school. A teacher sees one class
      // and appoints nobody, so an org address is encouraged rather than
      // required — at a community school the volunteer teachers ARE the
      // parents, and forcing a second address on them would split one
      // person across two accounts.
      const verdict = org.staffAddressVerdict(user.email, invite.role!);
      if (verdict === "wrong") {
        // The invite is deliberately NOT consumed: clicking while signed
        // into the wrong account must not burn it, or somebody has to be
        // re-invited for a mistake that cost nothing.
        throw new ApplicationError(
          `${org.name}'s ${invite.role}s sign in with a ${org
            .domains()
            .map((d) => "@" + d)
            .join(
              " or ",
            )} address. You're signed in as ${user.email}. Sign in with your school address, or ask to join as a teacher instead — teachers keep their own address.`,
        );
      }
      // A domain check on an unverified address is theatre: anyone could
      // register treasurer@theschool.org without ever controlling it.
      if (org.domains().length > 0 && !user.emailVerified) {
        throw new ApplicationError(
          "Confirm your email address first — a staff role needs a verified one.",
        );
      }
      await OrgMember.query().insert({
        organizationId: invite.organizationId!,
        userId: user.id!,
        role: invite.role!,
        batchId: invite.batchId ?? null,
      });
      await invite
        .$query()
        .patch({ acceptedByUserId: user.id!, acceptedAt: new Date() });
      ctx.response.body = {
        organization: org.toDetails(),
        role: invite.role!,
        batchId: invite.batchId ?? null,
        // Teachers are nudged, never blocked (see the verdict above).
        addressNote:
          verdict === "recommended"
            ? `Teachers at ${org.name} usually sign in with a ${org
                .domains()
                .map((d) => "@" + d)
                .join(
                  " or ",
                )} address. Yours works fine — if you also have a child here, keeping this one account is the better choice.`
            : null,
      };
      return;
    }

    // Guardian: enrol my children into the invite's batch, seat-checked.
    const profileIds = data.profileIds ?? [];
    if (profileIds.length === 0) {
      throw new ApplicationError(
        "Pick which of your learners this invite enrols.",
      );
    }
    const seats = await org.seatStatus();
    if (seats.seats != null && seats.used + profileIds.length > seats.seats) {
      throw new ApplicationError(
        `${org.name} has ${Math.max(0, seats.seats - seats.used)} seat(s) left — ask the coordinator for more.`,
      );
    }
    const enrolled: number[] = [];
    for (const profileId of profileIds) {
      // Their own child, and only visibility ever changes hands — the
      // profile stays theirs (mode B, P4 intact).
      const profile = await Profile.findOwned(user.id!, profileId);
      if (profile == null) {
        throw new ForbiddenError();
      }
      await ProfileAccess.grant({
        profileId,
        organizationId: invite.organizationId!,
        batchId: invite.batchId ?? null,
        grantedByUserId: user.id!,
      });
      enrolled.push(profileId);
    }
    await invite
      .$query()
      .patch({ acceptedByUserId: user.id!, acceptedAt: new Date() });
    ctx.response.body = {
      organization: org.toDetails(),
      role: "guardian",
      batchId: invite.batchId ?? null,
      enrolled,
    };
  }

  // ---- learners --------------------------------------------------------

  @http.GET("/_/org/{id:[0-9]+}/learners")
  async listLearners(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
  ) {
    const { member } = await this.#member(ctx, id, "learners.read");
    const batchScope = member.role === "teacher" ? member.batchId : null;
    if (member.role === "teacher" && batchScope == null) {
      throw new ForbiddenError();
    }
    // Mode A: owned by the organisation.
    let owned = Profile.query().where("organizationId", id);
    if (batchScope != null) {
      owned = owned.where("batchId", batchScope);
    }
    // Mode B: family-owned, enrolled by a live grant.
    let grants = ProfileAccess.query()
      .where("organizationId", id)
      .whereNull("revokedAt");
    if (batchScope != null) {
      grants = grants.where("batchId", batchScope);
    }
    const [ownedRows, grantRows] = await Promise.all([owned, grants]);
    const grantProfiles = await Promise.all(
      grantRows.map(async (g) => await Profile.query().findById(g.profileId!)),
    );
    ctx.response.body = {
      learners: [
        ...ownedRows.map((p) => ({
          profileId: p.id!,
          firstName: p.firstName!,
          batchId: p.batchId ?? null,
          mode: "A" as const,
          pinLocked: p.pinLocked(),
        })),
        ...grantRows.flatMap((g, i) => {
          const p = grantProfiles[i];
          return p == null
            ? []
            : [
                {
                  profileId: p.id!,
                  firstName: p.firstName!,
                  batchId: g.batchId ?? null,
                  mode: "B" as const,
                  pinLocked: false,
                },
              ];
        }),
      ],
    };
  }

  /**
   * Mode-A creation (spec §2). Consent note, honestly: the parental
   * record does not exist for an org-owned learner — the lawful basis is
   * the INSTITUTION's, which spec §9.1 leaves open for policy. The row
   * records that basis (`consentAt` set, org-owned), and every P5
   * protection applies regardless — no ads, no public leaderboards, no
   * analytics, by construction.
   */
  @http.POST("/_/org/{id:[0-9]+}/learners")
  async createLearner(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @body.json(PLearner) data: TLearner,
  ) {
    const { user, org } = await this.#member(ctx, id, "learners.create");
    await this.#writable(org);
    const batch = await Batch.query().findOne({
      id: data.batchId,
      organizationId: id,
    });
    if (batch == null) {
      throw new ApplicationError("That class belongs to another organisation.");
    }
    const seats = await org.seatStatus();
    if (seats.seats != null && seats.used >= seats.seats) {
      throw new ApplicationError(
        "Every seat is taken — free one or ask for more before adding a learner.",
      );
    }
    const profile = await Profile.query().insertAndFetch({
      userId: null,
      organizationId: id,
      batchId: data.batchId,
      kind: "kid",
      firstName: data.firstName,
      lastName: data.lastName || null,
      birthYear: data.birthYear ?? null,
      parentalConsent: true,
      consentAt: new Date(),
    });
    await profile.setPin(data.pin);
    void SecurityEvent.record({
      userId: user.id,
      type: "learner-pin-set",
      ip: clientIp(ctx),
      detail: `org ${id} learner ${profile.id}`,
    });
    ctx.response.body = {
      profileId: profile.id!,
      firstName: profile.firstName!,
      batchId: data.batchId,
      mode: "A",
    };
  }

  /** Mode B unenrolment — the grant's `revoked_at`, nothing else (A12). */
  @http.POST("/_/org/{id:[0-9]+}/learners/{profileId:[0-9]+}/unenrol")
  async unenrol(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @pathParam("profileId", zod(pId)) profileId: number,
  ) {
    await this.#member(ctx, id, "learners.unenrol");
    const revoked = await ProfileAccess.revoke(profileId, id);
    if (!revoked) {
      throw new ApplicationError("That learner isn't enrolled here.");
    }
    ctx.response.body = { ok: true };
  }

  /** Set, reset or unlock a mode-A learner's PIN (A7 — recorded). */
  @http.POST("/_/org/{id:[0-9]+}/learners/{profileId:[0-9]+}/pin")
  async learnerPin(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @pathParam("profileId", zod(pId)) profileId: number,
    @body.json(PPin) data: TPin,
  ) {
    const { user, org } = await this.#member(ctx, id, "learners.pins");
    await this.#writable(org);
    const profile = await Profile.query().findOne({
      id: profileId,
      organizationId: id,
    });
    if (profile == null) {
      // A family-owned (mode B) learner's PIN belongs to the family.
      throw new ForbiddenError();
    }
    if (data.pin != null) {
      await profile.setPin(data.pin);
      void SecurityEvent.record({
        userId: user.id,
        type: "learner-pin-set",
        ip: clientIp(ctx),
        detail: `org ${id} learner ${profileId}`,
      });
    } else if (data.unlock === true) {
      await profile.unlockPin();
      void SecurityEvent.record({
        userId: user.id,
        type: "learner-pin-unlocked",
        ip: clientIp(ctx),
        detail: `org ${id} learner ${profileId}`,
      });
    } else {
      throw new ApplicationError("Nothing to do — send a pin or unlock.");
    }
    ctx.response.body = { ok: true };
  }

  // ---- members ---------------------------------------------------------

  @http.POST("/_/org/{id:[0-9]+}/members/{userId:[0-9]+}/remove")
  async removeMember(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @pathParam("userId", zod(pId)) userId: number,
  ) {
    const { member } = await this.#member(ctx, id);
    const target = await OrgMember.find(id, userId);
    if (target == null) {
      throw new ApplicationError("Not a member here.");
    }
    const needed: OrgAction =
      target.role === "teacher" ? "members.teachers" : "members.admins";
    if (!can(member.role!, needed)) {
      throw new ForbiddenError();
    }
    // A10 lives in the model: removing the last owner throws.
    try {
      await OrgMember.remove(id, userId);
    } catch (err) {
      throw new ApplicationError(
        err instanceof Error ? err.message : "Could not remove that member.",
      );
    }
    ctx.response.body = { ok: true };
  }

  // ---- the audit (A15) -------------------------------------------------

  @http.GET("/_/org/{id:[0-9]+}/audit")
  async audit(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
  ) {
    await this.#member(ctx, id, "org.manage");
    const events = await OrgAccessEvent.listFor(id);
    ctx.response.body = {
      events: events.map((e) => ({
        actorUserId: e.actorUserId!,
        profileId: e.profileId!,
        action: e.action!,
        at: new Date(e.createdAt!).toISOString(),
      })),
    };
  }

  // ---- PIN sign-in (spec §6, M2) --------------------------------------

  /**
   * §6.2: the household or organisation session is established as it is
   * today; this carries the PIN; the server verifies it and writes the
   * profile id INTO THE SESSION. Step 4 — endpoints reading the learner
   * from the session — is the resolver's §5.2 rule.
   *
   * Who may even attempt: someone whose session already reaches this
   * learner (the household owner; org staff for their own learners) —
   * the PIN then identifies WHICH person at that keyboard (P3). A
   * profile with no PIN yields a session for the household owner
   * without one (optional-in-households, P1); org learners always have
   * one by construction.
   */
  @http.POST("/_/profiles/{id:[0-9]+}/enter")
  async enterProfile(
    ctx: Context<RouterState & SessionState & AuthState>,
    @pathParam("id", zod(pId)) id: number,
    @body.json(PEnter, { maxLength: 256 }) data: TEnter,
  ) {
    const user = ctx.state.requireUser();
    // The lockout is per PROFILE (A6); this per-session budget only blunts
    // a scripted sweep across many profiles from one session.
    rateLimit(ctx, "pin", 30, 300_000);
    const profile = await reachProfile(
      { userId: user.id! }, // deliberately ignoring any active profile session — switching learners is the point
      id,
      "read",
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    const outcome = await profile.verifyPin(data.pin);
    if (outcome === "locked") {
      void SecurityEvent.record({
        userId: user.id,
        type: "learner-pin-locked",
        ip: clientIp(ctx),
        detail: `learner ${id}`,
      });
      ctx.response.body = { ok: false, reason: "locked" };
      return;
    }
    if (outcome === "wrong") {
      ctx.response.body = { ok: false, reason: "wrong" };
      return;
    }
    // "unset" counts as entered for a household that never set one (P1);
    // an org learner always has a PIN, so "unset" cannot happen there.
    startProfileSession(ctx, id);
    ctx.response.body = { ok: true, profileId: id };
  }

  /** Walking away from the keyboard — gives the narrowed session back. */
  @http.POST("/_/profiles/exit")
  async exitProfile(ctx: Context<RouterState & SessionState & AuthState>) {
    ctx.state.requireUser();
    endProfileSession(ctx);
    ctx.response.body = { ok: true };
  }
}
