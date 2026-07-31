import { injectable } from "@fastr/invert";
import { Env } from "@keybr/config";
import { Profile, User } from "@keybr/database";
import { Logger } from "@keybr/logger";
import { PublicId } from "@keybr/publicid";
import { UserDataFactory } from "@keybr/result-userdata";
import { Notifier } from "./notify.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long someone must have been away before a nudge is warranted. */
export function quietDays(): number {
  return Env.getNumber("REMINDER_AFTER_DAYS", 3);
}

/** How often the sweep looks. Daily is plenty for a weekly-or-rarer email. */
export function sweepIntervalMs(): number {
  return Env.getNumber("REMINDER_SWEEP_HOURS", 24) * 60 * 60 * 1000;
}

/**
 * Sends practice reminders to accounts that have stopped practising.
 *
 * Runs in the cluster's primary process, which is otherwise idle after forking
 * the workers — so this never competes with a request, and it runs exactly once
 * per deployment rather than once per worker.
 *
 * "When did this learner last practise" is answered by the modification time of
 * their stats file rather than by parsing it. The file is appended to every
 * time a lesson is recorded, so its mtime IS the answer, and reading a
 * directory entry costs nothing next to decoding every result a household has
 * ever produced.
 *
 * This class decides only WHO has been away and for how long. Whether an email
 * is actually wanted — the opt-out, the chosen frequency, the gap since the
 * last nudge — belongs to {@link Notifier}, which owns those preferences.
 */
@injectable({ singleton: true })
export class ReminderSweep {
  #timer: NodeJS.Timeout | null = null;

  constructor(
    readonly notifier: Notifier,
    readonly userData: UserDataFactory,
  ) {}

  /** Begins the daily sweep. Safe to call once per process. */
  start(): void {
    if (this.#timer != null) {
      return;
    }
    const interval = sweepIntervalMs();
    // A restart must not trigger a burst: the first sweep waits, and the
    // Notifier's own frequency gap means even a restart loop cannot re-send.
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, interval);
    // Never hold the process open for the sake of a reminder.
    this.#timer.unref?.();
    Logger.info("Practice reminder sweep scheduled", {
      everyHours: interval / (60 * 60 * 1000),
      afterDays: quietDays(),
    });
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /**
   * One pass. Returns how many reminders were actually sent, which is always
   * fewer than the number of lapsed accounts — the Notifier declines most of
   * them.
   */
  async runOnce(now: number = Date.now()): Promise<number> {
    let sent = 0;
    try {
      const users = await User.query()
        .where("emailVerified", true)
        .whereNotNull("email");
      for (const user of users) {
        try {
          const last = await this.#lastPractice(user, now);
          const days = Math.floor((now - last) / DAY_MS);
          if (days < quietDays()) {
            continue;
          }
          if (await this.notifier.practiceReminder(user, days, now)) {
            sent += 1;
          }
        } catch (err: any) {
          // One unreadable account must not stop the rest of the sweep.
          Logger.warn(
            err,
            "Could not consider user %s for a reminder",
            user.id,
          );
        }
      }
      Logger.info("Practice reminder sweep finished", {
        considered: users.length,
        sent,
      });
    } catch (err: any) {
      Logger.warn(err, "Practice reminder sweep failed");
    }
    return sent;
  }

  /**
   * When anyone in this household last practised.
   *
   * A household shares one email address, so any active learner should silence
   * the nudge for the account — reminding a parent to practise because their
   * child has not would be wrong on both counts.
   *
   * An account that has never practised falls back to when it was created, so
   * someone who signed up and never started still gets one nudge.
   */
  async #lastPractice(user: User, now: number): Promise<number> {
    let newest = 0;
    const consider = async (data: { file: { stat: () => Promise<any> } }) => {
      try {
        const stats = await data.file.stat();
        newest = Math.max(newest, stats.mtime.getTime());
      } catch {
        // No file yet — this learner has never practised.
      }
    };
    await consider(this.userData.load(new PublicId(user.id!)));
    for (const profile of await Profile.listForUser(user.id!)) {
      await consider(this.userData.loadProfile(user.id!, profile.id!));
    }
    if (newest === 0) {
      return user.createdAt != null ? new Date(user.createdAt).getTime() : now;
    }
    return newest;
  }
}
