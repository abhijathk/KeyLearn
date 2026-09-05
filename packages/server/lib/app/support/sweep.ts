import { inject, injectable } from "@fastr/invert";
import { Env, listStaffEmails } from "@keylearn/config";
import {
  AccountDeletionRequest,
  Notification,
  StaffAuditEvent,
  StaffSettings,
  SupportMessage,
  SupportTicket,
} from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { siteNumber } from "@keylearn/site-config";
import { messageDailyDigest } from "../auth/email.ts";
import { Controller as AuthController } from "../auth/index.ts";
import { Mailer } from "../mail/index.ts";
import { emailStaffDigest } from "../site-config/readers.ts";
import { repeat } from "../site-config/repeat.ts";
import { forwardResolutionToQdesk } from "./qdesk-forward.ts";
import { QdeskRetrySweep } from "./qdesk-retry.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long an unconfirmed holding-queue ticket is kept before it's dropped. */
export function holdingDays(): number {
  // env → site_config → default (control centre, retention.holdingQueueDays).
  return siteNumber("retention.holdingQueueDays");
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
  return siteNumber("ops.digestHour");
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
    if (!emailStaffDigest()) {
      return false;
    }
    if (nowDate.getHours() < digestHour() || this.#lastSentDay === today) {
      return false;
    }
    try {
      const since = new Date(now - 24 * 60 * 60 * 1000);
      const [ticketsCreated, agentReplies, flagged, frustrated, undelivered] =
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
          // Customer messages that have not reached the desk. Nothing else
          // says this out loud: the retry sweep keeps trying quietly, and
          // the customer sees one tick rather than two — which tells them
          // something, and tells staff nothing at all.
          SupportMessage.query()
            .whereNull("deliveredAt")
            .where("sender", "them")
            .where("createdAt", ">=", new Date(now - 7 * DAY_MS))
            .resultSize(),
        ]);
      const abandoned = await QdeskRetrySweep.abandoned();
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
              undelivered,
              abandoned,
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
        undelivered,
        abandoned,
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
      // Control centre, ops.idleCloseDays (moved out of StaffSettings).
      const idleDays = siteNumber("ops.idleCloseDays");
      if (idleDays <= 0) {
        return 0;
      }
      const cutoff = now - idleDays * DAY_MS;
      const candidates = await SupportTicket.query()
        .whereIn("status", ["open", "waiting"])
        .whereNot("archived", true)
        // Never a business enquiry. Auto-close exists for a support
        // question that has run its course; a partnership or licensing
        // approach going quiet means nobody here has answered it yet,
        // and closing it turns that into a decision the company never
        // consciously made.
        .whereNot("kind", "business");
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
        // The desk is told, same as every other resolution. Without this
        // an auto-close left the two copies disagreeing indefinitely: shut
        // here, still sitting in someone's queue there, with no event
        // anywhere to explain the discrepancy. Fire-and-forget, like every
        // other forward — the sweep must not fail on an unreachable desk.
        forwardResolutionToQdesk(ticket.id!, true);
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

/**
 * How often the close-confirmation sweep looks.
 *
 * Four hours rather than daily, and the reason is the reminder rather than
 * the close. A daily sweep would fire the reminder at whatever time of day
 * the server last restarted — three in the morning, for as long as that
 * process lives. Looking more often, and letting `closeRemindedAt` decide
 * whether anything is actually sent, keeps the *nudge* daily while letting
 * it land at a more or less sane hour relative to when the desk asked.
 */
export function closeConfirmSweepIntervalMs(): number {
  return Env.getNumber("CLOSE_CONFIRM_SWEEP_HOURS", 4) * 60 * 60 * 1000;
}

/**
 * Chases the "is this sorted?" question the desk asked, and eventually
 * answers it on the learner's behalf.
 *
 * Two jobs on one pass, because they are the same query:
 *
 *  - **Remind**, at most once a day, while the window is open. The learner
 *    already has the question in the thread and a badge on the bell; this
 *    is a second and third nudge for someone who has not been back.
 *  - **Close**, once the window has run out, with a system line in the
 *    thread saying so and a notification saying so — because a thread that
 *    closes itself in silence is indistinguishable from one that was
 *    ignored.
 *
 * Silence taken as consent is a real decision, and the honest defence of it
 * is that the alternative is worse: threads that nobody can ever close pile
 * up in front of the people who could be answering the next question. The
 * window is a site setting (`ops.closeConfirmDays`, three days by default),
 * the learner is told the deadline before it passes, and a closed ticket
 * costs them a new conversation rather than anything irreversible.
 *
 * Guests get neither the reminder nor the notice — both are account
 * surfaces. Their window still runs; they were told in the thread.
 */
