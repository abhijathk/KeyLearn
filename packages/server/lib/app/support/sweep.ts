import { inject, injectable } from "@fastr/invert";
import { Env, listStaffEmails } from "@keylearn/config";
import {
  AccountDeletionRequest,
  StaffSettings,
  SupportMessage,
  SupportTicket,
} from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { messageDailyDigest } from "../auth/email.ts";
import { Controller as AuthController } from "../auth/index.ts";
import { Mailer } from "../mail/index.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long an unconfirmed holding-queue ticket is kept before it's dropped. */
export function holdingDays(): number {
  return Env.getNumber("HOLDING_QUEUE_DAYS", 7);
}

/** How often the sweep looks. Daily is plenty for a week-long window. */
export function holdingSweepIntervalMs(): number {
  return Env.getNumber("HOLDING_QUEUE_SWEEP_HOURS", 24) * 60 * 60 * 1000;
}

/**
 * Deletes holding-queue support tickets whose confirmation window has
 * lapsed — a signed-out submission sits there with an unverified email
 * address, so past the window it's discarded rather than kept forever.
 *
 * Runs in the cluster's primary process, same rationale as
 * {@link ReminderSweep} in `../mail/sweep.ts`: once per deployment, never
 * competing with a request.
 */
@injectable({ singleton: true })
export class HoldingQueueSweep {
  #timer: NodeJS.Timeout | null = null;

  /** Begins the daily sweep. Safe to call once per process. */
  start(): void {
    if (this.#timer != null) {
      return;
    }
    const interval = holdingSweepIntervalMs();
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, interval);
    // Never hold the process open for the sake of a cleanup sweep.
    this.#timer.unref?.();
    Logger.info("Holding-queue sweep scheduled", {
      everyHours: interval / (60 * 60 * 1000),
      afterDays: holdingDays(),
    });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** One pass. Returns how many holding-queue tickets were deleted. */
  async runOnce(now: number = Date.now()): Promise<number> {
    try {
      const olderThan = new Date(now - holdingDays() * DAY_MS);
      const deleted = await SupportTicket.deleteExpiredHolding(olderThan);
      Logger.info("Holding-queue sweep finished", { deleted });
      return deleted;
    } catch (err: any) {
      Logger.warn(err, "Holding-queue sweep failed");
      return 0;
    }
  }
}

/** The hour (server-local) the daily digest goes out. */
export function digestHour(): number {
  return Env.getNumber("DIGEST_HOUR", 8);
}

/**
 * One email a day, to every `STAFF_EMAILS` address — deliberately not an
 * LLM call. Every figure in it (tickets in, replies sent, flags, frustrated
 * reads) is a plain count already sitting in the database; asking a model
 * to reword numbers it didn't compute would cost a Groq call for no
 * benefit, and the one place a hallucination risk is least welcome is a
 * staff-facing status report about the automation itself.
 *
 * Same primary-process, once-per-deployment rationale as
 * {@link HoldingQueueSweep} — checks hourly for whether today's digest
 * hour has arrived and hasn't been sent yet, rather than trying to land a
 * `setInterval` on an exact wall-clock hour.
 */
@injectable({ singleton: true })
export class DigestSweep {
  #timer: NodeJS.Timeout | null = null;
  #lastSentDay: string | null = null;

  constructor(
    @inject("canonicalUrl") readonly canonicalUrl: string,
    readonly mailer: Mailer,
  ) {}

  start(): void {
    if (this.#timer != null) {
      return;
    }
    this.#timer = setInterval(
      () => {
        void this.runOnce();
      },
      60 * 60 * 1000,
    );
    this.#timer.unref?.();
    Logger.info("Daily digest sweep scheduled", { hour: digestHour() });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** One check. Sends (and returns true) only once per calendar day, at or after {@link digestHour}. */
  async runOnce(now: number = Date.now()): Promise<boolean> {
    const nowDate = new Date(now);
    const today = nowDate.toISOString().slice(0, 10);
    if (nowDate.getHours() < digestHour() || this.#lastSentDay === today) {
      return false;
    }
    try {
      const since = new Date(now - 24 * 60 * 60 * 1000);
      const [ticketsCreated, agentReplies, flagged, frustrated] =
        await Promise.all([
          SupportTicket.query().where("createdAt", ">=", since).resultSize(),
          SupportMessage.query()
            .where("sender", "agent")
            .where("createdAt", ">=", since)
            .resultSize(),
          SupportTicket.query()
            .where("status", "flagged")
            .where("updatedAt", ">=", since)
            .resultSize(),
          SupportTicket.query()
            .where("sentiment", "frustrated")
            .where("updatedAt", ">=", since)
            .resultSize(),
        ]);
      const deskLink = String(new URL("/desk", this.canonicalUrl));
      await Promise.all(
        listStaffEmails().map((to) =>
          this.mailer.sendMail(
            messageDailyDigest({
              to,
              date: nowDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              }),
              ticketsCreated,
              agentReplies,
              flagged,
              frustrated,
              deskLink,
            }),
          ),
        ),
      );
      this.#lastSentDay = today;
      Logger.info("Daily digest sent", {
        ticketsCreated,
        agentReplies,
        flagged,
        frustrated,
      });
      return true;
    } catch (err: any) {
      Logger.warn(err, "Daily digest sweep failed");
      return false;
    }
  }
}

