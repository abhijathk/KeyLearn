import { createHash } from "node:crypto";
import { type AccountDeletionRequestDetails } from "@keylearn/pages-shared";
import { type Knex } from "knex";
import { type JSONSchema, Model, snakeCaseMappers } from "objection";
import { TimestampMixin } from "./model.ts";
import { Random } from "./util.ts";

const DELETION_WINDOW_MS = 48 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * A staff-initiated account deletion, waiting out its 48-hour cooling-off
 * window before {@link AccountDeletionSweep} carries it out. Deliberately
 * not a foreign key on `userId` — this row is the permanent record that the
 * deletion happened, so it has to survive the account it names being
 * erased, the same reasoning `StaffAuditEvent.userId` already uses.
 */
export class AccountDeletionRequest extends TimestampMixin(Model) {
  static override readonly tableName = "account_deletion_request";
  static override readonly columnNameMappers = snakeCaseMappers();
  // executeAt/cancelledAt/completedAt are deliberately left out of
  // properties, the same way SupportTicket.closedAt is — they're set as
  // real Date objects (see `request()`/`cancel()`/`markCompleted()` below),
  // and AJV would reject a Date against a `type: "string"` schema entry.
  static override jsonSchema = {
    type: "object",
    required: ["userId", "reason"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      requestedByUserId: { type: ["integer", "null"] },
      reason: { type: "string", minLength: 1, maxLength: 500 },
      cancelTokenHash: { type: ["string", "null"] },
      cancelledVia: { type: ["string", "null"], maxLength: 8 },
      keepStats: { type: "boolean" },
    },
  } satisfies JSONSchema;

  static createTable(knex: Knex, table: Knex.CreateTableBuilder) {
    const { reason, cancelledVia } =
      AccountDeletionRequest.jsonSchema.properties;
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.integer("requested_by_user_id").unsigned().nullable();
    table.string("reason", reason.maxLength).notNullable();
    table.timestamp("execute_at").notNullable();
    table.string("cancel_token_hash", 64).nullable().index();
    table.timestamp("cancelled_at").nullable();
    table.string("cancelled_via", cancelledVia.maxLength).nullable();
    table.timestamp("completed_at").nullable();
    table.boolean("keep_stats").notNullable().defaultTo(false);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["execute_at"]);
  }

  readonly id?: number;
  userId?: number;
  requestedByUserId?: number | null;
  reason?: string;
  executeAt?: Date;
  cancelTokenHash?: string | null;
  cancelledAt?: Date | null;
  cancelledVia?: "staff" | "self" | null;
  completedAt?: Date | null;
  keepStats?: number | boolean;
  createdAt?: Date;
  updatedAt?: Date;

  /** Starts the 48-hour window and returns the raw cancel token — store the hash, email the raw value. */
  static async request({
    userId,
    requestedByUserId,
    reason,
    keepStats = false,
  }: {
    readonly userId: number;
    readonly requestedByUserId: number | null;
    readonly reason: string;
    readonly keepStats?: boolean;
  }): Promise<{
    readonly request: AccountDeletionRequest;
    readonly cancelToken: string;
  }> {
    const cancelToken = Random.string(24);
    const request = await AccountDeletionRequest.query().insertAndFetch({
      userId,
      requestedByUserId,
      reason,
      executeAt: new Date(Date.now() + DELETION_WINDOW_MS),
      cancelTokenHash: hashToken(cancelToken),
      keepStats,
      updatedAt: new Date(),
    });
    return { request, cancelToken };
  }

  /** The one active (not cancelled, not completed) request for this account, if any. */
  static async findPendingForUser(
    userId: number,
  ): Promise<AccountDeletionRequest | null> {
    return (
      (await AccountDeletionRequest.query()
        .where("userId", userId)
        .whereNull("cancelledAt")
        .whereNull("completedAt")
        .first()) ?? null
    );
  }

  static async findByCancelToken(
    token: string,
  ): Promise<AccountDeletionRequest | null> {
    return (
      (await AccountDeletionRequest.query()
        .where("cancelTokenHash", hashToken(token))
        .whereNull("cancelledAt")
        .whereNull("completedAt")
        .first()) ?? null
    );
  }

  static async findById(id: number): Promise<AccountDeletionRequest | null> {
    return (await AccountDeletionRequest.query().findById(id)) ?? null;
  }

  /** Every request whose window has closed and hasn't been cancelled or carried out yet — what the sweep acts on. */
  static async listDue(now: Date): Promise<AccountDeletionRequest[]> {
    return await AccountDeletionRequest.query()
      .where("executeAt", "<=", now)
      .whereNull("cancelledAt")
      .whereNull("completedAt");
  }

  async cancel(via: "staff" | "self"): Promise<AccountDeletionRequest> {
    return await this.$query().patchAndFetch({
      cancelledAt: new Date(),
      cancelledVia: via,
      updatedAt: new Date(),
    });
  }

  async markCompleted(): Promise<AccountDeletionRequest> {
    return await this.$query().patchAndFetch({
      completedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  toDetails(): AccountDeletionRequestDetails {
    return {
      id: this.id!,
      reason: this.reason!,
      requestedAt: new Date(this.createdAt!).toISOString(),
      executeAt: new Date(this.executeAt!).toISOString(),
      cancelledAt:
        this.cancelledAt != null
          ? new Date(this.cancelledAt).toISOString()
          : null,
      completedAt:
        this.completedAt != null
          ? new Date(this.completedAt).toISOString()
          : null,
    };
  }
}

AccountDeletionRequest.relationMappings = {};
