import { type SupportTicketDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

export type SupportTicketKind = "support" | "business";
export type SupportTicketStatus =
  | "open"
  | "flagged"
  | "waiting"
  | "closed"
  | "spam";

/**
 * Masks an address for the default (non-revealed) view: the first
 * character survives, the rest of the local part is hidden, the domain
 * stays legible. `r••••@gmail.com` rather than `rahul@gmail.com`.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "••••";
  }
  return `${email[0]}${"•".repeat(Math.max(at - 1, 3))}${email.slice(at)}`;
}

/**
 * A contact-form submission: a general question or a business enquiry.
 *
 * `userId` is nullable and NOT a foreign key, for the same reason as
 * {@link SecurityEvent}: a guest with no account can submit one, and a later
 * account deletion should not erase the trail of what was asked.
 */
export class SupportTicket extends TimestampMixin(Model) {
  static override readonly tableName = "support_ticket";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["kind", "name", "email", "subject", "message", "status"],
    properties: {
      id: { type: "integer" },
      userId: { type: ["integer", "null"] },
      kind: { type: "string", enum: ["support", "business"] },
      name: { type: "string", minLength: 1, maxLength: 64 },
      email: { type: "string", minLength: 1, maxLength: 128 },
      subject: { type: "string", minLength: 1, maxLength: 128 },
      message: { type: "string", minLength: 1, maxLength: 4000 },
      status: {
        type: "string",
        enum: ["open", "flagged", "waiting", "closed", "spam"],
      },
      staffReply: { type: ["string", "null"], maxLength: 4000 },
      repliedBy: { type: ["integer", "null"] },
      ip: { type: ["string", "null"], maxLength: 64 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { name, email, subject, ip } = SupportTicket.jsonSchema.properties;
    table.increments("id").primary();
    table.integer("user_id").unsigned().nullable().index();
    table.string("kind", 16).notNullable();
    table.string("name", name.maxLength).notNullable();
    table.string("email", email.maxLength).notNullable();
    table.string("subject", subject.maxLength).notNullable();
    table.text("message").notNullable();
    table.string("status", 16).notNullable().defaultTo("open");
    table.text("staff_reply").nullable();
    table.integer("replied_by").unsigned().nullable();
    table.timestamp("replied_at").nullable();
    table.string("ip", ip.maxLength).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["status", "created_at"]);
    table.index(["kind", "status"]);
  }

  readonly id?: number;
  userId?: number | null;
  kind?: SupportTicketKind;
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  status?: SupportTicketStatus;
  staffReply?: string | null;
  repliedBy?: number | null;
  repliedAt?: Date | null;
  ip?: string | null;
  createdAt?: Date;
  updatedAt?: Date;

  static async create({
    userId = null,
    kind,
    name,
    email,
    subject,
    message,
    status = "open",
    ip = null,
  }: {
    readonly userId?: number | null;
    readonly kind: SupportTicketKind;
    readonly name: string;
    readonly email: string;
    readonly subject: string;
    readonly message: string;
    readonly status?: SupportTicketStatus;
    readonly ip?: string | null;
  }): Promise<SupportTicket> {
    return await SupportTicket.query().insertAndFetch({
      userId,
      kind,
      name,
      email,
      subject,
      message,
      status,
      ip,
    });
  }

  /** The triage queue, most recent first. */
  static async listQueue({
    kind,
    status,
    limit = 50,
  }: {
    readonly kind?: SupportTicketKind;
    readonly status?: SupportTicketStatus;
    readonly limit?: number;
  } = {}): Promise<SupportTicket[]> {
    let query = SupportTicket.query();
    if (kind != null) {
      query = query.where("kind", kind);
    }
    if (status != null) {
      query = query.where("status", status);
    }
    return await query
      .orderBy("createdAt", "desc")
      .limit(Math.min(Math.max(limit, 1), 200));
  }

  static async findById(id: number): Promise<SupportTicket | null> {
    return (await SupportTicket.query().findById(id)) ?? null;
  }

  async reply({
    staffUserId,
    reply,
    status,
  }: {
    readonly staffUserId: number;
    readonly reply: string;
    readonly status: SupportTicketStatus;
  }): Promise<SupportTicket> {
    return await this.$query().patchAndFetch({
      staffReply: reply,
      repliedBy: staffUserId,
      repliedAt: new Date(),
      status,
      updatedAt: new Date(),
    });
  }

  /** A status-only move — "waiting on them", "close", "spam" — no reply sent. */
  async setStatus(status: SupportTicketStatus): Promise<SupportTicket> {
    return await this.$query().patchAndFetch({
      status,
      updatedAt: new Date(),
    });
  }

  /**
   * `reveal` controls whether the real address is included. Default false —
   * seeing the full email is a deliberate, audited action, not something
   * that happens just by opening a ticket.
   */
  toDetails(reveal = false): SupportTicketDetails {
    return {
      id: this.id!,
      kind: this.kind!,
      name: this.name!,
      email: reveal ? this.email! : maskEmail(this.email!),
      subject: this.subject!,
      message: this.message!,
      status: this.status!,
      staffReply: this.staffReply ?? null,
      repliedAt:
        this.repliedAt != null ? new Date(this.repliedAt).toISOString() : null,
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

SupportTicket.relationMappings = {};
