import { randomUUID } from "node:crypto";
import {
  SupportMessage,
  SupportQdeskOutbox,
  SupportTicket,
} from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { siteNumber } from "@keylearn/site-config";
import { type Knex } from "knex";
import { deskConfig, sendToDesk } from "./qdesk-forward.ts";

/**
 * The durable path for the forwards that are not customer messages.
 *
 * A customer's message is its own durable record — the `support_message`
 * row, with `delivered_at` saying whether the desk has it — and the retry
 * sweep re-sends from that. A rating, a thumbs, a "that sorted it" or an
 * archive had no such row: each was one `fetch`, and a desk that was down
 * for that second never heard about it. This table is their row.
 *
 *   write first   the row exists before anything is sent, so a crash, a
 *                 restart or an outage between click and send loses nothing;
 *   send at once  the first attempt is immediate, so a healthy desk sees no
 *                 delay;
 *   retry         408/425/429/5xx, a 404 (the desk may not have the ticket
 *                 yet — its own forward is still in the retry queue) and no
 *                 answer at all are retried with exponential backoff that
 *                 honours Retry-After; anything else is a permanent refusal,
 *                 recorded and not retried;
 *   idempotent    each attempt carries an `Idempotency-Key` header, and
 *                 every one of these calls sets a value rather than adding
 *                 one, so a replay of a delivery that landed is harmless;
 *   fair          the drain takes one row per account per round, so a
 *                 swarm that fills the queue from a few accounts cannot hold
 *                 every real customer's rating behind it.
 *
 * The table is created at bootstrap with every other table
 * (`@keylearn/database` SupportQdeskOutbox). `ensureOutbox` stays as a
 * one-check-per-process fallback for a database bootstrapped before the
 * table moved there.
 */

export const OUTBOX_TABLE = SupportQdeskOutbox.tableName;

export type OutboxKind = "csat" | "feedback" | "resolution" | "archive";

/** Long enough for the first attempt to finish before the sweep looks. */
const LEASE_MS = 2 * 60 * 1000;
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 20;

type Row = {
  id: number;
  kind: string;
  ticket_id: number;
  path: string;
  body: string;
  idem_key: string;
  dedupe_key: string;
  account_key: string;
  attempts: number;
  next_attempt_at: number | string;
  created_at: number | string;
  delivered_at: number | string | null;
  failed_at: number | string | null;
  last_status: number | null;
};

function knex(): Knex {
  return SupportMessage.knex();
}

let ensured: { knex: Knex; done: Promise<void> } | null = null;

/** Creates the table if it is missing. Memoised per database handle. */
export async function ensureOutbox(): Promise<void> {
  const k = knex();
  if (ensured == null || ensured.knex !== k) {
    ensured = {
      knex: k,
      done: (async () => {
        if (await k.schema.hasTable(OUTBOX_TABLE)) {
          return;
        }
        try {
          await k.schema.createTable(OUTBOX_TABLE, (table) => {
            SupportQdeskOutbox.createTable(k, table);
          });
        } catch (err) {
          // Another worker won the race. Anything else is real.
          if (!(await k.schema.hasTable(OUTBOX_TABLE))) {
            throw err;
          }
        }
      })(),
    };
    ensured.done.catch(() => {
      ensured = null;
    });
  }
  await ensured.done;
}

/** Whose this is, for the fair drain: the account, else the guest address. */
async function accountKeyFor(ticketId: number): Promise<string> {
  try {
    const t = await SupportTicket.query()
      .select("userId", "email")
      .findById(ticketId);
    if (t?.userId != null) {
      return `u:${t.userId}`;
    }
    if (t?.email != null) {
      return `e:${t.email.trim().toLowerCase()}`;
    }
  } catch {
    // Falls through to the ticket itself.
  }
  return `t:${ticketId}`;
}

export function giveUpMs(): number {
  return siteNumber("ops.qdeskGiveUpHours") * 60 * 60 * 1000;
}

/** Whether a failed attempt is worth another. */
export function retryable(status: number): boolean {
  return (
    status === 0 ||
    status === 404 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

/** Exponential with jitter, never sooner than the desk asked. */
export function backoffMs(
  attempts: number,
  retryAfterMs: number | null,
): number {
  const exp = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1),
  );
  const jittered = exp / 2 + Math.random() * (exp / 2);
  return Math.max(jittered, Math.min(retryAfterMs ?? 0, 6 * MAX_BACKOFF_MS));
}

/**
 * Records one forward and makes its first attempt. Fire-and-forget: the
 * write and the send both happen after the caller has moved on, and a
 * failure of either is logged, never thrown at the customer's request.
 */
export function enqueueForward(input: {
  readonly kind: OutboxKind;
  readonly ticketId: number;
  readonly path: string;
  readonly body: unknown;
  readonly dedupeKey: string;
}): void {
  if (deskConfig() == null) {
    return;
  }
  void (async () => {
    try {
      const id = await record(input);
      await attempt(id);
    } catch (err: any) {
      Logger.warn(err, "qdesk-outbox: could not record a forward", {
        kind: input.kind,
        ticketId: input.ticketId,
      });
    }
  })();
}

