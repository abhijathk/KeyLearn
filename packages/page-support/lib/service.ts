import {
  type NoticeDetails,
  type StaffAuditEventDetails,
  type SupportTicketDetails,
} from "@keylearn/pages-shared";
import { expectType, request } from "@keylearn/request";
import { startAuthentication } from "@simplewebauthn/browser";

export type TicketKind = "support" | "business";
export type TicketStatus = "open" | "flagged" | "waiting" | "closed" | "spam";

export type DeskAccessReason = "signed-out" | "not-staff" | "needs-2fa";
export type DeskAccessStatus =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: DeskAccessReason };

export type PasswordLoginResult =
  | { readonly ok: true }
  | { readonly twoFactor: true }
  | { readonly verify: true; readonly email: string };

export type CreateTicketInput = {
  readonly kind: TicketKind;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly turnstileToken?: string;
  /** Honeypot field — always left blank by a real visitor. */
  readonly website?: string;
};

export namespace SupportService {
  export async function createTicket(input: CreateTicketInput): Promise<void> {
    await request
      .use(expectType("application/json"))
      .POST("/_/support/tickets")
      .send(input);
  }

  export async function listTickets({
    kind,
    status,
  }: {
    readonly kind?: TicketKind;
    readonly status?: TicketStatus;
  } = {}): Promise<SupportTicketDetails[]> {
    const query = new URLSearchParams();
    if (kind != null) {
      query.set("kind", kind);
    }
    if (status != null) {
      query.set("status", status);
    }
    const qs = query.toString();
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/tickets${qs ? `?${qs}` : ""}`)
      .send();
    return (await response.json()) as SupportTicketDetails[];
  }

  export async function getTicket(id: number): Promise<SupportTicketDetails> {
    const response = await request
      .use(expectType("application/json"))
      .GET(`/_/support/tickets/${id}`)
      .send();
    return (await response.json()) as SupportTicketDetails;
  }

  export async function replyToTicket(
    id: number,
    input: { readonly reply: string; readonly status: TicketStatus },
  ): Promise<SupportTicketDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/tickets/${id}`)
      .send(input);
    return (await response.json()) as SupportTicketDetails;
  }

  /** A status-only move — "waiting on them", "close", "spam" — no reply sent. */
  export async function setTicketStatus(
    id: number,
    status: TicketStatus,
  ): Promise<SupportTicketDetails> {
    const response = await request
      .use(expectType("application/json"))
      .PUT(`/_/support/tickets/${id}/status`)
      .send({ status });
    return (await response.json()) as SupportTicketDetails;
  }

  /** The one deliberate, audited way to see a submitter's real address. */
  export async function revealEmail(id: number): Promise<string> {
    const response = await request
      .use(expectType("application/json"))
      .POST(`/_/support/tickets/${id}/reveal-email`)
      .send({});
    return ((await response.json()) as { email: string }).email;
  }

  export async function getActiveNotice(): Promise<NoticeDetails | null> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/notice")
      .send();
    return ((await response.json()) as { notice: NoticeDetails | null }).notice;
  }

  export async function createNotice(input: {
    readonly message: string;
    readonly level?: "info" | "warning";
  }): Promise<NoticeDetails> {
    const response = await request
      .use(expectType("application/json"))
      .POST("/_/support/notices")
      .send(input);
    return (await response.json()) as NoticeDetails;
  }

  export async function setNoticeActive(
    id: number,
    active: boolean,
  ): Promise<void> {
    await request
      .use(expectType("application/json"))
      .PUT(`/_/support/notices/${id}`)
      .send({ active });
  }

  /** Read-only — who did what, when. */
  export async function listAudit(): Promise<StaffAuditEventDetails[]> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/audit")
      .send();
    return (await response.json()) as StaffAuditEventDetails[];
  }

  /**
   * Whether the signed-in visitor (if any) can reach the desk right now,
   * and if not, which of the three reasons applies. Never throws — the
   * sign-in screen renders a different message per reason.
   */
  export async function deskAccess(): Promise<DeskAccessStatus> {
    const response = await request
      .use(expectType("application/json"))
      .GET("/_/support/desk/access")
      .send();
    return (await response.json()) as DeskAccessStatus;
  }

  async function postJson(path: string, data?: object): Promise<any> {
    const response = await request
      .use(expectType("application/json"))
      .POST(path)
      .send(data ?? {});
    return await response.json();
  }

  /**
   * Sign in with a passkey (usernameless). Duplicated from
   * `@keylearn/page-account`'s identical helper rather than imported —
   * `page-account` embeds this package's `SupportPage` for its own Support
   * pane, so the reverse import would be circular.
   */
  export async function loginPasskey(): Promise<void> {
    const optionsJSON = await postJson("/auth/passkey/login-options");
    const response = await startAuthentication({ optionsJSON });
    await postJson("/auth/passkey/login-verify", response);
  }

  /**
   * The desk's own password step — deliberately not `@keylearn/page-account`'s
   * `AccountService.loginPassword` (that would be circular; see
   * {@link loginPasskey}), and deliberately not a link out to the general
   * `/login` window either: a staff account needs a second factor, and the
   * mock is explicit that this screen shows only what staff signing in need
   * — no OAuth buttons, no registration, no magic link.
   */
  export async function loginPassword(input: {
    readonly email: string;
    readonly password: string;
    readonly turnstileToken?: string;
  }): Promise<PasswordLoginResult> {
    return (await postJson(
      "/auth/login-password",
      input,
    )) as PasswordLoginResult;
  }

  /** The authenticator-code step after {@link loginPassword} returns `twoFactor: true`. */
  export async function verifyTwoFactor(code: string): Promise<void> {
    await postJson("/auth/2fa/verify", { code });
  }
}
