import { expectType, request } from "@keylearn/request";

/**
 * The organisation tier's client — docs/organisations.md revision 2.
 *
 * Every call here is a thin wrapper over `/_/org/*`; not one of them
 * decides who may see what. The server's resolver owns that question
 * (P2), so a UI that forgets to hide something leaks nothing — it simply
 * shows an empty list or a refusal.
 */

export type OrgRole = "owner" | "admin" | "teacher";

export type OrgSummary = {
  readonly id: number;
  readonly name: string;
  readonly type: string;
  readonly parentId: number | null;
  readonly createdAt: string;
  readonly role: OrgRole;
  readonly batchId: number | null;
};

export type BatchSummary = {
  readonly id: number;
  readonly name: string;
};

export type SeatStatus = {
  /** Null when no plan exists yet — being set up before billing (M4). */
  readonly seats: number | null;
  readonly used: number;
  readonly lapsed: boolean;
};

export type MemberSummary = {
  readonly userId: number;
  readonly name: string | null;
  readonly role: OrgRole;
  readonly batchId: number | null;
};

export type OrgOverview = {
  readonly organization: {
    readonly id: number;
    readonly name: string;
    readonly type: string;
  };
  readonly myRole: OrgRole;
  readonly myBatchId: number | null;
  readonly batches: readonly BatchSummary[];
  readonly seats: SeatStatus;
  /** Null for a teacher — the roster of accounts is not their business. */
  readonly members: readonly MemberSummary[] | null;
};

export type Learner = {
  readonly profileId: number;
  readonly firstName: string;
  readonly batchId: number | null;
  /** A: the organisation owns them. B: a family does, and enrolled them. */
  readonly mode: "A" | "B";
  readonly pinLocked: boolean;
};

export type InviteCreated = {
  readonly id: number;
  readonly role: string;
  readonly batchId: number | null;
  readonly expiresAt: string;
  /** Readable exactly once — the server keeps only a hash. */
  readonly url: string;
};

export type AccessEvent = {
  readonly actorUserId: number;
  readonly profileId: number;
  readonly action: string;
  readonly at: string;
};

export type InviteVerdict =
  | "invite"
  | "repeated"
  | "already-invited"
  | "already-here"
  | "not-an-address";

export type ScreenResult = {
  /** In the order given, so a verdict lines up with its CSV row. */
  readonly verdicts: readonly {
    readonly email: string;
    readonly verdict: InviteVerdict;
  }[];
  readonly willInvite: number;
  /** Null when no plan exists yet — nothing to run out of. */
  readonly seatsLeft: number | null;
};

export type BulkResult = {
  readonly sent: number;
  readonly skipped: readonly {
    readonly email: string;
    readonly reason: Exclude<InviteVerdict, "invite">;
  }[];
};

export type Slip = {
  readonly id: number;
  readonly url: string;
  readonly expiresAt: string;
};

export type InviteRow = {
  readonly id: number;
  readonly role: string;
  readonly batchId: number | null;
  readonly email: string | null;
  /** The coordinator's note; null once the invite has been accepted. */
  readonly reference: string | null;
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly acceptedByName: string | null;
  readonly revokedAt: string | null;
};

export namespace OrgService {
  export async function myOrgs(): Promise<readonly OrgSummary[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/org/mine")
      .send();
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as {
      readonly organizations?: readonly OrgSummary[];
    };
    return body.organizations ?? [];
  }