/** Writes (or replaces) the waiting row. Returns its id. */
export async function record(input: {
  readonly kind: OutboxKind;
  readonly ticketId: number;
  readonly path: string;
  readonly body: unknown;
  readonly dedupeKey: string;
}): Promise<number> {
  await ensureOutbox();
  const k = knex();
  const now = Date.now();
  const idem = randomUUID();
  const fields = {
    path: input.path,
    body: JSON.stringify(input.body),
    idem_key: idem,
    attempts: 0,
    // Leased to the first attempt, so the sweep leaves it alone meanwhile.
    next_attempt_at: now + LEASE_MS,
    last_status: null,
  };
  // The latest word wins: a value still waiting is replaced, not queued
  // behind. A new idem key means an in-flight older attempt that lands can
  // no longer mark this row delivered (see `attempt`).
  const replaced = await k(OUTBOX_TABLE)
    .where("dedupe_key", input.dedupeKey)
    .whereNull("delivered_at")
    .whereNull("failed_at")
    .update(fields);
  if (replaced > 0) {
    const row = await k(OUTBOX_TABLE).where("idem_key", idem).first("id");
    return Number(row.id);
  }
  const [id] = await k(OUTBOX_TABLE).insert({
    ...fields,
    kind: input.kind,
    ticket_id: input.ticketId,
    dedupe_key: input.dedupeKey,
    account_key: await accountKeyFor(input.ticketId),
    created_at: now,
  });
  return Number(id);
}

/** One delivery attempt for one row. Returns whether it landed. */
export async function attempt(id: number): Promise<boolean> {
  const cfg = deskConfig();
  if (cfg == null) {
    return false;
  }
  const k = knex();
  const row = (await k(OUTBOX_TABLE).where("id", id).first()) as
    | Row
    | undefined;
  if (row == null || row.delivered_at != null || row.failed_at != null) {
    return false;
  }
  let body: unknown;
  try {
    body = JSON.parse(row.body);
  } catch {
    await k(OUTBOX_TABLE)
      .where("id", id)
      .update({ failed_at: Date.now(), last_status: -1 });
    return false;
  }
  const result = await sendToDesk(row.path, body, cfg, {
    "idempotency-key": row.idem_key,
  });
  const now = Date.now();
  // Scoped to the key that was sent: if the row was replaced meanwhile, this
  // outcome is about a value nobody wants any more and must not settle it.
  const mine = () =>
    k(OUTBOX_TABLE).where("id", id).where("idem_key", row.idem_key);
  if (result.ok) {
    await mine().update({ delivered_at: now, last_status: result.status });
    return true;
  }
  const attempts = Number(row.attempts) + 1;
  const tooOld = now - Number(row.created_at) > giveUpMs();
  if (!retryable(result.status) || attempts >= MAX_ATTEMPTS || tooOld) {
    Logger.warn("qdesk-outbox: giving up on a forward", {
      kind: row.kind,
      ticketId: row.ticket_id,
      status: result.status,
      attempts,
    });
    await mine().update({
      failed_at: now,
      attempts,
      last_status: result.status,
    });
    return false;
  }
  await mine().update({
    attempts,
    last_status: result.status,
    next_attempt_at: now + backoffMs(attempts, result.retryAfterMs),
  });
  return false;
}

/**
 * The rows due now, chosen fairly: the oldest row of each account first,
 * one per account, then — only if there is room left — further rows in age
 * order. A backlog from a handful of accounts therefore takes a handful of
 * slots per pass, not all of them.
 */
export async function dueFairly(
  limit: number,
  now = Date.now(),
): Promise<number[]> {
  await ensureOutbox();
  const k = knex();
  const due = () =>
    k(OUTBOX_TABLE)
      .whereNull("delivered_at")
      .whereNull("failed_at")
      .where("next_attempt_at", "<=", now);
  const firstPerAccount = (await due()
    .clone()
    .select("account_key")
    .min({ id: "id" })
    .groupBy("account_key")
    .orderByRaw("min(id) asc")
    .limit(limit)) as { id: number | string }[];
  const chosen = firstPerAccount.map((r) => Number(r.id));
  if (chosen.length < limit) {
    const more = (await due()
      .clone()
      .select("id")
      .modify((q) => {
        if (chosen.length > 0) {
          q.whereNotIn("id", chosen);
        }
      })
      .orderBy("id", "asc")
      .limit(limit - chosen.length)) as { id: number | string }[];
    chosen.push(...more.map((r) => Number(r.id)));
  }
  return chosen;
}

/**
 * One pass of the drain. Each row is claimed by moving its lease forward
 * first, so a worker's immediate attempt and the sweep never send the same
 * row at the same moment. Returns how many were attempted.
 */
export async function drainOutbox(limit: number): Promise<number> {
  if (deskConfig() == null) {
    return 0;
  }
  const now = Date.now();
  const ids = await dueFairly(limit, now);
  const k = knex();
  let attempted = 0;
  for (const id of ids) {
    const claimed = await k(OUTBOX_TABLE)
      .where("id", id)
      .where("next_attempt_at", "<=", now)
      .whereNull("delivered_at")
      .whereNull("failed_at")
      .update({ next_attempt_at: now + LEASE_MS });
    if (claimed === 0) {
      continue;
    }
    // Reopened for this attempt: `attempt` reads the row fresh.
    await attempt(id);
    attempted += 1;
  }
  return attempted;
}

/** Forwards that will never be delivered now — for the staff digest. */
export async function outboxAbandoned(): Promise<number> {
  await ensureOutbox();
  const row = (await knex()(OUTBOX_TABLE)
    .whereNotNull("failed_at")
    .count({ n: "id" })
    .first()) as { n: number | string } | undefined;
  return Number(row?.n ?? 0);
}