@injectable({ singleton: true })
export class CloseConfirmSweep {
  #timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.#timer != null) {
      return;
    }
    const interval = closeConfirmSweepIntervalMs();
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, interval);
    this.#timer.unref?.();
    Logger.info("Close-confirmation sweep scheduled", {
      everyHours: interval / (60 * 60 * 1000),
    });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** One pass. Returns what it did, so a test can assert on both halves. */
  async runOnce(
    now: number = Date.now(),
  ): Promise<{ readonly closed: number; readonly reminded: number }> {
    let closed = 0;
    let reminded = 0;
    try {
      const days = siteNumber("ops.closeConfirmDays");
      const pending = await SupportTicket.query()
        .whereNotNull("closeRequestedAt")
        // Belt and braces. `setStatus` clears the request on every
        // transition, so a pending ticket should always be open — but this
        // sweep closes things, and a query that trusts an invariant is one
        // refactor away from closing a conversation somebody is mid-way
        // through.
        .whereIn("status", ["open", "waiting", "flagged"])
        .whereNot("archived", true);

      for (const ticket of pending) {
        const askedAt = new Date(ticket.closeRequestedAt!).getTime();
        const dueAt = askedAt + days * DAY_MS;

        if (now >= dueAt) {
          await ticket.setStatus("closed");
          await SupportMessage.create({
            ticketId: ticket.id!,
            sender: "system",
            body: `Closed automatically after ${days} ${days === 1 ? "day" : "days"} without a reply. Send a new message any time \u2014 quote this ticket\u2019s number and we\u2019ll pick up where this left off.`,
          });
          // The desk asked; the desk is told what the answer turned out to
          // be. Fire-and-forget, like every other forward.
          forwardResolutionToQdesk(ticket.id!, true);
          await this.#notify(ticket, "ticket-auto-closed", CLOSED_NOTE);
          closed++;
          continue;
        }

        // Not due yet — nudge, but not twice in a day, and never on the
        // same pass that asked.
        const lastNudge =
          ticket.closeRemindedAt != null
            ? new Date(ticket.closeRemindedAt).getTime()
            : askedAt;
        if (now - lastNudge < DAY_MS) {
          continue;
        }
        const hoursLeft = Math.round((dueAt - now) / (60 * 60 * 1000));
        await this.#notify(
          ticket,
          "ticket-close-confirm",
          hoursLeft <= 24
            ? "This conversation closes tomorrow unless you tell us it is not sorted."
            : `This conversation closes in ${Math.round(hoursLeft / 24)} days unless you tell us it is not sorted.`,
        );
        await ticket.markCloseReminded();
        reminded++;
      }
      if (closed > 0 || reminded > 0) {
        Logger.info("Close-confirmation sweep finished", { closed, reminded });
      }
    } catch (err: any) {
      Logger.warn(err, "Close-confirmation sweep failed");
    }
    return { closed, reminded };
  }

  /**
   * Best-effort, and deliberately not fatal: the thread carries the same
   * information, and failing to raise a badge must never leave a ticket
   * half-closed.
   */
  async #notify(
    ticket: SupportTicket,
    kind: "ticket-close-confirm" | "ticket-auto-closed",
    body: string,
  ): Promise<void> {
    if (ticket.userId == null) {
      return;
    }
    try {
      await Notification.create({
        userId: ticket.userId,
        kind,
        ticketId: ticket.id!,
        body,
        authorName: null,
        fromAssistant: false,
      });
    } catch {
      // See doc comment.
    }
  }
}

const CLOSED_NOTE =
  "This conversation closed itself because nobody replied. Start a new one if it turns out not to be sorted.";

/** How often the sweep checks for a request whose 48-hour window has closed. */
export function accountDeletionSweepIntervalMs(): number {
  return siteNumber("ops.deletionSweepMin") * 60 * 1000;
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
  #timer: (() => void) | null = null;

  constructor(readonly authController: AuthController) {}

  start(): void {
    if (this.#timer != null) {
      return;
    }
    // Re-read each tick: the period is a control-centre setting.
    this.#timer = repeat(
      accountDeletionSweepIntervalMs,
      () => void this.runOnce(),
    );
    Logger.info("Account deletion sweep scheduled", {
      everyMinutes: accountDeletionSweepIntervalMs() / (60 * 1000),
    });
  }

  stop(): void {
    if (this.#timer != null) {
      this.#timer();
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

/**
 * How long staff audit rows are kept. 0 keeps them forever, which is the
 * shipped value: the log had no retention at all before this, and the
 * control centre (spec §6.2, `retention.staffAuditDays`) is where a window
 * gets chosen. The learner-facing sign-in history already ages out at 30
 * days; this is the staff-side counterpart, deliberately separate because
 * accountability for staff actions is worth keeping longer than a
 * household's sign-in trail.
 */
export function staffAuditRetentionDays(): number {
  // env → site_config → default, in that order; see the store in
  // @keylearn/site-config for why env wins.
  return siteNumber("retention.staffAuditDays");
}

/**
 * Ages the staff audit log out past its retention window, once a day in the
 * cluster's primary, same as the other sweeps in this file. Does nothing
 * while the window is 0.
 */
@injectable({ singleton: true })
export class StaffAuditSweep {
  #timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.#timer != null) {
      return;
    }
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, DAY_MS);
    this.#timer.unref?.();
    const days = staffAuditRetentionDays();
    Logger.info("Staff audit sweep scheduled", {
      retentionDays: days > 0 ? days : "forever",
    });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** One pass. Returns how many rows were dropped. */
  async runOnce(now: number = Date.now()): Promise<number> {
    try {
      const dropped = await StaffAuditEvent.deleteExpired(
        staffAuditRetentionDays() * DAY_MS,
        now,
      );
      if (dropped > 0) {
        Logger.info("Staff audit sweep dropped %d expired rows", dropped);
      }
      return dropped;
    } catch (err: any) {
      Logger.warn(err, "Staff audit sweep failed");
      return 0;
    }
  }
}
