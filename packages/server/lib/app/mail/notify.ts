import { inject, injectable } from "@fastr/invert";
import { maskEmail, User } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { SettingsDatabase } from "@keylearn/settings-database";
import {
  messagePracticeReminder,
  messageProductNews,
  messageSecurityAlert,
} from "../auth/email.ts";
import { Mailer } from "./types.ts";

// These keys mirror `accountProps` in page-account/lib/prefs.ts. The
// preferences live in the account's synced settings blob, so the server reads
// them from the same place the UI writes them.
const PREF_REMINDERS = "account.emailReminders";
const PREF_FREQUENCY = "account.reminderFrequency";
const PREF_NEWS = "account.emailProductNews";
const PREF_NEWS_LEVEL = "account.newsLevel";

/**
 * How long a nudged account is left alone afterwards. These are the values
 * behind the three choices in Preferences; anything unrecognised falls back to
 * weekly, so a corrupted setting errs towards fewer emails, not more.
 */
const REMINDER_GAP_MS: Record<string, number> = {
  "few-days": 3 * 24 * 60 * 60 * 1000,
  "weekly": 7 * 24 * 60 * 60 * 1000,
  "monthly": 30 * 24 * 60 * 60 * 1000,
};
const DEFAULT_GAP_MS = REMINDER_GAP_MS.weekly;

/** What counts as news. "major" is the default when news is switched on. */
export type NewsLevel = "major" | "all";

function boolPref(
  prefs: Record<string, unknown>,
  key: string,
  fallback: boolean,
) {
  const value = prefs[key];
  return typeof value === "boolean" ? value : fallback;
}

function strPref(
  prefs: Record<string, unknown>,
  key: string,
  fallback: string,
) {
  const value = prefs[key];
  return typeof value === "string" && value !== "" ? value : fallback;
}

/**
 * Sends the account-level emails, honouring what each household asked for.
 *
 * The three categories are deliberately not equal:
 *
 *  - Security alerts always send. They exist to reach someone who did NOT do
 *    the thing being reported, so letting an attacker silence them by flipping a
 *    preference would defeat the point.
 *  - Practice reminders and product news are opt-in-able and every message
 *    carries a way back to the setting.
 *
 * Nothing here is allowed to throw into a request: an email that fails to send
 * must never turn a successful password change into an error.
 */
@injectable({ singleton: true })
export class Notifier {
  constructor(
    readonly mailer: Mailer,
    readonly settings: SettingsDatabase,
    @inject("canonicalUrl") readonly canonicalUrl: string,
  ) {}

  #link(path: string): string {
    return String(new URL(path, this.canonicalUrl));
  }

  /** The account's saved preferences, or nothing if they cannot be read. */
  async #prefs(userId: number): Promise<Record<string, unknown>> {
    try {
      const settings = await this.settings.get(userId);
      return (settings?.toJSON() ?? {}) as Record<string, unknown>;
    } catch (err: any) {
      Logger.warn(err, "Could not read notification preferences");
      return {};
    }
  }

  /**
   * Reports a security-relevant change. Always sent, never awaited by the
   * caller's happy path.
   */
  securityAlert(
    user: User,
    event: string,
    {
      ip = null,
      device = null,
    }: { ip?: string | null; device?: string | null } = {},
  ): void {
    const email = user.email;
    if (email == null) {
      return;
    }
    void (async () => {
      try {
        await this.mailer.sendMail(
          messageSecurityAlert({
            email,
            event,
            when: new Date().toUTCString(),
            ip,
            device,
            manageLink: this.#link("/account#security"),
          }),
        );
      } catch (err: any) {
        Logger.warn(
          err,
          "Could not send security alert to '%s'",
          maskEmail(email),
        );
      }
    })();
  }

  /**
   * The practice nudge. Silently does nothing if the account opted out, or if
   * the last nudge is more recent than the chosen frequency allows.
   *
   * `now` is a parameter so the gap can be tested without waiting a month.
   */
  async practiceReminder(
    user: User,
    days: number,
    now: number = Date.now(),
  ): Promise<boolean> {
    const email = user.email;
    if (email == null) {
      return false;
    }
    const prefs = await this.#prefs(user.id!);
    if (!boolPref(prefs, PREF_REMINDERS, true)) {
      return false;
    }
    const gap =
      REMINDER_GAP_MS[strPref(prefs, PREF_FREQUENCY, "weekly")] ??
      DEFAULT_GAP_MS;
    const last = user.remindedAt;
    if (last != null && now - new Date(last).getTime() < gap) {
      return false;
    }
    try {
      await this.mailer.sendMail(
        messagePracticeReminder({
          email,
          name: user.name ?? "there",
          days,
          practiceLink: this.#link("/"),
          settingsLink: this.#link("/account#prefs"),
        }),
      );
      // Stamped only after the send succeeded, so a mail outage does not burn
      // someone's monthly slot on an email they never received.
      await User.query()
        .findById(user.id!)
        .patch({ remindedAt: new Date(now) } as any);
      return true;
    } catch (err: any) {
      Logger.warn(
        err,
        "Could not send practice reminder to '%s'",
        maskEmail(email),
      );
      return false;
    }
  }

  /**
   * Product news. Opt-IN — the default is off, and stays off unless asked.
   *
   * `level` describes the announcement, not the reader: send "major" for a
   * release worth interrupting anyone over, "all" for the smaller things that
   * only reach accounts asking for everything.
   */
  async productNews(
    user: User,
    {
      title,
      body,
      link = null,
      level = "major",
    }: {
      title: string;
      body: string;
      link?: string | null;
      level?: NewsLevel;
    },
  ): Promise<boolean> {
    const email = user.email;
    if (email == null) {
      return false;
    }
    const prefs = await this.#prefs(user.id!);
    if (!boolPref(prefs, PREF_NEWS, false)) {
      return false;
    }
    if (level === "all" && strPref(prefs, PREF_NEWS_LEVEL, "major") !== "all") {
      return false;
    }
    try {
      await this.mailer.sendMail(
        messageProductNews({
          email,
          title,
          body,
          link,
          settingsLink: this.#link("/account#prefs"),
        }),
      );
      return true;
    } catch (err: any) {
      Logger.warn(err, "Could not send product news to '%s'", maskEmail(email));
      return false;
    }
  }
}