  export async function overview(id: number): Promise<OrgOverview> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/org/${id}`)
      .send();
    if (!response.ok) {
      throw new Error(`organisation ${response.status}`);
    }
    return (await response.json()) as OrgOverview;
  }

  export async function learners(id: number): Promise<readonly Learner[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/org/${id}/learners`)
      .send();
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as {
      readonly learners?: readonly Learner[];
    };
    return body.learners ?? [];
  }

  export async function createBatch(
    id: number,
    name: string,
  ): Promise<BatchSummary> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/batches`)
      .send({ name });
    return (await response.json()) as BatchSummary;
  }

  export async function createInvite(
    id: number,
    role: "owner" | "admin" | "teacher" | "guardian",
    batchId: number | null,
  ): Promise<InviteCreated> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/invites`)
      .send({ role, batchId });
    return (await response.json()) as InviteCreated;
  }

  /**
   * The read-back before the send. No invite exists after this call and
   * no email leaves — it only says what would happen, by row.
   */
  export async function screenInvites(
    id: number,
    emails: readonly string[],
  ): Promise<ScreenResult> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/invites/screen`)
      .send({ emails });
    return (await response.json()) as ScreenResult;
  }

  /** One invite each, emailed. Returns what was skipped and why. */
  export async function inviteByEmail(
    id: number,
    role: "owner" | "admin" | "teacher" | "guardian",
    batchId: number | null,
    emails: readonly (
      | string
      | { readonly email: string; readonly reference: string | null }
    )[],
  ): Promise<BulkResult> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/invites`)
      .send({ role, batchId, emails });
    return (await response.json()) as BulkResult;
  }

  /**
   * Anonymous slips for printing. The tokens come back whole exactly
   * once — the sheet is the only copy — so this result must reach the
   * printer before it is thrown away.
   */
  export async function inviteSlips(
    id: number,
    role: "guardian",
    batchId: number | null,
    count: number,
  ): Promise<readonly Slip[]> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/invites`)
      .send({ role, batchId, count });
    const body = (await response.json()) as {
      readonly slips?: readonly Slip[];
    };
    return body.slips ?? [];
  }

  /** The roster: who was invited, who joined, who is still waiting. */
  export async function listInvites(id: number): Promise<readonly InviteRow[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/org/${id}/invites`)
      .send();
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as {
      readonly invites?: readonly InviteRow[];
    };
    return body.invites ?? [];
  }

  export async function revokeInvite(
    id: number,
    inviteId: number,
  ): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/invites/${inviteId}/revoke`)
      .send({});
  }

  export async function createLearner(
    id: number,
    data: {
      readonly firstName: string;
      readonly lastName?: string | null;
      readonly birthYear?: number | null;
      readonly batchId: number;
      readonly pin: string;
    },
  ): Promise<Learner> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/learners`)
      .send(data);
    return (await response.json()) as Learner;
  }

  /** Mode B only: ends the grant, and nothing else (A12). */
  export async function unenrol(id: number, profileId: number): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/learners/${profileId}/unenrol`)
      .send({});
  }

  /** Set/reset a mode-A PIN, or clear a lockout. Never reads one back. */
  export async function learnerPin(
    id: number,
    profileId: number,
    body: { readonly pin?: string; readonly unlock?: boolean },
  ): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST(`/_/org/${id}/learners/${profileId}/pin`)
      .send(body);
  }

  export async function audit(id: number): Promise<readonly AccessEvent[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/org/${id}/audit`)
      .send();
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as {
      readonly events?: readonly AccessEvent[];
    };
    return body.events ?? [];
  }

  /** What the link is offering — readable before anyone signs in. */
  export async function previewInvite(token: string): Promise<
    | {
        readonly valid: true;
        readonly organization: {
          readonly id: number;
          readonly name: string;
          readonly type: string;
        };
        readonly role: string;
        readonly batchName: string | null;
        readonly expiresAt: string;
        readonly staffEmailDomains: readonly string[];
      }
    | { readonly valid: false }
  > {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/org/invites/${encodeURIComponent(token)}/preview`)
      .send();
    if (!response.ok) {
      return { valid: false };
    }
    return (await response.json()) as
      | {
          readonly valid: true;
          readonly organization: {
            readonly id: number;
            readonly name: string;
            readonly type: string;
          };
          readonly role: string;
          readonly batchName: string | null;
          readonly expiresAt: string;
          readonly staffEmailDomains: readonly string[];
        }
      | { readonly valid: false };
  }

  /** The tier's one door: accepting an invite (A13). */
  export async function acceptInvite(
    token: string,
    profileIds?: readonly number[],
  ): Promise<{
    readonly organization?: { readonly id: number; readonly name: string };
    readonly role?: string;
    readonly error?: string;
  }> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/org/invites/accept")
      .send({ token, profileIds });
    const body = (await response.json()) as {
      readonly organization?: { readonly id: number; readonly name: string };
      readonly role?: string;
      readonly error?: { readonly message?: string };
    };
    if (body.error != null) {
      return { error: body.error.message ?? "That invite isn't valid." };
    }
    // The error branch is the only shape that differs; everything else
    // passes through as the endpoint sent it.
    return { organization: body.organization, role: body.role };
  }
}
