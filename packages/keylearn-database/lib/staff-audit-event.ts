import { type StaffAuditEventDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";

/**
 * What a staff action looked like, for whoever has to answer "what happened
 * and who did it" six months from now.
 *
 * Read-only by construction — nothing in the desk ever edits or deletes a
 * row here. A console that can read every support message and put a banner
 * in front of every user is only trustworthy if its own actions leave a
 * trail nobody on the team, including the person who acted, can quietly
 * edit afterwards.
 */
export type StaffAuditAction =
  | "staff-signin"
  | "staff-access-denied"
  | "reveal-email"
  | "reply-ticket"
  | "ticket-status"
  | "notice-published"
  | "notice-retracted";

export class StaffAuditEvent extends TimestampMixin(Model) {
  static override readonly tableName = "staff_audit_event";
  static override readonly columnNameMappers = snakeCaseMappers();
  static override jsonSchema = {
    type: "object",
    required: ["action"],
    properties: {
      id: { type: "integer" },
      userId: { type: ["integer", "null"] },
      action: { type: "string", minLength: 1, maxLength: 32 },
      detail: { type: ["string", "null"], maxLength: 256 },
      ip: { type: ["string", "null"], maxLength: 64 },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { action, detail, ip } = StaffAuditEvent.jsonSchema.properties;
    table.increments("id").primary();
    // Nullable and NOT a foreign key: a denied attempt may have no matching
    // staff account at all, and the row should outlive an account's deletion.
    table.integer("user_id").unsigned().nullable().index();
    table.string("action", action.maxLength).notNullable();
    table.string("detail", detail.maxLength).nullable();
    table.string("ip", ip.maxLength).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["created_at"]);
  }

  readonly id?: number;
  userId?: number | null;
  action?: StaffAuditAction;
  detail?: string | null;
  ip?: string | null;
  createdAt?: Date;

  /** Records an event. Never throws: an audit write must not fail the action it describes. */
  static async record({
    userId = null,
    action,
    detail = null,
    ip = null,
  }: {
    readonly userId?: number | null;
    readonly action: StaffAuditAction;
    readonly detail?: string | null;
    readonly ip?: string | null;
  }): Promise<void> {
    try {
      await StaffAuditEvent.query().insert({
        userId,
        action,
        detail: truncate(detail, 256),
        ip: truncate(ip, 64),
      });
    } catch {
      // Deliberately swallowed — see above.
    }
  }

  static async listRecent(limit = 100): Promise<StaffAuditEvent[]> {
    return await StaffAuditEvent.query()
      .orderBy("createdAt", "desc")
      .limit(Math.min(Math.max(limit, 1), 500));
  }

  toDetails(staffName: string | null): StaffAuditEventDetails {
    return {
      id: this.id!,
      staffName,
      action: this.action!,
      detail: this.detail ?? null,
      ip: this.ip ?? null,
      createdAt: new Date(this.createdAt!).toISOString(),
    };
  }
}

StaffAuditEvent.relationMappings = {};

function truncate(value: string | null, max: number): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}