/** How often the idle-ticket close sweep looks. Daily, same cadence as the holding queue. */
export function idleCloseSweepIntervalMs(): number {
  return Env.getNumber("IDLE_CLOSE_SWEEP_HOURS", 24) * 60 * 60 * 1000;
}

/**
 * Closes open/waiting tickets nobody has touched in a while — reads the
 * threshold from `StaffSettings.siteDefault().autoCloseIdleDays`, same
 * unsophisticated shared-setting convention as confidenceThreshold/
 * overdueHours. 0 (the default) means the setting is off and this sweep is
 * a no-op every run rather than something that needs disabling separately.
 *
 * "Idle" is measured from the last message in the thread, not the ticket's
 * own `updatedAt` — replies live in `SupportMessage`, a separate table that
 * doesn't touch the ticket row, so `updatedAt` alone would under-count how
 * recently a thread was actually active.
 */
@injectable({ singleton: true })
export class IdleTicketCloseSweep {
  #timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.#timer != null) {
      return;
    }
    const interval = idleCloseSweepIntervalMs();
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, interval);
    this.#timer.unref?.();
    Logger.info("Idle-ticket close sweep scheduled", {
      everyHours: interval / (60 * 60 * 1000),
    });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** One pass. Returns how many idle tickets were closed (0 while the setting is off). */
  async runOnce(now: number = Date.now()): Promise<number> {
    try {
      const siteSettings = await StaffSettings.siteDefault();
      const idleDays = siteSettings.autoCloseIdleDays ?? 0;
      if (idleDays <= 0) {
        return 0;
      }
      const cutoff = now - idleDays * DAY_MS;
      const candidates = await SupportTicket.query()
        .whereIn("status", ["open", "waiting"])
        .whereNot("archived", true);
      let closed = 0;
      for (const ticket of candidates) {
        const lastMessage = await SupportMessage.query()
          .where("ticketId", ticket.id!)
          .orderBy("createdAt", "desc")
          .first();
        const lastActivity = new Date(
          lastMessage?.createdAt ?? ticket.createdAt!,
        ).getTime();
        if (lastActivity > cutoff) {
          continue;
        }
        await ticket.setStatus("closed");
        await SupportMessage.create({
          ticketId: ticket.id!,
          sender: "system",
          body: `Automatically closed after ${idleDays} days of inactivity.`,
        });
        closed++;
      }
      if (closed > 0) {
        Logger.info("Idle-ticket close sweep finished", { closed, idleDays });
      }
      return closed;
    } catch (err: any) {
      Logger.warn(err, "Idle-ticket close sweep failed");
      return 0;
    }
  }
}

/** How often the sweep checks for a request whose 48-hour window has closed. */
export function accountDeletionSweepIntervalMs(): number {
  return Env.getNumber("ACCOUNT_DELETION_SWEEP_MINUTES", 60) * 60 * 1000;
}

/**
 * Carries out staff-initiated account deletions once their 48-hour
 * cooling-off window closes — the account holder's own notice email (sent
 * the moment the request was made, see `messageAccountDeletionRequested`)
 * is their chance to cancel it; nothing further is emailed here, this
 * sweep just quietly does what was already announced.
 *
 * DI-injects the SAME `AuthController` instance the self-service `/account`
 * deletion route uses (`import { Controller as AuthController } from
 * "../auth/index.ts"`, the same alias `routes.ts` itself uses) rather than
 * duplicating the erasure logic — one way an account goes away.
 */
@injectable({ singleton: true })
export class AccountDeletionSweep {
  #timer: NodeJS.Timeout | null = null;

  constructor(readonly authController: AuthController) {}

  start(): void {
    if (this.#timer != null) {
      return;
    }
    const interval = accountDeletionSweepIntervalMs();
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, interval);
    this.#timer.unref?.();
    Logger.info("Account deletion sweep scheduled", {
      everyMinutes: interval / (60 * 1000),
    });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** One pass. Returns how many accounts were deleted. */
  async runOnce(now: number = Date.now()): Promise<number> {
    let deleted = 0;
    try {
      const due = await AccountDeletionRequest.listDue(new Date(now));
      for (const request of due) {
        try {
          await this.authController.deleteAccountById(request.userId!, {
            keepStats: Boolean(request.keepStats),
          });
          await request.markCompleted();
          deleted++;
        } catch (err: any) {
          Logger.warn(
            err,
            "Account deletion failed for request %d",
            request.id!,
          );
        }
      }
      if (deleted > 0) {
        Logger.info("Account deletion sweep finished", { deleted });
      }
      return deleted;
    } catch (err: any) {
      Logger.warn(err, "Account deletion sweep failed");
      return deleted;
    }
  }
}
