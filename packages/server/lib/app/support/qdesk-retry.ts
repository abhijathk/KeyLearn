import { injectable } from "@fastr/invert";
import { Env } from "@keylearn/config";
import { SupportMessage, SupportTicket } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import {
  forwardReplyToQdesk,
  forwardTicketToQdesk,
  qdeskConfigured,
} from "./qdesk-forward.ts";

/**
 * Delivers what the first attempt could not.
 *
 * Forwarding to the desk is fire-and-forget on purpose — the desk being
 * down must never fail a customer's submission. But "fire and forget" was
 * literal: a failed forward was logged and abandoned, so a ten-minute
 * QDesk outage meant every ticket and reply raised in that window sat
 * here with `delivered_at` null and reached the desk *never*. The module
 * comment claimed "a missed forward means QDesk is behind, not that data
 * is lost", which is only true if something catches up afterwards. This
 * is that something.
 *
 * Retries are safe because both receiving endpoints are idempotent: the
 * ticket on `(app, externalId)`, the message on `(ticket,
 * externalMessageId)`. A delivery that actually landed but whose answer
 * was lost is recognised on the second attempt rather than duplicated in
 * front of a staff member.
 *
 * Runs in the cluster's primary, same as every other sweep here: once per
 * deployment, never competing with a request, and never two workers
 * re-sending the same message at the same moment.
 */

/** Long enough that a message still in its first attempt is left alone. */
export function retryAfterMs(): number {
  return Env.getNumber("QDESK_RETRY_AFTER_MINUTES", 5) * 60 * 1000;
}

/**
 * Past this, stop trying. Not because the message stops mattering, but
 * because something is wrong that retrying cannot fix, and a queue that
 * grinds on a permanently broken delivery hides that from whoever could.
 */
export function retryGiveUpMs(): number {
  return Env.getNumber("QDESK_RETRY_GIVE_UP_HOURS", 48) * 60 * 60 * 1000;
}

export function retryIntervalMs(): number {
  return Env.getNumber("QDESK_RETRY_SWEEP_MINUTES", 5) * 60 * 1000;
}

/** How many to attempt per pass, so a backlog cannot stampede the desk. */
export function retryBatchSize(): number {
  return Env.getNumber("QDESK_RETRY_BATCH", 50);
}

@injectable({ singleton: true })
export class QdeskRetrySweep {
  #timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.#timer != null) {
      return;
    }
    if (!qdeskConfigured()) {
      // No bridge configured means this repo is running standalone with
      // its own automation — nothing to catch up on.
      return;
    }
    const interval = retryIntervalMs();
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, interval);
    this.#timer.unref?.();
    Logger.info("QDesk retry sweep scheduled", {
      everyMinutes: interval / 60_000,
      retryAfterMinutes: retryAfterMs() / 60_000,
      giveUpHours: retryGiveUpMs() / 3_600_000,
    });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /**
   * One pass. Returns how many deliveries were attempted, which is what
   * the tests assert on — whether each one *lands* is the desk's answer,
   * recorded by `delivered_at` on the next pass.
   */
  async runOnce(): Promise<number> {
    if (!qdeskConfigured()) {
      return 0;
    }
    const now = Date.now();
    const stale = new Date(now - retryAfterMs());
    const tooOld = new Date(now - retryGiveUpMs());

    // Only the customer's own messages. A staff or agent reply travels the
    // other way, and a system note never leaves this repo at all.
    //
    // The confirmed-ticket filter is in the query rather than the loop
    // below, and that is not a tidiness point. The batch takes the oldest
    // rows first, so anything skipped after being selected still consumes
    // a slot — a backlog of rows that can never be sent would take the
    // whole batch every pass and starve every message behind it. Filtered
    // here, they are never selected at all.
    const pending = await SupportMessage.query()
      .whereNull("deliveredAt")
      .andWhere("sender", "them")
      .andWhere("createdAt", "<", stale)
      .andWhere("createdAt", ">", tooOld)
      .whereIn(
        "ticketId",
        SupportTicket.query().select("id").where("confirmed", true),
      )
      .orderBy("id", "asc")
      .limit(retryBatchSize());

    if (pending.length === 0) {
      return 0;
    }

    let attempted = 0;
    for (const message of pending) {
      // Confirmed by the query above; this only re-reads the row.
      const ticket = await SupportTicket.query().findById(message.ticketId!);
      if (ticket == null) {
        continue;
      }
      const first = await SupportMessage.query()
        .where("ticketId", ticket.id!)
        .andWhere("sender", "them")
        .orderBy("id", "asc")
        .first();

      if (first != null && first.id === message.id) {
        // The opening message: the ticket itself may never have arrived,
        // and posting a reply to a ticket the desk has never seen is a
        // 404 forever. Re-send the ticket, which is idempotent.
        forwardTicketToQdesk({
          id: ticket.id!,
          kind: (ticket.kind ?? "support") as "support" | "business",
          name: ticket.name!,
          email: ticket.email!,
          subject: ticket.subject!,
          message: ticket.message!,
          userId: ticket.userId ?? null,
          messageId: message.id!,
        });
      } else {
        forwardReplyToQdesk(ticket.id!, message.body!, message.id!);
      }
      attempted += 1;
    }

    Logger.info("QDesk retry sweep", { attempted, found: pending.length });
    return attempted;
  }

  /**
   * Deliveries this sweep has given up on — the ones a person needs to
   * know about, because nothing else will deliver them now.
   */
  static async abandoned(): Promise<number> {
    const tooOld = new Date(Date.now() - retryGiveUpMs());
    const rows = (await SupportMessage.query()
      .whereNull("deliveredAt")
      .andWhere("sender", "them")
      .andWhere("createdAt", "<", tooOld)
      .count({ n: "id" })) as unknown as { n: number }[];
    return Number(rows[0]?.n ?? 0);
  }
}
